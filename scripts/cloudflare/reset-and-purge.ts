/**
 * Fix Cloudflare Page Rules → upgrade to Transform Rules (no-cache redirects)
 * Uses Cloudflare Redirect Rules via Ruleset API for proper Cache-Control headers
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';
const TAILSCALE = 'https://desktop-25m6el7.tailbb9d28.ts.net';

async function cfRequest(endpoint: string, method: string = 'GET', body?: unknown) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as { success: boolean; result?: unknown; errors?: unknown[]; messages?: unknown[] };
  if (!json.success) {
    console.error('CF API error:', JSON.stringify(json.errors));
  }
  return json;
}

async function purgeCloudflareCache() {
  console.log('\n🧹 Purging Cloudflare cache for all 3 domains...');
  const urls = [
    `https://smmplan.pro/`,
    `https://test.smmplan.pro/`,
    `https://flux.smmplan.pro/`,
    `https://www.smmplan.pro/`,
  ];
  const r = await cfRequest(`/zones/${ZONE_ID}/purge_cache`, 'POST', { files: urls });
  if (r.success) {
    console.log('✅ Cache purged successfully for all domains');
  } else {
    console.log('⚠️  Cache purge failed:', JSON.stringify(r.errors));
  }
}

async function deleteAllPageRules() {
  const existing = await cfRequest(`/zones/${ZONE_ID}/pagerules?status=active&order=priority&direction=asc&match=all`);
  if (existing.success && Array.isArray(existing.result)) {
    for (const r of existing.result as { id: string }[]) {
      await cfRequest(`/zones/${ZONE_ID}/pagerules/${r.id}`, 'DELETE');
      console.log(`  - Deleted page rule: ${r.id}`);
    }
  }
}

async function createPageRules() {
  // Use 302 (temporary) to avoid browser caching, matching only exact subdomain patterns
  const rules = [
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'flux.smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: `${TAILSCALE}/$1?tenant=flux` } }],
      priority: 1, status: 'active'
    },
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'test.smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: `${TAILSCALE}/$1` } }],
      priority: 2, status: 'active'
    },
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: `${TAILSCALE}/$1?mode=holding` } }],
      priority: 3, status: 'active'
    },
  ];

  for (const rule of rules) {
    const r = await cfRequest(`/zones/${ZONE_ID}/pagerules`, 'POST', rule);
    if (r.success) {
      const pattern = rule.targets[0].constraint.value;
      const dest = rule.actions[0].value.url;
      console.log(`  ✅ ${pattern} → ${dest}`);
    }
  }
}

async function main() {
  console.log('🔄 Resetting Cloudflare Page Rules + purging cache...\n');

  console.log('1️⃣  Deleting old rules...');
  await deleteAllPageRules();

  console.log('\n2️⃣  Creating new rules (302 temporary)...');
  await createPageRules();

  await purgeCloudflareCache();

  console.log('\n✅ Done! Users must now clear browser cache or use incognito.');
  console.log('   Or open these direct links to bypass browser cache:');
  console.log(`   smmplan.pro (holding):  https://smmplan.pro/?nocache=${Date.now()}`);
  console.log(`   test.smmplan.pro:       https://test.smmplan.pro/?nocache=${Date.now()}`);
  console.log(`   flux.smmplan.pro:       https://flux.smmplan.pro/?nocache=${Date.now()}`);
}

main().catch(console.error);
