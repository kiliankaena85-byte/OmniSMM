/*
  Warnings:

  - You are about to alter the column `amount` on the `PromoCode` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `LedgerEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- DropIndex
DROP INDEX "Payment_orderId_idx";

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "idempotencyKey" TEXT,
ALTER COLUMN "adminId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customData" TEXT,
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "waitingUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "consentIp" TEXT,
ADD COLUMN     "consentUserAgent" TEXT;

-- AlterTable
ALTER TABLE "PromoCode" ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "amount" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "features" JSONB,
ADD COLUMN     "isQuarantined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pendingRate" DOUBLE PRECISION,
ADD COLUMN     "pricePer1000Cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quarantineReason" TEXT,
ADD COLUMN     "quarantinedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "exchangeRateUSD" DOUBLE PRECISION NOT NULL DEFAULT 90.0,
ADD COLUMN     "exchangeRateUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "globalMarkup" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
ADD COLUMN     "quarantineThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
ADD COLUMN     "robokassaLogin" TEXT,
ADD COLUMN     "robokassaPassword" TEXT,
ADD COLUMN     "safetyFloor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "siteFaviconUrl" TEXT,
ADD COLUMN     "siteLogoUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "adminNoteUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "adminNoteUpdatedBy" TEXT,
ADD COLUMN     "discountEndsAt" TIMESTAMP(3),
ADD COLUMN     "staffRoleId" TEXT,
ADD COLUMN     "supportLastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "supportSpentTodayCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UrlPattern" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrlPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'OFF',
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UrlPattern_networkId_idx" ON "UrlPattern"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_name_key" ON "StaffRole"("name");

-- CreateIndex
CREATE INDEX "StaffPermission_roleId_idx" ON "StaffPermission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermission_roleId_section_key" ON "StaffPermission"("roleId", "section");

-- CreateIndex
CREATE INDEX "LoginLog_email_idx" ON "LoginLog"("email");

-- CreateIndex
CREATE INDEX "LoginLog_ipAddress_idx" ON "LoginLog"("ipAddress");

-- CreateIndex
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Service_isQuarantined_idx" ON "Service"("isQuarantined");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_staffRoleId_fkey" FOREIGN KEY ("staffRoleId") REFERENCES "StaffRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrlPattern" ADD CONSTRAINT "UrlPattern_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
