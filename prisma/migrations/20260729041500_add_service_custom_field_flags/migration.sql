-- AlterTable
ALTER TABLE "Service" ADD COLUMN "isCustomName" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isCustomDescription" BOOLEAN NOT NULL DEFAULT false;
