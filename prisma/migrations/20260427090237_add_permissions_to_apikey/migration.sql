-- CreateEnum
CREATE TYPE "Permissions" AS ENUM ('GENERAL', 'ADMIN');

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "permissions" "Permissions"[],

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
