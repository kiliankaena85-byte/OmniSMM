/**
 * SMMplan Worker Healthcheck
 * Pure Node.js (zero external dependencies).
 * Connects to Redis, authenticates if needed, and checks that
 * worker:heartbeat was updated within the last 130 seconds.
 */
const net = require('net');

const redisUrlStr = process.env.REDIS_URL || 'redis://redis:6379';
let host = 'redis';
let port = 6379;
let password = '';

try {
  const parsed = new URL(redisUrlStr);
  host = parsed.hostname || 'redis';
  port = Number(parsed.port) || 6379;
  password = parsed.password ? decodeURIComponent(parsed.password) : '';
} catch (e) {
  // Fallback default
}

const timeout = setTimeout(() => {
  console.error('[Healthcheck] Timeout reaching Redis');
  process.exit(1);
}, 4500);

const client = net.createConnection({ host, port }, () => {
  if (password) {
    client.write(`AUTH ${password}\r\n`);
  }
  client.write('GET worker:heartbeat\r\nQUIT\r\n');
});

let buffer = '';

client.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
});

client.on('end', () => {
  clearTimeout(timeout);

  if (buffer.includes('-NOAUTH') || buffer.includes('-ERR')) {
    console.error('[Healthcheck] Redis error:', buffer.trim());
    process.exit(1);
  }

  // Look for timestamp (e.g. $13\r\n1725420000000\r\n)
  const lines = buffer.split('\r\n');
  let timestamp = null;
  for (const line of lines) {
    if (/^\d{13}$/.test(line)) {
      timestamp = Number(line);
      break;
    }
  }

  if (!timestamp) {
    console.error('[Healthcheck] worker:heartbeat missing or invalid in Redis');
    process.exit(1);
  }

  const ageMs = Date.now() - timestamp;
  if (ageMs > 130000) {
    console.error(`[Healthcheck] worker:heartbeat is stale: ${Math.round(ageMs / 1000)}s ago`);
    process.exit(1);
  }

  // Healthy!
  process.exit(0);
});

client.on('error', (err) => {
  clearTimeout(timeout);
  console.error('[Healthcheck] Redis connection error:', err.message);
  process.exit(1);
});
