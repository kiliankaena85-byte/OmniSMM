// Mock server-only for standalone script execution
require.cache[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
} as any;

function withTimeout<T>(promise: Promise<T>, ms: number, fallbackMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(fallbackMsg)), ms)),
  ]);
}

async function diagnoseAlerts() {
  const isSendTest = process.argv.includes('--send-test');

  console.log('======================================================================');
  console.log('       🔍 ДИАГНОСТИКА СИСТЕМЫ АЛЕРТОВ И БАЛАНСОВ OMNISMM 1.0          ');
  console.log('======================================================================\n');

  // 1. Проверка конфигурации Telegram & Email
  const tgToken = process.env.ADMIN_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.ADMIN_ALERT_CHAT_ID || '268747191';
  console.log('1. 📡 Каналы доставки алертов:');
  console.log(`   - Telegram Bot Token: ${tgToken ? `🟢 Настроен (длина: ${tgToken.length} симв.)` : '❌ НЕ НАСТРОЕН'}`);
  console.log(`   - Telegram Chat ID:   ${tgChatId ? `🟢 ${tgChatId}` : '❌ НЕ НАСТРОЕН'}`);
  console.log(`   - SMTP / Email:       ${process.env.SMTP_HOST ? `🟢 ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}` : '⚠️ НЕ НАСТРОЕН'}`);
  console.log(`   - Emergency Recipient:${process.env.ADMIN_ALERT_EMAIL || 'support@smmplan.pro'}\n`);

  // 2. Проверка Redis и блокировок Debouncer
  console.log('2. ⚡ Проверка Redis & Debounce Lock:');
  let redisOk = false;
  let redisInstance: any = null;
  try {
    const { redis } = await import('../src/lib/redis');
    redisInstance = redis;
    const ping = await withTimeout(redis.ping(), 3000, 'Таймаут подключения к Redis (3с)');
    redisOk = ping === 'PONG';
    console.log(`   - Redis Ping: ${redisOk ? '🟢 PONG (Online)' : '🔴 FAILED'}`);
    
    if (redisOk) {
      const p0Keys = await redis.keys('p0:debounce:*');
      const throttleKeys = await redis.keys('telemetry:alert:throttle:*');
      console.log(`   - Активные ключи дебаунса P0 (${p0Keys.length}):`, p0Keys.length > 0 ? p0Keys : 'Нет активных блокировок');
      console.log(`   - Активные троттлинг-ключи (${throttleKeys.length}):`, throttleKeys.length > 0 ? throttleKeys : 'Нет');
    }
  } catch (err: any) {
    console.warn(`   - Redis: ⚠️ Недоступен на хосте (${err.message}) -> fallback на память`);
  }

  // 3. Проверка провайдеров в БД
  console.log('\n3. 📦 Активные провайдеры в БД:');
  let dbInstance: any = null;
  let dbOk = false;
  try {
    const { db } = await import('../src/lib/db');
    dbInstance = db;
    const providers = await withTimeout(db.provider.findMany(), 3000, 'Таймаут подключения к БД (3с)');
    dbOk = true;
    console.log(`   - Всего провайдеров в базе: ${providers.length}`);
    for (const p of providers) {
      console.log(`   - [${p.id}] ${p.name} | isActive: ${p.isActive ? '🟢 Да' : '⚪ Нет'} | apiUrl: ${p.apiUrl ? 'Задан' : '—'}`);
    }
  } catch (err: any) {
    console.warn(`   - БД: ⚠️ Недоступна на хосте (${err.message})`);
  }

  // 4. Запуск сенсора балансов провайдеров (если БД доступна)
  console.log('\n4. 🩺 Запуск сенсора P0ThreatSensorService.checkProviderBalances():');
  if (dbOk) {
    try {
      const { P0ThreatSensorService } = await import('../src/services/telemetry/p0-threat-sensor.service');
      const lowProviders = await withTimeout(P0ThreatSensorService.checkProviderBalances(), 5000, 'Таймаут проверки балансов');
      console.log(`   - Найдено провайдеров с низким балансом: ${lowProviders.length}`);
      for (const lp of lowProviders) {
        console.log(`     ⚠️ ${lp.name}: баланс ${lp.balance} ${lp.currency}`);
      }
      if (lowProviders.length === 0) {
        console.log('   - 🟢 Все активные провайдеры имеют достаточный баланс');
      }
    } catch (err: any) {
      console.error(`   - Ошибка проверки балансов: ${err.message}`);
    }
  } else {
    console.log('   - ⏭️ Пропуск (БД недоступна на локальном хосте)');
  }

  // 5. Сенсор тихих сбоев платежных вебхуков
  console.log('\n5. 💳 Проверка здоровья платежных вебхуков (checkWebhookHealth):');
  if (dbOk) {
    try {
      const { checkWebhookHealth } = await import('../src/lib/alerts/webhook-health');
      const webhookHealth = await withTimeout(checkWebhookHealth(), 5000, 'Таймаут проверки вебхуков');
      console.log(`   - Статус: ${webhookHealth.healthy ? '🟢 В норме' : '🚨 ТРЕБУЕТСЯ ВНИМАНИЕ'}`);
      console.log(`   - Платежей за час PENDING: ${webhookHealth.pendingCount} | SUCCEEDED: ${webhookHealth.succeededCount}`);
      console.log(`   - Алерт сгенерирован: ${webhookHealth.alertSent ? 'Да' : 'Нет'}`);
    } catch (err: any) {
      console.error(`   - Ошибка проверки вебхуков: ${err.message}`);
    }
  } else {
    console.log('   - ⏭️ Пропуск (БД недоступна на локальном хосте)');
  }

  // 6. Сторожевой таймер очередей и зависших заказов (Watchdog)
  console.log('\n6. 🐕 Проверка очередей и заказов (runWatchdogCheck):');
  if (redisOk && dbOk) {
    try {
      const { runWatchdogCheck } = await import('../src/lib/daemons/watchdog-daemon');
      const watchdog = await withTimeout(runWatchdogCheck(), 5000, 'Таймаут Watchdog');
      console.log(`   - Redis: ${watchdog.redisOk ? '🟢 OK' : '🔴 Сбой'}`);
      console.log(`   - Воркер очередей: ${watchdog.workerOk ? '🟢 Жив' : '⚠️ Нет свежего пульса'}`);
      console.log(`   - Возраст последнего пульса воркера: ${watchdog.lastHeartbeatAgeSeconds !== null ? `${watchdog.lastHeartbeatAgeSeconds} сек` : 'Не зафиксирован'}`);
      console.log(`   - Зависших заказов (>10 мин): ${watchdog.stuckOrdersCount > 0 ? `⚠️ ${watchdog.stuckOrdersCount} шт.` : '🟢 0 шт.'}`);
    } catch (err: any) {
      console.error(`   - Ошибка сторожевого таймера: ${err.message}`);
    }
  } else {
    console.log('   - ⏭️ Пропуск (требуются подключенные Redis и БД)');
  }

  // 7. Запуск системного P0 сканирования (диск + память всегда доступны)
  console.log('\n7. 🛡️ Системный аудит здоровья (P0ThreatSensorService):');
  try {
    const { P0ThreatSensorService } = await import('../src/services/telemetry/p0-threat-sensor.service');
    const disk = await P0ThreatSensorService.checkDiskSpace();
    const mem = await P0ThreatSensorService.checkMemoryPressure();
    console.log(`   - Диск: свободно ${disk.freePercent}% (${disk.freeGb} GB / ${disk.totalGb} GB) | Критично? ${disk.isCritical ? '🚨 ДА' : '🟢 НЕТ'}`);
    console.log(`   - Память: занято ${mem.usedPercent}% (${mem.usedMb} MB / ${mem.totalMb} MB) | Критично? ${mem.isCritical ? '🚨 ДА' : '🟢 НЕТ'}`);
  } catch (err: any) {
    console.error(`   - Ошибка P0 сканирования: ${err.message}`);
  }

  // 8. Пример карточки алерта через ErrorInterpreter
  console.log('\n8. 📝 Проверка генератора карточек (ErrorInterpreter):');
  const { ErrorInterpreter } = await import('../src/lib/telemetry/error-interpreter');
  const sampleCard = ErrorInterpreter.formatTelegramMessage(
    'Тестовая проверка системы мониторинга OmniSMM 1.0',
    'INFO',
    'smmplan'
  );
  console.log('   --- Сгенерированный HTML ---');
  console.log(sampleCard);
  console.log('   ----------------------------');

  // 9. Опциональная тестовая отправка
  if (isSendTest) {
    console.log('\n9. 🚀 Отправка тестового алерта в Telegram (--send-test)...');
    try {
      const { sendAdminAlertSync } = await import('../src/lib/notifications');
      await sendAdminAlertSync(
        'Тестовое уведомление: проверка каналов алертов OmniSMM 1.0 завершена успешно.',
        'INFO',
        'smmplan'
      );
      console.log('   - 🟢 Тестовый алерт успешно передан в Telegram API!');
    } catch (sendErr: any) {
      console.error(`   - 🔴 Ошибка отправки: ${sendErr.message}`);
    }
  } else {
    console.log('\n💡 Для отправки реального тестового сообщения в Telegram запустите:');
    console.log('   npm run test:alerts -- --send-test');
  }

  console.log('\n======================================================================');
  console.log('                          ДИАГНОСТИКА ЗАВЕРШЕНА                       ');
  console.log('======================================================================');

  if (dbInstance) {
    await dbInstance.$disconnect().catch(() => {});
  }
  if (redisInstance) {
    try {
      redisInstance.disconnect();
    } catch { /* ignore */ }
  }
  process.exit(0);
}

diagnoseAlerts().catch((e) => {
  console.error('Fatal error in diagnoseAlerts:', e);
  process.exit(1);
});
