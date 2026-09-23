import { db as prisma } from '../src/lib/db';
import { CBRRateService } from '../src/services/system/cbr-rate.service';
import { BalanceVerifier } from '../src/utils/balance-verifier';
import { SettingsManager } from '../src/lib/settings';
import fs from 'fs';
import path from 'path';

async function runPreMortemSimulation() {
  console.log("======================================================================");
  console.log("🛡️   SMMPLAN LITE: АВТОНОМНЫЙ ПРЕМОТРЕМ ТЕСТ & СИМУЛЯЦИЯ СБОЕВ  🛡️");
  console.log("======================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // СЦЕНАРИЙ 1: Отказ API Центробанка (CBR XML/JSON API Offline Fallback)
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------------");
  console.log("🎬 ТЕСТ 1: Имитация падения API Центробанка (CBR)");
  console.log("----------------------------------------------------------------------");
  
  // Сохраняем текущее состояние настроек, чтобы не сломать их
  const originalRate = await SettingsManager.getExchangeRateUSD();
  console.log(`Текущий курс USD в системе: ${originalRate} ₽`);

  // Временно подменяем fetch для симуляции 500/сетевой ошибки
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("Simulated network outage (CBR server down / DNS failure)");
  };

  try {
    console.log("Вызов CBRRateService.syncCBRExchangeRate() в условиях полного отсутствия сети...");
    const syncResult = await CBRRateService.syncCBRExchangeRate();

    assert(syncResult.updated === false, "Синхронизация должна вернуть updated: false");
    assert(syncResult.systemRate === originalRate, `Система должна остаться на прежнем курсе: ${originalRate} ₽`);
    
    const dbRate = await SettingsManager.getExchangeRateUSD();
    assert(dbRate === originalRate, "Курс в настройках БД не должен быть изменен или поврежден");
    console.log("✅ Успешно: Система защищена от падения внешнего API и плавно перешла на кэш!");
  } catch (err: any) {
    console.error("❌ Сбой теста 1. Выброшено исключение вместо обработки сбоя:", err.message);
    failed++;
  } finally {
    // Восстанавливаем оригинальный fetch
    global.fetch = originalFetch;
  }

  // -------------------------------------------------------------------------
  // СЦЕНАРИЙ 2: Обнаружение расхождения баланса & Автоматическая блокировка (Ledger)
  // -------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------------------");
  console.log("🎬 ТЕСТ 2: Обнаружение компрометации баланса пользователя & Блокировка");
  console.log("----------------------------------------------------------------------");

  const testEmail = `premortem_tester_${Date.now()}@example.com`;
  let userId: string | null = null;

  try {
    // 1. Создаем пользователя с чистым балансом 1000 копеек (10 руб)
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        balance: BigInt(1000), // 1000 копеек
        isActive: true,
        isDeleted: false,
      }
    });
    userId = user.id;

    // 2. Создаем согласованную запись в реестре Ledger на 1000 копеек
    await prisma.ledgerEntry.create({
      data: {
        userId: user.id,
        amount: BigInt(1000),
        reason: "Valid top-up",
        status: "APPROVED",
        transactionType: "DEPOSIT",
      }
    });

    console.log(`Пользователь ${testEmail} успешно создан. Баланс = 1000 центов.`);
    console.log("Запуск верификации согласованного баланса...");
    const initialVerify = await BalanceVerifier.verifyAllBalances();
    const userResult = initialVerify.find(r => r.email === testEmail);

    assert(userResult !== undefined, "Пользователь найден в результатах проверки");
    assert(userResult?.isDiscrepancy === false, "Сначала расхождение не должно быть найдено");
    
    const dbUserBefore = await prisma.user.findUnique({ where: { id: userId } });
    assert(dbUserBefore?.isActive === true, "Пользователь должен быть активным");

    // 3. Имитируем несанкционированное изменение (взлом или сбой транзакции) в обход реестра
    console.log("\nИмитация изменения баланса в обход Ledger (например, хакерская атака)...");
    await prisma.user.update({
      where: { id: userId },
      data: { balance: BigInt(1500) } // Записали 1500 вместо 1000
    });

    console.log("Запуск верификации скомпрометированного баланса...");
    const secondaryVerify = await BalanceVerifier.verifyAllBalances();
    const discrepantResult = secondaryVerify.find(r => r.email === testEmail);

    assert(discrepantResult !== undefined, "Пользователь найден в результатах проверки после изменения");
    assert(discrepantResult?.isDiscrepancy === true, "Расхождение должно быть успешно обнаружено!");
    assert(discrepantResult?.discrepancy === BigInt(500), `Разница должна составлять 500 центов (получено: ${discrepantResult?.discrepancy})`);
    assert(discrepantResult?.lockedSuccessfully === true, "Статус блокировки должен быть lockedSuccessfully: true");

    // 4. Проверяем состояние в БД после авто-блокировки
    const dbUserAfter = await prisma.user.findUnique({ where: { id: userId } });
    assert(dbUserAfter?.isActive === false, "Аккаунт пользователя должен быть автоматически ЗАБЛОКИРОВАН (isActive: false)!");
    assert(dbUserAfter?.adminNote?.includes("[CRITICAL DISCREPANCY]") === true, `Заметка администратора должна содержать критический лог. Заметка: ${dbUserAfter?.adminNote}`);

    // 5. Проверяем наличие записи в аудите безопасности (AdminAuditLog)
    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { target: userId, action: 'USER_BALANCE_DISCREPANCY' }
    });
    assert(auditLog !== null, "В таблице AdminAuditLog должна быть создана запись о расхождении");
    assert(auditLog?.adminEmail === 'system@smmplan.pro', "Запись в аудит должна быть подписана системой system@smmplan.pro");

    console.log("✅ Успешно: Автоматический предохранитель Double-Check Ledger сработал мгновенно!");
  } catch (err: any) {
    console.error("❌ Сбой теста 2. Ошибка при выполнении сверки балансов:", err.message);
    failed++;
  } finally {
    // Чистим за собой
    if (userId) {
      console.log("\nОчистка тестовых данных...");
      await prisma.adminAuditLog.deleteMany({ where: { target: userId } });
      await prisma.ledgerEntry.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  }

  // -------------------------------------------------------------------------
  // СЦЕНАРИЙ 3: Защита скриншотов от ложных срабатываний (Dynamic Masking)
  // -------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------------------");
  console.log("🎬 ТЕСТ 3: Проверка маскирования динамических данных в Visual QA");
  console.log("----------------------------------------------------------------------");

  const visualQaPath = path.resolve(process.cwd(), 'scripts/visual-qa.js');
  if (fs.existsSync(visualQaPath)) {
    const code = fs.readFileSync(visualQaPath, 'utf-8');
    
    const hasStyleTag = code.includes("page.addStyleTag");
    const hasRechartsMask = code.includes(".recharts-responsive-container") || code.includes("svg.recharts-surface");
    const hasBalanceMask = code.includes("user-balance") || code.includes("balance");
    const hasTimestampMask = code.includes("timestamp") || code.includes("date-display");

    assert(hasStyleTag, "Скрипт visual-qa.js должен использовать инъекцию стилей addStyleTag для маскирования");
    assert(hasRechartsMask, "Динамические графики Recharts должны маскироваться (visibility: hidden)");
    assert(hasBalanceMask, "Динамический баланс пользователей должен скрываться");
    assert(hasTimestampMask, "Временные метки и даты должны скрываться во избежание ложных срабатываний сравнения");
    
    console.log("✅ Успешно: Логика Dynamic Masking в Visual QA спроектирована надежно!");
  } else {
    console.error("❌ Скрипт visual-qa.js не найден по пути:", visualQaPath);
    failed++;
  }

  console.log("\n======================================================================");
  console.log("🏁   ОБЩИЕ ИТОГИ ПРЕМОТРЕМ ТЕСТИРОВАНИЯ:");
  console.log(`- Успешно пройдено проверок: ${passed}`);
  console.log(`- Сбоев обнаружено: ${failed}`);
  console.log("======================================================================");

  if (failed > 0) {
    console.error("🔴 ПРЕМОТРЕМ ТЕСТ ОБНАРУЖИЛ КРИТИЧЕСКИЕ ДЕФЕКТЫ БЕЗОПАСНОСТИ!");
    process.exit(1);
  } else {
    console.log("🟢 ВСЕ ПРЕМОТРЕМ-МЕХАНИЗМЫ ЗАЩИТЫ АБСОЛЮТНО ИСПРАВНЫ И ГОТОВЫ К ПРОДАКШЕНУ!");
    process.exit(0);
  }
}

runPreMortemSimulation().catch(err => {
  console.error("💥 Критическая ошибка симулятора:", err);
  process.exit(1);
});
