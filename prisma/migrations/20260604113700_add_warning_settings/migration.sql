-- AlterTable
ALTER TABLE "Category" ADD COLUMN "requireWarning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "warningMessage" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "requireWarning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "warningMessage" TEXT;
