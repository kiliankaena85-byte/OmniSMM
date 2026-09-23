import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const prisma = new PrismaClient();

// Setup dirname equivalents for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotsDir = path.resolve(process.cwd(), '.planning/screenshots');
const baselineDir = path.resolve(screenshotsDir, 'baseline');

const adminPages = [
  { name: 'catalog', path: '/admin/catalog' },
  { name: 'catalog-categories', path: '/admin/catalog/categories' },
  { name: 'catalog-new-service', path: '/admin/catalog/new' },
  { name: 'catalog-tree', path: '/admin/catalog/tree' },
  { name: 'dashboard', path: '/admin/dashboard' },
  { name: 'orders', path: '/admin/orders' },
  { name: 'providers', path: '/admin/providers' },
  { name: 'clients', path: '/admin/clients' },
  { name: 'tickets', path: '/admin/tickets' },
  { name: 'settings', path: '/admin/settings' },
  { name: 'client-order-wizard', path: '/dashboard/new-order' },
  { name: 'showcase-telegram', path: '/services/telegram' },
];

async function seedData(userId) {
  console.log('🌱 Проверка и наполнение базы данных тестовыми данными...');

  // 1. Сеть и категория
  let network = await prisma.network.findFirst({ where: { slug: 'telegram' } });
  if (!network) {
    network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
  }

  let category = await prisma.category.findFirst({ where: { networkId: network.id } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Подписчики Telegram', sort: 1, networkId: network.id }
    });
  }

  // 2. Провайдер
  let provider = await prisma.provider.findFirst();
  if (!provider) {
    provider = await prisma.provider.create({
      data: { name: 'E2E Test Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
    });
  }

  // 3. Услуги (включая quarantined услугу)
  let service = await prisma.service.findFirst({ where: { name: 'Telegram Подписчики (Эконом)' } });
  if (!service) {
    service = await prisma.service.create({
      data: {
        name: 'Telegram Подписчики (Эконом)',
        categoryId: category.id,
        providerId: provider.id,
        rate: 1.5,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
        targetType: 'CHANNEL',
        externalId: 'mock_tg_sub_econom'
      }
    });
  } else if (!service.externalId) {
    service = await prisma.service.update({
      where: { id: service.id },
      data: { externalId: 'mock_tg_sub_econom' }
    });
  }

  let quarantinedService = await prisma.service.findFirst({ where: { isQuarantined: true } });
  if (!quarantinedService) {
    // eslint-disable-next-line no-useless-assignment
    quarantinedService = await prisma.service.create({
      data: {
        name: 'E2E Quarantined Service',
        categoryId: category.id,
        providerId: provider.id,
        rate: 10.0,
        isQuarantined: true,
        pendingRate: 20.0,
        quarantineReason: 'E2E Price increase by 100%',
        minQty: 10,
        maxQty: 1000,
        externalId: 'mock_quarantined'
      }
    });
  } else if (!quarantinedService.externalId) {
    quarantinedService = await prisma.service.update({
      where: { id: quarantinedService.id },
      data: { externalId: 'mock_quarantined' }
    });
  }

  // 4. Заказ
  let order = await prisma.order.findFirst({ where: { userId } });
  if (!order) {
    // eslint-disable-next-line no-useless-assignment
    order = await prisma.order.create({
      data: {
        userId,
        serviceId: service.id,
        providerId: provider.id,
        quantity: 100,
        status: 'PENDING',
        charge: 1500n, // Cents
        providerCost: 500n,
        link: 'https://t.me/testchannel'
      }
    });
  }

  // 5. Тикет (чат поддержки)
  let ticket = await prisma.ticket.findFirst({ where: { userId } });
  if (!ticket) {
    // eslint-disable-next-line no-useless-assignment
    ticket = await prisma.ticket.create({
      data: {
        userId,
        subject: 'Visual QA Test Ticket',
        status: 'OPEN',
        messages: {
          create: [
            { text: 'Привет, это тестовый тикет для проверки интерфейса.', sender: 'USER' },
            { text: 'Здравствуйте! Мы проверяем ваш запрос.', sender: 'STAFF' }
          ]
        }
      }
    });
  }
}

