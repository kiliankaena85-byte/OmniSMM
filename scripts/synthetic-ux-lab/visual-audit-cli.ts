import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = process.env.AUDIT_OUTPUT_DIR || path.join(process.cwd(), 'visual_audit_assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const reportPath = path.join(outDir, 'visual-audit-report.md');
const reportJsonPath = path.join(outDir, 'visual-audit-report.json');

interface ScreenResult {
  name: string;
  score: number;
  wcagCompliant: boolean;
  issues: string[];
  recommendations: string[];
}

interface AuditResponse {
  overallScore: number;
  screens: ScreenResult[];
  markdownReport: string;
}

async function runScreenshots() {
  console.log('\x1b[36m[1/4] Шаг 1: Запуск Playwright для генерации актуальных скриншотов...\x1b[0m');
  try {
    const captureScript = path.join(__dirname, 'capture-all-pages.ts');
    console.log(`Запуск: npx tsx "${captureScript}"`);
    execSync(`npx tsx "${captureScript}"`, { 
      stdio: 'inherit',
      env: { ...process.env, AUDIT_OUTPUT_DIR: outDir }
    });
    console.log('\x1b[32m✓ Скриншоты успешно сгенерированы!\x1b[0m\n');
  } catch (error) {
    console.error('\x1b[31m❌ Ошибка при генерации скриншотов Playwright:\x1b[0m', error);
    throw error;
  }
}

function fileToBase64(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

async function analyzeWithGemini(apiKey: string): Promise<AuditResponse> {
  console.log('\x1b[36m[2/4] Шаг 2: Подготовка скриншотов и отправка в Gemini API...\x1b[0m');
  
  const screens = [
    { name: 'new-order', desktop: 'new-order_desktop.png', mobile: 'new-order_mobile.png' },
    { name: 'add-funds', desktop: 'add-funds_desktop.png', mobile: 'add-funds_mobile.png' },
    { name: 'tickets', desktop: 'tickets_desktop.png', mobile: 'tickets_mobile.png' }
  ];

  const parts: any[] = [
    {
      text: `Вы — междисциплинарный Круглый Стол (Focus Group 3.0) из 6 ИИ-экспертов по UX/UI дизайну, доступности (WCAG 2.2) и премиальной эстетике:
1. **Марк (DEV-QA) — Devil's Advocate**: проверяет edge-cases, валидацию, "дуракоустойчивость" (foolproof), защиту от повторных списаний.
2. **София (DSN) — UX Inspector**: проверяет WCAG контрастность, Touch Targets (размер области клика не менее 44x44px), отступы.
3. **Дмитрий (USER-PRO) — Арбитражник**: проверяет скорость интерфейса, удобство копипаста ссылок, очистку в 1 клик, плотность данных.
4. **Мария (USER-NEW) — Блогер**: проверяет понятность текстов, отсутствие технического сленга, подсказки.
5. **Алексей (PROD) — Product Manager**: оценивает воронку оплаты, доведение до конверсии, минимизацию брошенных форм.
6. **Артем (DEV-CSS) — Junior Frontend**: проверяет адаптивность, премиальность темной темы Slate (без Halation Effect и чистого черного/белого).

Вам предоставлены актуальные Retina-скриншоты личного кабинета Smmplan (как десктопная, так и мобильная версии) для страниц:
- Создание заказа (/dashboard/new-order)
- Пополнение баланса (/dashboard/add-funds)
- Центр поддержки (/dashboard/tickets)

Изучите изображения и проведите глубокий, профессиональный и честный аудит.
Оцените интерфейс по 10-балльной шкале на соответствие манифестам:
- **gsd-dark-mode-manifest.md** ( Slate-цвета #020617, #0f172a, #1e293b, плавные hover-эффекты, отсутствие вибрации цветов и Halation).
- **gsd-premium-audit** (высококачественная типографика, отсутствие 1px линий между строками таблиц, контрастные кнопки, скругления 20px).

Верните результаты в строгом формате JSON в соответствии с responseSchema.`
    }
  ];

  for (const screen of screens) {
    const desktopPath = path.join(outDir, screen.desktop);
    const mobilePath = path.join(outDir, screen.mobile);

    if (!fs.existsSync(desktopPath) || !fs.existsSync(mobilePath)) {
      throw new Error(`Скриншоты для страницы ${screen.name} не найдены по путям:\n- ${desktopPath}\n- ${mobilePath}`);
    }

    console.log(`Загрузка скриншотов для страницы: ${screen.name}...`);
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: fileToBase64(desktopPath)
      }
    });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: fileToBase64(mobilePath)
      }
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          overallScore: { type: 'NUMBER' },
          screens: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                score: { type: 'NUMBER' },
                wcagCompliant: { type: 'BOOLEAN' },
                issues: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                },
                recommendations: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                }
              },
              required: ['name', 'score', 'wcagCompliant', 'issues', 'recommendations']
            }
          },
          markdownReport: { type: 'STRING' }
        },
        required: ['overallScore', 'screens', 'markdownReport']
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API вернул статус ${response.status}: ${errText}`);
  }

  const result: any = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('Gemini API вернул пустой ответ или некорректную структуру');
  }

  return JSON.parse(textContent) as AuditResponse;
}

function renderConsoleReport(data: AuditResponse) {
  console.log('\n\x1b[32m✔ Аудит успешно завершен!\x1b[0m');
  console.log('\x1b[36m==================================================\x1b[0m');
  console.log(`\x1b[1m\x1b[35mОБЩАЯ ОЦЕНКА UX/UI: ${data.overallScore}/10\x1b[0m`);
  console.log('\x1b[36m==================================================\x1b[0m\n');

  for (const screen of data.screens) {
    const scoreColor = screen.score >= 8 ? '\x1b[32m' : screen.score >= 6 ? '\x1b[33m' : '\x1b[31m';
    const wcagStatus = screen.wcagCompliant ? '\x1b[32m🟢 Compliant\x1b[0m' : '\x1b[31m🔴 Violating\x1b[0m';
    
    console.log(`\x1b[1mСтраница: /dashboard/${screen.name}\x1b[0m`);
    console.log(`- Оценка: ${scoreColor}${screen.score}/10\x1b[0m`);
    console.log(`- Доступность WCAG: ${wcagStatus}`);
    
    if (screen.issues.length > 0) {
      console.log(`- Проблемы (${screen.issues.length}):`);
      screen.issues.forEach(issue => console.log(`  • \x1b[31m${issue}\x1b[0m`));
    } else {
      console.log('  • \x1b[32mПроблем не обнаружено!\x1b[0m');
    }

    if (screen.recommendations.length > 0) {
      console.log(`- Рекомендации:`);
      screen.recommendations.forEach(rec => console.log(`  • \x1b[36m${rec}\x1b[0m`));
    }
    console.log('\x1b[90m--------------------------------------------------\x1b[0m\n');
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('\x1b[31m❌ Ошибка: В окружении не найден GEMINI_API_KEY. Убедитесь, что запускаете скрипт через npx dotenv!\x1b[0m');
    process.exit(1);
  }

  await runScreenshots();
  const auditData = await analyzeWithGemini(apiKey);

  // Сохраняем отчеты в файлы
  fs.writeFileSync(reportPath, auditData.markdownReport, 'utf8');
  fs.writeFileSync(reportJsonPath, JSON.stringify(auditData, null, 2), 'utf8');
  console.log(`\x1b[32m✓ Markdown отчет сохранен в: ${reportPath}\x1b[0m`);
  console.log(`\x1b[32m✓ JSON отчет сохранен в: ${reportJsonPath}\x1b[0m`);

  renderConsoleReport(auditData);

  // Проверяем UX Gate: если оценка ниже 7.0 или есть нарушения WCAG, падаем с ошибкой 1
  let failed = false;
  for (const screen of auditData.screens) {
    if (screen.score < 7.0) {
      console.error(`\x1b[31m❌ UX Gate FAILED: Страница /dashboard/${screen.name} имеет оценку ${screen.score}/10 (требуется >= 7.0)\x1b[0m`);
      failed = true;
    }
    if (!screen.wcagCompliant) {
      console.error(`\x1b[31m❌ UX Gate FAILED: Страница /dashboard/${screen.name} нарушает стандарты доступности WCAG!\x1b[0m`);
      failed = true;
    }
  }

  if (failed) {
    console.error('\n\x1b[31m❌ UX Quality Gate не пройден! Пожалуйста, исправьте указанные проблемы перед коммитом.\x1b[0m');
    process.exit(1);
  } else {
    console.log('\n\x1b[32m🟢 UX Quality Gate PASSED! Визуал соответствует стандартам Smmplan Premium.\x1b[0m');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\x1b[31m❌ Критическая ошибка выполнения аудита:\x1b[0m', err);
  process.exit(1);
});
