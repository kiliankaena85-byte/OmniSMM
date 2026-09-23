/**
 * Fix Cloudflare Page Rules to use exact domain patterns without wildcard collisions
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
  console.log('Fixing Cloudflare Page Rules...');

  // 1. Delete all existing page rules
  const existingRules = await cfRequest(`/zones/${ZONE_ID}/pagerules`);
  if (existingRules.success && existingRules.result) {
    for (const r of existingRules.result) {
      console.log(`- Deleting rule: ${r.id}`);
      await cfRequest(`/zones/${ZONE_ID}/pagerules/${r.id}`, 'DELETE');
    }
  }

  // 2. Create exact non-colliding Page Rules
  const pageRules = [
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'flux.smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$1?tenant=flux' } }],
      priority: 1,
      status: 'active'
    },
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'test.smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$1' } }],
      priority: 2,
      status: 'active'
    },
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$1?mode=holding' } }],
      priority: 3,
      status: 'active'
    }
  ];

  for (const pr of pageRules) {
    const createRes = await cfRequest(`/zones/${ZONE_ID}/pagerules`, 'POST', pr);
    if (createRes.success) {
      console.log(`✅ Created: ${pr.targets[0].constraint.value} -> ${pr.actions[0].value.url}`);
    } else {
      console.log(`❌ Error creating ${pr.targets[0].constraint.value}:`, JSON.stringify(createRes.errors));
    }
  }
}

main().catch(console.error);
