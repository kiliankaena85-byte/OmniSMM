-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Commission_orderId_referrerId_key" ON "Commission"("orderId", "referrerId");

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredDashboard" TEXT DEFAULT 'lovable';
