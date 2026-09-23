import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';
import { getEncodedKey } from '../src/lib/session-edge';

const prisma = new PrismaClient();
const STAGE_PORT = 3005;
const BRAIN_DIR = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/3380a72a-5b65-42ee-a3e0-5500d8d40e11');
const ARTIFACTS_DIR = path.resolve(process.cwd(), 'artifacts');

let nextServerProcess: ChildProcess | null = null;

async function checkServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => {
      resolve(false);
    });
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
    s.connect(port, '127.0.0.1');
  });
}

async function ensureServerRunning(): Promise<string> {
  if (await checkServer(STAGE_PORT)) {
    console.log(`✓ Stage server already running on port ${STAGE_PORT}`);
    return `http://127.0.0.1:${STAGE_PORT}`;
  }

  console.log(`🚀 Spawning Next.js stage server on port ${STAGE_PORT}...`);
  nextServerProcess = spawn('npx', ['next', 'dev', '-p', String(STAGE_PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(STAGE_PORT) }
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 75000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await checkServer(STAGE_PORT)) {
      console.log(`✓ Next.js stage server successfully running on port ${STAGE_PORT}!`);
      // Warm up
      await new Promise((r) => setTimeout(r, 4000));
      return `http://127.0.0.1:${STAGE_PORT}`;
    }
  }

  throw new Error(`Timeout waiting for stage server on port ${STAGE_PORT}`);
}

async function createJwt(userId: string, role: string, tenantId = 'smmplan') {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'stage-audit-agent',
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

async function main() {
  console.log('🎬 Stage Visual Audit Pipeline (Waves 1-3)...');

  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const stageUrl = await ensureServerRunning();

  const ownerUser = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  const smmplanClient = await prisma.user.findFirst({ where: { role: 'USER', tenantId: 'smmplan' } });
  const fluxClient = await prisma.user.findFirst({ where: { tenantId: 'flux' } }) || smmplanClient;

  if (!ownerUser || !smmplanClient) {
    throw new Error('Required test users missing in database');
  }

  const ownerToken = await createJwt(ownerUser.id, 'OWNER', 'smmplan');
  const smmplanToken = await createJwt(smmplanClient.id, 'USER', 'smmplan');
  const fluxToken = await createJwt(fluxClient!.id, 'USER', 'flux');

  const browser = await chromium.launch({ headless: true });

  try {
    // ── 1. SMMplan Storefront & Order Wizard (Wave 1 & 2 Verification) ──
    console.log('📸 1. Capturing SMMplan Storefront & Order Wizard...');
    const context1 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    });
    await context1.addCookies([
      { name: 'session_token', value: smmplanToken, domain: '127.0.0.1', path: '/' },
      { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
    ]);
    const page1 = await context1.newPage();
    await page1.goto(`${stageUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page1.waitForTimeout(4000);

    const shot1Local = path.join(ARTIFACTS_DIR, '01_stage_smmplan_order_wizard.png');
    const shot1Brain = path.join(BRAIN_DIR, '01_stage_smmplan_order_wizard.png');
    await page1.screenshot({ path: shot1Local, fullPage: false });
    fs.copyFileSync(shot1Local, shot1Brain);
    console.log(`✓ Saved ${shot1Brain}`);
    await context1.close();

    // ── 2. SMMflux Radiant Aurora Wizard (Wave 1 & 2 Drip-Feed Verification) ──
    console.log('📸 2. Capturing SMMflux Radiant Aurora Order Wizard...');
    const context2 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    });
    await context2.addCookies([
      { name: 'session_token', value: fluxToken, domain: '127.0.0.1', path: '/' },
      { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
    ]);
    const page2 = await context2.newPage();
    await page2.goto(`${stageUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page2.waitForTimeout(4000);

    const shot2Local = path.join(ARTIFACTS_DIR, '02_stage_flux_aurora_wizard.png');
    const shot2Brain = path.join(BRAIN_DIR, '02_stage_flux_aurora_wizard.png');
    await page2.screenshot({ path: shot2Local, fullPage: false });
    fs.copyFileSync(shot2Local, shot2Brain);
    console.log(`✓ Saved ${shot2Brain}`);
    await context2.close();

    // ── 3. Add Funds / Top-Up Screen (Wave 3 Fiscalization Verification) ──
    console.log('📸 3. Capturing Add Funds / Top-Up Screen...');
    const context3 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    });
    await context3.addCookies([
      { name: 'session_token', value: smmplanToken, domain: '127.0.0.1', path: '/' },
      { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
    ]);
    const page3 = await context3.newPage();
    await page3.goto(`${stageUrl}/dashboard/add-funds`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page3.waitForTimeout(3000);

    const shot3Local = path.join(ARTIFACTS_DIR, '03_stage_finance_add_funds.png');
    const shot3Brain = path.join(BRAIN_DIR, '03_stage_finance_add_funds.png');
    await page3.screenshot({ path: shot3Local, fullPage: false });
    fs.copyFileSync(shot3Local, shot3Brain);
    console.log(`✓ Saved ${shot3Brain}`);
    await context3.close();

    // ── 4. Admin Finance Hub & Reconciliation (Wave 3 Liquidity & Ledger) ──
    console.log('📸 4. Capturing Admin Finance & Reconciliation Hub...');
    const context4 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    });
    await context4.addCookies([
      { name: 'session_token', value: ownerToken, domain: '127.0.0.1', path: '/' },
      { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
    ]);
    const page4 = await context4.newPage();
    await page4.goto(`${stageUrl}/admin/finance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page4.waitForTimeout(3000);

    const shot4Local = path.join(ARTIFACTS_DIR, '04_stage_admin_finance_reconciliation.png');
    const shot4Brain = path.join(BRAIN_DIR, '04_stage_admin_finance_reconciliation.png');
    await page4.screenshot({ path: shot4Local, fullPage: false });
    fs.copyFileSync(shot4Local, shot4Brain);
    console.log(`✓ Saved ${shot4Brain}`);
    await context4.close();

    console.log('🎉 All 4 Stage Visual Audit screenshots successfully captured!');
  } finally {
    await browser.close();
    if (nextServerProcess) {
      console.log('🛑 Terminating stage server process...');
      nextServerProcess.kill();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Stage Visual Audit Failed:', err);
    if (nextServerProcess) nextServerProcess.kill();
    process.exit(1);
  });
