-- CreateEnum
CREATE TYPE "UsnScheme" AS ENUM ('INCOME', 'INCOME_EXPENSES');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('PAGE', 'ACADEMY_LESSON', 'GLOSSARY_TERM', 'NEWS_POST');

-- CreateEnum
CREATE TYPE "SmartCampaignStatus" AS ENUM ('PLANNED', 'RUNNING', 'PAUSED', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "SmartTaskStatus" AS ENUM ('PLANNED', 'SENT', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_CHECK';

-- DropIndex
DROP INDEX "AuthToken_token_idx";

-- DropIndex
DROP INDEX "PromoCode_code_idx";

-- DropIndex
DROP INDEX "User_apiKey_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isLinkOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "providerServiceId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "customDataLabel" TEXT,
ADD COLUMN     "etaP50Seconds" INTEGER,
ADD COLUMN     "etaP90Seconds" INTEGER,
ADD COLUMN     "etaSampleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "etaSpeedClass" TEXT,
ADD COLUMN     "etaUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "impersonatedBy" TEXT;

-- AlterTable
ALTER TABLE "SupportTemplate" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shortcut" TEXT,
ADD COLUMN     "useCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "usnScheme" "UsnScheme" NOT NULL DEFAULT 'INCOME_EXPENSES';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TicketMessage" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "originalText" TEXT,
ADD COLUMN     "replyToId" TEXT,
ADD COLUMN     "telegramMsgId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "apiKey",
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "inn" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kpp" TEXT,
ADD COLUMN     "legalAddress" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "B2bConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isB2b" BOOLEAN NOT NULL DEFAULT true,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "customLimitCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "actUrl" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRoute" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerServiceId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "failoverMode" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingAuditLog" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "fromProviderId" TEXT,
    "toProviderId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ContentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL DEFAULT 'PAGE',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "coverImage" TEXT,
    "contentJson" TEXT,
    "contentHtml" TEXT,
    "categoryId" TEXT,
    "authorName" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "readTimeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "SmartCampaignStatus" NOT NULL DEFAULT 'PLANNED',
    "link" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "isTestMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,

    CONSTRAINT "SmartCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartTask" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" "SmartTaskStatus" NOT NULL DEFAULT 'PLANNED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "providerId" TEXT,
    "externalOrderId" TEXT,
    "qtySent" INTEGER NOT NULL,
    "qtyDelivered" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSmartConfig" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isTestMode" BOOLEAN NOT NULL DEFAULT false,
    "minChunk" INTEGER NOT NULL DEFAULT 50,
    "maxChunk" INTEGER NOT NULL DEFAULT 200,
    "markup" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "providersPriority" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "useInviteBuffer" BOOLEAN NOT NULL DEFAULT false,
    "autoCompensate" BOOLEAN NOT NULL DEFAULT true,
    "checkIntervalMins" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSmartConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartChannelMetric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberCount" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "detectedDrops" INTEGER NOT NULL DEFAULT 0,
    "compensatedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SmartChannelMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartSnapshot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "members" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartDetectedUser" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartDetectedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL,
    "category" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT 'Михаил',
    "authorRole" TEXT NOT NULL DEFAULT 'Системный архитектор прокси-сетей Smmplan',
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "B2bConfig_userId_key" ON "B2bConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "ServiceRoute_serviceId_idx" ON "ServiceRoute"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceRoute_providerId_idx" ON "ServiceRoute"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRoute_serviceId_providerId_key" ON "ServiceRoute"("serviceId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCategory_slug_key" ON "ContentCategory"("slug");

-- CreateIndex
CREATE INDEX "ContentCategory_parentId_idx" ON "ContentCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_slug_key" ON "ContentItem"("slug");

-- CreateIndex
CREATE INDEX "ContentItem_type_idx" ON "ContentItem"("type");

-- CreateIndex
CREATE INDEX "ContentItem_slug_idx" ON "ContentItem"("slug");

-- CreateIndex
CREATE INDEX "ContentItem_categoryId_idx" ON "ContentItem"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartCampaign_orderId_key" ON "SmartCampaign"("orderId");

-- CreateIndex
CREATE INDEX "SmartCampaign_userId_idx" ON "SmartCampaign"("userId");

-- CreateIndex
CREATE INDEX "SmartCampaign_serviceId_idx" ON "SmartCampaign"("serviceId");

-- CreateIndex
CREATE INDEX "SmartCampaign_paymentId_idx" ON "SmartCampaign"("paymentId");

-- CreateIndex
CREATE INDEX "SmartTask_campaignId_idx" ON "SmartTask"("campaignId");

-- CreateIndex
CREATE INDEX "SmartTask_runAt_status_idx" ON "SmartTask"("runAt", "status");

-- CreateIndex
CREATE INDEX "SmartExecution_taskId_idx" ON "SmartExecution"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSmartConfig_serviceId_key" ON "ServiceSmartConfig"("serviceId");

-- CreateIndex
CREATE INDEX "SmartChannelMetric_campaignId_idx" ON "SmartChannelMetric"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_category_status_idx" ON "Article"("category", "status");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");

-- CreateIndex
CREATE INDEX "Order_serviceId_idx" ON "Order"("serviceId");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_paymentId_idx" ON "Order"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTemplate_shortcut_key" ON "SupportTemplate"("shortcut");

-- CreateIndex
CREATE INDEX "SupportTemplate_category_idx" ON "SupportTemplate"("category");

-- CreateIndex
CREATE INDEX "Ticket_paymentId_idx" ON "Ticket"("paymentId");

-- CreateIndex
CREATE INDEX "TicketMessage_telegramMsgId_idx" ON "TicketMessage"("telegramMsgId");

-- CreateIndex
CREATE INDEX "TicketMessage_orderId_idx" ON "TicketMessage"("orderId");

-- AddForeignKey
ALTER TABLE "B2bConfig" ADD CONSTRAINT "B2bConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "TicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRoute" ADD CONSTRAINT "ServiceRoute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRoute" ADD CONSTRAINT "ServiceRoute_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCategory" ADD CONSTRAINT "ContentCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCampaign" ADD CONSTRAINT "SmartCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCampaign" ADD CONSTRAINT "SmartCampaign_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCampaign" ADD CONSTRAINT "SmartCampaign_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCampaign" ADD CONSTRAINT "SmartCampaign_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartTask" ADD CONSTRAINT "SmartTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmartCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartExecution" ADD CONSTRAINT "SmartExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SmartTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartExecution" ADD CONSTRAINT "SmartExecution_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSmartConfig" ADD CONSTRAINT "ServiceSmartConfig_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartChannelMetric" ADD CONSTRAINT "SmartChannelMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmartCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartSnapshot" ADD CONSTRAINT "SmartSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmartCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
