import fs from 'fs';
import path from 'path';

interface DomainConfig {
  name: string;
  description: string;
  files: string[];
  directories: string[];
  prismaModels: string[];
}

const DOMAINS: Record<string, DomainConfig> = {
  payments: {
    name: 'Payments & Billing',
    description: 'Аудит транзакций, пополнения баланса, списаний, Ledger логов и платежных шлюзов (YooKassa, Robokassa).',
    files: [
      'src/actions/finance/settings.ts',
      'src/actions/user/top-up.action.ts',
      'src/actions/admin/finance/payments.ts',
      'src/services/financial/payment.service.ts',
      'src/services/financial/unified-payment.service.ts',
      'src/services/financial/payment-gateway.service.ts',
      'src/services/financial/wallet.service.ts',
      'src/services/financial/wallet-ops.ts',
      'src/services/financial/accounting.service.ts',
      'src/app/api/webhooks/yookassa/route.ts',
      'src/app/api/order-status/route.ts',
      'src/workers/processors/payment-sync.ts'
    ],
    directories: [],
    prismaModels: ['User', 'Payment', 'LedgerEntry', 'Invoice', 'PromoCode', 'PromoCodeUsage', 'B2bConfig']
  },
  providers: {
    name: 'Providers & Catalog Sync',
    description: 'Аудит работы с внешними SMM провайдерами, теневого буфера (Redis), синхронизации каталога услуг, маржинальности и Zombie Eraser.',
    files: [
      'src/workers/processors/sync.processor.ts',
      'src/workers/processors/catalog.processor.ts',
      'src/utils/target-type.ts'
    ],
    directories: [
      'src/services/providers',
      'src/services/analyzer'
    ],
    prismaModels: ['Provider', 'Service', 'ShadowService', 'Category', 'Network', 'UrlPattern']
  },
  orders: {
    name: 'Orders & Limits',
    description: 'Аудит создания заказов, валидации лимитов, вычисления ETA и обработки в фоновых воркерах (BullMQ).',
    files: [
      'src/actions/order/checkout.ts',
      'src/actions/order/sync-payment.ts',
      'src/workers/processors/order.processor.ts',
      'src/workers/processors/dripfeed.processor.ts',
      'src/workers/processors/refill.processor.ts'
    ],
    directories: [
      'src/services/eta',
      'src/services/dripfeed'
    ],
    prismaModels: ['User', 'Order', 'Service', 'ServiceRoute', 'Provider', 'PromoCode']
  },
  auth: {
    name: 'Auth & RBAC',
    description: 'Аудит системы аутентификации (magic links, API keys), сессий пользователей, ролей сотрудников (RBAC) и middleware защиты.',
    files: [
      'src/lib/auth.ts',
      'src/middleware.ts'
    ],
    directories: [
      'src/actions/auth'
    ],
    prismaModels: ['User', 'AuthToken', 'Session', 'StaffRole']
  },
  support: {
    name: 'Support & Bot',
    description: 'Аудит системы тикетов поддержки, интеграции с Telegram-ботом, омниканальной маршрутизации и лимитов операторов.',
    files: [
      'src/bot/index.ts'
    ],
    directories: [
      'src/actions/support',
      'src/services/support'
    ],
    prismaModels: ['User', 'Ticket', 'AuditLog', 'UserNote']
  }
};

const BLACKLIST_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  '__tests__',
  '\\.test\\.',
  '\\.spec\\.',
  '\\.env',
  '\\.pem$',
  '\\.key$',
  'package-lock\\.json'
];

function isBlacklisted(filePath: string): boolean {
  return BLACKLIST_PATTERNS.some(pattern => new RegExp(pattern).test(filePath));
}

