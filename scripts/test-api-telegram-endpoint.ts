import { SettingsProvider } from '../src/lib/settings';

async function testApiTelegramRedirect() {
  console.log('🔗 [TEST /api/support/telegram endpoint logic]');

  const contactSettings = await SettingsProvider.getContactAndLegalSettings('smmplan');
  let botUsername = contactSettings.TELEGRAM_SUPPORT_BOT;
  if (!botUsername || botUsername === 'smmplan_support_bot') {
    botUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_SUPPORT_BOT || 'SMMplansapport_bot';
  }

  const generatedUrl = `https://t.me/${botUsername}?start=support`;
  console.log('✅ Generated Anonymous Telegram URL:', generatedUrl);

  const isCorrect = generatedUrl === 'https://t.me/SMMplansapport_bot?start=support';
  console.log(`🎯 URL correctness: ${isCorrect ? 'PERFECT (SMMplansapport_bot)' : 'FAILED'}`);
}

testApiTelegramRedirect().catch(console.error);
