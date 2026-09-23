-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "alfaBankAccountNumber" TEXT,
ADD COLUMN IF NOT EXISTS "alfaBankApiBaseUrl" TEXT DEFAULT 'https://business.alfabank.ru/ext-api/v1',
ADD COLUMN IF NOT EXISTS "alfaBankApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "alfaBankClientSecret" TEXT,
ADD COLUMN IF NOT EXISTS "alfaBankIsSandbox" BOOLEAN NOT NULL DEFAULT true;
