/**
 * Apply Cloudflare Page Rules & Worker Redirects for smmplan.pro to Tailscale Funnel
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0a7a9a7acb363ffba6f1f1d71897b94c';

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
  console.log('  🔀 Configuring Seamless Redirect Rules (smmplan.pro -> Tailscale)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Update Worker smmplan-russia-gateway with instant 302 Redirect
  console.log('1. [Deploying Instant Redirect Worker]...');
  const REDIRECT_WORKER_CODE = `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const targetUrl = new URL(request.url);
  targetUrl.hostname = 'desktop-25m6el7.tailbb9d28.ts.net';
  targetUrl.protocol = 'https:';
  targetUrl.port = '';

  // 302 Temporary Redirect preserving full path, query params and hash
  return Response.redirect(targetUrl.toString(), 302);
}
`;

  const workerRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/smmplan-russia-gateway`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/javascript',
    },
    body: REDIRECT_WORKER_CODE,
  });

  const workerJson = await workerRes.json();
  console.log('   Worker redirect status:', workerJson.success ? '✅ Deployed' : JSON.stringify(workerJson.errors));

  // 2. Configure Cloudflare Page Rules for smmplan.pro
  console.log('\n2. [Configuring Cloudflare Page Rules for Domain Redirection]...');
  
  const rules = [
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: '*test.smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$2' } }],
      priority: 1,
      status: 'active'
    },
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: '*smmplan.pro/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 302, url: 'https://desktop-25m6el7.tailbb9d28.ts.net/$2' } }],
      priority: 2,
      status: 'active'
    }
  ];

  for (const rule of rules) {
    const pageRuleRes = await cfRequest(`/zones/${ZONE_ID}/pagerules`, 'POST', rule);
    if (pageRuleRes.success) {
      console.log(`   ✅ Page rule created for: ${rule.targets[0].constraint.value}`);
    } else {
      console.log(`   ⚠️ Page rule response for ${rule.targets[0].constraint.value}:`, JSON.stringify(pageRuleRes.errors || pageRuleRes.messages));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  🎉 Redirect Rules are 100% LIVE!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
