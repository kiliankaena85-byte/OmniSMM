/**
 * Point smmplan.pro, test.smmplan.pro, flux.smmplan.pro to Tailscale Funnel domain
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';
const TAILSCALE_TARGET = 'desktop-25m6el7.tailbb9d28.ts.net';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  🔗 Pointing DNS Records to Tailscale: ${TAILSCALE_TARGET}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Fetch current DNS records
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?per_page=100`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json() as { success: boolean; result: any[]; errors?: any[] };
  if (!data.success) {
    console.error('❌ Failed to fetch DNS records:', data.errors);
    return;
  }

  const domainsToUpdate = ['smmplan.pro', 'test.smmplan.pro', 'flux.smmplan.pro', 'www.smmplan.pro'];

  for (const record of data.result) {
    if (domainsToUpdate.includes(record.name)) {
      console.log(`- Updating [${record.type}] ${record.name} -> ${TAILSCALE_TARGET} (proxied: false)...`);

      const patchRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: TAILSCALE_TARGET,
          proxied: false,
          ttl: 1, // Auto TTL
        }),
      });

      const patchData = await patchRes.json() as { success: boolean; result: any; errors?: any[] };
      if (patchData.success) {
        console.log(`  ✅ ${record.name} successfully pointed to Tailscale!`);
      } else {
        console.log(`  ⚠️ Error updating ${record.name}:`, JSON.stringify(patchData.errors));
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  DNS Migration to Tailscale Complete!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
