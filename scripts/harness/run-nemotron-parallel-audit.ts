import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const AUDIT_PROMPT = `
Ты — ведущий системный архитектор платформы SMMplan (Next.js 16, React 19, Prisma, PostgreSQL).
Проведи разносторонний детальный аудит валидатора ссылок, матрицы совместимости и формы заказа.

ПРОБЛЕМА:
Пользователь вводит ссылку на Telegram-канал (например: https://t.me/durov или https://t.me/channel).
В каталоге не отображаются подходящие услуги (например «Подписчики Telegram в канал»), каталог становится пустым (0 услуг), хотя услуги есть в БД.

СУТЬ КОНФЛИКТА В КОДЕ:
1. В Prisma schema: Service.targetType имеет @default("POST"). Поэтому у всех услуг в базе targetType = "POST".
2. Анализатор ссылок (link-rules.ts) для https://t.me/channel возвращает detectedType = "channel".
3. В useOrderEngine.ts фильтр услуг написан так:
   isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))
   Поскольку s.targetType равен строке "POST", он ВСЕГДА truthy! Функция inferTargetTypeFromName НИКОГДА не вызывается.
4. В матрице link-service-compatibility.ts:
   LinkType.CHANNEL совместим ТОЛЬКО с CHANNEL, PROFILE, CHANNEL_POSTS.
   С ServiceTargetType.POST он НЕ СОВМЕСТИМ.
   В итоге ВСЕ услуги канала отсекаются!
5. В target-type-mapper.ts уже существует функция:
   export function resolveServiceTargetType(service: { name: string; targetType?: string | null }): string
   которая если targetType === 'POST', переопределяет его на inferred type из названия (CHANNEL)! Но в useOrderEngine.ts её забыли вызвать!

ЗАДАЧИ АУДИТА:
1. Подтверди математическую/логическую неизбежность бага при текущем коде.
2. Проверь сопутствующие места:
   - валидация в useOrderEngine (строки 803-806 и 884-888) — там тоже используется selectedService.targetType || inferTargetTypeFromCategory. Будет ли там ложная ошибка?
   - кэш categoryServicesCache.
   - мобильный визард useMobileWizard.
3. Дай точный пошаговый план исправления (какие файлы и строки изменить).
4. Pre-Mortem: 3 главных риска после исправления и как защититься.
`;

async function queryModel(model: string): Promise<{ model: string; content: string; ok: boolean }> {
  console.log(`[Swarm] Querying ${model}...`);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Nemotron Audit'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Ты — Senior Fullstack Architect. Дай структурированный четкий ответ на русском языке.'
          },
          { role: 'user', content: AUDIT_PROMPT }
        ],
        max_tokens: 2000,
        temperature: 0.15
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (!res.ok) {
      const err = await res.text();
      return { model, content: `HTTP ${res.status}: ${err}`, ok: false };
    }

    const json = await res.json();
    return { model, content: json.choices?.[0]?.message?.content || 'Empty', ok: true };
  } catch (err: any) {
    return { model, content: `Error: ${err.message}`, ok: false };
  }
}

async function run() {
  const models = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openrouter/free'
  ];

  console.log('🚀 Launching parallel audit with models:', models);
  const results = await Promise.all(models.map(m => queryModel(m)));

  let mdContent = `# Экспертный аудит валидатора ссылок и формы заказа: NVIDIA Nemotron & OpenRouter\n\n`;
  for (const r of results) {
    console.log(`Status for ${r.model}: ${r.ok ? 'SUCCESS' : 'FAILED'}`);
    mdContent += `## Модель: ${r.model} (${r.ok ? '✅ Успешно' : '❌ Ошибка'})\n\n${r.content}\n\n---\n\n`;
  }

  const reportPath = path.resolve(process.cwd(), 'scripts/harness/nemotron-audit-verdict.md');
  fs.writeFileSync(reportPath, mdContent, 'utf8');
  console.log(`\n🎉 Audit completed! Report saved to: ${reportPath}`);
}

run();
