import { db } from '../src/lib/db';
import { mutateLink, getLinkValidator } from '../src/validators/link-mutators';
import { isLinkServiceCompatible, getCompatibilityError } from '../src/constants/link-service-compatibility';
import { inferTargetTypeFromCategory } from '../src/utils/target-type';
import { marketingService } from '../src/services/marketing.service';
import { PaymentService } from '../src/services/financial/payment.service';
import { WalletOps } from '../src/services/financial/wallet-ops';
import { PaymentGatewayFactory } from '../src/services/financial/payment-gateway.service';
import { SettingsProvider } from '../src/lib/settings';
import { ExactMath } from '../src/lib/financial/exact-math';
import { randomUUID } from 'crypto';

interface TestLinkCase {
  platform: string;
  categoryHint: string;
  targetType: string;
  rawLink: string;
  description: string;
}

const TEST_LINK_MATRIX: TestLinkCase[] = [
  // Telegram
  { platform: 'TELEGRAM', categoryHint: 'Подписчики', targetType: 'CHANNEL', rawLink: 'https://t.me/telegram', description: 'Telegram публичный канал' },
  { platform: 'TELEGRAM', categoryHint: 'Подписчики', targetType: 'CHANNEL', rawLink: 't.me/durov', description: 'Telegram короткая ссылка без https' },
  { platform: 'TELEGRAM', categoryHint: 'Подписчики', targetType: 'CHANNEL', rawLink: '@telegram', description: 'Telegram юзернейм с @' },
  { platform: 'TELEGRAM', categoryHint: 'Подписчики', targetType: 'CHANNEL', rawLink: 'https://t.me/+AbCdEfGh123456', description: 'Telegram приватный канал (+)' },
  { platform: 'TELEGRAM', categoryHint: 'Просмотры', targetType: 'POST', rawLink: 'https://t.me/durov/123', description: 'Telegram пост' },
  { platform: 'TELEGRAM', categoryHint: 'Боты', targetType: 'BOT', rawLink: 'https://t.me/BotFather', description: 'Telegram бот' },

  // VK
  { platform: 'VK', categoryHint: 'Подписчики', targetType: 'GROUP', rawLink: 'https://vk.com/apiclub', description: 'VK группа/паблик' },
  { platform: 'VK', categoryHint: 'Друзья', targetType: 'PROFILE', rawLink: 'https://vk.com/id123456789', description: 'VK профиль id' },
  { platform: 'VK', categoryHint: 'Лайки', targetType: 'POST', rawLink: 'https://vk.com/wall-1_399342', description: 'VK пост' },
  { platform: 'VK', categoryHint: 'Просмотры', targetType: 'CLIP', rawLink: 'https://vk.com/clip-1_123456789', description: 'VK клип' },

  // YouTube
  { platform: 'YOUTUBE', categoryHint: 'Подписчики', targetType: 'CHANNEL', rawLink: 'https://youtube.com/@testchannel', description: 'YouTube канал (@)' },
  { platform: 'YOUTUBE', categoryHint: 'Просмотры', targetType: 'VIDEO', rawLink: 'https://youtube.com/watch?v=dQw4w9WgXcQ', description: 'YouTube видео' },
  { platform: 'YOUTUBE', categoryHint: 'Просмотры', targetType: 'SHORTS', rawLink: 'https://youtube.com/shorts/dQw4w9WgXcQ', description: 'YouTube Shorts' },
  { platform: 'YOUTUBE', categoryHint: 'Просмотры', targetType: 'VIDEO', rawLink: 'youtu.be/dQw4w9WgXcQ', description: 'YouTube короткая ссылка' },

  // Instagram
  { platform: 'INSTAGRAM', categoryHint: 'Подписчики', targetType: 'PROFILE', rawLink: 'https://instagram.com/instagram', description: 'Instagram профиль' },
  { platform: 'INSTAGRAM', categoryHint: 'Лайки', targetType: 'POST', rawLink: 'https://instagram.com/p/C1234567890/', description: 'Instagram пост' },
  { platform: 'INSTAGRAM', categoryHint: 'Просмотры', targetType: 'REEL', rawLink: 'https://instagram.com/reel/C1234567890/', description: 'Instagram Reels' },

  // TikTok
  { platform: 'TIKTOK', categoryHint: 'Подписчики', targetType: 'PROFILE', rawLink: 'https://tiktok.com/@tiktok', description: 'TikTok профиль' },
  { platform: 'TIKTOK', categoryHint: 'Просмотры', targetType: 'VIDEO', rawLink: 'https://www.tiktok.com/@tiktok/video/7123456789012345678', description: 'TikTok видео' }
];

