/**
 * Switch all DNS records for smmplan.pro, test.smmplan.pro, flux.smmplan.pro to DNS Only (proxied: false)
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ☁️ Switching Cloudflare DNS Records to "DNS Only" (Grey Cloud)');
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

  console.log(`Found ${data.result.length} DNS records:\n`);

  for (const record of data.result) {
    console.log(`- Updating [${record.type}] ${record.name} (Current proxied: ${record.proxied})...`);

    const patchRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proxied: false,
      }),
    });

    const patchData = await patchRes.json() as { success: boolean; result: any; errors?: any[] };
    if (patchData.success) {
      console.log(`  ✅ ${record.name} -> proxied: false (DNS Only)`);
    } else {
      console.log(`  ⚠️ ${record.name} -> Error: ${JSON.stringify(patchData.errors)}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Verification of updated DNS records:');
  console.log('═══════════════════════════════════════════════════════════════════');

  const verifyRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?per_page=100`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const verifyData = await verifyRes.json() as { success: boolean; result: any[] };
  for (const r of verifyData.result || []) {
    console.log(`  ${r.type.padEnd(6)} ${r.name.padEnd(25)} -> ${r.content} [Proxied: ${r.proxied}]`);
  }
}

main().catch(console.error);
