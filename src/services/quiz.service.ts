// import redisClient from "../cache/index.js";
// import eventEmitter from "../config/events.js";
// import { ValidationError } from "../lib/errors.js";
// import { AlocQuestionService } from "./aloc.question.service.js";
// import { v4 as uuidv4 } from "uuid";

// const QUESTIONS_TTL = 60 * 60 * 24;
// export class QuizSessionService {
//   private alocService = new AlocQuestionService();
//   private sanitizeQuestions(questions: AlocQuestionType[]) {
//     return questions.map(({ answer, solution, ...q }) => q);
//   }
//   private async getCachedQuestions(
//     subject: string,
//   ): Promise<AlocQuestionType[] | null> {
//     const key = `questions:subject:${subject}`;
//     const cached = await redisClient.get(key);
//     return cached ? JSON.parse(cached) : null;
//   }
//   private async cacheQuestions(subject: string, questions: AlocQuestionType[]) {
//     const key = `questions:subject:${subject}`;
//     await redisClient.setEx(key, QUESTIONS_TTL, JSON.stringify(questions));
//   }

//   async createSession(
//     userId: string,
//     config: {
//       subjects: string[];
//       questionCount: number;
//       duration?: number;
//       retake?: boolean;
//     },
//   ) {
//     const sessionId = uuidv4();
//     const SESSION_TTL = config.duration ? (config.duration + 5) * 60 : 0;
//     const allQuestions: QuizQuestionsType[] = [];
//     const sanitizedQuestions = [];
//     for (const subject of config.subjects) {
//       if (config.retake) {
//         const cached = await this.getCachedQuestions(subject);
//         if (cached) {
//           const cachedQuestions = cached.sort(() => Math.random() - 0.5);
//           const sanitized = this.sanitizeQuestions(cachedQuestions);
//           allQuestions.push({
//             subject,
//             questions: cachedQuestions,
//           });
//           sanitizedQuestions.push({
//             subject,
//             questions: sanitized,
//           });
//           continue;
//         }
//       }
//       const res = await this.alocService.getQuestionsBySubject(
//         subject,
//         config.questionCount,
//       );
//       let questions = res.data.sort(() => Math.random() - 0.5);
//       const sanitized = this.sanitizeQuestions(questions);
//       await this.cacheQuestions(subject, questions);
//       allQuestions.push({
//         subject,
//         questions,
//       });
//       sanitizedQuestions.push({
//         subject,
//         questions: sanitized,
//       });
//     }
//     const sessionData = {
//       sessionId,
//       userId,
//       config,
//       questions: allQuestions,
//       answers: [] as AnswersType[],
//       startedAt: Date.now(),
//       expiresAt: config.duration
//         ? Date.now() + config.duration * 60 * 1000
//         : null,
//       submitted: false,
//     };
//     await redisClient.setEx(
//       `session:${sessionId}`,
//       SESSION_TTL,
//       JSON.stringify(sessionData),
//     );
//     eventEmitter.emit("quiz.session.created", sessionData);
//     return {
//       sessionId,
//       totalQuestions: allQuestions.length,
//       duration: config.duration ?? null,
//       expiresAt: sessionData.expiresAt,
//       questions: sanitizedQuestions,
//     };
//   }

//   async getSession(sessionId: string) {
//     const data = await redisClient.get(`session:${sessionId}`);
//     const ttl = await redisClient.ttl(`session:${sessionId}`);
//     return data && ttl ? { ...JSON.parse(data), ttl } : null;
//   }
//   async removeSession(sessionId: string) {
//     const data = await redisClient.del(`session:${sessionId}`);
//     return data ? data : "Session removed";
//   }

//   async syncAnswers(sessionId: string, userId: string, answers: AnswersType[]) {
//     const session = await this.getSession(sessionId);
//     if (!session) throw new ValidationError("Session not found or expired");
//     if (session.userId !== userId) throw new ValidationError("Unauthorized");
//     if (session.submitted)
//       throw new ValidationError("Session already submitted");

//     session.answers = answers;
//     session.lastSyncedAt = Date.now();

//     await redisClient.setEx(
//       `session:${sessionId}`,
//       session.ttl,
//       JSON.stringify(session),
//     );
//     return {
//       synced: Object.keys(answers).length,
//       total: Object.keys(session.answers).length,
//     };
//   }

//   async gradeSession(
//     sessionId: string,
//     userId: string,
//     finalAnswers: AnswersType[] | null,
//   ) {
//     const session = await this.getSession(sessionId);
//     if (!session) throw new ValidationError("Session not found or expired");
//     if (session.userId !== userId)
//       throw new ValidationError("Unauthorized submittion");
//     if (session.submitted) throw new ValidationError("Already submitted");

//     const allAnswers: AnswersType[] = finalAnswers
//       ? finalAnswers
//       : session.answers;
//     const questions: QuizQuestionsType[] = session.questions;

