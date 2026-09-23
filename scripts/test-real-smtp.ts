import { sendMail } from '../src/lib/smtp';
import { SettingsProvider } from '../src/lib/settings';

async function testRealSmtp() {
  console.log('📧 [SMTP TEST] Initializing real SMTP delivery test...');

  const emailSettings = await SettingsProvider.getEmailSettings();
  console.log('⚙️ Email Settings:', {
    provider: emailSettings.emailProvider,
    smtpHost: emailSettings.smtpHost,
    smtpPort: emailSettings.smtpPort,
    smtpUser: emailSettings.smtpUser,
    hasPassword: !!emailSettings.smtpPassword,
  });

  const testRecipient = emailSettings.smtpUser || 'infosokoloff@yandex.ru';
  console.log(`📤 Sending test email to: ${testRecipient}...`);

  const success = await sendMail(
    testRecipient,
    'SMMplan Omni-Channel Test: Проверка почтовой доставки',
    `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5;">🚀 Omni-Channel Поддержка SMMplan</h2>
        <p>Это автоматическое тестовое письмо для проверки работы почтового транспорта.</p>
        <p><strong>Время отправки:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        <p><strong>Маршрут:</strong> SMMplan Core ➔ Yandex SMTP (${emailSettings.smtpHost}:${emailSettings.smtpPort}) ➔ ${testRecipient}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">Поддержка работает в omni-режиме (Telegram + Email + Web Dashboard).</p>
      </div>
    `,
    'support+test-ticket-123@smmplan.pro'
  );

  console.log(`\n🎉 [RESULT] Email delivery success: ${success}`);
}

testRealSmtp().catch(console.error);
