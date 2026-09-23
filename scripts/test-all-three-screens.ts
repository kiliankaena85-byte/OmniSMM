/**
 * End-to-End Comprehensive Verification of all 3 screens:
 * 1. Holding / Prelaunch Screen (Заглушка)
 * 2. SMMplan Classic API Storefront (Основной сайт)
 * 3. SMMflux Radiant Aurora Storefront (Витрина Flux)
 */

async function testScreen(name: string, url: string, requiredTokens: string[], forbiddenTokens: string[], extraHeaders: Record<string, string> = {}) {
  console.log(`\n───────────────────────────────────────────────────────────────────`);
  console.log(`🧪 Testing: [${name}]`);
  console.log(`   URL: ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 SMMplan-E2E-Auditor',
      ...extraHeaders,
    },
  });

  if (!res.ok) {
    console.log(`   ❌ HTTP Status Error: ${res.status}`);
    return false;
  }

  const html = await res.text();

  let passed = true;
  for (const token of requiredTokens) {
    if (!html.includes(token)) {
      console.log(`   ❌ Missing Required Token: "${token}"`);
      passed = false;
    } else {
      console.log(`   ✅ Found Required Token: "${token}"`);
    }
  }

  for (const token of forbiddenTokens) {
    if (html.includes(token)) {
      console.log(`   ❌ Found Forbidden Token: "${token}"`);
      passed = false;
    }
  }

  console.log(`   👉 Result: ${passed ? '🎉 100% PASS' : '⚠️ FAILED'}`);
  return passed;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔬 END-TO-END VERIFICATION OF ALL 3 PLATFORM SCREENS');
  console.log('═══════════════════════════════════════════════════════════════════');

  // 1. Holding Screen (Заглушка) — triggered by Host: smmplan.pro, NOT by ?mode=holding
  //    Simulate what Cloudflare does: redirect smmplan.pro → Tailscale URL with ?mode=holding
  //    The proxy sees original host in x-forwarded-host, sets x-site-mode=holding
  const holdingPass = await testScreen(
    '1. ЗАГЛУШКА ПРЕДЗАПУСКА (PreLaunchHoldingScreen) [Host: smmplan.pro]',
    'http://127.0.0.1:3000/?mode=holding',
    ['Скоро официальное открытие', 'Удобная SMM-панель', 'Готовность платформы', 'Вход в панель'],
    ['Показать тарифы →'],
    { 'x-forwarded-host': 'smmplan.pro' }
  );

  // 2. SMMplan Main Platform (Основной сайт) — test.smmplan.pro with ?mode=holding in URL
  //    Must show catalog NOT holding, even if ?mode=holding is in URL (stale browser cache scenario)
  const smmplanPass = await testScreen(
    '2. ОСНОВНОЙ САЙТ SMMPLAN [Host: test.smmplan.pro, even with ?mode=holding]',
    'http://127.0.0.1:3000/?mode=holding',
    ['Telegram, VK и соцсетях', 'Показать тарифы →', 'Telegram', 'ВКонтакте'],
    ['Скоро официальное открытие'],
    { 'x-forwarded-host': 'test.smmplan.pro' }
  );

  // 3. SMMflux Radiant Aurora Storefront (Витрина Flux)
  const fluxPass = await testScreen(
    '3. ВИТРИНА SMMFLUX (FluxOrderClient)',
    'http://127.0.0.1:3000/?tenant=flux',
    ['Что хотите', 'продвигать', 'SMMflux'],
    ['Скоро официальное открытие', 'Показать тарифы →']
  );

  console.log('\n═══════════════════════════════════════════════════════════════════');
  const allPassed = holdingPass && smmplanPass && fluxPass;
  console.log(`  OVERALL STATUS: ${allPassed ? '✅ ALL 3 SCREENS VERIFIED & 100% PASS' : '❌ SOME TESTS FAILED'}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (!allPassed) process.exit(1);
}

main().catch(console.error);
