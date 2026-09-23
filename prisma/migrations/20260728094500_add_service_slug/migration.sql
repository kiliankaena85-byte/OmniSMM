-- AlterTable
ALTER TABLE "Service" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Service_tenantId_slug_key" ON "Service"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Service_slug_idx" ON "Service"("slug");
