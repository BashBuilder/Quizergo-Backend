import redisClient from "../cache/index.js";
import eventEmitter from "../config/events.js";
import { ValidationError } from "../lib/errors.js";
import { AlocQuestionService } from "./aloc.question.service.js";
import { v4 as uuidv4 } from "uuid";

const QUESTIONS_TTL = 60 * 60 * 24;

export class QuizSessionService {
  private alocService = new AlocQuestionService();

  private sanitizeQuestions(questions: AlocQuestionType[]) {
    return questions.map(({ answer, solution, ...q }) => q);
  }

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
    const SESSION_TTL = config.duration ? (config.duration + 5) * 60 : 60 * 60;
    const allQuestions: QuizQuestionsType[] = [];
    const sanitizedQuestions: Array<{
      subject: string;
      questions: Omit<AlocQuestionType, "answer" | "solution">[];
    }> = [];

    for (const subject of config.subjects) {
      let questions: AlocQuestionType[] | null = null;

      if (config.retake) {
        questions = await this.getCachedQuestions(subject);
      }

      if (!questions) {
        const res = await this.alocService.getQuestionsBySubject(
          subject,
          config.questionCount,
        );
        questions = res.data;
        await this.cacheQuestions(subject, questions);
      }

      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      const sanitized = this.sanitizeQuestions(shuffled);

      allQuestions.push({ subject, questions: shuffled });
      sanitizedQuestions.push({ subject, questions: sanitized });
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

    return {
      sessionId,
      totalQuestions: allQuestions.reduce(
        (acc, g) => acc + g.questions.length,
        0,
      ),
      duration: config.duration ?? null,
      expiresAt: sessionData.expiresAt,
      questions: sanitizedQuestions,
    };
  }

  async getSession(sessionId: string) {
    const data = await redisClient.get(`session:${sessionId}`);
    const ttl = await redisClient.ttl(`session:${sessionId}`);
    return data && ttl > 0 ? { ...JSON.parse(data), ttl } : null;
  }

  async removeSession(sessionId: string) {
    await redisClient.del(`session:${sessionId}`);
  }

  async syncAnswers(sessionId: string, userId: string, answers: AnswersType[]) {
    const session = await this.getSession(sessionId);
    if (!session) throw new ValidationError("Session not found or expired");
    if (session.userId !== userId) throw new ValidationError("Unauthorized");
    if (session.submitted)
      throw new ValidationError("Session already submitted");

    const existing: AnswersType[] = session.answers ?? [];
    for (const incoming of answers) {
      const found = existing.find((a) => a.subject === incoming.subject);
      if (found) {
        found.answers = { ...found.answers, ...incoming.answers };
      } else {
        existing.push(incoming);
      }
    }

    session.answers = existing;
    session.lastSyncedAt = Date.now();

    await redisClient.setEx(
      `session:${sessionId}`,
      session.ttl,
      JSON.stringify(session),
    );

    const total = existing.reduce(
      (acc, g) => acc + Object.keys(g.answers).length,
      0,
    );
    return { synced: answers.length, total };
  }

  async gradeSession(
    sessionId: string,
    userId: string,
    finalAnswers: AnswersType[] | null,
  ): Promise<QuizResultReturnType> {
    const session = await this.getSession(sessionId);
    if (!session) throw new ValidationError("Session not found or expired");
    if (session.userId !== userId)
      throw new ValidationError("Unauthorized submission");
    if (session.submitted) throw new ValidationError("Already submitted");

    // Merge final answers over synced answers
    let mergedAnswers: AnswersType[] = session.answers ?? [];
    if (finalAnswers?.length) {
      for (const incoming of finalAnswers) {
        const found = mergedAnswers.find((a) => a.subject === incoming.subject);
        if (found) {
          found.answers = { ...found.answers, ...incoming.answers };
        } else {
          mergedAnswers.push(incoming);
        }
      }
    }

    const sessionQuestions: QuizQuestionsType[] = session.questions;

    const correct: { subject: string; count: number }[] = [];
    const incorrect: { subject: string; count: number }[] = [];
    const skipped: { subject: string; count: number }[] = [];
    const breakdown: BreakdownGroup[] = [];

    for (const group of sessionQuestions) {
      const { subject, questions } = group;
      const answersForSubject =
        mergedAnswers.find((a) => a.subject === subject)?.answers ?? {};

      const groupBreakdown: BreakdownQuestion[] = questions.map((q) => {
        const userAnswer =
          answersForSubject[q.id]?.toLowerCase().trim() || null;
        const correctAnswer = q.answer.toLowerCase().trim();

        let status: "correct" | "incorrect" | "skipped";

        if (!userAnswer) {
          status = "skipped";
          const entry = skipped.find((s) => s.subject === subject);
          entry ? entry.count++ : skipped.push({ subject, count: 1 });
        } else if (userAnswer === correctAnswer) {
          status = "correct";
          const entry = correct.find((c) => c.subject === subject);
          entry ? entry.count++ : correct.push({ subject, count: 1 });
        } else {
          status = "incorrect";
          const entry = incorrect.find((i) => i.subject === subject);
          entry ? entry.count++ : incorrect.push({ subject, count: 1 });
        }

        return {
          questionId: q.id, // mockId
          question: q.question,
          userAnswer,
          correctAnswer: q.answer,
          solution: q.solution ?? null,
          status,
        };
      });

      breakdown.push({ subject, questions: groupBreakdown });
    }

    const total = sessionQuestions.reduce(
      (acc, g) => acc + g.questions.length,
      0,
    );
    const scoreCount = correct.reduce((acc, c) => acc + c.count, 0);
    const timeTaken = Math.round((Date.now() - session.startedAt) / 1000);

    const result: QuizResultReturnType = {
      sessionId,
      score: scoreCount,
      total,
      correct,
      incorrect,
      skipped,
      timeTaken,
      breakdown,
      submittedAt: Date.now(),
    };

    await this.removeSession(sessionId);

    return result;
  }
}
