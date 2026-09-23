/**
 * scripts/tunnel-daemon.mjs
 * 
 * Persistent Watchdog Daemon for SMMplan Test Reverse Proxy
 * - Keeps SSH tunnel alive with 15s keep-alive & 30s HTTP heartbeats
 * - Auto-reconnects on drop
 * - Auto-syncs Cloudflare Worker on URL change
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

process.on('uncaughtException', (err) => {
  console.error('[Watchdog] Caught exception (continuing):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Watchdog] Caught rejection (continuing):', reason);
});

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const SCRIPT_NAME = 'smmplan-test-proxy';

let currentTunnelUrl = null;
let heartbeatInterval = null;
let activeSsh = null;
let consecutiveFailures = 0;

const TARGET_HOST = process.env.TUNNEL_TARGET || '127.0.0.1:3000';
const TUNNEL_URL_FILE = resolve(process.cwd(), 'TUNNEL_URL.txt');

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

async function updateCloudflareWorker(tunnelUrl) {
  if (!CF_TOKEN || CF_TOKEN.startsWith('cfut_EFnUo')) {
    return;
  }

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

  try {
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
      console.warn(`[Cloudflare] ⚠️ Worker update skipped:`, json.errors?.[0]?.message || 'Auth failed');
    }
  } catch (err) {
    console.warn(`[Cloudflare] ⚠️ Worker update error:`, err.message);
  }
}

function startTunnel() {
  console.log(`[Tunnel] Launching SSH tunnel to Pinggy (forwarding to ${TARGET_HOST} via port 443)...`);

  const ssh = spawn('ssh', [
    '-p', '443',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-R', `0:${TARGET_HOST}`,
    'a.pinggy.io'
  ]);

  activeSsh = ssh;
  consecutiveFailures = 0;
  let buffer = '';

  ssh.stdout.on('data', (data) => {
    const text = data.toString();
    buffer += text;
    process.stdout.write(text);

    // Match localhost.run or pinggy URL
    const match = buffer.match(/https:\/\/([a-z0-9]+\.lhr\.life)/)
      || buffer.match(/https:\/\/([a-z0-9-]+)\.free\.pinggy\.net/)
      || buffer.match(/https:\/\/([a-z0-9-]+)\.run\.pinggy-free\.link/);

    if (match && match[0] !== currentTunnelUrl) {
      currentTunnelUrl = match[0];
      const timestamp = new Date().toLocaleString('ru-RU');
      console.log(`\n=======================================================`);
      console.log(`  🌟 LIVE TUNNEL URL: ${currentTunnelUrl}`);
      console.log(`  🕒 Updated at: ${timestamp}`);
      console.log(`=======================================================\n`);

      try {
        writeFileSync(TUNNEL_URL_FILE, `${currentTunnelUrl}\n# SMMplan Active Tunnel\n# Updated: ${timestamp}\n`);
        console.log(`[Tunnel] Saved active URL to ${TUNNEL_URL_FILE}`);
      } catch (e) {
        console.error(`[Tunnel] Could not write URL file:`, e.message);
      }

      updateCloudflareWorker(currentTunnelUrl);

      // Start keep-alive heartbeats every 20 seconds
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
            if (consecutiveFailures >= 3) {
              console.log(`[Heartbeat] 🚨 Tunnel dead (${consecutiveFailures} consecutive non-200). Force restarting SSH...`);
              killSsh(ssh);
            }
          }
        } catch(e) {
          consecutiveFailures++;
          console.log(`[Heartbeat] ⚠️ Ping error: ${e.message} (fail count: ${consecutiveFailures})`);
          if (consecutiveFailures >= 3) {
            console.log(`[Heartbeat] 🚨 Tunnel unreachable (${consecutiveFailures} consecutive errors). Force restarting SSH...`);
            killSsh(ssh);
          }
        }
      }, 20000);
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

// Graceful cleanup
process.on('SIGINT', () => {
  console.log('\n[Tunnel] Shutting down tunnel daemon...');
  if (activeSsh) killSsh(activeSsh);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Tunnel] Received SIGTERM...');
  if (activeSsh) killSsh(activeSsh);
  process.exit(0);
});

console.log('═══════════════════════════════════════════════════════');
console.log('  🚀 SMMplan Persistent Tunnel & Proxy Watchdog Daemon');
console.log('═══════════════════════════════════════════════════════\n');

startTunnel();
