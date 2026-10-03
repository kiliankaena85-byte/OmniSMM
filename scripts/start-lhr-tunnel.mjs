import { spawn } from 'child_process';
import { updateWorkerProxy } from './update-cf-tunnel.mjs';

console.log('[Tunnel] Starting persistent localhost.run SSH tunnel for 127.0.0.1:3000...');

const ssh = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=5',
  '-R', '80:127.0.0.1:3000',
  'nokey@localhost.run'
]);

let buffer = '';
let currentUrl = null;

ssh.stdout.on('data', async (chunk) => {
  const text = chunk.toString();
  buffer += text;
  process.stdout.write(text);

  const match = buffer.match(/https:\/\/([a-z0-9]+\.lhr\.life)/);
  if (match && match[0] !== currentUrl) {
    currentUrl = match[0];
    console.log(`\n======================================================`);
    console.log(`  🌟 LIVE TMA URL: ${currentUrl}/depin`);
    console.log(`======================================================\n`);

    // Sync Cloudflare Worker
    await updateWorkerProxy(currentUrl);
  }
});

ssh.stderr.on('data', (chunk) => {
  process.stderr.write(chunk.toString());
});

ssh.on('close', (code) => {
  console.log(`[Tunnel] SSH process exited with code ${code}.`);
});
