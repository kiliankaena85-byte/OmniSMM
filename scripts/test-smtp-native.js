// Mock server-only for standalone script execution
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'server-only') return {};
  return originalRequire.apply(this, arguments);
};

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');

async function main() {
  console.log("=== 1. Checking SystemSettings in DB ===");
  const allSettings = await prisma.systemSettings.findMany();
  for (const s of allSettings) {
    console.log(`Setting ID: ${s.id}`);
    console.log(`  emailProvider: ${s.emailProvider}`);
    console.log(`  smtpHost: ${s.smtpHost}`);
    console.log(`  smtpPort: ${s.smtpPort}`);
    console.log(`  smtpUser: ${s.smtpUser}`);
    console.log(`  has smtpPassword in DB: ${!!s.smtpPassword}`);
  }

  console.log("\n=== 2. Checking Environment Variables ===");
  console.log(`  SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`  SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`  SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`  SMTP_PASS: ${process.env.SMTP_PASS ? process.env.SMTP_PASS.substring(0, 3) + '***' : 'none'}`);
  console.log(`  SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? process.env.SMTP_PASSWORD.substring(0, 3) + '***' : 'none'}`);

  const host = process.env.SMTP_HOST || 'smtp.yandex.ru';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'infosokoloff@yandex.ru';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  console.log(`\n=== 3. Testing SMTP Connection to ${host}:${port} as ${user} ===`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });

  try {
    const verified = await transporter.verify();
    console.log("✅ SMTP Transporter VERIFIED successfully:", verified);
  } catch (err) {
    console.error("❌ SMTP Verification FAILED:", err.message);
    console.error("Full error details:", {
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
      command: err.command
    });
  }

  process.exit(0);
}

main().catch(console.error);