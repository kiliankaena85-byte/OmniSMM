async function inspectSSR() {
  const r = await fetch('http://127.0.0.1:3000/', {
    headers: {
      'x-tenant-id': 'smmplan'
    }
  });

  const html = await r.text();
  console.log('=== SSR HTML INSPECTION ===');
  console.log('Status:', r.status);
  console.log('Has SmartLinkLanding:', html.includes('Telegram, VK'));
  console.log('Has Service Cards:', html.includes('service-card') || html.includes('Цена за 1 шт'));
  console.log('Has Telegram:', html.includes('Telegram'));
  console.log('Has VK:', html.includes('ВКонтакте'));
  console.log('Has YouTube:', html.includes('YouTube'));
  console.log('Has TikTok:', html.includes('TikTok'));
  console.log('Has Instagram:', html.includes('Instagram'));

  const hasPricePer1k = html.includes('pricePer1kRub');
  console.log('Has pricePer1kRub in payload:', hasPricePer1k);

  const hasPricePerUnit = html.includes('pricePerUnitRub');
  console.log('Has pricePerUnitRub in payload:', hasPricePerUnit);

  // Search for service names in HTML
  const serviceMatches = html.match(/Telegram Подписчики.*?(?=")/g);
  console.log('Telegram service names found in SSR payload:', serviceMatches);
}

inspectSSR().catch(console.error);
