import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const map = {
  'Behance': '/brands/behance.svg',
  'Discord': '/brands/discord.svg',
  'Facebook': '/brands/facebook.svg',
  'GitHub': '/brands/github.svg',
  'Instagram': '/brands/instagram.svg',
  'Kick': '/brands/kick.svg',
  'Likee': '/brands/likee.svg',
  'LinkedIn': '/brands/linkedin.svg',
  'Odnoklassniki': '/brands/ok.svg',
  'Pikabu': '/brands/pikabu.svg',
  'Pinterest': '/brands/pinterest.svg',
  'Quora': '/brands/quora.svg',
  'Reddit': '/brands/reddit.svg',
  'Rumble': '/brands/rumble.svg',
  'Rutube': '/brands/rutube.svg',
  'SoundCloud': '/brands/soundcloud.svg',
  'Spotify': '/brands/spotify.svg',
  'Telegram': '/brands/telegram.svg',
  'Threads': '/brands/threads.svg',
  'TikTok': '/brands/tiktok.svg',
  'Trovo': '/brands/trovo.svg',
  'Tumblr': '/brands/tumblr.svg',
  'Twitch': '/brands/twitch.svg',
  'VKontakte': '/brands/vk.svg',
  'Viber': '/brands/viber.svg',
  'WhatsApp': '/brands/whatsapp.svg',
  'Yandex Dzen': '/brands/dzen.svg',
  'YouTube': '/brands/youtube.svg'
};

async function main() {
  let count = 0;
  for (const [name, icon] of Object.entries(map)) {
    const res = await prisma.network.updateMany({
      where: { name },
      data: { icon }
    });
    count += res.count;
  }
  console.log(`Updated ${count} network icons.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
