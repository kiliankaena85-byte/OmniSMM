-- AlterTable
ALTER TABLE "Commission" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "LedgerEntry" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "charge" SET DATA TYPE BIGINT,
ALTER COLUMN "providerCost" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "avgResponseMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorCount5m" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "balance" SET DATA TYPE BIGINT,
ALTER COLUMN "quarantineBalance" SET DATA TYPE BIGINT,
ALTER COLUMN "totalSpent" SET DATA TYPE BIGINT;

-- CreateIndex
CREATE INDEX "AnalyticsEvent_event_idx" ON "AnalyticsEvent"("event");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
