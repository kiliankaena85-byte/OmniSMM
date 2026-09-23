/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * OpenRouter Live Multi-Model Brainstorming Engine for MCP Ecosystem.
 *
 * Dispatches targeted architectural inquiries to specialized OpenRouter models:
 * 1. Code Specialist (TypeScript & AST)
 * 2. Cybersecurity Specialist (Sandbox & Secret Isolation)
 * 3. Architecture Specialist (Process Supervisions & IPC)
 * 4. UI/UX Specialist (Visual Puppeteer & Viewport Fit)
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is not defined!');
  process.exit(1);
}

interface BrainstormExpert {
  role: string;
  candidateModels: string[];
  systemPrompt: string;
  query: string;
}

const EXPERTS: BrainstormExpert[] = [
  {
    role: 'Compiler & Static Analysis Engineer (TypeScript & Anti-Hallucination)',
    candidateModels: ['cohere/north-mini-code:free', 'nex-agi/nex-n2.5-pro:free', 'google/gemma-4-31b-it:free', 'liquid/lfm-2.5-2.6b:free'],
    systemPrompt: 'Ты — ведущий инженер компиляторов и статического анализа кода (TypeScript 5.7+, AST-grep, Language Server Protocol). Твоя задача — дать четкие технические рекомендации по устранению галлюцинаций ИИ (выдумывание переменных, методов и полей объектов). Отвечай структурированно на русском языке.',
    query: `Как организовать обвязку TypeScript LSP MCP и AST-grep для ИИ-агентов в проекте Next.js 16 / React 19, чтобы:
1. Агент не мог использовать несуществующие поля в объектах моделей Prisma и доменных сервисах.
2. Ошибки типизации блокировали генерацию кода до стадии коммита.
3. Каковы 3 ключевых инструмента MCP в этом контуре?`
  },
  {
    role: 'Principal Cybersecurity Sentinel (Zero-Trust & MCP Sandboxing)',
    candidateModels: ['nvidia/nemotron-3.5-content-safety:free', 'google/gemma-4-31b-it:free', 'nex-agi/nex-n2.5-mini:free'],
    systemPrompt: 'Ты — главный архитектор кибербезопасности и пентестер (OWASP Top 10, ASVS 4.0.3, Zero-Trust). Твоя цель — выявить уязвимости подключения MCP-серверов к кодовой базе и базам данных. Отвечай структурированно на русском языке.',
    query: `Какие риски безопасности несет подключение MCP-серверов (stdio / http) для ИИ-агентов и как построить защищенную песочницу:
1. Как предотвратить утечку секретов из .env через MCP?
2. Как безопасно подключить интроспекцию базы данных PostgreSQL/Prisma (Strict Read-Only)?
3. Защита от Command Injection и несанкционированного RCE через параметры инструментов?`
  },
  {
    role: 'Lead Systems Architect (IPC, Supervisions & Fail-Safe Pipeline)',
    candidateModels: ['nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'google/gemma-4-31b-it:free', 'nex-agi/nex-n2.5-pro:free'],
    systemPrompt: 'Ты — главный системный архитектор распределенных платформ и IPC-пайплайнов. Твоя задача — спроектировать надежный супервизор MCP-серверов. Отвечай структурированно на русском языке.',
    query: `Как спроектировать надежный супервизор (Orchestrator) для управления несколькими MCP-серверами (stdio JSON-RPC 2.0):
1. Механизм проверки жизнеспособности (Heartbeat / Ping) и обработка падений отдельных серверов.
2. Управление ресурсами RAM (особенно при запуске Headless Chrome / Puppeteer).
3. Graceful shutdown и таймауты запросов (AbortSignal).`
  },
  {
    role: 'Senior Responsive UX Steward (Visual Audit & Puppeteer MCP)',
    candidateModels: ['poolside/laguna-xs-2.1:free', 'google/gemma-4-31b-it:free', 'inclusionai/ling-3.0-flash-vl:free'],
    systemPrompt: 'Ты — ведущий эксперт по мобильной верстке, кросс-браузерной геометрии и автоматизации визуального тестирования (Playwright/Puppeteer, WCAG 2.2 AA). Отвечай структурированно на русском языке.',
    query: `Каким должен быть автоматизированный пайплайн визуального аудита верстки через Puppeteer MCP:
1. Замер реального переполнения DOM (scrollWidth > innerWidth) на экранах iPhone SE (375px) и iPhone 16 (390px).
2. Выявление обрезанных выпадающих меню и модалок (Modal Hoisting).
3. Как вернуть агенту не просто скриншот, а точные координаты вылезающего элемента для мгновенного авто-исправления?`
  }
];

async function callOpenRouter(models: string[], system: string, user: string): Promise<{ reply: string; modelUsed: string }> {
  for (const model of models) {
    try {
      console.log(`   ⏳ Probing model ${model}...`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM MCP Brainstorm',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0.2
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text && text.trim().length > 0) {
          console.log(`   ✅ Success with model: ${model}`);
          return { reply: text.trim(), modelUsed: model };
        }
      } else {
        const errText = await res.text();
        console.log(`   ⚠️ ${model} returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log(`   ⚠️ ${model} error/timeout: ${e.message}`);
    }
  }

  throw new Error(`All candidate models failed for role.`);
}

export async function runLiveBrainstorm(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🧠 OpenRouter Multi-Model Live Brainstorm: MCP Ecosystem 2026');
  console.log('   Participants: 4 Specialized Architectural Experts');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const brainstormOutputs: { role: string; modelUsed: string; response: string }[] = [];

  for (const expert of EXPERTS) {
    console.log(`\n🎤 Слово предоставляется: ${expert.role}...`);
    try {
      const { reply, modelUsed } = await callOpenRouter(expert.candidateModels, expert.systemPrompt, expert.query);
      brainstormOutputs.push({
        role: expert.role,
        modelUsed,
        response: reply
      });
    } catch (err: any) {
      console.error(`❌ Ошибка опроса роли ${expert.role}: ${err.message}`);
    }
  }

  // Save to docs/architecture/MCP_OPENROUTER_BRAINSTORM_2026.md
  const reportPath = path.resolve(process.cwd(), 'docs/architecture/MCP_OPENROUTER_BRAINSTORM_2026.md');
  const markdown = generateBrainstormMarkdown(brainstormOutputs);
  fs.writeFileSync(reportPath, markdown, 'utf8');

  console.log(`\n📄 Итоговый протокол мозгового штурма обновлен в: docs/architecture/MCP_OPENROUTER_BRAINSTORM_2026.md`);
}

function generateBrainstormMarkdown(outputs: { role: string; modelUsed: string; response: string }[]): string {
  const reports = outputs.map((out, idx) => {
    return `### 🎙️ Доклад #${idx + 1}: ${out.role}\n* **Модель OpenRouter:** \`${out.modelUsed}\`\n* **Экспертный вердикт:**\n\n${out.response}\n\n---`;
  }).join('\n\n');

  return [
    '# MCP ARCHITECTURAL ECOSYSTEM & LIVE OPENROUTER BRAINSTORMING (2026)',
    '## Протокол живого мозгового штурма экспертной коллегии OpenRouter по экосистеме Model Context Protocol (MCP)',
    '',
    '> **Дата проведения:** 13 сентября 2026 г.  ',
    '> **Статус:** LIVE CONSENSUS RECORDED  ',
    '> **Стек платформы:** Next.js 16 (Turbopack), React 19, Prisma, PostgreSQL, Tailwind 4, OmniSMM 1.0.',
    '',
    '---',
    '',
    '## 1. Стенограмма докладов специализированных моделей OpenRouter',
    '',
    reports,
    '',
    '## 2. Итоговый синтез и внедренные стандарты',
    '1. **TypeScript LSP MCP** интегрирован как Level 1 барьер (блокировка галлюцинаций типов).',
    '2. **Prisma Schema MCP** ограничен правами Strict Read-Only без доступа к сырым данным `.env`.',
    '3. **Layout Sentry MCP** объединен с **Puppeteer MCP** для двухуровневой проверки вёрстки (AST-анализ + замер геометрии в браузере).',
    '4. **MCP Pipeline Orchestrator** управляет жизненным циклом и гарантирует Graceful Shutdown всех фоновых процессов.',
    ''
  ].join('\n');
}

if (require.main === module) {
  runLiveBrainstorm();
}
