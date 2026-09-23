import { db as prisma } from '@/lib/db';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'QualityDetector' });

/**
 * Тихий детектор качества подписчиков (Mock Scorer Detector)
 * 
 * Работает в фоновом режиме (Silent Mode).
 * Рассчитывает качество поступивших подписчиков после завершения каждого транша dripfeed.
 * Никогда не выбрасывает исключения в основной поток выполнения, чтобы не прерывать доставку.
 */
export async function scanSubscriberQuality(
  campaignId: string,
  taskQuantity: number,
  link: string
): Promise<void> {
  try {
    log.info(`[QualityDetector] Запуск тихого сканирования качества для кампании ${campaignId}, порция: ${taskQuantity} шт.`);

    // 1. Проверяем существование кампании
    const campaign = await prisma.smartCampaign.findUnique({
      where: { id: campaignId },
      include: { service: { include: { category: { include: { network: true } } } } }
    });

    if (!campaign) {
      log.warn(`[QualityDetector] Кампания ${campaignId} не найдена для сканирования.`);
      return;
    }

    // 2. Сканируем только Telegram (по требованиям)
    const platformSlug = campaign.service.category?.network?.slug?.toLowerCase() || '';
    if (!platformSlug.includes('telegram') && !campaign.service.name.toLowerCase().includes('telegram')) {
      log.info(`[QualityDetector] Кампания ${campaignId} не относится к Telegram. Пропуск сканирования.`);
      return;
    }

    // 3. Получаем предыдущий слепок (Snapshot)
    const lastSnapshot = await prisma.smartSnapshot.findFirst({
      where: { campaignId },
      orderBy: { createdAt: 'desc' }
    });

    const previousMembers = lastSnapshot?.members || [];
    log.info(`[QualityDetector] Предыдущий слепок содержит ${previousMembers.length} подписчиков.`);

    // 4. Генерируем новые "прибывшие" аккаунты (симуляция)
    const newMembers: string[] = [];
    const suspiciousUsers: { telegramId: string; score: number; reasons: string[] }[] = [];

    // Возможные причины низкого качества
    const botReasons = ["NO_PHOTO", "RECENT_JOIN", "NUMERIC_USERNAME", "ARABIC_CHARS", "SUSPICIOUS_BIO"];

    for (let i = 0; i < taskQuantity; i++) {
      // Генерируем псевдослучайный хэш ID пользователя Telegram
      const tgId = crypto.randomBytes(8).toString('hex');
      newMembers.push(tgId);

      // Симулируем процент ботов (10% - 15% от порции)
      if (Math.random() < 0.12) {
        const score = Math.floor(Math.random() * 56) + 40; // Скоринг подозрительности 40-95%
        
        // Случайный набор причин (1-3 причины)
        const shuffled = [...botReasons].sort(() => 0.5 - Math.random());
        const reasonsCount = Math.floor(Math.random() * 2) + 1;
        const reasons = shuffled.slice(0, reasonsCount);

        suspiciousUsers.push({
          telegramId: tgId,
          score,
          reasons
        });
      }
    }

    // Объединяем старых и новых подписчиков
    const MAX_SNAPSHOT_MEMBERS = 5000;
    const combined = [...previousMembers, ...newMembers];
    const totalMembers = combined.length > MAX_SNAPSHOT_MEMBERS
      ? combined.slice(combined.length - MAX_SNAPSHOT_MEMBERS)
      : combined;

    // 5. Записываем результаты в БД в рамках единой транзакции
    await prisma.$transaction(async (tx) => {
      // Создаем новый слепок
      await tx.smartSnapshot.create({
        data: {
          campaignId,
          channelUrl: link,
          members: totalMembers
        }
      });

      // Записываем подозрительных пользователей
      if (suspiciousUsers.length > 0) {
        await tx.smartDetectedUser.createMany({
          data: suspiciousUsers.map(u => ({
            campaignId,
            telegramId: u.telegramId,
            score: u.score,
            reasons: u.reasons
          }))
        });
      }
    });

    log.info(
      `[QualityDetector] Сканирование завершено успешно. Создан новый слепок на ${totalMembers.length} пользователей. ` +
      `Обнаружено подозрительных ботов в порции: ${suspiciousUsers.length} шт.`
    );
  } catch (err: unknown) {
    // ВАЖНО: Тихо логируем ошибку в консоль и НЕ выбрасываем ее наружу, чтобы не сломать доставку Dripfeed
    log.error(`[QualityDetector] Critical error during silent quality scanning for campaign ${campaignId}:`, (err instanceof Error ? err.message : String(err)));
  }
}
