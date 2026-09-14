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
6. В строках 803-806 и 884-888 хука useOrderEngine.ts:
   normalizeServiceTargetType(selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name))
   тоже зашит тот же дефект: selectedService.targetType === 'POST' глушит inferTargetTypeFromCategory!

ЗАДАЧИ АУДИТА:
1. Подтверди логическую неизбежность бага при текущем коде.
2. Проверь сопутствующие места:
   - валидация в useOrderEngine (строки 803-806 и 884-888).
   - кэш categoryServicesCache.
   - мобильный визард useMobileWizard.
   - автоматическая мутация ссылки mutateLink (строка 815).
3. Дай точный пошаговый план исправления (какие файлы и строки изменить, приведи diff).
4. Pre-Mortem: 3 главных риска после исправления и как защититься.
`;

async function run() {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Deep Audit'
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [
        {
          role: 'system',
          content: 'Ты — Senior Staff Software Engineer и ведущий эксперт по архитектуре Next.js и React. Дай исчерпывающий технический отчет на русском языке.'
        },
        { role: 'user', content: AUDIT_PROMPT }
      ],
      max_tokens: 4000,
      temperature: 0.15
    })
  });

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || 'Empty';
  fs.writeFileSync('scripts/harness/deep-audit-verdict.md', text, 'utf8');
  console.log('Deep audit written to scripts/harness/deep-audit-verdict.md');
}

run().catch(console.error);
