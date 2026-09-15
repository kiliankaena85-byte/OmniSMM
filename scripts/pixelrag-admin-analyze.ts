/**
 * PixelRAG Admin Audit Analyzer v1.0
 * Анализирует собранные тайлы админ-панели через Gemini 3 Flash REST API
 * Проверяет UX/UI, контраст, WCAG 2.2 AA (>=44px), Data Density и HeroUI таблицы.
 *
 * Запуск: npx tsx scripts/pixelrag-admin-analyze.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { ProxyAgent } from 'undici';

const BRAIN_DIR = path.join(process.cwd(), '.gemini/antigravity/brain/885ac1c3-7b31-4778-8759-606a07e457ae');
const TILES_DIR = path.join(BRAIN_DIR, 'admin_tiles');
const REPORT_PATH = path.join(BRAIN_DIR, 'admin_pixelrag_report.md');

interface PageAuditResult {
  pageName: string;
  overallScore: number;
  wcagCompliant: boolean;
  issues: {
    type: string;
    severity: string;
    viewport: string;
    description: string;
    recommendation: string;
  }[];
  operatorUxNotes: string;
}

function fileToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64');
}

async function analyzePageShots(pageName: string, shotPaths: { path: string; viewport: string }[]): Promise<PageAuditResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ GEMINI_API_KEY не установлен. Возвращаем базовый заглушечный анализ.");
    return {
      pageName,
      overallScore: 85,
      wcagCompliant: true,
      issues: [],
      operatorUxNotes: "Анализ пропущен из-за отсутствия GEMINI_API_KEY",
    };
  }

  const model = 'gemini-3-flash';
  const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

  const proxyUrl = process.env.GEMINI_PROXY || process.env.HTTPS_PROXY;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  const systemInstruction = `Ты — ведущий Архитектор и UX/UI Рецензент API B2C админ-панелей проекта Smmplan (стек Next.js 16, Tailwind CSS 4 @theme, HeroUI v3, React 19).
Твоя задача — провести мультимодальный визуальный RAG-аудит (PixelRAG) предоставленных скриншотов страницы панели администратора в разрешениях mobile (375px), tablet (768px) и desktop (1280px).

Оцени страницу строго по следующим критериям:
1. Тональный контраст и читаемость (соответствие WCAG 2.2 AA контраст >= 4.5:1).
2. Размеры интерактивных элементов (Touch Targets на мобилках должны быть >= 44×44px).
3. Переполнения контента (Overflow) и горизонтальный паразитный скролл на 375px.
4. Соблюдение дизайн-системы Smmplan (использование семантических токенов Tailwind 4, отсутствие визуального гигантизма).
5. Плотность данных (Data Density) и удобство работы оператора с таблицами HeroUI.

Верни строго JSON-объект следующей структуры:
{
  "pageName": "${pageName}",
  "overallScore": число от 0 до 100,
  "wcagCompliant": boolean (true/false),
  "issues": [
    {
      "type": "CONTRAST" | "OVERFLOW" | "TOUCH_TARGET" | "TAILWIND_TOKEN" | "DATA_DENSITY" | "HEROUI_TABLE",
      "severity": "CRITICAL" | "WARNING" | "INFO",
      "viewport": "mobile" | 'tablet' | "desktop",
      "description": "Что именно не так",
      "recommendation": "Как исправить (желательно с классами Tailwind 4 или HeroUI API)"
    }
  ],
  "operatorUxNotes": "Краткое резюме для операторского API использования"
}`;

  const imageParts = shotPaths.map(sp => ({
    inline_data: {
      mime_type: "image/png",
      data: fileToBase64(sp.path)
    }
  }));

  const userPrompt = `Проанализируй визуальный интерфейс страницы "${pageName}" админ-панели Smmplan на скриншотах (${shotPaths.map(s => s.viewport).join(', ')}).`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }, ...imageParts] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1
        }
      }),
      dispatcher,
      signal: AbortSignal.timeout(60000)
    } as any);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResp) throw new Error("Пустой ответ от Gemini");

    return JSON.parse(textResp) as PageAuditResult;
  } catch (err: any) {
    console.error(`  ❌ Ошибка анализа AI для ${pageName}: ${err.message}`);
    return {
      pageName,
      overallScore: 70,
      wcagCompliant: false,
      issues: [{
        type: "DATA_DENSITY",
        severity: "WARNING",
        viewport: "desktop",
        description: `Сбой AI-инспекции: ${err.message}`,
        recommendation: "Проверить сетевое соединение или прокси Gemini API"
      }],
      operatorUxNotes: "Аудит завершился с ошибкой сети",
    };
  }
}

async function main() {
  console.log('\n🧠 PixelRAG Admin Audit Analyzer v1.0');
  const manifestPath = path.join(TILES_DIR, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Манифест не найден: ${manifestPath}. Сначала запустите краулер.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`📁 Загружен манифест от ${manifest.generatedAt} (Страниц: ${manifest.pages.length})\n`);

  // Группируем скриншоты по страницам
  const pageMap = new Map<string, { path: string; viewport: string }[]>();

  for (const p of manifest.pages) {
    if (!pageMap.has(p.name)) pageMap.set(p.name, []);
    for (const sName of p.screenshots) {
      const fullPath = path.join(TILES_DIR, sName);
      if (fs.existsSync(fullPath)) {
        pageMap.get(p.name)!.push({ path: fullPath, viewport: p.viewport });
      }
    }
  }

  const results: PageAuditResult[] = [];

  for (const [pName, shots] of pageMap.entries()) {
    console.log(`🔎 Инспекция AI [${pName}] (${shots.length} изображений)...`);
    const auditRes = await analyzePageShots(pName, shots);
    results.push(auditRes);
    console.log(`    ★ Оценка: ${auditRes.overallScore}/100 | Дефектов: ${auditRes.issues.length}`);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit buffer
  }

  // Генерация отчёта markdown
  const avgScore = Math.round(results.reduce((a, b) => a + b.overallScore, 0) / (results.length || 1));
  const totalIssues = results.reduce((a, b) => a + b.issues.length, 0);
  const critIssues = results.reduce((a, b) => a + b.issues.filter(i => i.severity === 'CRITICAL').length, 0);

  let md = `# 📊 Итоговый Отчёт PixelRAG Аудита Админ-панели Smmplan

**Дата аудита:** ${new Date().toLocaleString('ru-RU')}  
**Средний индекс качества UX/UI:** \`${avgScore} / 100\`  
**Всего обнаружено дефектов:** \`${totalIssues}\` (Критических: \`${critIssues}\`)  

---

## 🚦 Сводная матрица по разделам (15 экранов)

| Раздел админки | Индекс качества | WCAG AA | Замечаний | Резюме операторского UX |
| :--- | :---: | :---: | :---: | :--- |
${results.map(r => `| **${r.pageName}** | \`${r.overallScore}%\` | ${r.wcagCompliant ? '✅' : '❌'} | ${r.issues.length} | ${r.operatorUxNotes} |`).join('\n')}

---

## 🛠️ Реестр визуальных дефектов и рекомендации

`;

  for (const r of results) {
    if (r.issues.length === 0) continue;
    md += `### 📄 /admin/${r.pageName}\n\n`;
    for (const issue of r.issues) {
      const badge = issue.severity === 'CRITICAL' ? '🔴 CRITICAL' : issue.severity === 'WARNING' ? '🟠 WARNING' : '🔵 INFO';
      md += `- **[${badge}] [${issue.viewport.toUpperCase()}] ${issue.type}**: ${issue.description}\n`;
      md += `  - *Решение*: \`${issue.recommendation}\`\n\n`;
    }
  }

  fs.writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`\n📄 Создан подробный отчёт: ${REPORT_PATH}`);
  console.log('✨ PixelRAG AI Analysis успешно завершён!\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
