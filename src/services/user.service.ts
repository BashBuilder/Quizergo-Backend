import { prisma } from "../config/prisma.js";

export const getUserQuizHistory = async (userId: string) => {
  try {
    const userHistory = await prisma.quizResult.findMany({
      where: {
        userId,
      },
    });

    return userHistory;
  } catch (error) {
    throw error;
  }
};