//     let correct: { subject: string; count: number }[] = [];
//     let incorrect: { subject: string; count: number }[] = [];
//     let skipped: { subject: string; count: number }[] = [];

//     const breakdown = allAnswers
//       .map((group) => {
//         const subject = group.subject;
//         const answers = group.answers;
//         const currentQuestion = questions.find((q) => q.subject === subject);

//         const breakdown = Object.keys(answers)
//           .map((id) => {
//             const num = Number(id);
//             const answer = answers[num];
//             const question = currentQuestion?.questions.find(
//               (q) => q.id === num,
//             );
//             let status = "";
//             if (!question) {
//               return undefined;
//             }
//             if (!answer) {
//               status = "skipped";
//               const currentSkipped = skipped.find(
//                 (skip) => skip.subject === subject,
//               );
//               currentSkipped
//                 ? (currentSkipped.count += 1)
//                 : skipped.push({ subject, count: 1 });
//             }
//             if (
//               question.answer.toLowerCase().trim() ===
//               answer?.toLowerCase().trim()
//             ) {
//               status = "correct";
//               const currentCorrect = correct.find(
//                 (correct) => correct.subject === subject,
//               );
//               currentCorrect
//                 ? (currentCorrect.count += 1)
//                 : correct.push({ subject, count: 1 });
//             } else {
//               status = "incorrect";
//               const currentIncorrect = incorrect.find(
//                 (incorrect) => incorrect.subject === subject,
//               );
//               currentIncorrect
//                 ? (currentIncorrect.count += 1)
//                 : incorrect.push({ subject, count: 1 });
//             }
//             return {
//               questionId: num,
//               question: question.question,
//               userAnswer: answer,
//               correctAnswer: question.answer,
//               solution: question.solution,
//               status,
//             };
//           })
//           .filter(
//             (
//               item,
//             ): item is {
//               questionId: number;
//               question: string;
//               userAnswer: string | undefined;
//               correctAnswer: string;
//               solution: string;
//               status: string;
//             } => item !== undefined,
//           );

//         return {
//           subject,
//           questions: breakdown,
//         };
//       })
//       .filter(Boolean);

//     const total = questions.reduce(
//       (acc, current) => acc + current.questions.length,
//       0,
//     );
//     const score = correct.reduce(
//       (accumulator, current) => accumulator + current.count,
//       0,
//     );
//     const timeTaken = Math.round((Date.now() - session.startedAt) / 1000);

//     const result: QuizResultReturnType = {
//       sessionId,
//       score,
//       correct,
//       incorrect,
//       skipped,
//       total,
//       timeTaken,
//       breakdown,
//       submittedAt: Date.now(),
//     };

//     session.submitted = true;
//     session.result = result;
//     await this.removeSession(sessionId);

//     return result;
//   }
// }


// services/quiz.service.ts
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

  private async getCachedQuestions(subject: string): Promise<AlocQuestionType[] | null> {
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
    const sanitizedQuestions: Array<{ subject: string; questions: Omit<AlocQuestionType, 'answer' | 'solution'>[] }> = [];

    for (const subject of config.subjects) {
      let questions: AlocQuestionType[] | null = null;

      if (config.retake) {
        questions = await this.getCachedQuestions(subject);
      }

      if (!questions) {
        const res = await this.alocService.getQuestionsBySubject(subject, config.questionCount);
        questions = res.data;
        await this.cacheQuestions(subject, questions);
      }

      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      const sliced = shuffled.slice(0, config.questionCount);
      const sanitized = this.sanitizeQuestions(sliced);

      allQuestions.push({ subject, questions: sliced });
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

    eventEmitter.emit("quiz.session.created", sessionData);

    return {
      sessionId,
      totalQuestions: allQuestions.reduce((acc, g) => acc + g.questions.length, 0),
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
    if (session.submitted) throw new ValidationError("Session already submitted");

    // Merge per-subject answers rather than replace
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

    const total = existing.reduce((acc, g) => acc + Object.keys(g.answers).length, 0);
    return { synced: answers.length, total };
  }

  async gradeSession(
    sessionId: string,
    userId: string,
    finalAnswers: AnswersType[] | null,
  ): Promise<QuizResultReturnType> {
    const session = await this.getSession(sessionId);
    if (!session) throw new ValidationError("Session not found or expired");
    if (session.userId !== userId) throw new ValidationError("Unauthorized submission");
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

    // Iterate over ALL session questions (not just answered ones)
    for (const group of sessionQuestions) {
      const { subject, questions } = group;
      const answersForSubject = mergedAnswers.find((a) => a.subject === subject)?.answers ?? {};

      const groupBreakdown: BreakdownQuestion[] = questions.map((q) => {
        const userAnswer = answersForSubject[q.id]?.toLowerCase().trim() || null;
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

    const total = sessionQuestions.reduce((acc, g) => acc + g.questions.length, 0);
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

    // Clean up session from Redis
    await this.removeSession(sessionId);

    return result;
  }
}