function getFilesRecursively(dirPath: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;
  const list = fs.readdirSync(dirPath);
  for (const file of list) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      if (!isBlacklisted(filePath) && /\.(ts|tsx|js|jsx|prisma)$/.test(filePath)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function extractPrismaModels(schemaPath: string, modelNames: string[]): string {
  if (!fs.existsSync(schemaPath)) return '// Prisma schema not found';
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  let result = '';
  for (const modelName of modelNames) {
    const regex = new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\}`);
    const match = schemaContent.match(regex);
    if (match) {
      result += `model ${modelName} {${match[1]}}\n\n`;
    }
  }
  return result || '// No matching Prisma models found in schema';
}

function getAgentsRules(): string {
  if (fs.existsSync('AGENTS.md')) {
    const content = fs.readFileSync('AGENTS.md', 'utf-8');
    const match = content.match(/## Architecture Rules([\s\S]*?)(## File Structure|$)/);
    if (match) {
      return match[1].trim();
    }
    return content.slice(0, 5000) + '\n... (truncated)';
  }
  return 'No AGENTS.md rules found.';
}

interface FileContent {
  path: string;
  content: string;
}

function loadFiles(filePaths: string[]): FileContent[] {
  const loaded: FileContent[] = [];
  for (const fp of filePaths) {
    const normalized = path.normalize(fp).replace(/\\/g, '/');
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, 'utf-8');
      loaded.push({ path: normalized, content });
    }
  }
  return loaded;
}

async function main() {
  const args = process.argv.slice(2);
  let selectedDomain = '';
  let customPath = '';
  let maxSize = 50000; // Default max size in chars

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--domain' || args[i] === '-d') && args[i + 1]) {
      selectedDomain = args[i + 1];
      i++;
    } else if ((args[i] === '--path' || args[i] === '-p') && args[i + 1]) {
      customPath = args[i + 1];
      i++;
    } else if ((args[i] === '--max-size' || args[i] === '-s') && args[i + 1]) {
      maxSize = parseInt(args[i + 1], 10) || 50000;
      i++;
    }
  }

  const outDir = path.join(process.cwd(), '.planning', 'audit');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`🚀 Starting audit preparation...`);
  console.log(`⚙️ Output directory: ${outDir}`);
  console.log(`📏 Max chunk size: ${maxSize} characters`);

  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const rulesText = getAgentsRules();

  let domainsToProcess: string[] = [];
  if (selectedDomain) {
    if (selectedDomain === 'all') {
      domainsToProcess = Object.keys(DOMAINS);
    } else if (DOMAINS[selectedDomain]) {
      domainsToProcess = [selectedDomain];
    } else {
      console.error(`❌ Unknown domain: ${selectedDomain}. Available: ${Object.keys(DOMAINS).join(', ')}`);
      process.exit(1);
    }
  } else if (customPath) {
    console.log(`🔍 Processing custom path: ${customPath}`);
  } else {
    // Default to all domains if nothing is specified
    console.log(`⚠️ No domain or path specified. Processing all domains.`);
    domainsToProcess = Object.keys(DOMAINS);
  }

  if (domainsToProcess.length > 0) {
    for (const domKey of domainsToProcess) {
      const config = DOMAINS[domKey];
      console.log(`\n📦 Processing domain: ${config.name} (${domKey})...`);
      
      // Gather files
      let allFiles = [...config.files];
      for (const dir of config.directories) {
        allFiles = allFiles.concat(getFilesRecursively(path.join(process.cwd(), dir)));
      }

      // Filter and normalize
      const uniqueFiles = Array.from(new Set(allFiles)).filter(fp => !isBlacklisted(fp));
      console.log(`   Found ${uniqueFiles.length} target files to audit.`);

      const loadedFiles = loadFiles(uniqueFiles);
      const prismaText = extractPrismaModels(schemaPath, config.prismaModels);

      // Create chunks
      createAuditChunks(domKey, config.name, prismaText, rulesText, loadedFiles, maxSize, outDir);
    }
  } else if (customPath) {
    const fullCustomPath = path.resolve(process.cwd(), customPath);
    let allFiles: string[] = [];
    
    if (fs.existsSync(fullCustomPath)) {
      const stat = fs.statSync(fullCustomPath);
      if (stat.isDirectory()) {
        allFiles = getFilesRecursively(fullCustomPath);
      } else {
        if (!isBlacklisted(customPath)) {
          allFiles = [customPath];
        }
      }
    } else {
      console.error(`❌ Path not found: ${customPath}`);
      process.exit(1);
    }

    console.log(`   Found ${allFiles.length} files in custom path.`);
    const loadedFiles = loadFiles(allFiles);
    // Include full prisma models since we don't know the exact domain
    const prismaText = extractPrismaModels(schemaPath, ['User', 'Order', 'Service', 'Provider', 'Payment']);
    createAuditChunks('custom', 'Custom Path Audit', prismaText, rulesText, loadedFiles, maxSize, outDir);
  }

  console.log(`\n🎉 Audit preparation complete! All files generated in: ${outDir}`);
}

function createAuditChunks(
  domainKey: string,
  domainName: string,
  prismaText: string,
  rulesText: string,
  files: FileContent[],
  maxSize: number,
  outDir: string
) {
  let currentGroup: FileContent[] = [];
  let currentGroupSize = 0;
  const chunks: FileContent[][] = [];

  const buildFileSection = (file: FileContent) => {
    const ext = path.extname(file.path).slice(1) || 'typescript';
    return `### FILE: ${file.path}\n\`\`\`${ext}\n${file.content}\n\`\`\`\n\n`;
  };

  for (const file of files) {
    const fileStr = buildFileSection(file);
    if (currentGroupSize + fileStr.length > maxSize && currentGroup.length > 0) {
      chunks.push(currentGroup);
      currentGroup = [];
      currentGroupSize = 0;
    }
    currentGroup.push(file);
    currentGroupSize += fileStr.length;
  }
  if (currentGroup.length > 0) {
    chunks.push(currentGroup);
  }

  const totalParts = chunks.length;

  if (totalParts === 0) {
    console.log(`   ⚠️ No files to write for domain: ${domainKey}`);
    return;
  }

  const buildPromptHeader = (partIdx: number, totalPartsStr: string) => {
    return `# 📋 Чек-лист и последовательность проведения аудита для внешнего ИИ (GLM-5.2 / Claude)
# Домен: ${domainName} (Часть ${partIdx} из ${totalPartsStr})

Вы выступаете в роли ведущего эксперта по безопасности (DevSecOps) и архитектора ПО.
Вам передан исходный код веб-приложения SMM-панели (Next.js 16, React 19, Prisma, PostgreSQL).
Ваша задача — провести глубокий внешний аудит предоставленного кода.

Критерии анализа:
1. Безопасность и уязвимости (OWASP Top 10, утечки секретов, права доступа в Server Actions, защита от IDOR).
2. Логическая целостность (целостность транзакций Prisma, защита баланса пользователей, гонки данных / Race Conditions при изменении баланса).
3. Структурная архитектура (соответствие конвенциям Server Component, Next.js 16).
4. Ошибки обработки исключений (пустые блоки catch, отсутствие логирования).
5. Соблюдение правил ценообразования (маржа, маркап, расчеты в центах) и обработки линков (targetType).

---

## 🏗️ Схема базы данных (Релевантные Prisma модели):
\`\`\`prisma
${prismaText.trim()}
\`\`\`

---

## 📜 Правила и контракты проекта (AGENTS.md):
\`\`\`markdown
${rulesText.trim()}
\`\`\`

---

## 💻 Исходный код для анализа (Часть ${partIdx}):
`;
  };

  for (let i = 0; i < chunks.length; i++) {
    const partIdx = i + 1;
    const header = buildPromptHeader(partIdx, totalParts.toString());
    let body = '';
    for (const file of chunks[i]) {
      body += buildFileSection(file);
    }

    const fullContent = header + body;
    const fileName = `audit_${domainKey}_part_${partIdx}.md`;
    const destPath = path.join(outDir, fileName);
    fs.writeFileSync(destPath, fullContent, 'utf-8');
    console.log(`   ✍️ Generated: ${fileName} (${Math.round(fullContent.length / 1024)} KB)`);
  }
}

main().catch(err => {
  console.error('❌ Error executing audit preparation:', err);
  process.exit(1);
});
