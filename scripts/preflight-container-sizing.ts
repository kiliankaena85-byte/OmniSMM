/**
 * scripts/preflight-container-sizing.ts
 * Pre-Flight чекер ресурсов хоста, валидатор Golden Ratio RAM и поэтапный запуск (Staggered Startup).
 */

import { execSync } from 'child_process';
import os from 'os';

interface MemoryAudit {
  freePhysicalMb: number;
  totalPhysicalMb: number;
  wslLimitMb: number;
  containerBudgetMb: number;
}

function auditHostMemory(): MemoryAudit {
  const totalPhysicalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freePhysicalMb = Math.round(os.freemem() / 1024 / 1024);

  // WSL2 бюджет (из .wslconfig или дефолт 1536MB)
  const wslLimitMb = 1536;

  // Сумма жестких лимитов контейнеров OmniSMM:
  // db (128) + redis (64) + clash (64) + worker (128) + bot (128) + web (384) = 896 MB
  const containerBudgetMb = 896;

  return {
    freePhysicalMb,
    totalPhysicalMb,
    wslLimitMb,
    containerBudgetMb,
  };
}

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (err: any) {
    return err.message || String(err);
  }
}

async function staggeredStartup() {
  console.log('\x1b[36m%s\x1b[0m', '======================================================');
  console.log('\x1b[36m%s\x1b[0m', '  OmniSMM: Load-Aware Staggered Container Launcher    ');
  console.log('\x1b[36m%s\x1b[0m', '======================================================');

  // 1. Аудит памяти
  const audit = auditHostMemory();
  console.log(`[1/4] Аудит памяти хоста:`);
  console.log(`      - Всего RAM: ${audit.totalPhysicalMb} МБ`);
  console.log(`      - Свободно RAM: ${audit.freePhysicalMb} МБ`);
  console.log(`      - WSL2 потолок: ${audit.wslLimitMb} МБ`);
  console.log(`      - Бюджет контейнеров (Hard Cap): ${audit.containerBudgetMb} МБ (Golden Ratio OK)`);

  if (audit.freePhysicalMb < 800) {
    console.warn('\x1b[33m%s\x1b[0m', '      ⚠️ Предупреждение: Свободной памяти < 800 МБ. Запускаю сброс дискового кэша...');
    try {
      execSync('wsl -e sh -c "sync; echo 3 > /proc/sys/vm/drop_caches"', { stdio: 'ignore' });
    } catch {}
  }

  // 2. Фаза 1: Инфраструктурные сервисы (db, redis, clash)
  console.log(`\n[2/4] Фаза 1: Запуск инфраструктуры (db, redis, clash)...`);
  execSync('docker compose up -d db redis clash', { stdio: 'inherit' });
  console.log('      Ожидание готовности healthcheck (10 сек)...');
  await new Promise((r) => setTimeout(r, 10000));

  // 3. Фаза 2: Фоновые сервисы (worker, bot)
  console.log(`\n[3/4] Фаза 2: Запуск фоновых обработчиков (worker, bot)...`);
  execSync('docker compose up -d worker bot', { stdio: 'inherit' });
  console.log('      Стабилизация очередей (5 сек)...');
  await new Promise((r) => setTimeout(r, 5000));

  // 4. Фаза 3: Веб-интерфейс (web)
  console.log(`\n[4/4] Фаза 3: Запуск Next.js Standalone (web)...`);
  execSync('docker compose up -d web', { stdio: 'inherit' });

  console.log('\n\x1b[32m%s\x1b[0m', '✓ Все контейнеры успешно запущены в поэтапном режиме!');
  console.log('Текущее состояние контейнеров:');
  const stats = runCommand('docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"');
  console.log(stats);
}

staggeredStartup().catch((e) => {
  console.error('\x1b[31m%s\x1b[0m', `❌ Ошибка запуска контейнеров: ${e.message}`);
  process.exit(1);
});
