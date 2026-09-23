import { sendAdminAlertSync } from '@/lib/notifications';
import { db } from '@/lib/db';
import { getTenantHost } from '@/lib/seo-helpers';

export interface TelegramDigestPayload {
  snapshotId: string;
  tenantId: string;
  totalLeakageRub: number;
  leakingServicesCount: number;
}

export class AiPricingTelegramDispatcher {
  public static async dispatchNightlyDigest(payload: TelegramDigestPayload): Promise<void> {
    const { snapshotId, tenantId, totalLeakageRub, leakingServicesCount } = payload;

    const topRecommendations = await db.aiPricingRecommendation.findMany({
      where: { snapshotId, status: 'PENDING' },
      include: { service: true },
      orderBy: { projectedMonthlyGainRub: 'desc' },
      take: 3,
    });

    const host = getTenantHost(tenantId);
    const directUrl = `https://${host}/admin/economics/recommendations?snapshotId=${snapshotId}`;

    const lines: string[] = [
      `🤖 <b>[AI Economic Optimizer] Ночной аудит (${tenantId.toUpperCase()})</b>`,
      `💰 Обнаруженная ежемесячная утечка маржи: <b>${Math.round(totalLeakageRub).toLocaleString('ru-RU')} ₽</b>`,
      `📦 Услуг, требующих коррекции: <b>${leakingServicesCount} шт.</b>`,
      '',
      `<b>ТОП-3 Рекомендаций по прибыли:</b>`,
    ];

    topRecommendations.forEach((rec, idx) => {
      lines.push(
        `${idx + 1}. <b>${rec.service.name.slice(0, 30)}</b>: ${rec.currentPriceRub} ₽ ➔ <b>${rec.proposedPriceRub} ₽</b> (+${Math.round(rec.projectedMonthlyGainRub)} ₽/мес)`
      );
    });

    lines.push('');
    lines.push(`🔗 <a href="${directUrl}">Утвердить в 1-клик в админке</a>`);

    const messageHtml = lines.join('\n');
    sendAdminAlertSync(messageHtml, 'WARNING');
  }
}
