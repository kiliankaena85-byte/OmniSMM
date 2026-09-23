import fs from 'fs';
import path from 'path';
import https from 'https';

const BRANDS = [
  { slug: 'vk', simpleIconSlug: 'vk', color: '0077FF' },
  { slug: 'telegram', simpleIconSlug: 'telegram', color: '26A5E4' },
  { slug: 'instagram', simpleIconSlug: 'instagram', color: 'E4405F' },
  { slug: 'youtube', simpleIconSlug: 'youtube', color: 'FF0000' },
  { slug: 'tiktok', simpleIconSlug: 'tiktok', color: '000000' },
  { slug: 'twitch', simpleIconSlug: 'twitch', color: '9146FF' },
  { slug: 'kick', simpleIconSlug: 'kick', color: '53FC18' },
  { slug: 'x', simpleIconSlug: 'x', color: '000000' },
  { slug: 'facebook', simpleIconSlug: 'facebook', color: '0866FF' },
  { slug: 'discord', simpleIconSlug: 'discord', color: '5865F2' },
  { slug: 'reddit', simpleIconSlug: 'reddit', color: 'FF4500' },
  { slug: 'pinterest', simpleIconSlug: 'pinterest', color: 'BD081C' },
  { slug: 'spotify', simpleIconSlug: 'spotify', color: '1DB954' },
  { slug: 'steam', simpleIconSlug: 'steam', color: '000000' },
  { slug: 'whatsapp', simpleIconSlug: 'whatsapp', color: '25D366' },
  { slug: 'linkedin', simpleIconSlug: 'linkedin', color: '0A66C2' },
  { slug: 'soundcloud', simpleIconSlug: 'soundcloud', color: 'FF5500' },
  { slug: 'threads', simpleIconSlug: 'threads', color: '000000' },
  { slug: 'snapchat', simpleIconSlug: 'snapchat', color: 'FFFC00' },
  { slug: 'rutube', simpleIconSlug: 'rutube', color: '002882' },
  { slug: 'dzen', simpleIconSlug: 'dzen', color: '000000' },
  { slug: 'ok', simpleIconSlug: 'odnoklassniki', color: 'F58220' }
];

async function downloadSimpleIcon(simpleIconSlug: string, color: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://cdn.simpleicons.org/${simpleIconSlug}/${color}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('<svg')) {
          resolve(data);
        } else {
          reject(new Error(`Failed to fetch ${url} (status: ${res.statusCode})`));
        }
      });
    }).on('error', reject);
  });
}

// Fallback high-quality official SVG paths for key brands if network is restricted
const OFFICIAL_SVGS: Record<string, string> = {
  vk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path fill="#0077FF" d="M0 12C0 5.373 5.373 0 12 0s12 5.373 12 12-5.373 12-12 12S0 18.627 0 12z"/><path fill="#FFFFFF" d="M13.162 16.53c-4.475 0-7.067-3.09-7.18-8.24h2.51c.075 3.738 1.636 5.343 2.876 5.656V8.29h2.38v3.23c1.222-.132 2.502-1.636 2.934-3.23h2.38c-.376 1.956-1.745 3.39-2.73 4.09 1.004.58 2.556 1.832 3.166 4.15h-2.585c-.47-1.637-1.77-2.906-3.165-3.085v3.085h-2.586z"/></svg>`,
  telegram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path fill="#26A5E4" d="M0 12C0 5.373 5.373 0 12 0s12 5.373 12 12-5.373 12-12 12S0 18.627 0 12z"/><path fill="#FFFFFF" d="m5.453 11.837 12.35-4.764c.572-.207 1.073.143.886.993l-2.102 9.907c-.155.703-.574.877-1.16.546l-3.244-2.39-1.564 1.506c-.173.173-.319.319-.652.319l.233-3.305 6.015-5.434c.261-.233-.058-.363-.404-.131l-7.433 4.68-3.203-1.001c-.697-.218-.71-.697.146-1.033z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><radialGradient id="ig-rg" cx="2" cy="22" r="21" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFD600"/><stop offset=".1" stop-color="#FF7A00"/><stop offset=".5" stop-color="#FF0069"/><stop offset="1" stop-color="#7638FA"/></radialGradient><rect width="24" height="24" rx="6" fill="url(#ig-rg)"/><path fill="#FFFFFF" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" rx="6" fill="#000000"/><path fill="#FFFFFF" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
};

async function updateAllBrandLogos() {
  console.log('=== ОБНОВЛЕНИЕ ВСЕХ ЛОГОТИПОВ НА ЭТАЛОННЫЕ ОФИЦИАЛЬНЫЕ SVG ===\n');
  const brandsDir = path.join(process.cwd(), 'public', 'brands');
  const logosDir = path.join(process.cwd(), 'public', 'assets', 'logos');

  if (!fs.existsSync(brandsDir)) fs.mkdirSync(brandsDir, { recursive: true });
  if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

  for (const brand of BRANDS) {
    let svgContent = OFFICIAL_SVGS[brand.slug];
    
    if (!svgContent) {
      try {
        svgContent = await downloadSimpleIcon(brand.simpleIconSlug, brand.color);
      } catch (err: any) {
        console.warn(`⚠️ Не удалось скачать ${brand.slug}: ${err.message}`);
      }
    }

    if (svgContent) {
      const filePath1 = path.join(brandsDir, `${brand.slug}.svg`);
      const filePath2 = path.join(logosDir, `${brand.slug}.svg`);
      fs.writeFileSync(filePath1, svgContent, 'utf-8');
      fs.writeFileSync(filePath2, svgContent, 'utf-8');
      console.log(`✅ [${brand.slug}] Записан эталонный официальный логотип (Simple Icons / Wikimedia)`);
    }
  }

  // Также копируем эталонный vk.svg в vkontakte.svg для обратной совместимости
  const vkSvg = OFFICIAL_SVGS.vk;
  fs.writeFileSync(path.join(brandsDir, 'vkontakte.svg'), vkSvg, 'utf-8');
  fs.writeFileSync(path.join(logosDir, 'vkontakte.svg'), vkSvg, 'utf-8');
  console.log(`✅ [vkontakte] Дублирован эталонный VK логотип`);
}

updateAllBrandLogos().catch(console.error);
