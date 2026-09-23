/**
 * Test page.tsx rendering for all 4 hosts:
 * 1. smmplan.pro (Should be PreLaunchHoldingScreen / Заглушка)
 * 2. test.smmplan.pro (Should be SmartLinkLanding / SMMplan order platform)
 * 3. flux.smmplan.pro (Should be FluxOrderClient / SMMflux Radiant Aurora)
 * 4. desktop-25m6el7.tailbb9d28.ts.net (Tailscale direct node)
 * 5. desktop-25m6el7.tailbb9d28.ts.net?tenant=flux (Tailscale Flux mode)
 */

async function probe(host: string, path: string = '/') {
  const url = `http://127.0.0.1:3000${path}`;
  const res = await fetch(url, {
    headers: {
      'Host': host,
      'User-Agent': 'Mozilla/5.0 SMMplan-Auditor',
    },
  });

  const html = await res.text();
  
  let detected = 'UNKNOWN';
  if (html.includes('PreLaunchHoldingScreen') || html.includes('Скоро открытие') || html.includes('закрытый бета-тест') || html.includes('Предзапуск')) {
    detected = '🛑 PreLaunchHoldingScreen (ЗАГЛУШКА)';
  } else if (html.includes('FluxOrderClient') || html.includes('SMMflux') || html.includes('Быстрый заказ без регистрации') || html.includes('Radiant Aurora')) {
    detected = '⚡ FluxOrderClient (SMMFLUX)';
  } else if (html.includes('SmartLinkLanding') || html.includes('Выберите категорию') || html.includes('Каталог услуг') || html.includes('Оптовая платформа')) {
    detected = '🚀 SmartLinkLanding (SMMPLAN САЙТ ЗАКАЗА)';
  }

  console.log(`Host: [${host.padEnd(38)}] Path: [${path}] -> ${detected}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔍 Multi-Host Rendering Diagnostic (smmplan / test / flux)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await probe('smmplan.pro');
  await probe('www.smmplan.pro');
  await probe('test.smmplan.pro');
  await probe('flux.smmplan.pro');
  await probe('desktop-25m6el7.tailbb9d28.ts.net');
  await probe('desktop-25m6el7.tailbb9d28.ts.net', '/?tenant=flux');
  await probe('desktop-25m6el7.tailbb9d28.ts.net', '/?contour=test');

  console.log('\n═══════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
