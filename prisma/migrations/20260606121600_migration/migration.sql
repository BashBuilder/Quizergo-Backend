/*
  Warnings:

  - The `breakdown` column on the `QuizResult` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "QuizResult" DROP COLUMN "breakdown",
ADD COLUMN     "breakdown" JSONB[];
