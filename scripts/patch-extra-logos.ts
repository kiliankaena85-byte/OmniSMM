import fs from 'fs';
import path from 'path';

const EXTRA_OFFICIAL_SVGS: Record<string, string> = {
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path fill="#0A66C2" d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12z"/><path fill="#FFFFFF" d="M19 19h-3.328v-5.21c0-1.243-.024-2.843-1.733-2.843-1.735 0-2 1.354-2 2.753V19H8.61V8.297h3.195v1.463h.045c.445-.844 1.534-1.734 3.158-1.734 3.378 0 4.002 2.223 4.002 5.114V19zM5.337 6.83a1.932 1.932 0 1 1 0-3.864 1.932 1.932 0 0 1 0 3.864zm1.664 12.17H3.673V8.297h3.328V19z"/></svg>`,
  rutube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" rx="5" fill="#002882"/><path fill="#FFFFFF" d="M5 6h5.8c2.4 0 4.2 1.5 4.2 3.6 0 1.6-.9 2.9-2.3 3.4L16 18h-3l-2.8-4.6H8V18H5V6zm3 5h2.6c1 0 1.8-.7 1.8-1.5s-.8-1.5-1.8-1.5H8v3z"/><circle cx="18.5" cy="8.5" r="2.5" fill="#E61610"/></svg>`,
  dzen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" rx="5" fill="#000000"/><path fill="#FFFFFF" d="M12 2c.4 5.3 4.7 9.6 10 10-5.3.4-9.6 4.7-10 10-.4-5.3-4.7-9.6-10-10 5.3-.4 9.6-4.7 10-10z"/></svg>`,
  max: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" rx="5" fill="#000000"/><path fill="#FFFFFF" d="M18 6.5h-2.5L12 11.8 8.5 6.5H6v11h2.5v-7.2l3.5 5.2 3.5-5.2v7.2H18v-11z"/></svg>`
};

function patchExtraLogos() {
  const brandsDir = path.join(process.cwd(), 'public', 'brands');
  const logosDir = path.join(process.cwd(), 'public', 'assets', 'logos');

  for (const [slug, svg] of Object.entries(EXTRA_OFFICIAL_SVGS)) {
    fs.writeFileSync(path.join(brandsDir, `${slug}.svg`), svg, 'utf-8');
    fs.writeFileSync(path.join(logosDir, `${slug}.svg`), svg, 'utf-8');
    console.log(`✅ [${slug}] Записан эталонный векторный SVG`);
  }
}

patchExtraLogos();
