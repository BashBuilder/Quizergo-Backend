-- Additive migration for Qbot summary-based conversation memory.
-- Safe to apply to existing data: every new column is nullable or has a default.

-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN "summary" TEXT,
ADD COLUMN "summaryMessageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "summaryUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
