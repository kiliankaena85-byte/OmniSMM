import { readFileSync } from 'fs';
import { resolve } from 'path';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '5914b5f5d96041994b68108a8b1df1bd';
const SCRIPT_NAME = 'depin';

export async function updateWorkerProxy(tunnelUrl) {
  console.log(`[Cloudflare] Updating Worker "${SCRIPT_NAME}" to PROXY -> ${tunnelUrl}...`);

  const WORKER_CODE = `
const TARGET_ORIGIN = '${tunnelUrl}';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const destination = new URL(url.pathname + url.search, TARGET_ORIGIN);

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set('host', destination.host);
    proxyHeaders.set('x-forwarded-host', destination.host);
    proxyHeaders.set('x-forwarded-proto', 'https');
    proxyHeaders.set('X-Pinggy-No-Screen', 'true');
    proxyHeaders.set('x-pinggy-no-screen', 'true');
    proxyHeaders.set('bypass-tunnel-reminder', 'true');
    if (proxyHeaders.has('origin')) {
      proxyHeaders.set('origin', 'https://' + destination.host);
    }
    if (proxyHeaders.has('referer')) {
      proxyHeaders.set('referer', 'https://' + destination.host + url.pathname + url.search);
    }

    const init = {
      method: request.method,
      headers: proxyHeaders,
      redirect: 'manual'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
      init.body = request.body;
      init.duplex = 'half';
    }

    try {
      const response = await fetch(destination.toString(), init);
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.delete('X-Frame-Options');
      newHeaders.delete('x-frame-options');
      newHeaders.set('Content-Security-Policy', "frame-ancestors *; default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return new Response('DePIN Gateway Error: ' + err.message, { status: 502 });
    }
  }
};
`;

  const formData = new FormData();
  const meta = {
    main_module: 'worker.js',
    compatibility_date: '2024-09-23',
    compatibility_flags: ['nodejs_compat']
  };
  formData.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }), 'metadata.json');
  formData.append('worker.js', new Blob([WORKER_CODE], { type: 'application/javascript+module' }), 'worker.js');

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    body: formData
  });

  const json = await res.json();
  if (json.success) {
    console.log(`[Cloudflare] ✅ Worker successfully updated to proxy to ${tunnelUrl}`);
    console.log(`[Cloudflare] 🌐 Public endpoint: https://depin.smmplan-tma.workers.dev/depin`);
  } else {
    console.error(`[Cloudflare] ❌ Worker update error:`, json.errors);
  }
}

// If run directly with argument: node scripts/update-cf-tunnel.mjs <URL>
const argUrl = process.argv[2];
if (argUrl) {
  updateWorkerProxy(argUrl).catch(console.error);
}
