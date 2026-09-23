-- CreateTable
CREATE TABLE "ShadowService" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "category" TEXT,
    "rate" DOUBLE PRECISION NOT NULL,
    "rateRub" DOUBLE PRECISION NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "refill" BOOLEAN NOT NULL DEFAULT false,
    "cancel" BOOLEAN NOT NULL DEFAULT false,
    "dripfeed" BOOLEAN NOT NULL DEFAULT false,
    "cleanName" TEXT,
    "platform" TEXT,
    "normalizedCategory" TEXT,
    "targetType" TEXT NOT NULL DEFAULT 'POST',
    "customDataType" TEXT NOT NULL DEFAULT 'NONE',
    "isMediaGroupAware" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "warranty" INTEGER NOT NULL DEFAULT 0,
    "geo" TEXT,
    "velocity" INTEGER NOT NULL DEFAULT 0,
    "anomalyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShadowService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShadowService_providerId_idx" ON "ShadowService"("providerId");

-- CreateIndex
CREATE INDEX "ShadowService_platform_idx" ON "ShadowService"("platform");

-- CreateIndex
CREATE INDEX "ShadowService_normalizedCategory_idx" ON "ShadowService"("normalizedCategory");

-- CreateIndex
CREATE INDEX "ShadowService_rateRub_idx" ON "ShadowService"("rateRub");

-- CreateIndex
CREATE UNIQUE INDEX "ShadowService_providerId_externalId_key" ON "ShadowService"("providerId", "externalId");

-- AddForeignKey
ALTER TABLE "ShadowService" ADD CONSTRAINT "ShadowService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
