import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const infraFiles = [
  'next.config.mjs',
  'package.json',
  'prisma/schema.prisma',
  'nginx/default.conf',
  'docker-compose.yml',
];

function getFileContent(relPath: string): string {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return `// FILE MISSING: ${relPath}`;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function getLang(relPath: string): string {
  if (relPath.endsWith('.mjs') || relPath.endsWith('.js')) return 'javascript';
  if (relPath.endsWith('.json')) return 'json';
  if (relPath.endsWith('.prisma')) return 'prisma';
  if (relPath.endsWith('.conf') || relPath.includes('nginx')) return 'nginx';
  if (relPath.endsWith('.yml') || relPath.endsWith('.yaml')) return 'yaml';
  return 'text';
}

const content = `# ИНФРАСТРУКТУРНЫЙ АУДИТОРСКИЙ ПАКЕТ (INFRASTRUCTURE_AUDIT_PACKAGE_2026-07-28.md)

**Дата создания:** 28 июля 2026  
**Проект:** SMMplan Lite / Multi-Tenant Infrastructure Audit  
**Содержимое:** Полные исходные файлы конфигурации Nginx, Next.js, Prisma Schema и Package.json  

---

## 1. Сводный анализ инфраструктурных аспектов

### А. Анализ безопасности Nginx и \`getClientIp\` (Замечание C-2)
В конфигурации \`nginx/default.conf\` во всех роутах (\`/api/webhooks/\`, \`/api/v2\`, \`/api/auth/\`, \`/api/support/chat/stream\`, \`/\`, \`/api/\`) явно установлены следующие директивы:
\`\`\`nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
\`\`\`
**Вывод:** Nginx принудительно перезаписывает заголовок \`X-Forwarded-For\` реальным IP-адресом сокета (\`$remote_addr\`). Подмена заголовка \`X-Forwarded-For\` извне невозможна, так как любые внешние заголовки сбрасываются Nginx перед проксированием в приложение.

---

### Б. Анализ защиты от гонок в балансе кошелька (Замечание M-1)
В \`prisma/schema.prisma\` для модели \`LedgerEntry\` установлена составная уникальная инвариантность:
\`\`\`prisma
model LedgerEntry {
  id              String   @id @default(cuid())
  userId          String
  ...
  idempotencyKey  String?
  transactionType String   @default("PAYMENT")
  ...

  @@unique([idempotencyKey, transactionType])
}
\`\`\`
**Вывод:** В базе данных PostgreSQL уже действует суровый индекс \`@@unique([idempotencyKey, transactionType])\`. Повторная попытка проведения финансовой транзакции с тем же \`idempotencyKey\` сбросится на уровне СУБД с ошибкой уникального ключа, что блокирует параллельные race-condition атаки.

---

## 2. Исходные файлы конфигурации

${infraFiles
  .map(f => {
    const code = getFileContent(f);
    const lang = getLang(f);
    return `### 📄 \`${f}\`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  })
  .join('\n')}
`;

fs.writeFileSync(path.join(rootDir, 'INFRASTRUCTURE_AUDIT_PACKAGE_2026-07-28.md'), content, 'utf8');
console.log('INFRASTRUCTURE_AUDIT_PACKAGE_2026-07-28.md generated successfully! Length: ' + content.length);
