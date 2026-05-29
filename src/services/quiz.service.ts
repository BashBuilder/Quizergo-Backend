import redisClient from "../cache/index.js";
import eventEmitter from "../config/events.js";
import { BadRequestError, ValidationError } from "../lib/errors.js";
import { AlocQuestionService } from "./aloc.question.service.js";
import { v4 as uuidv4 } from "uuid";

const QUESTIONS_TTL = 60 * 60 * 24;
export class QuizSessionService {
  private alocService = new AlocQuestionService();
  private sanitizeQuestions(questions: AlocQuestionType[]) {
    return questions.map(({ answer, solution, ...q }) => q);
  }

  // Cache questions per subject (shared across users)
  private async getCachedQuestions(
    subject: string,
  ): Promise<AlocQuestionType[] | null> {
    const key = `questions:subject:${subject}`;
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async cacheQuestions(subject: string, questions: AlocQuestionType[]) {
    const key = `questions:subject:${subject}`;
    await redisClient.setEx(key, QUESTIONS_TTL, JSON.stringify(questions));
  }

  async createSession(
    userId: string,
    config: {
      subjects: string[];
      questionCount: number;
      duration?: number;
      retake?: boolean;
    },
  ) {
    const sessionId = uuidv4();
    const SESSION_TTL = config.duration ? (config.duration + 5) * 60 * 1000 : 0;
    const allQuestions: QuizQuestionsType[] = [];
    const sanitizedQuestions = [];
    for (const subject of config.subjects) {
      if (config.retake) {
        const cached = await this.getCachedQuestions(subject);
        if (cached) {
          const cachedQuestions = cached.sort(() => Math.random() - 0.5);
          const sanitized = this.sanitizeQuestions(cachedQuestions);
          allQuestions.push({
            subject,
            questions: cachedQuestions,
          });
          sanitizedQuestions.push({
            subject,
            questions: sanitized,
          });
          continue;
        }
      }
      const res = await this.alocService.getQuestionsBySubject(
        subject,
        config.questionCount,
      );
      let questions = res.data.sort(() => Math.random() - 0.5);
      const sanitized = this.sanitizeQuestions(questions);
      await this.cacheQuestions(subject, questions);
      allQuestions.push({
        subject,
        questions,
      });
      sanitizedQuestions.push({
        subject,
        questions: sanitized,
      });
    }
    const sessionData = {
      sessionId,
      userId,
      config,
      questions: allQuestions,
      answers: [] as AnswersType[],
      startedAt: Date.now(),
      expiresAt: config.duration
        ? Date.now() + config.duration * 60 * 1000
        : null,
      submitted: false,
    };
    await redisClient.setEx(
      `session:${sessionId}`,
      SESSION_TTL,
      JSON.stringify(sessionData),
    );
    eventEmitter.emit("quiz.session.created", sessionData);
    return {
      sessionId,
      totalQuestions: allQuestions.length,
      duration: config.duration ?? null,
      expiresAt: sessionData.expiresAt,
      questions: sanitizedQuestions,
    };
  }

  async getSession(sessionId: string) {
    const data = await redisClient.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }
  async removeSession(sessionId: string) {
    const data = await redisClient.del(`session:${sessionId}`);
    return data ? data : "Session removed";
  }

  async syncAnswers(sessionId: string, userId: string, answers: AnswersType[]) {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error("Session not found or expired");
    if (session.userId !== userId) throw new Error("Unauthorized");
    if (session.submitted) throw new Error("Session already submitted");

    session.answers = answers;
    session.lastSyncedAt = Date.now();

    await redisClient.setEx(
      `session:${sessionId}`,
      session.expiresAt - Date.now() + 5 * 60 * 1000,
      JSON.stringify(session),
    );
    return {
      synced: Object.keys(answers).length,
      total: Object.keys(session.answers).length,
    };
  }

  async gradeSession(
    sessionId: string,
    userId: string,
    finalAnswers: Record<number, string>,
  ) {
    const session = await this.getSession(sessionId);
    if (!session) throw new ValidationError("Session not found or expired");
    if (session.userId !== userId)
      throw new ValidationError("Unauthorized submittion");
    if (session.submitted) throw new ValidationError("Already submitted");

    const allAnswers: AnswersType[] = finalAnswers
      ? finalAnswers
      : session.answers;
    const questions: QuizQuestionsType[] = session.questions;

    let correct: { subject: string; count: number }[] = [];
    let incorrect: { subject: string; count: number }[] = [];
    let skipped: { subject: string; count: number }[] = [];

    const breakdown = allAnswers
      .map((group) => {
        const subject = group.subject;
        const answers = group.answers;
        const currentQuestion = questions.find((q) => q.subject === subject);

        const breakdown = Object.keys(answers)
          .map((id) => {
            const num = Number(id);
            const answer = answers[num];
            const question = currentQuestion?.questions.find(
              (q) => q.id === num,
            );
            let status = "";
            if (!question) {
              return undefined;
            }
            if (!answer) {
              status = "skipped";
              const currentSkipped = skipped.find(
                (skip) => skip.subject === subject,
              );
              currentSkipped
                ? (currentSkipped.count += 1)
                : skipped.push({ subject, count: 1 });
            }
            if (
              question.answer.toLowerCase().trim() ===
              answer?.toLowerCase().trim()
            ) {
              status = "correct";
              const currentCorrect = correct.find(
                (correct) => correct.subject === subject,
              );
              currentCorrect
                ? (currentCorrect.count += 1)
                : correct.push({ subject, count: 1 });
            } else {
              status = "incorrect";
              const currentIncorrect = incorrect.find(
                (incorrect) => incorrect.subject === subject,
              );
              currentIncorrect
                ? (currentIncorrect.count += 1)
                : incorrect.push({ subject, count: 1 });
            }
            return {
              questionId: num,
              question: question.question,
              userAnswer: answer,
              correctAnswer: question.answer,
              solution: question.solution,
              status,
            };
          })
          .filter(
            (
              item,
            ): item is {
              questionId: number;
              question: string;
              userAnswer: string | undefined;
              correctAnswer: string;
              solution: string;
              status: string;
            } => item !== undefined,
          );

        return {
          subject,
          questions: breakdown,
        };
      })
      .filter(Boolean);

    const total = questions.reduce(
      (acc, current) => acc + current.questions.length,
      0,
    );
    const score = correct.reduce(
      (accumulator, current) => accumulator + current.count,
      0,
    );
    const timeTaken = Math.round((Date.now() - session.startedAt) / 1000);

    const result: QuizResultReturnType = {
      sessionId,
      score,
      correct,
      incorrect,
      skipped,
      total,
      timeTaken,
      breakdown,
      submittedAt: Date.now(),
    };

    session.submitted = true;
    session.result = result;
    await this.removeSession(sessionId);

    return result;
  }
}
