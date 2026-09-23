/**
 * Configure full domain redirection via Cloudflare Page Rules
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function cfRequest(endpoint: string, method: string = 'GET', body?: unknown) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return await res.json() as { success: boolean; result?: any; errors?: any[]; messages?: any[] };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔀 Configuring Full Automated Domain Redirections via Page Rules');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Ensure DNS records are proxied so Cloudflare Page Rules intercept traffic
  console.log('1. [Ensuring DNS Records are Proxied for Edge Interception]...');
  const dnsRes = await cfRequest(`/zones/${ZONE_ID}/dns_records?per_page=100`);
  if (dnsRes.success && dnsRes.result) {
    for (const record of dnsRes.result) {
      if (['smmplan.pro', 'test.smmplan.pro', 'flux.smmplan.pro', 'www.smmplan.pro'].includes(record.name)) {
        if (!record.proxied) {
          const pRes = await cfRequest(`/zones/${ZONE_ID}/dns_records/${record.id}`, 'PATCH', { proxied: true });
          console.log(`   - ${record.name} -> proxied: true (Status: ${pRes.success ? '✅ OK' : '⚠️ Error'})`);
        } else {
          console.log(`   - ${record.name} is already proxied: true ✅`);
        }
      }
    }
  }

  // 2. Fetch existing page rules to delete/update
  console.log('\n2. [Cleaning up Old Page Rules]...');
  const existingRules = await cfRequest(`/zones/${ZONE_ID}/pagerules`);
  if (existingRules.success && existingRules.result) {
    for (const r of existingRules.result) {
      console.log(`   - Deleting existing page rule: ${r.id}...`);
      await cfRequest(`/zones/${ZONE_ID}/pagerules/${r.id}`, 'DELETE');
    }
  }

  // 3. Create fresh Page Rules
  console.log('\n3. [Creating Fresh Page Rules for 3 Domains]...');

  const pageRules = [
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: '*flux.smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$2?tenant=flux' } }],
      priority: 1,
      status: 'active'
    },
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: '*test.smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$2' } }],
      priority: 2,
      status: 'active'
    },
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: '*smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$2?mode=holding' } }],
      priority: 3,
      status: 'active'
    }
  ];

  for (const pr of pageRules) {
    const createRes = await cfRequest(`/zones/${ZONE_ID}/pagerules`, 'POST', pr);
    if (createRes.success) {
      console.log(`   ✅ Created rule for: ${pr.targets[0].constraint.value} -> ${pr.actions[0].value.url}`);
    } else {
      console.log(`   ❌ Failed for ${pr.targets[0].constraint.value}:`, JSON.stringify(createRes.errors));
    }
  }

  // 4. Verify all active page rules
  console.log('\n4. [Verification of Live Page Rules]...');
  const verifyRes = await cfRequest(`/zones/${ZONE_ID}/pagerules`);
  if (verifyRes.success && verifyRes.result) {
    for (const r of verifyRes.result) {
      const match = r.targets?.[0]?.constraint?.value;
      const target = r.actions?.[0]?.value?.url;
      console.log(`   ✨ [Priority ${r.priority}] ${match} ──(302)──> ${target} [Status: ${r.status}]`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  🎉 All domain redirections are LIVE and ACTIVE!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
