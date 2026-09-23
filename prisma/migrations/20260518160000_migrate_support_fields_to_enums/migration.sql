-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('WEB', 'TELEGRAM', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('USER', 'STAFF', 'INTERNAL');

-- Drop Index if it exists
DROP INDEX IF EXISTS "Ticket_source_idx";

-- AlterTable (Safe conversion of Ticket columns)
ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus" USING "status"::"TicketStatus";
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'OPEN';
ALTER TABLE "Ticket" ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "Ticket" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "source" TYPE "TicketSource" USING "source"::"TicketSource";
ALTER TABLE "Ticket" ALTER COLUMN "source" SET DEFAULT 'WEB';
ALTER TABLE "Ticket" ALTER COLUMN "source" SET NOT NULL;

-- AlterTable (Safe conversion of TicketMessage column)
ALTER TABLE "TicketMessage" ALTER COLUMN "sender" TYPE "MessageSender" USING "sender"::"MessageSender";
ALTER TABLE "TicketMessage" ALTER COLUMN "sender" SET NOT NULL;

-- Recreate index
CREATE INDEX "Ticket_source_idx" ON "Ticket"("source");
