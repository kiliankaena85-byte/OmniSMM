/**
 * Inspect and optimize DNS records in Cloudflare zone
 */
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function main() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?per_page=100`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json() as { success: boolean; result: any[]; errors: any[] };
  if (!data.success) {
    console.error('Failed to fetch DNS records:', data.errors);
    return;
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  DNS Records for Zone (Total: ${data.result.length})`);
  console.log('═══════════════════════════════════════════════════════════════════');

  for (const r of data.result) {
    console.log(`  ${r.type.padEnd(8)} ${r.name.padEnd(30)} -> ${r.content} [proxied: ${r.proxied}]`);
  }
}

main().catch(console.error);
