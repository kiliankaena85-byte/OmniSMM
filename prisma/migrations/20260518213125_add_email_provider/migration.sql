-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "emailProvider" TEXT NOT NULL DEFAULT 'SMTP',
ADD COLUMN     "resendApiKey" TEXT;
