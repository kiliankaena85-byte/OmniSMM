import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function probe() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  console.log('Token exists:', !!token, 'Length:', token?.length);
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing in .env');
    return;
  }

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    console.log('1. Bot Info (getMe):', JSON.stringify(meData, null, 2));

    const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const whData = await whRes.json();
    console.log('2. Webhook Info (getWebhookInfo):', JSON.stringify(whData, null, 2));
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

probe();
