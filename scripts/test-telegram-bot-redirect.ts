import { SettingsProvider } from '../src/lib/settings';

async function testTelegramRedirect() {
  console.log('🤖 [TELEGRAM BOT RESOLUTION TEST] Testing bot resolution across all providers...');

  const smmplanSettings = await SettingsProvider.getContactAndLegalSettings('smmplan');
  console.log('📱 SMMplan Contact Settings:', {
    TELEGRAM_SUPPORT_BOT: smmplanSettings.TELEGRAM_SUPPORT_BOT,
    TELEGRAM_SUPPORT_CHANNEL: smmplanSettings.TELEGRAM_SUPPORT_CHANNEL,
    SITE_NAME: smmplanSettings.SITE_NAME,
  });

  const fluxSettings = await SettingsProvider.getContactAndLegalSettings('flux');
  console.log('📱 SMMflux Contact Settings:', {
    TELEGRAM_SUPPORT_BOT: fluxSettings.TELEGRAM_SUPPORT_BOT,
    TELEGRAM_SUPPORT_CHANNEL: fluxSettings.TELEGRAM_SUPPORT_CHANNEL,
    SITE_NAME: fluxSettings.SITE_NAME,
  });

  const envBot = process.env.TELEGRAM_SUPPORT_BOT || process.env.TELEGRAM_BOT_USERNAME;
  console.log('🌐 Environment TELEGRAM_BOT_USERNAME:', envBot);

  const finalSmmplanBot = smmplanSettings.TELEGRAM_SUPPORT_BOT || envBot || 'SMMplansapport_bot';
  console.log(`\n🎯 Resulting DeepLink for SMMplan: https://t.me/${finalSmmplanBot}?start=tg_bind_test`);
}

testTelegramRedirect().catch(console.error);
