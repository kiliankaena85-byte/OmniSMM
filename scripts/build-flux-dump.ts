import fs from 'fs';
import path from 'path';

const filesToInclude = [
  'src/tenants/registry.ts',
  'src/tenants/flux/strategy.ts',
  'src/lib/tenant-resolver.ts',
  'src/lib/navigation.ts',
  'src/lib/money.ts',
  'src/types/flux.ts',
  'src/utils/status-helpers.ts',
  'src/hooks/useOrderWizard.ts',
  'src/app/globals.css',
  'src/app/ab-lovable/page.tsx',
  'src/components/ab-test/LovableOrderClient.tsx',
  'src/components/ab-test/LovableTrustBar.tsx',
  'src/components/ab-test/LovableWhyUs.tsx',
  'src/components/ab-test/LovableReviews.tsx',
  'src/components/ab-test/LovableFAQ.tsx',
  'src/components/landing/Header.tsx',
  'src/components/landing/MegaFooter.tsx',
  'src/components/dashboard/lovable/LovableDashboardShell.tsx',
  'src/components/dashboard/lovable/LovableDashboardHome.tsx',
  'src/components/dashboard/lovable/LovableOrdersView.tsx',
  'src/components/dashboard/LovableNewOrderWorkspace.tsx',
  'src/components/dashboard/LovableDock.tsx',
  'src/components/dashboard/LovableOrdersKanban.tsx',
  'src/components/dashboard/LovableOrdersList.tsx',
];

const rootDir = process.cwd();
const outputFile = path.join(rootDir, 'FLUX_FULL_FRONTEND_PACKAGE.md');

let output = `# 📦 FULL Flux Frontend Source Code Handoff Package

Этот документ содержит **ПОЛНЫЙ ИСХОДНЫЙ КОД ФРОНТЕНДА FLUX (без сокращений)** для Next.js 16 / React 19 / Tailwind CSS 4.
Скопируйте данный файл целиком и передайте другому AI-агенту (Cursor, Claude Code, Gemini, Copilot).

---

## 📑 Оглавление файлов в пакете:\n`;

filesToInclude.forEach((relPath, index) => {
  output += `${index + 1}. \`${relPath}\`\n`;
});

output += `\n---\n\n`;

filesToInclude.forEach((relPath, index) => {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found: ${relPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const ext = path.extname(relPath).replace('.', '');
  const lang = ext === 'css' ? 'css' : 'typescript';

  output += `### ${index + 1}. \`${relPath}\`\n\n\`\`\`${lang}\n${content}\n\`\`\`\n\n---\n\n`;
});

fs.writeFileSync(outputFile, output, 'utf8');
const stats = fs.statSync(outputFile);
console.log(`Successfully generated ${outputFile} (${stats.size} bytes, ${filesToInclude.length} files)`);
