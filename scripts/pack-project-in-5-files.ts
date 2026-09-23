import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

// Helper to recursively collect files
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (
        !file.includes('node_modules') &&
        !file.includes('.next') &&
        !file.includes('.git') &&
        !file.includes('dist')
      ) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (
        file.endsWith('.ts') ||
        file.endsWith('.tsx') ||
        file.endsWith('.js') ||
        file.endsWith('.mjs') ||
        file.endsWith('.css') ||
        file.endsWith('.prisma') ||
        file.endsWith('.json') ||
        file.endsWith('.conf')
      ) {
        // Skip package-lock, tsconfig build info, test snapshots
        if (
          !file.includes('package-lock.json') &&
          !file.includes('tsconfig.tsbuildinfo') &&
          !file.endsWith('.map')
        ) {
          arrayOfFiles.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
        }
      }
    }
  });

  return arrayOfFiles;
}

// Key modified/created/infrastructure files priority list
const corePriorityFiles = [
  'next.config.mjs',
  'package.json',
  'prisma/schema.prisma',
  'nginx/default.conf',
  'src/middleware.ts',
  'src/lib/money.ts',
  'src/lib/tenant-resolver.ts',
  'src/lib/navigation.ts',
  'src/types/flux.ts',
  'src/utils/status-helpers.ts',
  'src/hooks/useOrderWizard.ts',
  'src/app/globals.css',
  'src/app/ab-lovable/page.tsx',
  'src/app/api/auth/logout/route.ts',
  'src/app/dashboard/layout.tsx',
  'src/app/dashboard/new-order/page.tsx',
  'src/app/dashboard/orders/page.tsx',
  'src/app/dashboard/page.tsx',
  'src/components/dashboard/order-wizard/WizardStepIndicator.tsx',
  'src/components/dashboard/order-wizard/WizardNetworkStep.tsx',
  'src/components/dashboard/order-wizard/WizardCategoryStep.tsx',
  'src/components/dashboard/order-wizard/WizardServiceStep.tsx',
  'src/components/dashboard/LovableNewOrderWorkspace.tsx',
  'src/components/dashboard/LovableDock.tsx',
  'src/components/dashboard/LovableOrdersKanban.tsx',
  'src/components/dashboard/LovableOrdersList.tsx',
  'src/components/dashboard/lovable/LovableDashboardShell.tsx',
  'src/components/dashboard/lovable/LovableDashboardHome.tsx',
  'src/components/dashboard/lovable/LovableOrdersView.tsx',
  'src/components/ab-test/LovableOrderClient.tsx',
  'src/components/ab-test/LovableTrustBar.tsx',
  'src/components/ab-test/LovableWhyUs.tsx',
  'src/components/ab-test/LovableFAQ.tsx',
  'src/components/ab-test/LovableReviews.tsx',
  'src/components/landing/Header.tsx',
  'src/components/landing/MegaFooter.tsx',
  'src/components/landing/TrustBar.tsx',
  'src/tenants/flux/strategy.ts',
  'src/tenants/registry.ts',
  'src/tenants/factory.ts',
  'src/tenants/types.ts',
  'src/actions/order/checkout.ts',
  'src/actions/order/catalog.ts',
  'src/actions/user/settings-extra.ts',
  'src/actions/auth/password-login.ts',
  'src/actions/auth/password-register.ts',
  'src/actions/auth/request-magic-link.ts',
];

// Collect all src files + root files
let allSourceFiles = getAllFiles(path.join(rootDir, 'src'));
const rootExtraFiles = ['next.config.mjs', 'package.json', 'prisma/schema.prisma', 'nginx/default.conf'];

rootExtraFiles.forEach((f) => {
  if (fs.existsSync(path.join(rootDir, f)) && !allSourceFiles.includes(f)) {
    allSourceFiles.unshift(f);
  }
});

// Remove duplicates while keeping order
allSourceFiles = Array.from(new Set([...corePriorityFiles, ...allSourceFiles]));

// Categorize files into 5 volumes
const part1Files: string[] = []; // Core Infra, Middleware, Configs, Schema, Tenant Engine, Money, Navigation
const part2Files: string[] = []; // Dashboard Components, Order Wizard, Shell, Dock, Views, Home
const part3Files: string[] = []; // Landing, A/B Test Components, TrustBar, Header, Footer, WhyUs, FAQ, Reviews
const part4Files: string[] = []; // Actions (Checkout, Catalog, Auth, User, Admin)
const part5Files: string[] = []; // Services, Utils, Financial Engine, Link Validators, Workers, Types

