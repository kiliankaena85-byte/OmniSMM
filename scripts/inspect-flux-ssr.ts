async function inspectFluxSSR() {
  const r = await fetch('http://127.0.0.1:3000/?tenant=flux');

  const html = await r.text();
  console.log('=== SMMFLUX SSR HTML INSPECTION ===');
  console.log('Status:', r.status);
  console.log('Has SMMflux:', html.includes('SMMflux'));
  console.log('Has Telegram in catalog payload:', html.includes('telegram'));
  console.log('Has VK in catalog payload:', html.includes('vk'));
  console.log('Has YouTube in catalog payload:', html.includes('youtube'));
  console.log('Has TikTok in catalog payload:', html.includes('tiktok'));
  console.log('Has Instagram in catalog payload:', html.includes('instagram'));

  // Check if categories are in JSON
  const catMatches = html.match(/tg-subscribers|vk-subscribers|yt-subscribers|ig-subscribers|tt-subscribers/g);
  console.log('Found category slugs in SSR payload:', [...new Set(catMatches || [])]);
}

inspectFluxSSR().catch(console.error);
