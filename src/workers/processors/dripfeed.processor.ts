import { db as prisma } from '@/lib/db';
import { providerService } from '@/services/providers/provider.service';
import { SmartCampaignStatus, SmartTaskStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'DripfeedProcessor' });

/**
 * Проверяет завершенность кампании и обновляет статус кампании и родительского заказа.
 */
async function checkAndCompleteCampaign(campaignId: string) {
  const campaign = await prisma.smartCampaign.findUnique({
    where: { id: campaignId },
    include: { tasks: true, order: true },
  });

  if (!campaign) return;

  const allTasks = campaign.tasks;
  const allFinished = allTasks.every(
    (t) => t.status === SmartTaskStatus.COMPLETED || t.status === SmartTaskStatus.ERROR
  );

  if (allFinished) {
    const hasError = allTasks.some((t) => t.status === SmartTaskStatus.ERROR);
    const finalStatus = hasError ? SmartCampaignStatus.ERROR : SmartCampaignStatus.COMPLETED;

    await prisma.smartCampaign.update({
      where: { id: campaign.id },
      data: { status: finalStatus },
    });

    if (campaign.orderId) {
      const parentOrderId = campaign.orderId;
      const orderTargetStatus = finalStatus === SmartCampaignStatus.COMPLETED ? 'COMPLETED' : 'ERROR';

      await prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: parentOrderId, status: 'IN_PROGRESS' },
          data: {
            status: orderTargetStatus,
            remains: 0,
            updatedAt: new Date()
          }
        });

        if (updated.count === 0) return; // Status already changed by sync processor

        // Handle proportional refund for ERROR campaigns
        if (orderTargetStatus === 'ERROR') {
          const order = await tx.order.findUnique({
            where: { id: parentOrderId },
            select: { userId: true, charge: true, numericId: true }
          });
          
          if (order && order.charge > 0) {
            const totalQty = campaign.totalQuantity || allTasks.reduce((acc, t) => acc + t.quantity, 0);
            const errorQty = allTasks
              .filter((t) => t.status === SmartTaskStatus.ERROR)
              .reduce((acc, t) => acc + t.quantity, 0);

            const refundRatio = totalQty > 0 ? errorQty / totalQty : 1;
            const refundCents = Math.floor(Number(order.charge) * refundRatio);

            if (refundCents > 0) {
              const { WalletOps } = await import('@/services/financial/wallet-ops');
              const refundKey = `refund-dripfeed-final-${parentOrderId}`;
              const existing = await tx.ledgerEntry.findFirst({ where: { idempotencyKey: refundKey } });
              if (!existing) {
                await WalletOps.refund(
                  tx,
                  order.userId,
                  refundCents,
                  `Авто-возврат (${errorQty}/${totalQty} шт): SmartCampaign #${order.numericId} не полностью выполнена`,
                  { idempotencyKey: refundKey }
                );
              }
            }
          }
        }

        // Handle commission proportionally
        const { LoyaltyService } = await import('@/services/users/loyalty.service');
        if (orderTargetStatus === 'COMPLETED') {
          await LoyaltyService.confirmCommission(tx, parentOrderId);
        } else {
          const totalQty = campaign.totalQuantity || allTasks.reduce((acc, t) => acc + t.quantity, 0);
          const errorQty = allTasks
            .filter((t) => t.status === SmartTaskStatus.ERROR)
            .reduce((acc, t) => acc + t.quantity, 0);
          const deliveredQty = Math.max(0, totalQty - errorQty);

          if (deliveredQty > 0) {
            await LoyaltyService.handlePartialCommission(tx, parentOrderId, errorQty, totalQty);
          } else {
            await LoyaltyService.reverseCommission(tx, parentOrderId);
          }
        }
      }, { isolationLevel: 'Serializable' });
    }

    log.info(`[Dripfeed] SmartCampaign ${campaignId} завершена со статусом ${finalStatus}.`);
  }
}

/**
 * Основной периодический обработчик, запускаемый раз в 1 минуту.
 * 1. Синхронизирует статусы активных SmartExecution.
 * 2. Запускает SmartTasks, у которых наступило время runAt.
 */
