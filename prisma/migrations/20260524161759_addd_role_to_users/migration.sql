-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('STUDENT', 'ADMIN', 'TEACHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Roles" NOT NULL DEFAULT 'STUDENT';
