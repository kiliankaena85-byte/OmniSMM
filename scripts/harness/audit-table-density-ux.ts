/**
 * Table Density Architecture & UX Dialectic Audit (OpenRouter Swarm)
 * 
 * Conducts multi-expert analysis on Option 2 (Developing full-fledged Table Density feature):
 * 1. API UX / Enterprise Design Architect (Visual hierarchy & density ergonomics)
 * 2. Frontend Systems Engineer (Tailwind 4, CSS variables & zero layout shift)
 * 3. Product & Operations Director (Admin ergonomics & per-tab utility)
 */

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('\x1b[31m❌ Ошибка: OPENROUTER_API_KEY не найден в .env!\x1b[0m');
  process.exit(1);
}

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM 1.0 UX Design Audit',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🏛️  OMNISMM 1.0 — TABLE DENSITY & UX ERGONOMICS MULTI-AI AUDIT');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  const contextData = `
Проект: OmniSMM 1.0 (Next.js 16, React 19, Tailwind CSS 4.0).
Текущая задача: Детальная проработка Варианта 2 — полноценная реализация переключателя "Компактность таблиц" (Density Toggle: Comfortable vs Compact) во всех вкладках панели администратора (/admin/orders, /admin/services, /admin/finance, /admin/clients, /admin/catalog/categories, /admin/providers).

Критические требования дизайн-системы платформы (AGENTS.md):
1. Viewport 100% Width Fit & Zero Horizontal Scroll Rule: таблица обязана на 100% умещаться по ширине в экран без горизонтальной прокрутки.
2. Семантические токены Tailwind 4: bg-primary, text-foreground, bg-card, border-border, shadow-sm.
3. Доступность WCAG 2.2 AA (читаемость текста, контраст, интерактивные элементы).

Вопрос для экспертов:
1. Как детально визуально и структурно должны отличаться "Стандартный" (Comfortable) и "Компактный" (Compact Data-Dense) режимы на каждой вкладке админки?
2. Какие параметры (Padding, высота строки в px, размер шрифта, скрытие/сворачивание второстепенных бэйджей и тултипов) должны применяться?
3. Какая архитектура реализации в Tailwind 4 и React 19 наиболее производительна (CSS variables на <html> vs React Context vs data-атрибуты)?
4. Каковы плюсы, минусы и финальные рекомендации по внедрению?
`;

  console.log('🤖 Опрос экспертов через OpenRouter AI Swarm...\n');

  // 1. Lead API UX & Design System Architect
  console.log('[1/3] 🎨 Запрос к Lead API UX / Enterprise Design Architect (meta-llama/llama-3.3-70b-instruct:free)...');
  let uxAnalysis = '';
  try {
    uxAnalysis = await callOpenRouter(
      'meta-llama/llama-3.3-70b-instruct:free',
      'Ты — Главный UX-архитектор API enterprise-систем (Stripe, Linear, Datadog). Твоя задача — составить детальную спецификацию визуальных различий между Comfortable и Compact режимами для всех таблиц.',
      contextData
    );
  } catch (e: any) {
    uxAnalysis = `[Fallback Direct Analysis]: ` + e.message;
  }

  // 2. Principal Frontend Systems Engineer
  console.log('[2/3] ⚡ Запрос к Principal Frontend Systems Engineer (qwen/qwen-2.5-coder-32b-instruct:free)...');
  let techAnalysis = '';
  try {
    techAnalysis = await callOpenRouter(
      'qwen/qwen-2.5-coder-32b-instruct:free',
      'Ты — Principal Frontend Engineer (React 19, Tailwind CSS 4, CSS Architecture). Твоя задача — предложить самую быструю, zero-layout-shift архитектуру переключения плотности без лишних ререндеров.',
      contextData + '\n\nПредложи чистую CSS/DOM архитектуру для Tailwind 4.'
    );
  } catch (e: any) {
    techAnalysis = `[Fallback Direct Analysis]: ` + e.message;
  }

  // 3. Head of Product & Operations
  console.log('[3/3] 📊 Запрос к Head of Product & SMM Operations (deepseek/deepseek-r1:free)...');
  let productAnalysis = '';
  try {
    productAnalysis = await callOpenRouter(
      'deepseek/deepseek-r1:free',
      'Ты — Директор по продукту и операционной эффективности SMM-платформ. Проанализируй реальные сценарии операторов и оцени целесообразность Варианта 2.',
      contextData
    );
  } catch (e: any) {
    productAnalysis = `[Fallback Direct Analysis]: ` + e.message;
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('📄 РЕЗУЛЬТАТЫ ЭКСПЕРТНОГО АУДИТА');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  console.log('### 1. Спецификация UX-дизайна (Comfortable vs Compact):\n');
  console.log(uxAnalysis);
  console.log('\n──────────────────────────────────────────────────────────────────────\n');

  console.log('### 2. Техническая архитектура (Tailwind 4 & React 19):\n');
  console.log(techAnalysis);
  console.log('\n──────────────────────────────────────────────────────────────────────\n');

  console.log('### 3. Продуктовая оценка и операционный сценарий:\n');
  console.log(productAnalysis);
}

main().catch(err => {
  console.error('❌ Ошибка выполнения аудита:', err);
  process.exit(1);
});
