/**
 * Test what all 3 live Tailscale URLs actually return right now
 */

async function checkUrl(name: string, url: string) {
  console.log(`\n=== Testing ${name}: ${url} ===`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const html = await res.text();

  const isHolding = html.includes('Скоро официальное открытие') || html.includes('PreLaunchHoldingScreen') || html.includes('Готовность платформы');
  const isSmmplan = html.includes('Показать тарифы') || html.includes('SmartLinkLanding') || html.includes('Telegram, VK');
  const isFlux = html.includes('SMMflux') && (html.includes('Что хотите') || html.includes('Radiant Aurora') || html.includes('FluxOrderClient'));

  console.log(`Status: ${res.status}`);
  console.log(`Holding Screen: ${isHolding ? 'YES' : 'NO'}`);
  console.log(`SMMplan Site:   ${isSmmplan ? 'YES' : 'NO'}`);
  console.log(`SMMflux Site:   ${isFlux ? 'YES' : 'NO'}`);

  if (isHolding && !isSmmplan && !isFlux) {
    console.log('👉 RENDER: [ЗАГЛУШКА]');
  } else if (isFlux && !isHolding) {
    console.log('👉 RENDER: [SMMFLUX]');
  } else if (isSmmplan && !isHolding) {
    console.log('👉 RENDER: [SMMPLAN]');
  } else {
    console.log('👉 RENDER: [UNCERTAIN/MIXED]');
  }
}

async function main() {
  await checkUrl('1. smmplan.pro redirect destination', 'https://desktop-25m6el7.tailbb9d28.ts.net/?mode=holding');
  await checkUrl('2. test.smmplan.pro redirect destination', 'https://desktop-25m6el7.tailbb9d28.ts.net/');
  await checkUrl('3. flux.smmplan.pro redirect destination', 'https://desktop-25m6el7.tailbb9d28.ts.net/?tenant=flux');
}

main().catch(console.error);
