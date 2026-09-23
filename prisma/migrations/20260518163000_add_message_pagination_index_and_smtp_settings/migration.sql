-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN "smtpHost" TEXT,
ADD COLUMN "smtpPort" INTEGER NOT NULL DEFAULT 465,
ADD COLUMN "smtpUser" TEXT,
ADD COLUMN "smtpPassword" TEXT,
ADD COLUMN "supportEmailDomain" TEXT,
ADD COLUMN "contactSupportEmail" TEXT,
ADD COLUMN "contactPrivacyEmail" TEXT,
ADD COLUMN "contactTelegramBot" TEXT,
ADD COLUMN "contactTelegramChannel" TEXT,
ADD COLUMN "contactWhatsApp" TEXT,
ADD COLUMN "contactVk" TEXT,
ADD COLUMN "legalCompanyName" TEXT,
ADD COLUMN "legalCompanyInn" TEXT,
ADD COLUMN "legalCompanyOgrnip" TEXT,
ADD COLUMN "legalCompanyAddress" TEXT;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN "providerType" TEXT NOT NULL DEFAULT 'SMM_PANEL';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "providerCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "anomalyScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cooldownUntil" TIMESTAMP(3),
ADD COLUMN "cooldownReason" TEXT,
ADD COLUMN "targetType" TEXT NOT NULL DEFAULT 'POST',
ADD COLUMN "customDataType" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "isMediaGroupAware" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptId_key" ON "Payment"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_refundReceiptId_key" ON "Payment"("refundReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKeyHash_key" ON "User"("apiKeyHash");
