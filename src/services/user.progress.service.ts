// // services/user.progress.service.ts

// import { prisma } from "../config/prisma.js";

// export class UserProgressService {
//   async saveResult(userId: string, result: QuizResultReturnType) {
//     if (!result.breakdown) return;
//     await prisma.quizResult.create({
//       data: {
//         userId,
//         sessionId: result.sessionId,
//         score: result.score,
//         correct: result.correct,
//         incorrect: result.incorrect,
//         skipped: result.skipped,
//         total: result.total,
//         timeTaken: result.timeTaken,
//         submittedAt: new Date(result.submittedAt),
//         breakdown: result.breakdown!,
//       },
//     });

//   }
// }

// services/user.progress.service.ts
import { prisma } from "../config/prisma.js";

export class UserProgressService {
  async saveResult(userId: string, result: QuizResultReturnType) {
    if (!result.breakdown?.length) return;

    // Collect all mockIds from breakdown
    const mockIds = result.breakdown.flatMap((group) =>
      group.questions.map((q) => q.questionId),
    );

    // Batch fetch Prisma Question records by mockId
    const dbQuestions = await prisma.question.findMany({
      where: { mockId: { in: mockIds } },
      select: { id: true, mockId: true },
    });

    // Build mockId -> prisma UUID map
    const mockIdToUuid = new Map(dbQuestions.map((q) => [q.mockId, q.id]));

    // Build QuizAnswer create payloads
    const answerPayloads = result.breakdown.flatMap((group) =>
      group.questions
        .filter((q) => mockIdToUuid.has(q.questionId)) // skip if question not in DB
        .map((q) => ({
          questionId: mockIdToUuid.get(q.questionId)!,
          subject: group.subject,
          userAnswer: q.userAnswer ?? null,
          status: q.status.toUpperCase() as "CORRECT" | "INCORRECT" | "SKIPPED",
          questionSnapshot: {
            question: q.question,
            correctAnswer: q.correctAnswer,
            solution: q.solution,
          },
        })),
    );

    await prisma.quizResult.create({
      data: {
        userId,
        sessionId: result.sessionId,
        score: result.score,
        total: result.total,
        timeTaken: result.timeTaken,
        submittedAt: new Date(result.submittedAt),
        answers: {
          create: answerPayloads,
        },
      },
    });
  }
}
