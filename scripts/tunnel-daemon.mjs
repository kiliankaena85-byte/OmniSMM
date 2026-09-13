/**
 * scripts/tunnel-daemon.mjs
 * 
 * Persistent Watchdog Daemon for SMMplan Test Reverse Proxy
 * - Keeps SSH tunnel alive with 15s keep-alive & 30s HTTP heartbeats
 * - Auto-reconnects on drop
 * - Auto-syncs Cloudflare Worker on URL change
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'cfut_EFnUoQN8CInbcwzNchPSrx0oWPReaNK8jtlvqENH1dec0681';
const ACCOUNT_ID = '0a7a9a7acb363ffba6f1f1d71897b94c';
const ZONE_ID = 'b67ab9748fc5f42587bc0d455faf0fdd';
const SCRIPT_NAME = 'smmplan-test-proxy';

let currentTunnelUrl = null;
let heartbeatInterval = null;

async function updateCloudflareWorker(tunnelUrl) {
  console.log(`[Cloudflare] Updating Worker "${SCRIPT_NAME}" to REDIRECT (302) to: ${tunnelUrl}...`);

  const WORKER_CODE = `
const TARGET_ORIGIN = '${tunnelUrl}';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const destination = new URL(url.pathname + url.search, TARGET_ORIGIN);
    return Response.redirect(destination.toString(), 302);
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

  const uploadRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
      body: formData
    }
  );
  const json = await uploadRes.json();
  if (json.success) {
    console.log(`[Cloudflare] ✅ Worker updated to REDIRECT 302 -> ${tunnelUrl}`);
  } else {
    console.error(`[Cloudflare] ❌ Worker update failed:`, json.errors);
  }
}

let activeSsh = null;
let consecutiveFailures = 0;

const TARGET_HOST = process.env.TUNNEL_TARGET || '127.0.0.1:3000';

function startTunnel() {
  console.log(`[Tunnel] Launching SSH tunnel to localhost.run (forwarding to ${TARGET_HOST})...`);

  // localhost.run (clean redirect without warning pages)
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', `80:${TARGET_HOST}`,
    'nokey@localhost.run'
  ]);
  activeSsh = ssh;
  consecutiveFailures = 0;

  let buffer = '';

  ssh.stdout.on('data', (data) => {
    const text = data.toString();
    buffer += text;
    process.stdout.write(text);

    // Match pinggy or localhost.run URL
    const match = buffer.match(/https:\/\/([a-z0-9-]+)\.free\.pinggy\.net/)
      || buffer.match(/https:\/\/([a-z0-9-]+)\.run\.pinggy-free\.link/)
      || buffer.match(/https:\/\/([a-z0-9]+\.lhr\.life)/);

    if (match && match[0] !== currentTunnelUrl) {
      currentTunnelUrl = match[0];
      console.log(`\n[Tunnel] 🌟 Detected active tunnel URL: ${currentTunnelUrl}`);
      updateCloudflareWorker(currentTunnelUrl);

function killSsh(child) {
  if (!child) return;
  try {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)]);
    } else {
      child.kill('SIGKILL');
    }
  } catch (_) {
    try { child.kill(); } catch (_) {}
  }
}

      // Start keep-alive heartbeats every 15 seconds
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(async () => {
        try {
          const res = await fetch(`${currentTunnelUrl}/api/health`, {
            headers: { 'x-pinggy-no-screen': 'true' },
            signal: AbortSignal.timeout(10000)
          });
          if (res.ok) {
            consecutiveFailures = 0;
            console.log(`[Heartbeat] 💓 Ping OK: ${new Date().toLocaleTimeString()} (200 OK)`);
          } else if (res.status === 503) {
            console.log(`[Heartbeat] 🚨 Provider returned 503 (tunnel revoked). Force restarting SSH...`);
            killSsh(ssh);
          } else {
            consecutiveFailures++;
            console.log(`[Heartbeat] ⚠️ Ping returned status: ${res.status} (fail count: ${consecutiveFailures})`);
            if (consecutiveFailures >= 2) {
              console.log(`[Heartbeat] 🚨 Tunnel dead (${consecutiveFailures} consecutive non-200). Force restarting SSH...`);
              killSsh(ssh);
            }
          }
        } catch(e) {
          consecutiveFailures++;
          console.log(`[Heartbeat] ⚠️ Ping error: ${e.message} (fail count: ${consecutiveFailures})`);
          if (consecutiveFailures >= 2) {
            console.log(`[Heartbeat] 🚨 Tunnel unreachable (${consecutiveFailures} consecutive errors). Force restarting SSH...`);
            killSsh(ssh);
          }
        }
      }, 15000);
    }
  });

  ssh.stderr.on('data', (data) => {
    const text = data.toString();
    buffer += text;
    if (!text.includes('Pseudo-terminal')) {
      process.stderr.write(text);
    }
  });

  ssh.on('close', (code) => {
    console.log(`[Tunnel] SSH connection closed (code ${code}). Reconnecting in 3s...`);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    setTimeout(startTunnel, 3000);
  });

  ssh.on('error', (err) => {
    console.error(`[Tunnel] Error:`, err);
  });
}

console.log('═══════════════════════════════════════════════════════');
console.log('  🚀 SMMplan Persistent Tunnel & Proxy Watchdog Daemon');
console.log('═══════════════════════════════════════════════════════\n');

startTunnel();
