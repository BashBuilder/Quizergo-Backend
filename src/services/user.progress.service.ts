import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

type QuizAnswerCreatePayload = Prisma.QuizAnswerCreateWithoutQuizResultInput;

export class UserProgressService {
  async saveResult(userId: string, result: QuizResultReturnType) {
    if (!result.breakdown?.length) return;
    // mockId is unique per subject, not globally, so scope the lookup by subject.
    const dbQuestions = await prisma.question.findMany({
      where: {
        OR: result.breakdown.map((group) => ({
          subject: group.subject,
          mockId: { in: group.questions.map((q) => q.questionId) },
        })),
      },
      select: { id: true, mockId: true, subject: true },
    });
    const questionKey = (subject: string, mockId: number) =>
      `${subject}:${mockId}`;
    // Imported questions may have no mockId (NULL); they cannot be matched
    // against ALOC question ids, so leave them out of the lookup.
    const questionToUuid = new Map(
      dbQuestions.flatMap((q) =>
        q.mockId === null
          ? []
          : [[questionKey(q.subject, q.mockId), q.id] as const],
      ),
    );
    const answerPayloads: QuizAnswerCreatePayload[] = result.breakdown.flatMap(
      (group) =>
        group.questions
          .filter((q) => questionToUuid.has(questionKey(group.subject, q.questionId))) // skip if question not in DB
          .map((q) => ({
            question: {
              connect: {
                id: questionToUuid.get(questionKey(group.subject, q.questionId))!,
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
