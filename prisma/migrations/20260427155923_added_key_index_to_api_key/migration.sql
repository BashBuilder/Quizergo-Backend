-- DropIndex
DROP INDEX "ApiKey_id_version_idx";

-- CreateIndex
CREATE INDEX "ApiKey_id_version_key_idx" ON "ApiKey"("id", "version", "key");
