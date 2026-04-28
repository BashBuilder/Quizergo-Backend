-- CreateTable
CREATE TABLE "KeyStore" (
    "id" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "primaryKey" TEXT NOT NULL,
    "secondaryKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeyStore_client_key" ON "KeyStore"("client");

-- CreateIndex
CREATE INDEX "KeyStore_client_primaryKey_secondaryKey_idx" ON "KeyStore"("client", "primaryKey", "secondaryKey");

-- AddForeignKey
ALTER TABLE "KeyStore" ADD CONSTRAINT "KeyStore_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
