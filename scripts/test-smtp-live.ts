import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import { SettingsProvider } from "@/lib/settings";
import nodemailer from "nodemailer";

async function main() {
  console.log("=== 1. Checking SystemSettings in DB ===");
  const allSettings = await db.systemSettings.findMany();
  for (const s of allSettings) {
    console.log(`Setting ID: ${s.id}`);
    console.log(`  emailProvider: ${s.emailProvider}`);
    console.log(`  smtpHost: ${s.smtpHost}`);
    console.log(`  smtpPort: ${s.smtpPort}`);
    console.log(`  smtpUser: ${s.smtpUser}`);
    console.log(`  has smtpPassword in DB: ${!!s.smtpPassword}`);
  }

  console.log("\n=== 2. Resolving Email Settings via SettingsProvider ===");
  const emailSettings = await SettingsProvider.getEmailSettings("smmplan");
  console.log("Resolved Settings:");
  console.log(`  provider: ${emailSettings.emailProvider}`);
  console.log(`  host: ${emailSettings.smtpHost}`);
  console.log(`  port: ${emailSettings.smtpPort}`);
  console.log(`  user: ${emailSettings.smtpUser}`);
  console.log(`  pass length: ${emailSettings.smtpPassword ? emailSettings.smtpPassword.length : 0}`);
  console.log(`  pass starts with: ${emailSettings.smtpPassword ? emailSettings.smtpPassword.substring(0, 3) + "***" : "none"}`);

  if (!emailSettings.smtpHost || !emailSettings.smtpUser || !emailSettings.smtpPassword) {
    console.error("❌ SMTP credentials incomplete!");
    process.exit(1);
  }

  console.log("\n=== 3. Testing SMTP Connection (transporter.verify) ===");
  const transporter = nodemailer.createTransport({
    host: emailSettings.smtpHost,
    port: emailSettings.smtpPort,
    secure: emailSettings.smtpPort === 465,
    auth: {
      user: emailSettings.smtpUser,
      pass: emailSettings.smtpPassword,
    },
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });

  try {
    const verified = await transporter.verify();
    console.log("✅ SMTP Transporter VERIFIED successfully:", verified);
  } catch (err: any) {
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

main().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});