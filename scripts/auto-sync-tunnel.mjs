import { execSync } from 'child_process';
import { updateWorkerProxy } from './update-cf-tunnel.mjs';

let lastUrl = null;

async function checkAndSync() {
  try {
    const raw = execSync('docker exec smmplan_tunnel cat /app/TUNNEL_URL.txt', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const match = raw.match(/https:\/\/[a-zA-Z0-9_\-\.]+\.pinggy\.net/);
    if (match && match[0] !== lastUrl) {
      const newUrl = match[0];
      console.log(`[AutoSync] Tunnel URL changed: ${lastUrl} -> ${newUrl}`);
      await updateWorkerProxy(newUrl);
      lastUrl = newUrl;
    }
  } catch (err) {
    // smmplan_tunnel container may be restarting or file not ready
  }
}

// Initial sync
await checkAndSync();

// Loop every 15s
setInterval(checkAndSync, 15000);
console.log('[AutoSync] Tunnel watchdog active (polling every 15s)...');
