import { db } from '../src/lib/db';
import { SettingsProvider } from '../src/lib/settings';
import nodemailer from 'nodemailer';

async function main() {
  console.log('=== EMAIL & SMTP CONFIGURATION AUDIT ===\n');

  // 1. Settings in DB for all tenants
  const allSettings = await db.systemSettings.findMany({
    select: {
      id: true,
      siteName: true,
      emailProvider: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassword: true,
      resendApiKey: true,
      supportEmailDomain: true,
    }
  });

  console.log(`Found ${allSettings.length} SystemSettings in DB:`);
  for (const s of allSettings) {
    console.log(` - Tenant [${s.id}] (${s.siteName}):`);
    console.log(`   * emailProvider: ${s.emailProvider}`);
    console.log(`   * smtpHost: ${s.smtpHost}`);
    console.log(`   * smtpPort: ${s.smtpPort}`);
    console.log(`   * smtpUser: ${s.smtpUser}`);
    console.log(`   * hasSmtpPassword: ${Boolean(s.smtpPassword)}`);
    console.log(`   * hasResendApiKey: ${Boolean(s.resendApiKey)}`);
  }

  // 2. Decrypted settings via SettingsProvider
  for (const t of ['smmplan', 'flux']) {
    console.log(`\nDecrypted settings for '${t}':`);
    try {
      const emailSettings = await SettingsProvider.getEmailSettings(t);
      console.log({
        emailProvider: emailSettings.emailProvider,
        smtpHost: emailSettings.smtpHost,
        smtpPort: emailSettings.smtpPort,
        smtpUser: emailSettings.smtpUser,
        hasPassword: Boolean(emailSettings.smtpPassword),
        passwordPreview: emailSettings.smtpPassword ? `${emailSettings.smtpPassword.slice(0, 3)}***` : null,
        hasResendKey: Boolean(emailSettings.resendApiKey),
      });

      // 3. Test actual SMTP connection
      if (emailSettings.smtpHost && emailSettings.smtpUser && emailSettings.smtpPassword) {
        console.log(`\nTesting SMTP Connection to ${emailSettings.smtpHost}:${emailSettings.smtpPort}...`);
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
        } as any);

        try {
          await transporter.verify();
          console.log('✅ SMTP Connection verified successfully!');
        } catch (connErr: any) {
          console.error('❌ SMTP Connection verification failed:', connErr.message || connErr);
        }
      } else {
        console.log('⚠️ SMTP credentials not fully configured (host, user, or password missing).');
      }
    } catch (err: any) {
      console.error(`Error resolving settings for ${t}:`, err.message || err);
    }
  }

  // 4. Check AuthToken table for recent magic links
  const recentTokens = await db.authToken.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } }
  });
  console.log(`\nRecent AuthTokens in DB (${recentTokens.length}):`);
  for (const t of recentTokens) {
    console.log(` - User: ${t.user.email} | Created: ${t.createdAt} | Expires: ${t.expiresAt} | IP: ${t.ipIssued}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