allSourceFiles.forEach((relPath) => {
  if (
    relPath.includes('next.config') ||
    relPath.includes('package.json') ||
    relPath.includes('prisma/schema') ||
    relPath.includes('nginx') ||
    relPath.includes('middleware') ||
    relPath.includes('tenant') ||
    relPath.includes('money') ||
    relPath.includes('navigation') ||
    relPath.includes('globals.css')
  ) {
    part1Files.push(relPath);
  } else if (
    relPath.includes('components/dashboard') ||
    relPath.includes('app/dashboard') ||
    relPath.includes('hooks/useOrderWizard')
  ) {
    part2Files.push(relPath);
  } else if (
    relPath.includes('components/ab-test') ||
    relPath.includes('components/landing') ||
    relPath.includes('app/ab-lovable') ||
    relPath.includes('components/orders')
  ) {
    part3Files.push(relPath);
  } else if (relPath.includes('actions/')) {
    part4Files.push(relPath);
  } else {
    part5Files.push(relPath);
  }
});

const volumes = [
  {
    num: 1,
    title: 'ЧАСТЬ 1 из 5: Инфраструктура, Темы, Тенанты, Навигация, Миддлвар и СУБД',
    filename: 'PROJECT_FILES_PART_1_2026-07-28.md',
    files: part1Files,
  },
  {
    num: 2,
    title: 'ЧАСТЬ 2 из 5: Панель управления (Dashboard Shell, Order Wizard, Dock, Views)',
    filename: 'PROJECT_FILES_PART_2_2026-07-28.md',
    files: part2Files,
  },
  {
    num: 3,
    title: 'ЧАСТЬ 3 из 5: Лендинги, A/B Трафик, Компоненты оформления заказа (Landing, Checkout)',
    filename: 'PROJECT_FILES_PART_3_2026-07-28.md',
    files: part3Files,
  },
  {
    num: 4,
    title: 'ЧАСТЬ 4 из 5: Server Actions (Каталог, Оформление заказа, Настройки, Аутентификация)',
    filename: 'PROJECT_FILES_PART_4_2026-07-28.md',
    files: part4Files,
  },
  {
    num: 5,
    title: 'ЧАСТЬ 5 из 5: Сервисы бизнес-логики, Финансовый движок, Валидаторы, Типы и Воркеры',
    filename: 'PROJECT_FILES_PART_5_2026-07-28.md',
    files: part5Files,
  },
];

function getLang(relPath: string): string {
  if (relPath.endsWith('.tsx')) return 'tsx';
  if (relPath.endsWith('.ts')) return 'ts';
  if (relPath.endsWith('.css')) return 'css';
  if (relPath.endsWith('.prisma')) return 'prisma';
  if (relPath.endsWith('.json')) return 'json';
  if (relPath.endsWith('.mjs') || relPath.endsWith('.js')) return 'javascript';
  if (relPath.endsWith('.conf')) return 'nginx';
  return 'text';
}

volumes.forEach((vol) => {
  let content = `# СБОРКА ИСХОДНОГО КОДА ПРОЕКТА SMMplan / Flux / Lovable\n`;
  content += `## ${vol.title}\n\n`;
  content += `**Дата сборки:** 28 июля 2026  \n`;
  content += `**Файл:** \`${vol.filename}\`  \n`;
  content += `**Количество файлов в части:** ${vol.files.length}  \n`;
  content += `**Принцип:** Доказательность 100%. Чтение файлов ВСЕГДА выполнено НАПРЯМУЮ С ДИСКА (\`fs.readFileSync\`). Нет сокращений (\`...\`), нет моков, нет заглушек.\n\n`;
  content += `---\n\n`;

  let fileIndex = 1;
  vol.files.forEach((relPath) => {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      const lang = getLang(relPath);
      content += `### 📄 Файл ${fileIndex} из ${vol.files.length}: \`${relPath}\`\n\n`;
      content += `\`\`\`${lang}\n${code}\n\`\`\`\n\n---\n\n`;
      fileIndex++;
    }
  });

  fs.writeFileSync(path.join(rootDir, vol.filename), content, 'utf8');
  console.log(`[OK] Generated ${vol.filename} (${vol.files.length} files, ${content.length} bytes)`);
});

console.log('All 5 volume files assembled successfully directly from disk!');