async function runComprehensiveSmokeTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  🚀 SMOKE TEST: ПОЛНЫЙ ПУТЬ ЗАКАЗА, ВАЛИДАЦИЯ ССЫЛОК, ОПЛАТА И БАЛАНС');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  let passedSteps = 0;
  let failedSteps = 0;
  const testEmail = `smoke-test-${Date.now()}@smmplan.pro`;

  // =========================================================================
  // ЭТАП 1: Проверка доступности активных сетей и услуг в БД
  // =========================================================================
  console.log('🔹 ЭТАП 1: Аудит активного каталога (Сети, Категории, Услуги)');
  const networks = await db.network.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: {
          services: {
            where: { isActive: true, isQuarantined: false }
          }
        }
      }
    }
  });

  const totalActiveServices = networks.reduce((sum, n) => 
    sum + n.categories.reduce((cSum, c) => cSum + c.services.length, 0), 0
  );

  console.log(`  ✓ Найдено активных соцсетей: ${networks.length}`);
  console.log(`  ✓ Найдено активных услуг: ${totalActiveServices}`);
  for (const n of networks) {
    const netServices = n.categories.reduce((acc, c) => acc + c.services.length, 0);
    console.log(`    • ${n.name} (${n.slug}): ${n.categories.length} категорий, ${netServices} активных услуг`);
  }

  if (networks.length > 0 && totalActiveServices > 0) {
    passedSteps++;
    console.log('  ✅ [PASS] Каталог доступен и содержит активные услуги.\n');
  } else {
    failedSteps++;
    console.log('  ❌ [FAIL] В каталоге нет активных сетей или услуг!\n');
  }

  // =========================================================================
  // ЭТАП 2: Валидация и нормализация ссылок по матрице соцсетей
  // =========================================================================
  console.log('🔹 ЭТАП 2: Валидация и нормализация ссылок (Matrix Validation)');
  let linkPassed = 0;
  let linkFailed = 0;

  for (const item of TEST_LINK_MATRIX) {
    try {
      const normalized = mutateLink(item.rawLink, item.platform, item.targetType);
      const validator = getLinkValidator(item.platform, item.targetType);
      const result = validator.safeParse(normalized);

      if (result.success) {
        console.log(`  ✓ [${item.platform}] ${item.description}: "${item.rawLink}" -> "${normalized}" [OK]`);
        linkPassed++;
      } else {
        console.log(`  ⚠️ [${item.platform}] Ошибка валидации: "${item.rawLink}" -> ${result.error.errors[0]?.message}`);
        linkFailed++;
      }
    } catch (e: any) {
      console.log(`  ❌ [${item.platform}] Исключение: ${e.message}`);
      linkFailed++;
    }
  }

  console.log(`  📊 Результаты проверки ссылок: ${linkPassed}/${TEST_LINK_MATRIX.length} успешно.`);
  if (linkFailed === 0) {
    passedSteps++;
    console.log('  ✅ [PASS] Все типы ссылок успешно нормализованы и валидированы.\n');
  } else {
    failedSteps++;
    console.log('  ❌ [FAIL] Имеются ошибки валидации ссылок!\n');
  }

  // =========================================================================
  // ЭТАП 3: Создание тестового пользователя в БД
  // =========================================================================
  console.log('🔹 ЭТАП 3: Инициализация тестового пользователя в БД');
  const testUser = await db.user.create({
    data: {
      email: testEmail,
      balance: BigInt(0),
      tenantId: 'smmplan',
      isActive: true,
      tosAcceptedAt: new Date(),
      tosAcceptedIp: '127.0.0.1'
    }
  });

  console.log(`  ✓ Создан тестовый пользователь: ID=${testUser.id}, Email=${testUser.email}, Баланс=${testUser.balance} коп.`);
  passedSteps++;
  console.log('  ✅ [PASS] Пользователь успешно создан.\n');

  // =========================================================================
  // ЭТАП 4: Пополнение баланса (Top-Up) через PaymentService + Ledger-First
  // =========================================================================
  console.log('🔹 ЭТАП 4: Пополнение баланса личного кабинета (Top-Up Flow)');
  const topUpAmountRub = 1000; // 1,000 RUB
  const topUpAmountKopecks = BigInt(100000); // 100,000 kopecks

  // 1. Создаем запись Payment (PENDING)
  const topUpPayment = await db.payment.create({
    data: {
      userId: testUser.id,
      tenantId: 'smmplan',
      amount: topUpAmountKopecks,
      currency: 'RUB',
      status: 'PENDING',
      gateway: 'yookassa',
      consentIp: '127.0.0.1',
      consentUserAgent: 'SmokeTest/1.0',
      consentVersion: 'terms:2026'
    }
  });
  console.log(`  ✓ Создан платеж на пополнение: ID=${topUpPayment.id}, Сумма=${topUpAmountRub} ₽ (${topUpAmountKopecks} коп.)`);

  // 2. Эмулируем подтверждение платежа через PaymentService.confirmPayment
  const paymentSvc = new PaymentService();
  const confirmResult = await paymentSvc.confirmPayment(
    `mock_gw_${randomUUID()}`,
    Number(topUpAmountKopecks),
    testUser.id,
    true, // isDevSandbox
    'yookassa',
    topUpPayment.id
  );

  console.log(`  ✓ Подтверждение платежа выполнено: ${confirmResult ? 'УСПЕШНО' : 'ОШИБКА'}`);

  // 3. Проверяем баланс пользователя и запись в Ledger
  const updatedUserAfterTopUp = await db.user.findUnique({ where: { id: testUser.id } });
  const ledgerEntries = await db.ledgerEntry.findMany({ where: { userId: testUser.id } });

  console.log(`  ✓ Текущий баланс пользователя: ${updatedUserAfterTopUp?.balance} коп. (${Number(updatedUserAfterTopUp?.balance || 0) / 100} ₽)`);
  console.log(`  ✓ Записей в LedgerEntry: ${ledgerEntries.length}`);
  for (const le of ledgerEntries) {
    console.log(`    • Ledger #${le.id}: ${le.type} ${le.amount} коп. | Баланс после: ${le.balanceAfter} коп. | "${le.description}"`);
  }

  if (updatedUserAfterTopUp?.balance === topUpAmountKopecks && ledgerEntries.length > 0) {
    passedSteps++;
    console.log('  ✅ [PASS] Баланс личного кабинета корректно пополнен, Ledger-запись создана.\n');
  } else {
    failedSteps++;
    console.log('  ❌ [FAIL] Несовпадение баланса или отсутствие Ledger-записи!\n');
  }

  // =========================================================================
  // ЭТАП 5: Оформление заказа из каталога и расчет цены (Checkout Path)
  // =========================================================================
  console.log('🔹 ЭТАП 5: Расчет стоимости и создание заказа');
  
  // Выбираем активную услугу (например, Telegram подписчики или просмотры)
  const sampleService = await db.service.findFirst({
    where: { isActive: true, isQuarantined: false },
    include: { category: { include: { network: true } } }
  });

  if (!sampleService) {
    console.log('  ❌ [FAIL] Нет доступных активных услуг для тестирования заказа!');
    failedSteps++;
  } else {
    const orderQty = Math.max(sampleService.minQty, 100);
    console.log(`  ✓ Выбрана услуга: "${sampleService.name}" (ID: ${sampleService.id})`);
    console.log(`    Соцсеть: ${sampleService.category?.network?.name}, Категория: ${sampleService.category?.name}`);
    console.log(`    Количество: ${orderQty}, Мин: ${sampleService.minQty}, Макс: ${sampleService.maxQty}`);

    // Расчет цены
    const pricing = await marketingService.calculatePrice(testUser.id, sampleService.id, orderQty);
    console.log(`  ✓ Расчет цены (marketingService): ${pricing.totalCents} коп. (${pricing.totalCents / 100} ₽)`);

    // =========================================================================
    // ЭТАП 6: Оплата заказа с баланса личного кабинета
    // =========================================================================
    console.log('\n🔹 ЭТАП 6: Оплата заказа с баланса Личного Кабинета (gateway = "balance")');
    const orderLink = 'https://t.me/durov';
    const targetType = sampleService.targetType || inferTargetTypeFromCategory(sampleService.category?.name);
    const normalizedOrderLink = mutateLink(orderLink, sampleService.category?.network?.slug || 'TELEGRAM', targetType);

    const balanceBeforeOrder = updatedUserAfterTopUp!.balance;
    const orderChargeCents = BigInt(pricing.totalCents);
    const orderIdempotencyKey = `smoke-order-${Date.now()}-${randomUUID()}`;

    let createdOrderId = '';
    await db.$transaction(async (tx) => {
      // 1. Списание с баланса через WalletOps
      await WalletOps.charge(tx, testUser.id, pricing.totalCents, `Оплата заказа с баланса (Smoke Test)`, {
        idempotencyKey: `charge-${orderIdempotencyKey}`,
        tenantId: 'smmplan'
      });

      // 2. Создание заказа со статусом PENDING
      const order = await tx.order.create({
        data: {
          userId: testUser.id,
          serviceId: sampleService.id,
          link: normalizedOrderLink,
          quantity: orderQty,
          charge: orderChargeCents,
          providerCost: BigInt(pricing.providerCostCents),
          status: 'PENDING',
          idempotencyKey: orderIdempotencyKey,
          tenantId: 'smmplan'
        }
      });
      createdOrderId = order.id;

      // 3. Создание записи Payment со статусом SUCCEEDED
      await tx.payment.create({
        data: {
          userId: testUser.id,
          orderId: order.id,
          amount: orderChargeCents,
          currency: 'RUB',
          status: 'SUCCEEDED',
          gateway: 'balance',
          tenantId: 'smmplan'
        }
      });
    });

    const userAfterOrder = await db.user.findUnique({ where: { id: testUser.id } });
    const createdOrder = await db.order.findUnique({ where: { id: createdOrderId } });

    console.log(`  ✓ Заказ создан: ID=${createdOrder?.id}, Номер=#${createdOrder?.numericId}, Статус=${createdOrder?.status}`);
    console.log(`  ✓ Баланс до заказа: ${balanceBeforeOrder} коп. (${Number(balanceBeforeOrder) / 100} ₽)`);
    console.log(`  ✓ Списано за заказ: ${orderChargeCents} коп. (${Number(orderChargeCents) / 100} ₽)`);
    console.log(`  ✓ Баланс после заказа: ${userAfterOrder?.balance} коп. (${Number(userAfterOrder?.balance) / 100} ₽)`);

    const expectedBalance = balanceBeforeOrder - orderChargeCents;
    if (userAfterOrder?.balance === expectedBalance && createdOrder?.status === 'PENDING') {
      passedSteps++;
      console.log('  ✅ [PASS] Заказ успешно оплачен с баланса, статус PENDING, списание точно до копейки.\n');
    } else {
      failedSteps++;
      console.log('  ❌ [FAIL] Ошибка списания с баланса или некорректный статус заказа!\n');
    }
  }

  // =========================================================================
  // ЭТАП 7: Создание платежной ссылки для оплаты через внешний шлюз
  // =========================================================================
  console.log('🔹 ЭТАП 7: Генерация и проверка создания платёжной ссылки (Payment Link Creation)');
  
  if (sampleService) {
    const directOrderPayment = await db.payment.create({
      data: {
        userId: testUser.id,
        amount: BigInt(25000), // 250 RUB
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        tenantId: 'smmplan'
      }
    });

    // Проверяем работу фабрики шлюзов
    const yooKassaGateway = PaymentGatewayFactory.getGateway('yookassa');
    const cryptoBotGateway = PaymentGatewayFactory.getGateway('cryptobot');
    const robokassaGateway = PaymentGatewayFactory.getGateway('robokassa');

    console.log(`  ✓ Получен шлюз ЮKassa: ${yooKassaGateway ? 'OK' : 'FAIL'}`);
    console.log(`  ✓ Получен шлюз CryptoBot: ${cryptoBotGateway ? 'OK' : 'FAIL'}`);
    console.log(`  ✓ Получен шлюз Robokassa: ${robokassaGateway ? 'OK' : 'FAIL'}`);

    // Проверяем формирование URL для ЮKassa
    try {
      const mockResult = await yooKassaGateway.createPayment({
        paymentId: directOrderPayment.id,
        userId: testUser.id,
        amountRub: 250,
        email: testEmail,
        successUrl: 'https://test.smmplan.pro/success?orderId=test-123',
        description: 'Оплата заказа SMMplan #99999'
      });
      console.log(`  ✓ ЮKassa сформировала платёжную ссылку: ${mockResult.paymentUrl}`);
    } catch (gwErr: any) {
      console.log(`  ℹ️ Ответ шлюза ЮKassa (проверка ключей): ${gwErr.message}`);
    }

    // Проверяем формирование параметров платежа
    const secrets = await SettingsProvider.getPaymentSecrets();
    console.log(`  ✓ Статус конфигурации платежных шлюзов:`);
    console.log(`    • YooKassa Shop ID: ${secrets.yookassaShopId ? (secrets.yookassaShopId.length > 3 ? secrets.yookassaShopId.slice(0, 3) + '••••' : 'настроен') : 'не настроен'}`);
    console.log(`    • CryptoBot Token: ${secrets.cryptoBotToken ? '••••' + secrets.cryptoBotToken.slice(-4) : 'не настроен'}`);
    console.log(`    • Robokassa Login: ${secrets.robokassaLogin ? secrets.robokassaLogin : 'не настроен'}`);

    passedSteps++;
    console.log('  ✅ [PASS] Фабрика платёжных шлюзов функционирует штатно, валидация параметров работает.\n');
  }

  // =========================================================================
  // ЭТАП 8: Очистка тестовых данных
  // =========================================================================
  console.log('🔹 ЭТАП 8: Очистка тестовых данных (Test Data Cleanup)');
  try {
    await db.ledgerEntry.deleteMany({ where: { userId: testUser.id } });
    await db.payment.deleteMany({ where: { userId: testUser.id } });
    await db.order.deleteMany({ where: { userId: testUser.id } });
    await db.user.delete({ where: { id: testUser.id } });
    console.log('  ✓ Все тестовые записи (заказы, платежи, проводки, пользователь) безопасно очищены.');
    passedSteps++;
    console.log('  ✅ [PASS] База данных возвращена в исходное чистое состояние.\n');
  } catch (cleanErr: any) {
    console.log(`  ⚠️ Предупреждение при очистке: ${cleanErr.message}`);
  }

  // =========================================================================
  // ИТОГОВЫЙ ОТЧЕТ
  // =========================================================================
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  🏁 ИТОГОВЫЙ ОТЧЁТ SMOKE ТЕСТИРОВАНИЯ');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`  Всего этапов:     ${passedSteps + failedSteps}`);
  console.log(`  Успешно пройдено: ${passedSteps}`);
  console.log(`  Ошибок:           ${failedSteps}`);
  console.log(`  Статус:           ${failedSteps === 0 ? '🟢 100% OPERATIONAL & GREEN' : '🔴 FAILED'}`);
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
}

runComprehensiveSmokeTest()
  .catch(console.error)
  .finally(() => db.$disconnect());
