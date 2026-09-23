import { db } from '../src/lib/db';
import { redis } from '../src/lib/redis';

async function sanitizeDatabase() {
  console.log('=== НАЧАЛО САНАЦИИ БАЗЫ ДАННЫХ OMNISMM ===\n');

  const VEXBOOST_PROVIDER_ID = 'cmswm47y60000hqrkoljy8wde';

  // 1. Проверяем наличие основного провайдера Vexboost
  const vexboost = await db.provider.findUnique({
    where: { id: VEXBOOST_PROVIDER_ID }
  });

  if (!vexboost) {
    throw new Error(`CRITICAL: Провайдер Vexboost (${VEXBOOST_PROVIDER_ID}) не найден в БД! Прерываем операцию.`);
  }
  console.log(`[1/6] Найден основной провайдер: "${vexboost.name}" (ID: ${vexboost.id}, URL: ${vexboost.apiUrl})`);

  // 2. Находим и отменяем все зависшие PENDING заказы
  const pendingOrders = await db.order.findMany({
    where: { status: 'PENDING' },
    select: { id: true, numericId: true, serviceId: true, isTest: true }
  });

  console.log(`[2/6] Найдено зависших PENDING заказов: ${pendingOrders.length}`);
  if (pendingOrders.length > 0) {
    const updated = await db.order.updateMany({
      where: { status: 'PENDING' },
      data: {
        status: 'CANCELED',
        error: 'Тестовый заказ отменён при санации зависших услуг платформы',
        updatedAt: new Date()
      }
    });
    console.log(` -> Успешно переведено в CANCELED: ${updated.count} заказов.`);
  }

  // 3. Находим все услуги, не относящиеся к Vexboost (сторонние провайдеры + без провайдера)
  const servicesToDelete = await db.service.findMany({
    where: {
      OR: [
        { providerId: { not: VEXBOOST_PROVIDER_ID } },
        { providerId: null }
      ]
    },
    select: { id: true, name: true, providerId: true }
  });

  const serviceIdsToDelete = servicesToDelete.map(s => s.id);
  console.log(`[3/6] Найдено сторонних и тестовых услуг к удалению: ${serviceIdsToDelete.length}`);

  if (serviceIdsToDelete.length > 0) {
    // 3.1 Очищаем связанные дочерние таблицы
    await db.serviceRoute.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.servicePriceHistory.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.serviceLinkCheck.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.smartCampaign.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.serviceCustomerAccess.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.serviceDraft.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.serviceEditHistory.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.serviceSmartConfig.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
    await db.aiPricingRecommendation.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });

    // 3.2 Проверяем, есть ли заказы, привязанные к этим услугам
    const attachedOrders = await db.order.findMany({
      where: { serviceId: { in: serviceIdsToDelete } },
      select: { id: true, numericId: true, status: true }
    });

    if (attachedOrders.length > 0) {
      console.log(` -> Найдено ${attachedOrders.length} заказов, привязанных к удаляемым услугам. Очищаем...`);
      // Удаляем связанные тикеты, refills, если есть
      const orderIds = attachedOrders.map(o => o.id);
      await db.ticketMessage.deleteMany({ where: { ticket: { orderId: { in: orderIds } } } });
      await db.ticket.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.refill.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderRecoveryIncident.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.cxApologyCompensation.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.promoCodeUsage.deleteMany({ where: { orderId: { in: orderIds } } });

      const deletedOrders = await db.order.deleteMany({
        where: { id: { in: orderIds } }
      });
      console.log(` -> Удалено ${deletedOrders.count} тестовых заказов.`);
    }

    // 3.3 Удаляем сами услуги
    const deletedServices = await db.service.deleteMany({
      where: { id: { in: serviceIdsToDelete } }
    });
    console.log(` -> Успешно удалено ${deletedServices.count} сторонних/тестовых услуг.`);
  }

  // 4. Удаляем всех неактивных провайдеров
  const inactiveProviders = await db.provider.findMany({
    where: {
      id: { not: VEXBOOST_PROVIDER_ID }
    },
    select: { id: true, name: true }
  });

  console.log(`[4/6] Найдено неактивных сторонних провайдеров к удалению: ${inactiveProviders.length}`);
  if (inactiveProviders.length > 0) {
    const provIds = inactiveProviders.map(p => p.id);
    await db.shadowService.deleteMany({ where: { providerId: { in: provIds } } });
    await db.serviceRoute.deleteMany({ where: { providerId: { in: provIds } } });
    await db.smartExecution.deleteMany({ where: { providerId: { in: provIds } } });
    await db.providerProxyLog.deleteMany({ where: { providerId: { in: provIds } } });

    const deletedProviders = await db.provider.deleteMany({
      where: { id: { in: provIds } }
    });
    console.log(` -> Успешно удалено ${deletedProviders.count} неактивных провайдеров: ${inactiveProviders.map(p => p.name).join(', ')}`);
  }

  // 5. Очищаем Redis-очереди от зависших задач order-dispatch
  try {
    const keys = await redis.keys('bull:ordersQueue:*');
    console.log(`[5/6] Очистка BullMQ ключей очереди ordersQueue: найдено ${keys.length} ключей`);
    for (const order of pendingOrders) {
      await redis.del(`bull:ordersQueue:dispatch-${order.id}`);
      await redis.del(`order:dispatched:${order.id}`);
    }
    await redis.del('p0:debounce:stuck_orders_alert');
    await redis.del('alert:stuck_orders_alert');
    console.log(' -> BullMQ и Redis-ключи алертов сброшены.');
  } catch (redisErr) {
    console.warn(' -> Не удалось очистить BullMQ ключи в Redis:', redisErr);
  }

  // 6. Итоговая сверка
  const remainingProviders = await db.provider.findMany({
    select: { id: true, name: true, isActive: true, apiUrl: true }
  });
  const remainingServices = await db.service.findMany({
    select: { id: true, name: true, providerId: true, isActive: true }
  });
  const remainingPending = await db.order.count({
    where: { status: 'PENDING' }
  });

  console.log('\n=== ИТОГОВАЯ ВЕРИФИКАЦИЯ БАЗЫ ДАННЫХ ===');
  console.log(`• Активных провайдеров в системе: ${remainingProviders.length}`);
  console.log(remainingProviders);
  console.log(`• Всего услуг в системе: ${remainingServices.length} (все привязаны к Vexboost: ${remainingServices.every(s => s.providerId === VEXBOOST_PROVIDER_ID)})`);
  console.log(`• Из них активных услуг: ${remainingServices.filter(s => s.isActive).length}`);
  console.log(`• Зависших PENDING заказов: ${remainingPending}`);
  console.log('========================================\n');
}

sanitizeDatabase()
  .then(() => {
    console.log('Санация успешно завершена.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Ошибка санации:', err);
    process.exit(1);
  });
