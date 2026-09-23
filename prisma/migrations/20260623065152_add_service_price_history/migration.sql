-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "ticketUrl" TEXT;

-- CreateTable
CREATE TABLE "ServicePriceHistory" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePriceHistory_serviceId_idx" ON "ServicePriceHistory"("serviceId");

-- CreateIndex
CREATE INDEX "ServicePriceHistory_createdAt_idx" ON "ServicePriceHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
