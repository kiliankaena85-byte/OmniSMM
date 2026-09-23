import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { db } from '../src/lib/db';

async function main() {
  const brandsDir = path.join(process.cwd(), 'public', 'brands');

  // Скачиваем недостающие иконки с SimpleIcons
  const toDownload = [
    { slug: 'tumblr', url: 'https://cdn.simpleicons.org/tumblr' },
    { slug: 'rumble', url: 'https://cdn.simpleicons.org/rumble' },
    { slug: 'medium', url: 'https://cdn.simpleicons.org/medium' },
    { slug: 'quora', url: 'https://cdn.simpleicons.org/quora' },
    { slug: 'audiomack', url: 'https://cdn.simpleicons.org/audiomack' },
    { slug: 'applemusic', url: 'https://cdn.simpleicons.org/applemusic' }, // для категории Music
  ];

  for (const item of toDownload) {
    const dest = path.join(brandsDir, `${item.slug}.svg`);
    if (!fs.existsSync(dest)) {
      console.log(`Скачиваю: ${item.slug}.svg...`);
      execSync(`curl -s ${item.url} > "${dest}"`);
    } else {
      console.log(`Иконка ${item.slug}.svg уже существует.`);
    }
  }

  // Маппинг Network -> имя файла
  const iconMapping: Record<string, string> = {
    'TELEGRAM': '/brands/telegram.svg',
    'VK': '/brands/vk.svg',
    'INSTAGRAM': '/brands/instagram.svg',
    'YOUTUBE': '/brands/youtube.svg',
    'TIKTOK': '/brands/tiktok.svg',
    'TWITCH': '/brands/twitch.svg',
    'KICK': '/brands/kick.svg',
    'TWITTER': '/brands/x.svg',
    'WEBSITE': '/brands/web.svg',
    'OK': '/brands/ok.svg',
    'FACEBOOK': '/brands/facebook.svg',
    'RUTUBE': '/brands/rutube.svg',
    'MAX': '/brands/max.svg',
    'DISCORD': '/brands/discord.svg',
    'DZEN': '/brands/dzen.svg',
    'SPOTIFY': '/brands/spotify.svg',
    'LIKEE': '/brands/likee.svg',
    'YANDEX': '/brands/yandex.svg',
    'STEAM': '/brands/steam.svg',
    'WHATSAPP': '/brands/whatsapp.svg',
    'LINKEDIN': '/brands/linkedin.svg',
    'SOUNDCLOUD': '/brands/soundcloud.svg',
    'TROVO': '/brands/trovo.svg',
    'THREADS': '/brands/threads.svg',
    'PINTEREST': '/brands/pinterest.svg',
    'GOOGLE': '/brands/google.svg',
    'REDDIT': '/brands/reddit.svg',
    'TUMBLR': '/brands/tumblr.svg',
    'RUMBLE': '/brands/rumble.svg',
    'MEDIUM': '/brands/medium.svg',
    'MUSIC': '/brands/applemusic.svg',
    'QUORA': '/brands/quora.svg',
    'AUDIOMACK': '/brands/audiomack.svg',
    'OTHER': '/brands/generic.svg',
  };

  let updatedCount = 0;
  const networks = await db.network.findMany();

  for (const net of networks) {
    const expectedIcon = iconMapping[net.name];
    if (expectedIcon && net.icon !== expectedIcon) {
      await db.network.update({
        where: { id: net.id },
        data: { icon: expectedIcon }
      });
      updatedCount++;
      console.log(`✅ Привязана иконка к сети ${net.name}: ${expectedIcon}`);
    }
  }

  console.log(`\nГотово! Скачано недостающих иконок, привязано к сетям: ${updatedCount}`);
}

main().catch(console.error);
