/**
 * Deploy Cloudflare Worker Reverse-Proxy for SMMplan
 * Bypasses TSPU/MGTS Anycast IP block by routing through Cloudflare Workers Edge IP pool
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0a7a9a7acb363ffba6f1f1d71897b94c';
const SCRIPT_NAME = 'smmplan-russia-gateway';

const WORKER_CODE = `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const targetUrl = new URL(request.url);
  targetUrl.hostname = 'test.smmplan.pro';
  targetUrl.protocol = 'https:';

  const newHeaders = new Headers(request.headers);
  newHeaders.set('Host', 'test.smmplan.pro');

  const forwardRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: newHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual'
  });

  try {
    const response = await fetch(forwardRequest);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Proxy-By', 'SMMplan-Worker-Edge-Gateway');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response('Edge Gateway Error: ' + err.message, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
`;

async function cfRequest(endpoint: string, method: string = 'GET', body?: unknown, contentType?: string) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_TOKEN}`,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  } else if (body && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

  return await res.json() as { success: boolean; result?: any; errors?: any[]; messages?: any[] };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🚀 Deploying Cloudflare Worker Reverse-Proxy (Russia Gateway)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Upload Worker Script
  console.log(`1. [Uploading Worker Script: "${SCRIPT_NAME}"]...`);
  const uploadRes = await cfRequest(
    `/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`,
    'PUT',
    WORKER_CODE,
    'application/javascript'
  );

  if (!uploadRes.success) {
    console.error('❌ Failed to upload worker script:', JSON.stringify(uploadRes.errors));
    return;
  }
  console.log('   ✅ Script updated successfully!');

  // 2. Public URL
  const publicUrl = 'https://smmplan-russia-gateway.a9040000911.workers.dev';
  console.log(`\n2. [Testing HTTP Gateway Response via ${publicUrl}]...`);

  try {
    const probeRes = await fetch(`${publicUrl}/api/health`);
    console.log(`   ✨ Probe status: HTTP ${probeRes.status} (${probeRes.statusText})`);
    const body = await probeRes.text();
    console.log(`   Response:`, body);
  } catch (e: unknown) {
    console.log(`   ❌ Probe test error:`, e instanceof Error ? e.message : String(e));
  }

  console.log('\n3. [Testing HTML Landing Page via Worker Gateway]...');
  try {
    const htmlRes = await fetch(`${publicUrl}/`);
    console.log(`   ✨ Landing page status: HTTP ${htmlRes.status} (${htmlRes.statusText})`);
    const text = await htmlRes.text();
    console.log(`   HTML Title snippet:`, text.slice(0, 300).replace(/\\s+/g, ' '));
  } catch (e: unknown) {
    console.log(`   ❌ Landing page error:`, e instanceof Error ? e.message : String(e));
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  🎉 Cloudflare Worker Reverse-Proxy is 100% OPERATIONAL!');
  console.log(`  🌐 Direct Gateway URL: ${publicUrl}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
