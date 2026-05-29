// services/user.progress.service.ts

import { prisma } from "../config/prisma.js";

export class UserProgressService {
  async saveResult(userId: string, result: QuizResultReturnType) {
    await prisma.quizResult.create({
      data: {
        userId,
        sessionId: result.sessionId,
        score: result.score,
        correct: result.correct,
        incorrect: result.incorrect,
        skipped: result.skipped,
        total: result.total,
        timeTaken: result.timeTaken,
        submittedAt: new Date(result.submittedAt),
        breakdown: result.breakdown,
      },
    });

    // Update user stats atomically
    // await prisma.userStats.upsert({
    //   where: { userId },
    //   create: {
    //     userId,
    //     totalSessions: 1,
    //     totalCorrect: result.correct,
    //     totalQuestions: result.total,
    //     bestScore: result.score,
    //     totalXp: this.calculateXp(result),
    //   },
    //   update: {
    //     totalSessions: { increment: 1 },
    //     totalCorrect: { increment: result.correct },
    //     totalQuestions: { increment: result.total },
    //     bestScore: { set: undefined }, // handled below
    //     totalXp: { increment: this.calculateXp(result) },
    //   },
    // });

    // Update best score separately if improved
    // await prisma.userStats.updateMany({
    //   where: { userId, bestScore: { lt: result.score } },
    //   data: { bestScore: result.score },
    // });

    // Update streak
    // await this.updateStreak(userId);
  }

  // private calculateXp(result: {
  //   score: number;
  //   total: number;
  //   timeTaken: number;
  // }) {
  //   const base = result.total * 6;
  //   const bonus = Math.round((result.score / 100) * result.total * 4);
  //   // Speed bonus: full marks if under 1 min per question
  //   const speedBonus = result.timeTaken < result.total * 60 ? 20 : 0;
  //   return base + bonus + speedBonus;
  // }

  // private async updateStreak(userId: string) {
  //   const today = new Date();
  //   today.setHours(0, 0, 0, 0);

  //   const stats = await prisma.userStats.findUnique({ where: { userId } });
  //   if (!stats) return;

  //   const lastActive = stats.lastActiveDate;
  //   const yesterday = new Date(today);
  //   yesterday.setDate(yesterday.getDate() - 1);

  //   const isConsecutive =
  //     lastActive &&
  //     new Date(lastActive).setHours(0, 0, 0, 0) === yesterday.getTime();
  //   const alreadyToday =
  //     lastActive &&
  //     new Date(lastActive).setHours(0, 0, 0, 0) === today.getTime();

  //   if (alreadyToday) return; // already counted today

  //   await prisma.userStats.update({
  //     where: { userId },
  //     data: {
  //       streak: isConsecutive ? { increment: 1 } : 1,
  //       lastActiveDate: today,
  //     },
  //   });
  // }
}
