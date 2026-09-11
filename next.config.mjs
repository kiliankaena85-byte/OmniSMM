import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
/**
 * Dynamic Allowed Origins Generator for Next.js 16 Server Actions & Dev Server.
 * Supports exact domains, wildcards (*.ts.net, *.trycloudflare.com), and dynamic ENV hydration.
 */
function buildAllowedOrigins() {
  const isProdContour = process.env.NODE_ENV === 'production' && process.env.CONTOUR === 'prod';

  // Production contour: tunnel wildcards restricted; enabled in dev/test/staging or via explicit ENV
  const tunnelWildcards = isProdContour ? [] : [
    '*.ts.net',
    '*.trycloudflare.com',
    '*.loca.lt',
    '*.ngrok-free.app',
    '*.ngrok.app',
    '*.ngrok.io',
  ];

  const baseWildcards = [
    // Production brand domains & subdomains
    'smmplan.pro',
    '*.smmplan.pro',
    'smmflux.ru',
    '*.smmflux.ru',
    'smmplan.ru',
    '*.smmplan.ru',
    ...tunnelWildcards,
  ];

  const localOrigins = [
    'localhost',
    'localhost:3000',
    'localhost:3001',
    '127.0.0.1',
    '127.0.0.1:3000',
    '127.0.0.1:3001',
    '0.0.0.0:3000',
    'host.docker.internal:3000',
    '192.168.*',
    '192.168.*:3000',
    '10.*',
    '10.*:3000',
    '26.*',
    '26.*:3000',
  ];

  const envOrigins = [];

  // 1. APP_URL & NEXT_PUBLIC_APP_URL
  const appUrls = [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.BASE_URL];
  for (const u of appUrls) {
    if (u) {
      try {
        const parsed = new URL(u);
        envOrigins.push(parsed.host);
      } catch {}
    }
  }

  // 2. TUNNEL_DOMAIN (comma-separated or single)
  if (process.env.TUNNEL_DOMAIN) {
    const list = process.env.TUNNEL_DOMAIN.split(',').map(s => s.trim()).filter(Boolean);
    envOrigins.push(...list);
  }

  // 3. ALLOWED_ORIGINS (comma-separated list for custom mirrors / white-label tenants)
  if (process.env.ALLOWED_ORIGINS) {
    const list = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
    envOrigins.push(...list);
  }

  // Deduplicate and sanitize
  const combined = Array.from(new Set([
    ...baseWildcards,
    ...localOrigins,
    ...envOrigins
  ])).filter(Boolean);

  return combined;
}

const dynamicOrigins = buildAllowedOrigins();

const nextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ["@blocknote/core", "@blocknote/react", "@blocknote/server-util"],

  typescript: { ignoreBuildErrors: false },

  transpilePackages: ["@base-ui/react"],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: dynamicOrigins,
    },
  },
  allowedDevOrigins: dynamicOrigins,
  
  // OSAD-V2: Distributed Cache Sync for Redis (Disabled for standalone container portability)
  cacheHandler: undefined,

  // User-uploaded files use raw buffer response via /api/media/ (never _next/image), keeping static image optimization intact.
  images: {
    unoptimized: false,
  },
  async redirects() {
    return [
      {
        source: '/services/vkontakte/:path*',
        destination: '/services/vk/:path*',
        permanent: true,
      },
      {
        source: '/services/vkontakte',
        destination: '/services/vk',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://yookassa.ru" "https://auth.robokassa.ru")',
          },
          {
            key: 'X-XSS-Protection',
            value: '0',
          },
        ],
      },
    ];
  },
  // Fix: BullMQ uses dynamic require() in child-processor.js (known library pattern).
  // Suppresses false-positive "Critical dependency" webpack warning — validated 2026.
  // Source: github.com/taskforcesh/bullmq/issues + medium.com webpack docs
  webpack: (config) => {
    config.module.exprContextCritical = false;
    return config;
  },
};

export default nextConfig;
