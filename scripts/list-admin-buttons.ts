import * as dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';

async function main() {
  const token = await new SignJWT({
    sessionId: 'qa_session_owner_2026',
    userId: 'cmugw141d00026vtakb62tr44',
    email: 'art@artmspektr.ru',
    role: 'OWNER',
    tenantId: 'smmplan',
    allowedTenants: ['smmplan', 'flux'],
    contour: 'test',
    canResetPassword: false,
    sessionVer: 1
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getEncodedKey());

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext();
  await ctx.addCookies([
    { name: 'session_token', value: token, url: 'http://127.0.0.1:3005' },
    { name: 'x_tenant', value: 'smmplan', url: 'http://127.0.0.1:3005' }
  ]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:3005/admin/settings?tab=telegram', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const btns = await page.$$eval('button', els =>
    els.map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  console.log('Total buttons found:', btns.length);
  console.log('Buttons:', btns);

  await browser.close();
}

main().catch(console.error);
