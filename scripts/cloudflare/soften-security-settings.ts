/**
 * Soften Cloudflare security level to minimum for maximum compatibility
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function main() {
  console.log('Soften Cloudflare security settings...');

  const updates = [
    { id: 'security_level', value: 'essentially_off' },
    { id: 'browser_integrity_check', value: 'off' },
    { id: 'challenge_ttl', value: 86400 },
  ];

  for (const u of updates) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/${u.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: u.value }),
    });

    const data = await res.json() as { success: boolean; result: any; errors?: any[] };
    console.log(`Setting ${u.id} -> ${u.value}:`, data.success ? '✅ Success' : JSON.stringify(data.errors));
  }
}

main().catch(console.error);
