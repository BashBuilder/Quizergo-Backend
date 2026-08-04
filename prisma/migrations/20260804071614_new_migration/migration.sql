/*
  Warnings:

  - You are about to drop the column `breakdown` on the `QuizResult` table. All the data in the column will be lost.
  - You are about to drop the column `correct` on the `QuizResult` table. All the data in the column will be lost.
  - You are about to drop the column `incorrect` on the `QuizResult` table. All the data in the column will be lost.
  - You are about to drop the column `skipped` on the `QuizResult` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `QuizResult` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sessionId]` on the table `QuizResult` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('CORRECT', 'INCORRECT', 'SKIPPED');

-- DropIndex
DROP INDEX "QuizResult_sessionId_idx";

-- AlterTable
ALTER TABLE "QuizResult" DROP COLUMN "breakdown",
DROP COLUMN "correct",
DROP COLUMN "incorrect",
DROP COLUMN "skipped",
DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "mockId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "questionNub" INTEGER,
    "hasPassage" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "options" JSONB NOT NULL,
    "solution" TEXT,
    "image" TEXT,
    "examType" TEXT,
    "examYear" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "quizResultId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userAnswer" TEXT,
    "status" "QuestionStatus" NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_mockId_key" ON "Question"("mockId");

-- CreateIndex
CREATE INDEX "Question_subject_idx" ON "Question"("subject");

-- CreateIndex
CREATE INDEX "Question_subject_topic_idx" ON "Question"("subject", "topic");

-- CreateIndex
CREATE INDEX "Question_subject_examYear_idx" ON "Question"("subject", "examYear");

-- CreateIndex
CREATE INDEX "Question_mockId_subject_idx" ON "Question"("mockId", "subject");

-- CreateIndex
CREATE INDEX "QuizAnswer_quizResultId_idx" ON "QuizAnswer"("quizResultId");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE INDEX "QuizAnswer_subject_idx" ON "QuizAnswer"("subject");

-- CreateIndex
CREATE INDEX "QuizAnswer_status_idx" ON "QuizAnswer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QuizResult_sessionId_key" ON "QuizResult"("sessionId");

-- CreateIndex
CREATE INDEX "QuizResult_submittedAt_idx" ON "QuizResult"("submittedAt");

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_quizResultId_fkey" FOREIGN KEY ("quizResultId") REFERENCES "QuizResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
