import 'dotenv/config';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';

export const prisma = new PrismaClient();
export const STAGE_PORT = 3005;

let nextServerProcess: ChildProcess | null = null;

export async function checkServer(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.status < 500;
  } catch {
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1500) });
      return res.status < 500;
    } catch {
      return false;
    }
  }
}

export async function ensureServerRunning(): Promise<string> {
  if (await checkServer(STAGE_PORT)) {
    console.log(`✓ Stage server already running on port ${STAGE_PORT}`);
    return `http://127.0.0.1:${STAGE_PORT}`;
  }

  console.log(`🚀 Spawning Next.js stage server on port ${STAGE_PORT}...`);
  nextServerProcess = spawn('npx', ['next', 'dev', '-p', String(STAGE_PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(STAGE_PORT), HOSTNAME: '0.0.0.0', TELEGRAM_BOT_TOKEN: '' },
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 90000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await checkServer(STAGE_PORT)) {
      console.log(`✓ Next.js stage server successfully running on port ${STAGE_PORT}!`);
      for (let i = 0; i < 20; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${STAGE_PORT}/login`);
          if (res.status === 200 || res.status === 307) {
            console.log(`✓ Next.js stage HTTP warmup ready!`);
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1000));
      }
      await new Promise((r) => setTimeout(r, 2000));
      return `http://127.0.0.1:${STAGE_PORT}`;
    }
  }

  throw new Error(`Timeout waiting for stage server on port ${STAGE_PORT}`);
}

export async function createJwt(userId: string, role: string, tenantId = 'smmplan'): Promise<string> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'unknown',
      ipAddress: '127.0.0.1',
    },
  });

  return new SignJWT({
    sessionId: session.id,
    userId,
    canResetPassword: false,
    role,
    tenantId,
    contour: 'test',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

export function stopServer(): void {
  if (nextServerProcess && nextServerProcess.pid) {
    console.log('🛑 Stopping temporary stage server process...');
    try {
      const { execSync } = require('child_process');
      execSync(`taskkill /PID ${nextServerProcess.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      nextServerProcess.kill();
    }
    nextServerProcess = null;
  }
}
