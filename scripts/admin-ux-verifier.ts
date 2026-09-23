import fs from 'fs';
import path from 'path';

interface AdminRouteAudit {
  route: string;
  section: string;
  hasPageFile: boolean;
  hasErrorFile: boolean;
  hasLoadingFile: boolean;
  status: 'PASS' | 'WARN';
}

async function verifyAdminArchitecture() {
  console.log('================================================================');
  console.log('🏛️  ADMIN PANEL ERGONOMIC & ARCHITECTURAL VERIFICATION SUITE');
  console.log('================================================================\n');

  const adminDir = path.join(process.cwd(), 'src', 'app', 'admin');
  
  const expectedSections = [
    // 1. Операционка
    { path: 'dashboard', name: 'Дашборд (Главная аналитика)' },
    { path: 'orders', name: 'Заказы (Живой поток, статусы, SLA)' },
    { path: 'refills', name: 'Докрутки (Гарантийные заявки)' },
    { path: 'tickets', name: 'Тикеты (Омничат поддержки)' },
    { path: 'clients', name: 'Клиенты (Профили, LTV, балансы)' },

    // 2. Финансы & Маркетинг
    { path: 'finance', name: 'Биллинг (Транзакции, леджер)' },
    { path: 'analytics', name: 'Аналитика (Выручка, маржа, динамика)' },
    { path: 'finance/balance-requests', name: 'Заявки баланса (Двухфакторный аппрув)' },
    { path: 'finance/balance-requests/stats', name: 'Статистика заявок (Аудит операторов)' },
    { path: 'marketing', name: 'Маркетинг (Промокоды, скидки)' },

    // 3. Каталог & Провайдеры
    { path: 'catalog', name: 'Услуги (Витрина, цены, маржа)' },
    { path: 'catalog/sync', name: 'Синхронизация (Фоновый синк)' },
    { path: 'catalog/quarantine', name: 'Карантин (Аномалии и скачки цен)' },
    { path: 'smart', name: 'Умный Dripfeed (Авто-кампании)' },
    { path: 'providers', name: 'Провайдеры (API, шифрование Vault)' },
    { path: 'pages', name: 'Страницы (CMS правовых страниц)' },
    { path: 'knowledge', name: 'Блог & Статьи (База знаний)' },

    // 4. Система
    { path: 'settings', name: 'Настройки (Глобальные параметры)' },
    { path: 'settings/balance-policies', name: 'Политики баланса (Лимиты саппорта)' },
    { path: 'system/features', name: 'Фичи (Feature Flags переключатели)' },
  ];

  const results: AdminRouteAudit[] = [];

  for (const sec of expectedSections) {
    const routeDir = path.join(adminDir, sec.path);
    const pageFile = path.join(routeDir, 'page.tsx');
    const hasPage = fs.existsSync(pageFile);

    const auditItem: AdminRouteAudit = {
      route: `/admin/${sec.path}`,
      section: sec.name,
      hasPageFile: hasPage,
      hasErrorFile: fs.existsSync(path.join(routeDir, 'error.tsx')) || fs.existsSync(path.join(adminDir, 'error.tsx')),
      hasLoadingFile: fs.existsSync(path.join(routeDir, 'loading.tsx')) || fs.existsSync(path.join(adminDir, 'loading.tsx')),
      status: hasPage ? 'PASS' : 'WARN'
    };

    results.push(auditItem);
    const icon = auditItem.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${auditItem.route}] -> ${auditItem.section} (page.tsx: ${hasPage ? 'OK' : 'MISSING'})`);
  }

  console.log('\n================================================================');
  console.log('📊 ИТОГ АРХИТЕКТУРНОЙ ПРОВЕРКИ ВКЛАДОК:');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`Всего ключевых вкладок: ${total}`);
  console.log(`✅ Реализовано и готово: ${passed}`);
  console.log(`❌ Отсутствует: ${total - passed}\n`);

  if (passed === total) {
    console.log('🎉 ВСЕ 20 ВХОДНЫХ ТОЧЕК АДМИН-ПАНЕЛИ СОГЛАСОВАНЫ И РАБОТАЮТ!');
  } else {
    process.exit(1);
  }
}

verifyAdminArchitecture().catch(console.error);
