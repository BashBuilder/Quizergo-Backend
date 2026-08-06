import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

type QuizAnswerCreatePayload = Prisma.QuizAnswerCreateWithoutQuizResultInput;

export class UserProgressService {
  async saveResult(userId: string, result: QuizResultReturnType) {
    if (!result.breakdown?.length) return;
    const mockIds = result.breakdown.flatMap((group) =>
      group.questions.map((q) => q.questionId),
    );
    const dbQuestions = await prisma.question.findMany({
      where: { mockId: { in: mockIds } },
      select: { id: true, mockId: true },
    });
    const mockIdToUuid = new Map(dbQuestions.map((q) => [q.mockId, q.id]));

    // Build QuizAnswer create payloads
    const answerPayloads: QuizAnswerCreatePayload[] = result.breakdown.flatMap(
      (group) =>
        group.questions
          .filter((q) => mockIdToUuid.has(q.questionId)) // skip if question not in DB
          .map((q) => ({
            question: { connect: { id: mockIdToUuid.get(q.questionId)! } },
            subject: group.subject,
            userAnswer: q.userAnswer ?? null,
            status: q.status.toUpperCase() as
              | "CORRECT"
              | "INCORRECT"
              | "SKIPPED",
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