async function main() {
  const isCompareMode = process.argv.includes('--compare');
  const isBaselineMode = process.argv.includes('--baseline');

  console.log('🚀 Запуск Visual QA Script...');
  console.log(`Режим: ${isCompareMode ? 'Сравнение (Compare)' : isBaselineMode ? 'Запись эталона (Baseline)' : 'Обычный захват (Capture)'}`);

  // 1. Создание директорий
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  // 2. Создание/обновление пользователя-владельца
  const email = 'e2e-tester@test.com';
  console.log(`👤 Проверка тестового пользователя ${email}...`);
  const user = await prisma.user.upsert({
    where: { email_tenantId: { email, tenantId: 'smmplan' } },
    update: {
      role: 'OWNER',
      isActive: true,
      isDeleted: false,
    },
    create: {
      email,
      tenantId: 'smmplan',
      role: 'OWNER',
      isActive: true,
      isDeleted: false,
      balance: 200000_00n, // 200K RUB
    },
  });

  // Наполнение тестовыми данными
  await seedData(user.id);

  // 3. Создание сессии в БД
  console.log('🔑 Создание сессии и JWT токена...');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: 'visual-qa-tester',
      ipAddress: '127.0.0.1'
    }
  });

  // 4. Генерация JWT
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new SignJWT({ sessionId: session.id, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  // 5. Запуск браузера Playwright
  console.log('🌐 Запуск Chromium браузера...');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

  // 1. Авторизуемся через проверенный QA login-direct эндпоинт
  console.log('🔑 Авторизация через /api/dev/login-direct...');
  const qaSecret = process.env.QA_SECRET_KEY || process.env.NEXT_PUBLIC_QA_SECRET || '';
  await page.goto(`${baseUrl}/api/dev/login-direct?email=art@artmspektr.ru&role=OWNER&secret=${qaSecret}&redirectTo=/admin/catalog`, {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await page.waitForTimeout(2000);

  console.log(`🤖 Начало захвата скриншотов с ${baseUrl}...`);

  const results = [];

  for (const pageMeta of adminPages) {
    const targetUrl = `${baseUrl}${pageMeta.path}`;
    console.log(`📸 Загрузка: ${targetUrl}...`);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Ждём дополнительное время для стабильного рендеринга таблиц и контента
      await page.waitForTimeout(2000);

      // Путь сохранения
      const filename = `${pageMeta.name}_desktop.png`;
      const savePath = isBaselineMode 
        ? path.resolve(baselineDir, filename)
        : path.resolve(screenshotsDir, filename);

      await page.screenshot({ path: savePath, fullPage: false });
      console.log(`✔️ Снимок сохранен по пути: ${savePath}`);

      const artifactCopy = path.resolve('C:\\Users\\Артём\\.gemini\\antigravity\\brain\\6fe070bd-15c2-4d78-b2e2-88e29f93053c', filename);
      try {
        fs.copyFileSync(savePath, artifactCopy);
      } catch (e) {}

      results.push({ name: pageMeta.name, path: pageMeta.path, status: 'CAPTURED', filename });
    } catch (err) {
      console.error(`❌ Ошибка захвата страницы ${pageMeta.path}:`, err.message);
      results.push({ name: pageMeta.name, path: pageMeta.path, status: 'ERROR', error: err.message });
    }
  }

  // Закрываем браузер
  await browser.close();

  // 6. Сравнение скриншотов, если включен режим --compare
  if (isCompareMode) {
    console.log('\n🔍 Запуск сравнения скриншотов с эталонами...');
    let hasFailures = false;
    const compareSummary = [];

    for (const pageMeta of adminPages) {
      const filename = `${pageMeta.name}_desktop.png`;
      const baselinePath = path.resolve(baselineDir, filename);
      const capturedPath = path.resolve(screenshotsDir, filename);
      const diffPath = path.resolve(screenshotsDir, `diff_${filename}`);

      // 1. Проверяем наличие эталона
      if (!fs.existsSync(baselinePath)) {
        console.error(`❌ Ошибка: Отсутствует эталонный снимок (baseline) для страницы "${pageMeta.name}"`);
        compareSummary.push({
          name: pageMeta.name,
          status: 'MISSING_BASELINE',
          details: `Отсутствует эталонный снимок по пути: ${baselinePath}`
        });
        hasFailures = true;
        continue;
      }

      // 2. Проверяем наличие свежего снимка
      if (!fs.existsSync(capturedPath)) {
        console.error(`❌ Ошибка: Отсутствует свежий снимок для сравнения для страницы "${pageMeta.name}"`);
        compareSummary.push({
          name: pageMeta.name,
          status: 'MISSING_CAPTURE',
          details: `Не удалось сделать свежий снимок.`
        });
        hasFailures = true;
        continue;
      }

      // 3. Выполняем сравнение пикселей с помощью pixelmatch
      try {
        const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
        const img2 = PNG.sync.read(fs.readFileSync(capturedPath));
        const { width, height } = img1;

        if (img1.width !== img2.width || img1.height !== img2.height) {
          throw new Error(`Размеры изображений не совпадают: эталон (${img1.width}x${img1.height}) vs свежий (${img2.width}x${img2.height})`);
        }

        const diff = new PNG({ width, height });
        const mismatchedPixels = pixelmatch(
          img1.data,
          img2.data,
          diff.data,
          width,
          height,
          { threshold: 0.1 }
        );

        fs.writeFileSync(diffPath, PNG.sync.write(diff));

        const totalPixels = width * height;
        const diffRatio = mismatchedPixels / totalPixels;
        const diffPercent = (diffRatio * 100).toFixed(2);

        if (diffRatio > 0.01) {
          hasFailures = true;
          compareSummary.push({
            name: pageMeta.name,
            status: 'FAILED',
            ratio: diffRatio,
            percent: diffPercent,
            diffPath
          });
        } else {
          compareSummary.push({
            name: pageMeta.name,
            status: 'PASSED',
            ratio: diffRatio,
            percent: diffPercent
          });
        }
      } catch (err) {
        console.error(`❌ Ошибка сравнения пикселей на странице "${pageMeta.name}":`, err.message);
        compareSummary.push({
          name: pageMeta.name,
          status: 'ERROR',
          details: err.message
        });
        hasFailures = true;
      }
    }

    // Вывод итогового отчета на русском языке
    console.log('\n============================================================');
    if (hasFailures) {
      console.log('❌ ОШИБКА ВИЗУАЛЬНОГО QA: ОБНАРУЖЕНЫ РАСХОЖДЕНИЯ МАКЕТОВ ❌');
      console.log('============================================================');
      console.log('Следующие страницы превысили допустимый порог изменений (1%):\n');

      for (const item of compareSummary) {
        if (item.status === 'FAILED') {
          console.log(`- Страница [${item.name}]:`);
          console.log(`  Процент расхождений: ${item.percent}% (порог: 1.00%)`);
          console.log(`  Файл различий: ${item.diffPath}`);
        } else if (item.status === 'MISSING_BASELINE') {
          console.log(`- Страница [${item.name}]:`);
          console.log(`  Ошибка: ${item.details}`);
        } else if (item.status === 'ERROR') {
          console.log(`- Страница [${item.name}]:`);
          console.log(`  Ошибка работы: ${item.details}`);
        }
      }
      console.log('\nПожалуйста, проверьте файлы различий (diff) для выявления сдвигов интерфейса.');
      console.log('============================================================');
      process.exit(1);
    } else {
      console.log('✅ УСПЕШНО: ВИЗУАЛЬНЫЙ QA ПРОЙДЕН БЕЗ ОШИБОК ✅');
      console.log('============================================================');
      console.log('Все ключевые страницы админ-панели соответствуют эталонам!\n');
      
      compareSummary.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} - OK (${item.percent}% изменений)`);
      });
      console.log('============================================================');
      process.exit(0);
    }
  }

  console.log('\n🎉 Завершено успешно без сравнения.');
  process.exit(0);
}

main()
  .catch(async (err) => {
    console.error('💥 Критическая ошибка скрипта:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
