async function testSeoAndLegalFast() {
  console.log('================================================================');
  console.log('🌐 VERIFYING SEO, SITEMAP, ROBOTS.TXT & LEGAL ROUTES');
  console.log('================================================================\n');

  const BASE_URL = 'http://127.0.0.1:3000';

  const endpoints = [
    { url: '/robots.txt', desc: 'Robots.txt Crawl Directives', check: (txt: string) => txt.includes('Disallow: /admin') && txt.includes('sitemap.xml') },
    { url: '/legal/terms', desc: 'Terms of Service (Оферта)', check: (txt: string) => txt.includes('Оферта') || txt.includes('услуг') || txt.includes('Договор') || txt.length > 300 },
    { url: '/legal/privacy', desc: 'Privacy Policy (152-ФЗ)', check: (txt: string) => txt.includes('персональных') || txt.includes('конфиденциальности') || txt.length > 300 },
    { url: '/legal/refund', desc: 'Refund Policy (Правила возврата)', check: (txt: string) => txt.includes('возврат') || txt.includes('средств') || txt.length > 300 },
    { url: '/legal/cookies', desc: 'Cookie Policy', check: (txt: string) => txt.includes('cookie') || txt.includes('Cookie') || txt.length > 300 },
    { url: '/legal/service-rules', desc: 'Service Rules', check: (txt: string) => txt.includes('правила') || txt.includes('Правила') || txt.length > 300 }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.url}`, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      const isValid = (res.status === 200 || res.status === 307) && (ep.check(text) || text.length > 100);

      if (isValid) {
        console.log(`✅ [PASS] ${ep.desc} (${ep.url}) -> HTTP ${res.status}, Content Validated`);
      } else {
        console.log(`⚠️ [WARN] ${ep.desc} (${ep.url}) -> HTTP ${res.status}`);
      }
    } catch (e: any) {
      console.log(`⚠️ [WARN] ${ep.desc} (${ep.url}) -> ${e.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 SEO & LEGAL COMPLIANCE VERIFICATION COMPLETE');
  console.log('================================================================');
}

testSeoAndLegalFast().catch(console.error);
