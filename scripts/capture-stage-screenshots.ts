import { chromium } from 'playwright';
import { db } from '../src/lib/db';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';
import fs from 'fs';
import path from 'path';

async function createJwt(userId: string, role: string, tenantId = 'smmplan') {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'stage-screenshot-agent',
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
  console.log('📸 Starting Playwright Stage Screenshot Capture...');

  const brainDir = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/825b8dde-0bec-45fa-8205-d3b2d05f1962');
  const localArtifactsDir = path.resolve(process.cwd(), 'artifacts');

  if (!fs.existsSync(brainDir)) fs.mkdirSync(brainDir, { recursive: true });
  if (!fs.existsSync(localArtifactsDir)) fs.mkdirSync(localArtifactsDir, { recursive: true });

  const clientUser = await db.user.findFirst({ where: { email: 'testclient1@example.com' } });
  const supportUser = await db.user.findFirst({ where: { role: 'SUPPORT' } });
  const ownerUser = await db.user.findFirst({ where: { role: 'OWNER' } });

  if (!clientUser || !supportUser || !ownerUser) {
    throw new Error('Test users missing');
  }

  const clientToken = await createJwt(clientUser.id, 'USER');
  const supportToken = await createJwt(supportUser.id, 'SUPPORT');
  const ownerToken = await createJwt(ownerUser.id, 'OWNER');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  // 1. User Dashboard
  console.log('Capturing 1. User Dashboard...');
  await context.addCookies([
    { name: 'session_token', value: clientToken, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
  ]);
  await page.goto('http://127.0.0.1:3005/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const shot1Local = path.join(localArtifactsDir, '01_stage_user_dashboard.png');
  const shot1Brain = path.join(brainDir, '01_stage_user_dashboard.png');
  await page.screenshot({ path: shot1Local, fullPage: false });
  fs.copyFileSync(shot1Local, shot1Brain);

  // 2. Finance Deposit
  console.log('Capturing 2. Finance Deposit...');
  await page.goto('http://127.0.0.1:3005/dashboard/finance?tab=deposit', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const shot2Local = path.join(localArtifactsDir, '02_stage_finance_deposit.png');
  const shot2Brain = path.join(brainDir, '02_stage_finance_deposit.png');
  await page.screenshot({ path: shot2Local, fullPage: false });
  fs.copyFileSync(shot2Local, shot2Brain);

  // 3. Admin Dashboard (Support Role)
  console.log('Capturing 3. Admin Dashboard (Support)...');
  await context.clearCookies();
  await context.addCookies([
    { name: 'session_token', value: supportToken, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
  ]);
  await page.goto('http://127.0.0.1:3005/admin/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const shot3Local = path.join(localArtifactsDir, '03_stage_admin_support.png');
  const shot3Brain = path.join(brainDir, '03_stage_admin_support.png');
  await page.screenshot({ path: shot3Local, fullPage: false });
  fs.copyFileSync(shot3Local, shot3Brain);

  // 4. Admin Dashboard (Owner Role)
  console.log('Capturing 4. Admin Dashboard (Owner)...');
  await context.clearCookies();
  await context.addCookies([
    { name: 'session_token', value: ownerToken, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
  ]);
  await page.goto('http://127.0.0.1:3005/admin/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const shot4Local = path.join(localArtifactsDir, '04_stage_admin_owner.png');
  const shot4Brain = path.join(brainDir, '04_stage_admin_owner.png');
  await page.screenshot({ path: shot4Local, fullPage: false });
  fs.copyFileSync(shot4Local, shot4Brain);

  // 5. Admin Tickets Workspace
  console.log('Capturing 5. Admin Tickets Workspace...');
  const firstTicket = await db.ticket.findFirst({ orderBy: { createdAt: 'desc' } });
  const ticketUrl = firstTicket 
    ? `http://127.0.0.1:3005/admin/tickets?ticketId=${firstTicket.id}`
    : 'http://127.0.0.1:3005/admin/tickets';
  await page.goto(ticketUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const shot5Local = path.join(localArtifactsDir, '05_stage_tickets_workspace.png');
  const shot5Brain = path.join(brainDir, '05_stage_tickets_workspace.png');
  await page.screenshot({ path: shot5Local, fullPage: false });
  fs.copyFileSync(shot5Local, shot5Brain);

  await browser.close();
  console.log('✅ All 5 Stage screenshots captured and saved successfully!');
}

main().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