export async function runSmartDripfeedTick() {
  // --- ЧАСТЬ 1: Синхронизация активных SmartExecution ---
  const activeExecutions = await prisma.smartExecution.findMany({
    where: { status: 'IN_PROGRESS' },
    include: {
      task: {
        include: {
          campaign: {
            include: {
              service: { include: { provider: true } },
            },
          },
        },
      },
    },
  });

  for (const exec of activeExecutions) {
    try {
      if (!exec.externalOrderId) continue;
      const task = exec.task;
      const campaign = task.campaign;
      const service = campaign.service;
      if (!service.provider) continue;

      const provider = await providerService.getWorkerProviderInstance(service.provider);
      const statusRes = await provider.getOrderStatus(exec.externalOrderId);

      if (statusRes && statusRes.status) {
        const providerStatus = statusRes.status.toUpperCase();
        const remains = parseInt(statusRes.remains || '0', 10);
        const delivered = Math.max(0, exec.qtySent - remains);

        if (['COMPLETED'].includes(providerStatus)) {
          await prisma.$transaction([
            prisma.smartExecution.update({
              where: { id: exec.id },
              data: { status: 'COMPLETED', qtyDelivered: exec.qtySent },
            }),
            prisma.smartTask.update({
              where: { id: task.id },
              data: { status: SmartTaskStatus.COMPLETED },
            }),
          ]);
          
          // Запуск тихого сканирования качества подписчиков (неблокирующий вызов)
          const { scanSubscriberQuality } = await import('./quality-detector.processor');
          void scanSubscriberQuality(campaign.id, exec.qtySent, campaign.link).catch((err) =>
            log.error('[Dripfeed] Failed to run silent quality scanner:', { error: err })
          );

          await checkAndCompleteCampaign(campaign.id);
        } else if (['CANCELED', 'PARTIAL', 'FAILED'].includes(providerStatus)) {
          await prisma.$transaction([
            prisma.smartExecution.update({
              where: { id: exec.id },
              data: {
                status: 'FAILED',
                qtyDelivered: delivered,
                error: 'Заказ отменен или частично выполнен провайдером',
              },
            }),
            prisma.smartTask.update({
              where: { id: task.id },
              data: {
                status: SmartTaskStatus.ERROR,
                error: 'Заказ отменен или частично выполнен провайдером',
              },
            }),
          ]);
          await checkAndCompleteCampaign(campaign.id);
        } else {
          // В процессе выполнения: обновляем доставленное количество
          await prisma.smartExecution.update({
            where: { id: exec.id },
            data: { qtyDelivered: delivered },
          });
        }
      }
    } catch (err: unknown) {
      log.error(
        `[Dripfeed Status Sync] Не удалось синхронизировать статус выполнения ${exec.id}:`,
        (err instanceof Error ? err.message : String(err))
      );
    }
  }

  // --- ЧАСТЬ 2: Запуск запланированных SmartTasks ---
  const plannedTasks = await prisma.smartTask.findMany({
    where: {
      status: SmartTaskStatus.PLANNED,
      runAt: { lte: new Date() },
      campaign: {
        status: SmartCampaignStatus.RUNNING,
      },
    },
    include: {
      campaign: {
        include: {
          service: { include: { provider: true } },
        },
      },
    },
  });

  for (const task of plannedTasks) {
    try {
      // 1. Атомарно помечаем задачу как SENT (Защита от состояния гонки между параллельными инстансами воркеров)
      const affected = await prisma.smartTask.updateMany({
        where: { id: task.id, status: SmartTaskStatus.PLANNED },
        data: { status: SmartTaskStatus.SENT },
      });

      if (affected.count === 0) {
        log.warn(`[Dripfeed Worker] Задача ${task.id} уже запущена другим инстансом воркера. Пропускаем.`);
        continue;
      }

      const campaign = task.campaign;
      const service = campaign.service;

      // Тестовый режим: имитируем мгновенный успех
      if (campaign.isTestMode) {
        await prisma.smartExecution.create({
          data: {
            taskId: task.id,
            qtySent: task.quantity,
            qtyDelivered: task.quantity,
            status: 'COMPLETED',
          },
        });
        await prisma.smartTask.update({
          where: { id: task.id },
          data: { status: SmartTaskStatus.COMPLETED },
        });
        log.info(`[Dripfeed Worker] Тестовая задача ${task.id} имитирована успешно.`);

        // Запуск тихого сканирования качества подписчиков (неблокирующий вызов)
        const { scanSubscriberQuality } = await import('./quality-detector.processor');
        void scanSubscriberQuality(campaign.id, task.quantity, campaign.link).catch((err) =>
          log.error('[Dripfeed] Failed to run silent quality scanner:', { error: err })
        );

        await checkAndCompleteCampaign(campaign.id);
        continue;
      }

      // Реальный режим отправки провайдеру: предсоздаем запись PENDING для идемпотентности
      if (!service.provider) {
        throw new Error(`Услуга ${service.id} не привязана к провайдеру`);
      }

      const execution = await prisma.smartExecution.create({
        data: {
          taskId: task.id,
          providerId: service.provider.id,
          qtySent: task.quantity,
          status: 'PENDING',
        },
      });

      const provider = await providerService.getWorkerProviderInstance(service.provider);

      // Отправляем чанк провайдеру с таски как ref / custom_id
      const response = await provider.createOrder({
        service: service.externalId || '',
        link: campaign.link,
        quantity: task.quantity,
        ref: task.id,
        custom_id: task.id,
      });

      if (response.error && !response.order) {
        await prisma.smartExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', error: response.error },
        });
        throw new Error(response.error);
      }

      const extOrderId = response.order ? response.order.toString() : '';

      // Обновляем SmartExecution запись на IN_PROGRESS
      await prisma.smartExecution.update({
        where: { id: execution.id },
        data: {
          externalOrderId: extOrderId,
          status: 'IN_PROGRESS',
        },
      });

      log.info(
        `[Dripfeed Worker] Задача ${task.id} успешно отправлена провайдеру. External ID: ${extOrderId}`
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(`[Dripfeed Worker] Ошибка обработки задачи ${task.id}:`, errorMsg);

      const isBalanceError = errorMsg.toLowerCase().includes('balance') ||
                            errorMsg.toLowerCase().includes('not enough') ||
                            errorMsg.toLowerCase().includes('low balance') ||
                            errorMsg.toLowerCase().includes('insufficient');

      if (isBalanceError) {
        log.warn(`[Dripfeed Worker] Провайдер исчерпал баланс. Откладываем задачу ${task.id} на 20 минут.`);
        await prisma.smartTask.update({
          where: { id: task.id },
          data: {
            status: SmartTaskStatus.PLANNED,
            runAt: new Date(Date.now() + 20 * 60 * 1000),
            error: `Отложено из-за баланса поставщика: ${errorMsg}`,
          },
        });
        continue;
      }

      await prisma.smartTask.update({
        where: { id: task.id },
        data: { status: SmartTaskStatus.ERROR, error: errorMsg },
      });
      await checkAndCompleteCampaign(task.campaignId);
    }
  }
}
