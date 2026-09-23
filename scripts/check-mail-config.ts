import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function checkSettings() {
  const s = await db.systemSettings.findUnique({ where: { id: 'global' } });
  if (!s) {
    console.log('❌ SystemSettings global не найден!');
    return;
  }

  console.log('=== ТЕКУЩАЯ КОНФИГУРАЦИЯ ПОЧТЫ ===');
  console.log('Email Provider:', s.emailProvider);
  console.log('SMTP Host:', s.smtpHost || '(не задан)');
  console.log('SMTP Port:', s.smtpPort);
  console.log('SMTP User:', s.smtpUser || '(не задан)');
  console.log('SMTP Password:', s.smtpPassword ? '(зашифрован в Vault)' : '(не задан)');
  console.log('Resend Key:', s.resendApiKey ? '(зашифрован в Vault)' : '(не задан)');
  console.log('Contact Support Email:', s.contactSupportEmail);
  console.log('Support Email Domain:', s.supportEmailDomain || '(не задан)');
  console.log('Inbound Webhook Secret:', s.inboundEmailWebhookSecret ? '(зашифрован в Vault)' : '(не задан)');
}

checkSettings().catch(console.error).finally(() => process.exit(0));
