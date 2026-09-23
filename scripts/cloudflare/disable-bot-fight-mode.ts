/**
 * Disable Bot Fight Mode for smmplan.pro via Cloudflare API
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🤖 Checking & Disabling Bot Fight Mode via Cloudflare API');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Get current bot management status
  console.log('1. [Fetching Current Bot Management Settings]...');
  const getRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/bot_management`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const getData = await getRes.json() as { success: boolean; result: any; errors?: any[] };
  console.log('Current Bot Management:', JSON.stringify(getData, null, 2));

  // 2. Disable fight_mode / super_bot_fight_mode
  console.log('\n2. [Disabling Bot Fight Mode]...');
  const putRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/bot_management`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fight_mode: false,
    }),
  });

  const putData = await putRes.json() as { success: boolean; result: any; errors?: any[] };
  console.log('Update Bot Fight Mode Result:', JSON.stringify(putData, null, 2));
}

main().catch(console.error);
