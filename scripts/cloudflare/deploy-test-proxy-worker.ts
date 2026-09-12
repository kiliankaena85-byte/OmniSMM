/**
 * deploy-test-proxy-worker.ts
 * Deploys a transparent Cloudflare Worker reverse-proxy for test.smmplan.pro
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0a7a9a7acb363ffba6f1f1d71897b94c';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';
const SCRIPT_NAME = 'smmplan-test-proxy';
const TUNNEL_ORIGIN = process.env.TUNNEL_ORIGIN || 'https://9945d66980ac04.lhr.life';

const HOP_BY_HOP_SET = [
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailers','transfer-encoding','upgrade',
  'cf-connecting-ip','cf-ray','cf-visitor','cf-ipcountry',
].join('","');

const WORKER_CODE = `
const ORIGIN = '${TUNNEL_ORIGIN.replace(/'/g, "\\\'")}';
const HOP_BY_HOP = new Set(["${HOP_BY_HOP_SET}"]);
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstreamUrl = new URL(url.pathname + url.search, ORIGIN);
    const upstreamHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) upstreamHeaders.set(k, v);
    }
    const originHost = new URL(ORIGIN).host;
    upstreamHeaders.set('host', originHost);
    upstreamHeaders.set('x-forwarded-host', 'test.smmplan.pro');
    upstreamHeaders.set('x-forwarded-proto', 'https');
    upstreamHeaders.set('x-real-ip', request.headers.get('cf-connecting-ip') || '');
    const upstreamReq = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: ['GET','HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });
    let resp;
    try { resp = await fetch(upstreamReq); }
    catch(err) {
      return new Response(JSON.stringify({error:'Tunnel unreachable',detail:String(err)}),
        {status:502,headers:{'content-type':'application/json'}});
    }
    if ([301,302,303,307,308].includes(resp.status)) {
      const loc = (resp.headers.get('location') || '').replace(ORIGIN, 'https://test.smmplan.pro');
      const h = new Headers(resp.headers);
      h.set('location', loc);
      return new Response(null, {status: resp.status, headers: h});
    }
    const responseHeaders = new Headers();
    for (const [k, v] of resp.headers.entries()) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) responseHeaders.set(k, v);
    }
    responseHeaders.set('x-proxy-via', 'smmplan-test-proxy/1.0');
    return new Response(resp.body, {status: resp.status, statusText: resp.statusText, headers: responseHeaders});
  }
};
`;

async function cfRequest(endpoint: string, method = 'GET', body?: unknown, contentType?: string) {
  const headers: Record<string,string> = { 'Authorization': `Bearer ${API_TOKEN}` };
  if (contentType) headers['Content-Type'] = contentType;
  else if (body && typeof body === 'object') headers['Content-Type'] = 'application/json';
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method, headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  return res.json() as Promise<{success:boolean;result?:unknown;errors?:unknown[];messages?:unknown[]}>;
}

async function main() {
  if (!API_TOKEN) {
    console.error('❌ Set CLOUDFLARE_API_TOKEN first');
    process.exit(1);
  }
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  🚀 Deploying Transparent Proxy Worker: ${SCRIPT_NAME}`);
  console.log(`  🌍 Tunnel origin: ${TUNNEL_ORIGIN}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Upload ESM worker via multipart
  console.log('1. Uploading Worker...');
  const formData = new FormData();
  const meta = {main_module:'worker.js',compatibility_date:'2024-09-23',compatibility_flags:['nodejs_compat']};
  formData.append('metadata', new Blob([JSON.stringify(meta)], {type:'application/json'}), 'metadata.json');
  formData.append('worker.js', new Blob([WORKER_CODE], {type:'application/javascript+module'}), 'worker.js');
  const uploadRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`,
    { method:'PUT', headers:{'Authorization':`Bearer ${API_TOKEN}`}, body: formData }
  );
  const uploadJson = await uploadRes.json() as {success:boolean;errors?:unknown[]};
  if (!uploadJson.success) { console.error('❌ Upload failed:', uploadJson.errors); process.exit(1); }
  console.log('   ✅ Script uploaded!\n');

  // 2. Create / update Worker Route
  console.log('2. Configuring route test.smmplan.pro/*...');
  const routesRes = await cfRequest(`/zones/${ZONE_ID}/workers/routes`);
  const routes = (routesRes.result as Array<{id:string;pattern:string;script:string}>) || [];
  const existing = routes.find(r => r.pattern === 'test.smmplan.pro/*');
  if (existing) {
    const u = await cfRequest(`/zones/${ZONE_ID}/workers/routes/${existing.id}`, 'PUT', {pattern:'test.smmplan.pro/*',script:SCRIPT_NAME});
    console.log(u.success ? '   ✅ Route updated!' : '   ❌ Route update failed: ' + JSON.stringify(u.errors));
  } else {
    const c = await cfRequest(`/zones/${ZONE_ID}/workers/routes`, 'POST', {pattern:'test.smmplan.pro/*',script:SCRIPT_NAME});
    console.log(c.success ? '   ✅ Route created!' : '   ❌ Route create failed: ' + JSON.stringify(c.errors));
  }

  // 3. Remove stale page rules pointing to dead Tailscale tunnel
  console.log('\n3. Removing stale Page Rules...');
  const prRes = await cfRequest(`/zones/${ZONE_ID}/pagerules?status=active`);
  const prs = (prRes.result as Array<{id:string;targets:Array<{constraint:{value:string}}>}>) || [];
  let removed = 0;
  for (const rule of prs) {
    if ((rule.targets?.[0]?.constraint?.value ?? '').includes('test.smmplan.pro')) {
      const d = await cfRequest(`/zones/${ZONE_ID}/pagerules/${rule.id}`, 'DELETE');
      if (d.success) { console.log(`   🗑️  Removed rule: ${rule.targets[0].constraint.value}`); removed++; }
    }
  }
  if (removed === 0) console.log('   ℹ️  No stale page rules found.');

  // 4. Verify probe
  console.log('\n4. Probing test.smmplan.pro/api/health...');
  await new Promise(r => setTimeout(r, 3000));
  try {
    const probe = await fetch('https://test.smmplan.pro/api/health', {signal: AbortSignal.timeout(15000)});
    const text = await probe.text();
    console.log(`   ✨ HTTP ${probe.status}: ${text.slice(0, 120)}`);
  } catch(e) { console.log('   ⚠️ Probe error:', e instanceof Error ? e.message : String(e)); }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ DONE: test.smmplan.pro now transparently proxied!');
  console.log(`  🔗 Origin: ${TUNNEL_ORIGIN}`);
  console.log('\n  ⚠️  Tunnel restarts require redeployment:');
  console.log('     $env:TUNNEL_ORIGIN="https://<new>.lhr.life"; npx tsx scripts/cloudflare/deploy-test-proxy-worker.ts');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); });
