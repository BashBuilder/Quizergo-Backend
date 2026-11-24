-- Imported questions no longer carry an external mockId; it stays NULL.
-- The previous unique index still allows multiple NULL values.
ALTER TABLE "Question" ALTER COLUMN "mockId" DROP NOT NULL;
