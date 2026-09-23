-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "robokassaWebhookPassword" TEXT;

-- CreateIndex
CREATE INDEX "LedgerEntry_adminId_createdAt_idx" ON "LedgerEntry"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "Service_externalId_idx" ON "Service"("externalId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");
