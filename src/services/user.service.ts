import { prisma } from "../config/prisma.js";

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const getUserQuizHistory = async (
  userId: string,
  { page = 1, limit = 10 }: PaginationParams = {}
): Promise<PaginatedResult<any>> => {
  try {
    const skip = (page - 1) * limit;

    const [userHistory, total] = await Promise.all([
      prisma.quizResult.findMany({
        where: { userId },
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.quizResult.count({ where: { userId } }),
    ]);

    return {
      data: userHistory,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw error;
  }
};
