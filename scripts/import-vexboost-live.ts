import { db } from '../src/lib/db';
import { encrypt } from '../src/lib/crypto/encryption';

const VEXBOOST_KEY = process.env.VEXBOOST_API_KEY || 'Pp1kBnSehTsGaC5UmER0Kp6PcqIqG7TljnqNSX650Fpis4u5TwiSYXrDjEAh';
const VEXBOOST_URL = 'https://vexboost.ru/api/v2';

const NETWORK_MAP: Record<string, { name: string; slug: string }> = {
  'telegram': { name: 'Telegram', slug: 'telegram' },
  'telegram premium': { name: 'Telegram', slug: 'telegram' },
  'telegram звезды': { name: 'Telegram', slug: 'telegram' },
  'vk': { name: 'VKontakte', slug: 'vkontakte' },
  'vkontakte': { name: 'VKontakte', slug: 'vkontakte' },
  'instagram': { name: 'Instagram', slug: 'instagram' },
  'youtube': { name: 'YouTube', slug: 'youtube' },
  'tiktok': { name: 'TikTok', slug: 'tiktok' },
  'twitter': { name: 'Twitter', slug: 'twitter' },
  'facebook': { name: 'Facebook', slug: 'facebook' },
  'twitch': { name: 'Twitch', slug: 'twitch' },
  'kick': { name: 'Kick', slug: 'kick' },
  'rutube': { name: 'Rutube', slug: 'rutube' },
  'yandex zen': { name: 'Дзен', slug: 'dzen' },
  'одноклассники': { name: 'OK', slug: 'ok' },
  'ok': { name: 'OK', slug: 'ok' },
  'discord': { name: 'Discord', slug: 'discord' },
  'spotify': { name: 'Spotify', slug: 'spotify' },
  'likee': { name: 'Likee', slug: 'likee' },
  'whatsapp': { name: 'WhatsApp', slug: 'whatsapp' },
  'website traffic': { name: 'Веб-трафик', slug: 'website' },
  'steam': { name: 'Steam', slug: 'steam' },
  'trovo': { name: 'Trovo', slug: 'trovo' },
  'max': { name: 'MAX', slug: 'max' },
  'wibes': { name: 'Wibes', slug: 'wibes' },
  'other': { name: 'Другое', slug: 'other' }
};

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\wа-яА-ЯёЁ\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'cat-' + Math.random().toString(36).substring(2, 7);
}

