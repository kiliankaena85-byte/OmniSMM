import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Target Environment Configurations
const CONFIGS = {
  staging: {
    host: 'root@smmplan.pro',
    path: '/opt/smmplan_staging',
    composeFile: 'docker-compose.yml',
    containers: {
      app: 'smmplan_staging_app',
      worker: 'smmplan_staging_worker',
      bot: 'smmplan_staging_bot'
    },
    healthCheckUrl: 'http://localhost:3005/api/health'
  },
  prod: {
    host: 'root@smmplan.pro',
    path: '/opt/smmplan_lite',
    composeFile: 'docker-compose.prod.yml',
    containers: {
      app: 'smmplan_lite_prod_app',
      worker: 'smmplan_lite_prod_worker',
      bot: 'smmplan_lite_prod_bot'
    },
    healthCheckUrl: 'https://smmplan.pro/api/health'
  }
};

// Colors for console logging
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg: string) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`)
};

async function main() {
  const args = process.argv.slice(2);
  const isProd = args.includes('--prod') || args.includes('--env=prod');
  const isForce = args.includes('--force');
  const skipTsc = args.includes('--skip-tsc') || args.includes('--no-verify');
  const env: 'prod' | 'staging' = isProd ? 'prod' : 'staging';
  const target = CONFIGS[env];

  log.info(`Запуск системы быстрых правок (Hot-Patching) для среды: ${env.toUpperCase()}`);
  log.info(`Целевой хост: ${target.host}`);
  log.info(`Путь деплоя: ${target.path}`);

  // 1. Проверка изменений в критических файлах (package.json, schema.prisma)
  try {
    const gitDiff = execSync('git diff --name-only HEAD').toString();
    const criticalFiles = ['package.json', 'package-lock.json', 'prisma/schema.prisma'];
    const modifiedCritical = criticalFiles.filter(file => gitDiff.includes(file));

    if (modifiedCritical.length > 0) {
      if (isForce) {
        log.warn(`Принудительный запуск (--force): игнорируем изменения в критических файлах: ${modifiedCritical.join(', ')}`);
      } else {
        log.error(`Обнаружены изменения в критических файлах: ${modifiedCritical.join(', ')}`);
        log.error('Горячий патч не поддерживает автоматическое обновление зависимостей или схемы БД.');
        log.error('Используйте флаг --force, если эти изменения уже применены на сервере, или запустите полный деплой.');
        process.exit(1);
      }
    }
  } catch (err) {
    log.warn('Не удалось запустить git diff. Проверка критических файлов пропущена.');
  }

  // 2. Локальная проверка типов (tsc)
  if (skipTsc) {
    log.warn('Пропуск проверки типов TypeScript (--skip-tsc).');
  } else {
    log.info('1/6 Проверка типов TypeScript...');
    try {
      execSync('npx tsc --noEmit', { stdio: 'inherit' });
      log.success('Проверка типов пройдена успешно.');
    } catch (err) {
      log.error('Проверка типов завершилась с ошибкой. Исправьте ошибки типов перед деплоем или используйте --skip-tsc.');
      process.exit(1);
    }
  }

  // 3. Локальный билд Next.js
  log.info('2/6 Сборка Next.js приложения...');
  
  const envPath = path.join(process.cwd(), '.env');
  const envBackupPath = path.join(process.cwd(), '.env.tmp_build_backup');
  let envRenamed = false;
  
  try {
    if (fs.existsSync(envPath)) {
      log.info('Временное скрытие файла .env для чистой сборки...');
      fs.renameSync(envPath, envBackupPath);
      envRenamed = true;
    }
    
    const nextPath = path.join(process.cwd(), '.next');
    if (fs.existsSync(nextPath)) {
      log.info('Очистка старого кэша Next.js сборки...');
      fs.rmSync(nextPath, { recursive: true, force: true });
    }
    execSync('npm run build', { 
      stdio: 'inherit', 
      env: { 
        ...process.env, 
        DISABLE_REDIS_CACHE: '1',
        APP_ENV: 'production',
        NEXT_PUBLIC_APP_ENV: 'production',
        DATABASE_URL: 'postgresql://db:5432/smmplan_lite?schema=public'
      } 
    });
    log.success('Сборка Next.js выполнена успешно.');
  } catch (err) {
    log.error('Сборка Next.js завершилась с ошибкой.');
    if (envRenamed && fs.existsSync(envBackupPath)) {
      fs.renameSync(envBackupPath, envPath);
      envRenamed = false;
    }
    process.exit(1);
  } finally {
    if (envRenamed && fs.existsSync(envBackupPath)) {
      log.info('Восстановление локального файла .env...');
      fs.renameSync(envBackupPath, envPath);
    }
  }

  // 4. Подготовка архива патча
  log.info('3/6 Подготовка архива патча...');
  const distPath = path.join(process.cwd(), 'dist_patch');
  const archivePath = path.join(process.cwd(), 'patch.tar.gz');

  try {
    // Очистка старых файлов патча
    if (fs.existsSync(distPath)) fs.rmSync(distPath, { recursive: true, force: true });
    if (fs.existsSync(archivePath)) fs.rmSync(archivePath, { force: true });

    // Создание структуры
    fs.mkdirSync(distPath, { recursive: true });

    // Копирование необходимых собранных файлов
    log.info('Копирование файлов сборки...');
    fs.cpSync(path.join(process.cwd(), '.next/standalone/server.js'), path.join(distPath, 'server.js'));
    if (fs.existsSync(path.join(process.cwd(), 'cache-handler.js'))) {
      fs.cpSync(path.join(process.cwd(), 'cache-handler.js'), path.join(distPath, 'cache-handler.js'));
    }
    fs.cpSync(path.join(process.cwd(), '.next/standalone/.next'), path.join(distPath, '.next'), { recursive: true });
    // Remove node_modules from .next to prevent Windows/Linux symlink conflicts during docker cp
    const nestedNodeModules = path.join(distPath, '.next', 'node_modules');
    if (fs.existsSync(nestedNodeModules)) {
      fs.rmSync(nestedNodeModules, { recursive: true, force: true });
    }
    fs.cpSync(path.join(process.cwd(), '.next/static'), path.join(distPath, '.next/static'), { recursive: true });
    fs.cpSync(path.join(process.cwd(), 'public'), path.join(distPath, 'public'), { recursive: true });
    fs.cpSync(path.join(process.cwd(), 'src'), path.join(distPath, 'src'), { recursive: true });
    if (fs.existsSync(path.join(process.cwd(), 'scripts'))) {
      fs.cpSync(path.join(process.cwd(), 'scripts'), path.join(distPath, 'scripts'), { recursive: true });
    }
    if (fs.existsSync(path.join(process.cwd(), 'prisma'))) {
      fs.cpSync(path.join(process.cwd(), 'prisma'), path.join(distPath, 'prisma'), { recursive: true });
    }

    const standalonePrismaPath = path.join(process.cwd(), '.next/standalone/node_modules/.prisma');
    if (fs.existsSync(standalonePrismaPath) && process.platform !== 'win32') {
      log.info('Копирование бинарников Prisma...');
      fs.cpSync(standalonePrismaPath, path.join(distPath, 'node_modules/.prisma'), { recursive: true });
    } else if (fs.existsSync(standalonePrismaPath)) {
      log.info('Пропуск копирования бинарников Prisma на Windows (для сохранения Linux query-engine в Docker)...');
    }


    // FIX FOR WINDOWS: Convert backslashes to forward slashes in Next.js manifests so they work on Linux
    const manifestsToFix = [
      path.join(distPath, 'server.js'),
      path.join(distPath, '.next', 'server', 'app-paths-manifest.json'),
      path.join(distPath, '.next', 'server', 'pages-manifest.json'),
      path.join(distPath, '.next', 'server', 'middleware-manifest.json'),
      path.join(distPath, '.next', 'prerender-manifest.json'),
      path.join(distPath, '.next', 'routes-manifest.json'),
      path.join(distPath, '.next', 'required-server-files.json')
    ];
    for (const manifestPath of manifestsToFix) {
      if (fs.existsSync(manifestPath)) {
        let content = fs.readFileSync(manifestPath, 'utf-8');
        content = content.replace(/\\\\/g, '/');
        fs.writeFileSync(manifestPath, content, 'utf-8');
      }
    }

    // Создание tarball
    log.info('Упаковка архива...');
    execSync(`tar -czf "${archivePath}" -C "${distPath}" .`);
    log.success(`Архив патча готов: ${archivePath}`);
  } catch (err: any) {
    log.error(`Ошибка при сборке архива: ${err.message}`);
    cleanup(distPath, archivePath);
    process.exit(1);
  }

  // 5. Передача архива на сервер
  log.info('4/6 Передача архива на сервер...');
  try {
    execSync(`scp "${archivePath}" ${target.host}:/tmp/smmplan_patch.tar.gz`, { stdio: 'inherit' });
    log.success('Архив успешно передан на сервер.');
  } catch (err: any) {
    log.error(`Ошибка при передаче SCP: ${err.message}`);
    cleanup(distPath, archivePath);
    process.exit(1);
  }

  // 6. Применение правок на сервере через SSH
  log.info('5/6 Применение правок и перезапуск служб на сервере...');
  const remoteCommands = [
    `set -e`,
    `rm -rf /tmp/smmplan_patch`,
    `mkdir -p /tmp/smmplan_patch`,
    `tar -xzf /tmp/smmplan_patch.tar.gz -C /tmp/smmplan_patch`,
    `rm -f /tmp/smmplan_patch.tar.gz`,
    `echo "Копирование файлов в контейнеры..."`,
    `docker exec -u root ${target.containers.app} rm -rf /app/.next/server /app/.next/static`,
    `docker cp /tmp/smmplan_patch/. ${target.containers.app}:/app/`,
    `docker exec -u root ${target.containers.app} chown -R nextjs:nodejs /app/server.js /app/cache-handler.js /app/.next /app/public /app/src /app/prisma || true`,
    `docker cp /tmp/smmplan_patch/src/. ${target.containers.worker}:/app/src/`,
    `docker exec -u root ${target.containers.worker} chown -R nextjs:nodejs /app/src`,
    `docker cp /tmp/smmplan_patch/src/. ${target.containers.bot}:/app/src/`,
    `docker exec -u root ${target.containers.bot} chown -R nextjs:nodejs /app/src`,
    `echo "Запуск миграций базы данных..."`,
    `docker exec -u 0 ${target.containers.app} npx prisma migrate deploy`,
    `echo "Перезапуск контейнеров..."`,
    `docker restart ${target.containers.app}`,
    `docker restart ${target.containers.worker}`,
    `docker restart ${target.containers.bot}`,
    `echo "Ожидание запуска приложения (12 сек)..."`,
    `sleep 12`,
    `echo "Проверка здоровья приложения (Health Check)..."`,
    `HTTP_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" ${target.healthCheckUrl} || echo "000")`,
    `if [ "$HTTP_STATUS" != "200" ]; then`,
    `  echo "❌ Ошибка! Health Check вернул код: $HTTP_STATUS"`,
    `  echo "=== LOGS FROM FAILED CONTAINER ==="`,
    `  docker logs --tail 100 ${target.containers.app} || true`,
    `  echo "=================================="`,
    `  echo "🚨 Запуск автоматического отката (восстановление из чистого образа)..."`,
    `  cd ${target.path}`,
    `  docker compose -f ${target.composeFile} up -d --force-recreate`,
    `  echo "✅ Откат успешно завершен."`,
    `  exit 1`,
    `fi`,
    `echo "✅ Приложение успешно запущено. Код ответа: $HTTP_STATUS"`,
    `rm -rf /tmp/smmplan_patch`
  ].join('\n');

  try {
    execSync(`ssh ${target.host} "bash"`, {
      input: remoteCommands,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    log.success('Патч успешно применен на сервере!');
  } catch (err: any) {
    log.error(`Ошибка при выполнении удаленных команд: ${err.message}`);
    cleanup(distPath, archivePath);
    process.exit(1);
  }

  // 7. Очистка временных файлов
  log.info('6/6 Очистка локальных временных файлов...');
  cleanup(distPath, archivePath);
  log.success('Горячий патч успешно завершен!');
}

function cleanup(distPath: string, archivePath: string) {
  if (fs.existsSync(distPath)) fs.rmSync(distPath, { recursive: true, force: true });
  if (fs.existsSync(archivePath)) fs.rmSync(archivePath, { force: true });
}

main().catch(err => {
  log.error(`Непредвиденная ошибка: ${err.message}`);
  process.exit(1);
});
