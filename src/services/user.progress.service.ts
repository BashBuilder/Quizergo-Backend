import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

type QuizAnswerCreatePayload = Prisma.QuizAnswerCreateWithoutQuizResultInput;

export class UserProgressService {
  async saveResult(userId: string, result: QuizResultReturnType) {
    if (!result.breakdown?.length) return;
    // Breakdown ids are Question.id now that questions come from the database.
    const answerPayloads: QuizAnswerCreatePayload[] = result.breakdown.flatMap(
      (group) =>
        group.questions.map((q) => ({
          question: {
            connect: {
              id: q.questionId,
            },
          },
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