function cleanVendorLeaks(name: string): string {
  return name
    .replace(/\bvexboost\b/gi, '')
    .replace(/\bprimelike\b/gi, '')
    .replace(/\bsmmbox\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('🚀 [Vexboost Importer] Starting real services import...');

  let provider = await db.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  const encryptedKey = encrypt(VEXBOOST_KEY);

  if (!provider) {
    provider = await db.provider.create({
      data: {
        name: 'Vexboost',
        apiUrl: VEXBOOST_URL,
        apiKey: encryptedKey,
        isActive: true,
        balanceCurrency: 'RUB',
        providerType: 'SMM_PANEL'
      }
    });
    console.log('✅ Created Vexboost provider: ' + provider.id);
  } else {
    provider = await db.provider.update({
      where: { id: provider.id },
      data: {
        apiUrl: VEXBOOST_URL,
        apiKey: encryptedKey,
        isActive: true,
        balanceCurrency: 'RUB'
      }
    });
    console.log('✅ Updated Vexboost provider: ' + provider.id);
  }

  console.log('📡 Fetching live services from Vexboost API...');
  const res = await fetch(VEXBOOST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: VEXBOOST_KEY, action: 'services' })
  });

  if (!res.ok) {
    throw new Error('Failed to fetch: ' + res.status + ' ' + res.statusText);
  }

  const rawServices = await res.json();
  if (!Array.isArray(rawServices)) {
    throw new Error('Unexpected API response: ' + JSON.stringify(rawServices));
  }

  console.log('📥 Successfully fetched ' + rawServices.length + ' raw services from Vexboost!');

  const networkCache = new Map<string, any>();
  const categoryCache = new Map<string, any>();

  const existingNets = await db.network.findMany();
  for (const n of existingNets) {
    networkCache.set(n.slug, n);
    networkCache.set(n.name.toLowerCase(), n);
  }

  const existingCats = await db.category.findMany();
  for (const c of existingCats) {
    categoryCache.set(c.networkId + ':' + c.name.toLowerCase(), c);
  }

  let importedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const item of rawServices) {
    try {
      const rawNet = (item.network || 'Other').toLowerCase().trim();
      const netMeta = NETWORK_MAP[rawNet] || { name: item.network || 'Другое', slug: slugify(item.network || 'other') };

      let network = networkCache.get(netMeta.slug);
      if (!network) {
        network = await db.network.upsert({
          where: { slug: netMeta.slug },
          update: { name: netMeta.name, isActive: true },
          create: {
            name: netMeta.name,
            slug: netMeta.slug,
            isActive: true,
            tenantId: 'smmplan',
            sort: 10
          }
        });
        networkCache.set(netMeta.slug, network);
        networkCache.set(netMeta.name.toLowerCase(), network);
      }

      const catName = (item.category || 'Общее').trim();
      const catKey = network.id + ':' + catName.toLowerCase();
      let category = categoryCache.get(catKey);

      if (!category) {
        const catSlug = slugify(netMeta.slug + '-' + catName);
        category = await db.category.upsert({
          where: { slug: catSlug },
          update: { name: catName, networkId: network.id },
          create: {
            name: catName,
            slug: catSlug,
            networkId: network.id,
            tenantId: 'smmplan',
            sort: 10
          }
        });
        categoryCache.set(catKey, category);
      }

      const extId = String(item.service);
      const cleanName = cleanVendorLeaks(item.name || ('Service #' + extId));
      const rateNum = parseFloat(item.rate) || 0;
      const minQty = parseInt(item.min, 10) || 10;
      const maxQty = parseInt(item.max, 10) || 100000;
      const markup = 3.0;
      const pricePer1000Cents = Math.round(rateNum * markup * 100);

      const existingService = await db.service.findFirst({
        where: {
          providerId: provider.id,
          externalId: extId
        }
      });

      let serviceId = '';

      if (existingService) {
        await db.service.update({
          where: { id: existingService.id },
          data: {
            name: cleanName,
            categoryId: category.id,
            rate: rateNum,
            costPer1kRub: rateNum,
            providerCurrency: 'RUB',
            markup: markup,
            minQty: minQty,
            maxQty: maxQty,
            isCancelEnabled: Boolean(item.cancel || item.canceling_is_available),
            isRefillEnabled: Boolean(item.refill),
            isActive: true,
            pricePer1000Cents: pricePer1000Cents
          }
        });
        serviceId = existingService.id;
        updatedCount++;
      } else {
        const newService = await db.service.create({
          data: {
            name: cleanName,
            categoryId: category.id,
            providerId: provider.id,
            externalId: extId,
            rate: rateNum,
            costPer1kRub: rateNum,
            providerCurrency: 'RUB',
            markup: markup,
            minQty: minQty,
            maxQty: maxQty,
            isCancelEnabled: Boolean(item.cancel || item.canceling_is_available),
            isRefillEnabled: Boolean(item.refill),
            isActive: true,
            pricePer1000Cents: pricePer1000Cents,
            tenantId: 'smmplan'
          }
        });
        serviceId = newService.id;
        importedCount++;
      }

      await db.serviceRoute.upsert({
        where: {
          serviceId_providerId: {
            serviceId: serviceId,
            providerId: provider.id
          }
        },
        update: {
          providerServiceId: extId,
          isPrimary: true,
          isActive: true
        },
        create: {
          serviceId: serviceId,
          providerId: provider.id,
          providerServiceId: extId,
          isPrimary: true,
          isActive: true,
          priority: 0
        }
      });

    } catch (err) {
      errorCount++;
      console.error('❌ Error on item ' + item?.service + ':', err);
    }
  }

  console.log('\n==========================================');
  console.log('🎉 Vexboost Live Import Finished!');
  console.log('✨ Newly created: ' + importedCount);
  console.log('🔄 Updated: ' + updatedCount);
  console.log('⚠️ Errors: ' + errorCount);
  console.log('📊 Total services: ' + (importedCount + updatedCount));
  console.log('==========================================');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
