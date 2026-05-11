/*
  Warnings:

  - Changed the type of `status` on the `KeyStore` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "KeyStore" DROP COLUMN "status",
ADD COLUMN     "status" "KeyStatus" NOT NULL;
