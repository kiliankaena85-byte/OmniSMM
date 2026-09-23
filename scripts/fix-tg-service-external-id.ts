import { db } from '../src/lib/db';

async function main() {
  console.log('Fixing Telegram Подписчики (Эконом)...');
  const service = await db.service.findFirst({
    where: { name: 'Telegram Подписчики (Эконом)' }
  });
  if (service) {
    const updated = await db.service.update({
      where: { id: service.id },
      data: { externalId: 'mock_tg_sub_econom' }
    });
    console.log('Successfully updated service externalId:', updated.externalId);
  } else {
    console.log('Service Telegram Подписчики (Эконом) not found in DB.');
  }
}

main().finally(async () => {
  await db.$disconnect();
});
