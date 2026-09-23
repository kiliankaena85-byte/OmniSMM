import { db } from '../src/lib/db';

async function deactivateDeprecated() {
  const deprecated = await db.service.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: 'DEPRECATED' } },
        { name: { contains: 'АРХИВ' } },
        { name: { contains: 'ТЕСТ' } }
      ]
    }
  });
  console.log('Found ' + deprecated.length + ' active deprecated services:');
  for (const s of deprecated) {
    console.log('Deactivating: [' + s.id + '] ' + s.name);
    await db.service.update({
      where: { id: s.id },
      data: { isActive: false }
    });
  }
}

deactivateDeprecated()
  .catch(console.error)
  .finally(() => db.$disconnect());
