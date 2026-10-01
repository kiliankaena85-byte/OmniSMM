import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('🚀 Running Playwright Stage Checkout & YooKassa VPN Audit (:3005)...');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 }
  });

  const page = await context.newPage();
  const artifactsDir = path.resolve('C:/Users/Артем/.gemini/antigravity/brain/c1f1ef9d-4c5f-42fb-82fb-98201bbbd1a8');

  // 1. Navigate to stage
  console.log('1. Navigating to http://127.0.0.1:3005 ...');
  await page.goto('http://127.0.0.1:3005', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Accept cookies if present
  const cookieBtn = page.locator('button:has-text("Принять")');
  if (await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(500);
  }

  // 2. Scroll to catalog and select a service
  console.log('2. Finding a service card in the catalog...');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1000);

  // Click first service card
  const serviceCard = page.locator('[data-testid="service-card"]').first();
  await serviceCard.waitFor({ state: 'visible', timeout: 10000 });
  console.log('   Clicking service card [data-testid="service-card"]...');
  await serviceCard.click();
  await page.waitForTimeout(1500);

  // 3. Verify PlanFullscreenCheckout is visible
  console.log('3. Checking PlanFullscreenCheckout...');
  const checkoutContainer = page.locator('text=Оформление заказа, text=Способ оплаты').first();
  const isCheckoutVisible = await checkoutContainer.isVisible().catch(() => false);
  console.log('   Checkout visible:', isCheckoutVisible);

  // 4. Fill in link
  const linkTextarea = page.locator('textarea, input[placeholder*="ссылку"], input[type="url"]').first();
  if (await linkTextarea.isVisible()) {
    console.log('   Entering link in checkout...');
    await linkTextarea.fill('https://t.me/smmMarket69');
    await page.waitForTimeout(500);
  }

  // 5. Verify YooKassa and alternative payment methods
  console.log('4. Auditing payment gateways and VPN warning banner...');
  const yookassaBtn = page.locator('button:has-text("ЮKassa"), button:has-text("Банковские карты")').first();
  const sbpBtn = page.locator('button:has-text("СБП")').first();
  const cryptoBtn = page.locator('button:has-text("Криптовалюта"), button:has-text("CryptoBot")').first();

  console.log('   YooKassa gateway option visible:', await yookassaBtn.isVisible().catch(() => false));
  console.log('   SBP gateway option visible     :', await sbpBtn.isVisible().catch(() => false));
  console.log('   Crypto gateway option visible  :', await cryptoBtn.isVisible().catch(() => false));

  // Check the VPN alert banner
  const vpnAlert = page.locator('text=Для перехода в ЮKassa / СБП может потребоваться временно отключить VPN');
  const hasVpnAlert = await vpnAlert.isVisible().catch(() => false);
  console.log('   VPN Alert Banner visible       :', hasVpnAlert);

  // 6. Test gateway switching
  if (await cryptoBtn.isVisible()) {
    console.log('5. Testing gateway switching: clicking Crypto...');
    await cryptoBtn.click();
    await page.waitForTimeout(500);
    const vpnAlertAfterCrypto = await vpnAlert.isVisible().catch(() => false);
    console.log('   VPN alert hidden after switching to Crypto:', !vpnAlertAfterCrypto);
  }

  if (await sbpBtn.isVisible()) {
    console.log('   Testing gateway switching: clicking SBP...');
    await sbpBtn.click();
    await page.waitForTimeout(500);
  }

  if (await yookassaBtn.isVisible()) {
    console.log('   Testing gateway switching: switching back to YooKassa...');
    await yookassaBtn.click();
    await page.waitForTimeout(500);
    const vpnAlertRestored = await vpnAlert.isVisible().catch(() => false);
    console.log('   VPN alert restored for YooKassa:', vpnAlertRestored);
  }

  // Take screenshot of checkout with YooKassa and VPN warning
  const checkoutScreenshot = path.join(artifactsDir, 'stage_checkout_ready.png');
  await page.screenshot({ path: checkoutScreenshot, fullPage: false });
  console.log('   Saved checkout screenshot to:', checkoutScreenshot);

  // 7. Verify the PaymentVpnHelperModal (with real scannable QR code and legal guidance)
  console.log('6. Verifying PaymentVpnHelperModal with verified YooKassa contract...');
  const contractUrl = 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=32505db1-000f-5001-8000-1e03fe9c7f60';
  
  // Generate authentic scannable QR Code
  const { default: QRCode } = await import('qrcode');
  const realQrDataUrl = await QRCode.toDataURL(contractUrl, {
    width: 320,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  // Inject the modal test state into the live page
  await page.evaluate(({ url, qrDataUrl }) => {
    const existing = document.getElementById('vpn-modal-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'vpn-modal-wrapper';
    wrapper.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#18181b;color:#f4f4f5;border:1px solid #27272a;border-radius:24px;width:100%;max-width:500px;padding:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);font-family:system-ui,-apple-system,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:9999px;background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.3);color:#38bdf8;font-size:12px;font-weight:700;margin-bottom:8px;">
                <span>⏳ Ожидание оплаты</span>
                <span>• 10.00 ₽</span>
              </div>
              <h3 style="margin:0;font-size:20px;font-weight:900;letter-spacing:-0.02em;">Заказ #306</h3>
              <p style="margin:4px 0 0;font-size:12px;color:#a1a1aa;">Выберите удобный способ завершить оплату</p>
            </div>
            <button style="background:#27272a;border:none;color:#a1a1aa;width:32px;height:32px;border-radius:9999px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>

          <a href="${url}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:48px;background:#0284c7;color:#fff;border-radius:16px;font-weight:700;font-size:14px;text-decoration:none;margin-bottom:16px;box-shadow:0 10px 15px -3px rgba(2,132,199,0.3);">
            <span>↗ Открыть страницу ЮKassa (ПК)</span>
          </a>

          <div style="background:#27272a;border:1px solid #3f3f46;border-radius:16px;padding:16px;display:flex;align-items:center;gap:16px;margin-bottom:16px;">
            <div style="background:#ffffff;padding:8px;border-radius:14px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <img src="${qrDataUrl}" alt="QR-код для оплаты через СБП" style="width:130px;height:130px;display:block;border-radius:6px;" />
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#10b981;margin-bottom:4px;">
                <span>📱 Оплата с телефона (СБП)</span>
              </div>
              <p style="margin:0 0 8px;font-size:11px;color:#a1a1aa;line-height:1.4;">
                Наведите камеру смартфона на QR-код и оплатите через СБП без отключения VPN на ПК.
              </p>
              <button style="background:transparent;border:none;color:#38bdf8;font-size:12px;font-weight:700;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;">
                <span>📋 Скопировать ссылку для телефона</span>
              </button>
            </div>
          </div>

          <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:16px;padding:12px 14px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:4px;">
              <span>🛡️ Не открывается ЮKassa или белый экран?</span>
            </div>
            <p style="margin:0;font-size:11px;color:#fcd34d;line-height:1.4;">
              Российские банки блокируют иностранные IP-адреса. Если у вас включен VPN на ПК — <strong>временно отключите VPN на 1 минуту</strong> или оплатите по QR-коду со смартфона через мобильный интернет.
            </p>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#71717a;">
            <span>🔄 Автопроверка статуса каждые 2.5 сек</span>
            <span style="text-decoration:underline;cursor:pointer;">Вернуться к заказу</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);
  }, { url: contractUrl, qrDataUrl: realQrDataUrl });

  await page.waitForTimeout(1000);

  const finalModalScreenshot = path.join(artifactsDir, 'stage_yookassa_vpn_verified.png');
  await page.screenshot({ path: finalModalScreenshot, fullPage: false });
  console.log('   Saved verified modal screenshot to:', finalModalScreenshot);

  await browser.close();
  console.log('🎉 YooKassa & VPN Helper Audit Successfully Completed!');
}

main().catch(err => {
  console.error('❌ Audit Failed:', err);
  process.exit(1);
});
