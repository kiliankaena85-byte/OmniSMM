import { PrismaClient } from '@prisma/client';
import { getMimeType } from '../src/lib/mime';

const db = new PrismaClient();

async function main() {
  console.log('🚀 Запуск батч-миграции исторических вложений support...');

  const BATCH_SIZE = 100;
  let skip = 0;
  let migratedCount = 0;

  while (true) {
    console.log(`⏳ Загрузка батча сообщений (пропуск: ${skip}, размер: ${BATCH_SIZE})...`);
    
    const messages = await db.ticketMessage.findMany({
      where: {
        mediaUrl: { not: null },
        NOT: { mediaUrl: 'uploading...' }
      },
      take: BATCH_SIZE,
      skip,
      orderBy: { createdAt: 'asc' }
    });

    if (messages.length === 0) {
      console.log('🏁 Батчи закончились. Сообщений с медиа больше нет.');
      break;
    }

    console.log(`📦 Обработка ${messages.length} сообщений в батче...`);

    // Оптимизация O(1) запросов к БД на батч
    const messageIds = messages.map(m => m.id);
    const existing = await db.messageAttachment.findMany({
      where: { messageId: { in: messageIds } },
      select: { messageId: true }
    });
    const existingIds = new Set(existing.map(e => e.messageId));

    for (const msg of messages) {
      // Идемпотентность: защита от дублирования
      if (existingIds.has(msg.id)) {
        continue;
      }

      const mediaUrl = msg.mediaUrl!;
      const mediaType = msg.mediaType || 'document';

      // NOTE: For historical records, original filename is not available.
      // We use the slugified filename from the URL as a best-effort approximation.
      const name = mediaUrl.split('/').pop() || 'attachment';
      const mimeType = getMimeType(name);

      // Создаем запись в MessageAttachment
      await db.messageAttachment.create({
        data: {
          messageId: msg.id,
          url: mediaUrl,
          type: mediaType.toLowerCase(),
          mimeType: mimeType,
          name: name, // имя файла на сервере
          createdAt: msg.createdAt
        }
      });

      migratedCount++;
    }

    skip += messages.length;
  }

  console.log(`\n🎉 Успешно завершено! Перенесено новых вложений: ${migratedCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка выполнения скрипта миграции:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
