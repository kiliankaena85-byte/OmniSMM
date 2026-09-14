import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const AUDIT_PROMPT = `
Ты — ведущий системный архитектор и Tech Lead платформы SMMplan (Next.js 16, React 19, Prisma, PostgreSQL).
Проведи разносторонний детальный аудит валидатора ссылок, матрицы совместимости и формы оформления заказа.

СИМПТОМ БАГА:
Пользователь вставляет ссылку на Telegram-канал (например: https://t.me/durov или https://t.me/smmplan_channel).
После ввода ссылки каталог услуг становится ПУСТЫМ (0 доступных услуг), хотя в базе данных есть услуги:
- "Подписчики в Telegram канал (быстрые)"
- "Просмотры на последние посты Telegram"
- "Буст канала Telegram"

КОНТЕКСТ КОДА:

1. Схема Prisma (prisma/schema.prisma):
model Service {
  id          String   @id @default(cuid())
  name        String
  targetType  String   @default("POST")
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
}

2. Анализ ссылки (src/services/analyzer/link-rules.ts):
{
  platform: IntelligencePlatform.TELEGRAM,
  type: 'channel',
  pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?!joinchat|\+|c\/|contact\/|share\/|setlanguage\/)([a-zA-Z0-9_]{4,32})\/?(?:\?.*)?$/i,
  suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.REACTIONS],
  context: 'channel_growth'
}

3. Матрица совместимости (src/constants/link-service-compatibility.ts):
export const COMPATIBILITY_MAP: Record<LinkType, ServiceTargetType[]> = {
  [LinkType.CHANNEL]: [
    ServiceTargetType.CHANNEL,
    ServiceTargetType.PROFILE,
    ServiceTargetType.CHANNEL_POSTS,
  ],
  [LinkType.POST]: [
    ServiceTargetType.POST_INTERACTION,
    ServiceTargetType.VIDEO_INTERACTION,
    ServiceTargetType.COMMENTS,
  ],
  ...
};

4. Фильтрация в React Hook (src/hooks/useOrderEngine.ts, строки 550-596):
// В двух местах (кэш и свежая загрузка):
let finalSvcs = sortedSvcs;
if (detectedType && isLinkFilled) {
  const compatibleSvcs = sortedSvcs.filter(s =>
    isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))
  );
  finalSvcs = compatibleSvcs;
}
setServices(finalSvcs);

5. Маппер типов (src/utils/target-type-mapper.ts):
export function inferTargetTypeFromName(serviceName: string | null | undefined): TargetTypeEnum {
  const n = (serviceName || '').toLowerCase();
  if (n.includes('подписчик') || n.includes('канал') || n.includes('буст')) return TargetTypeEnum.CHANNEL;
  return TargetTypeEnum.POST;
}

export function resolveServiceTargetType(service: { name: string; targetType?: string | null }): string {
  const inferred = inferTargetTypeFromName(service.name);
  if (
    (!service.targetType || service.targetType === 'POST' || service.targetType === 'CUSTOM') &&
    (inferred === TargetTypeEnum.CHANNEL || inferred === TargetTypeEnum.CHANNEL_POSTS || inferred === TargetTypeEnum.POLL || inferred === TargetTypeEnum.VIDEO || inferred === TargetTypeEnum.STORY || inferred === TargetTypeEnum.BOT)
  ) {
    return inferred;
  }
  return service.targetType || inferred;
}

ВОПРОСЫ АУДИТА:
1. Корневая причина (Root Cause): Разбери пошагово, почему s.targetType || inferTargetTypeFromName(s.name) отсекает 100% услуг Telegram при вводе ссылки на канал.
2. Сопутствующие скрытые дефекты:
   - Что происходит с categoryServicesCache при смене ссылки пользователем?
   - Как реагирует мобильный визард useMobileWizard (шаги 1 -> 2 -> 3)?
   - Что происходит при авто-мутации ссылки (mutateLink)?
3. Точное и безопасное исправление:
   - Как именно нужно скорректировать вызов в useOrderEngine.ts?
   - Требуется ли правка в других компонентах/хуках (PlanSlideOrderClient, FluxDashboardOrderWizard)?
4. Pre-Mortem & Impact Radius (анализ на 3 шага вперед):
   - Какие риски у исправления?
   - Как гарантировать, что услуги для постов (например «Реакции на пост») НЕ будут показаны для ссылки на канал?
`;

async function queryModel(model: string): Promise<string> {
  console.log(`[Swarm] Querying ${model}...`);
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
          content: 'Ты — ведущий системный архитектор. Дай структурированный, исчерпывающий экспертный отчет на русском языке.'
        },
        { role: 'user', content: AUDIT_PROMPT }
      ],
      temperature: 0.15
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || 'Empty response';
}

async function run() {
  const models = [
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'openrouter/free'
  ];

  const results: Record<string, string> = {};

  for (const model of models) {
    try {
      const response = await queryModel(model);
      results[model] = response;
      console.log(`✅ [Swarm] ${model} successfully delivered audit report!`);
    } catch (err: any) {
      console.warn(`⚠️ [Swarm] ${model} failed:`, err.message);
    }
  }

  const reportPath = path.resolve(process.cwd(), 'scripts/harness/nemotron-audit-verdict.md');
  let mdContent = `# Экспертный аудит валидатора ссылок и формы заказа: NVIDIA Nemotron & OpenRouter Swarm\n\n`;
  for (const [m, resp] of Object.entries(results)) {
    mdContent += `## Модель: ${m}\n\n${resp}\n\n---\n\n`;
  }

  fs.writeFileSync(reportPath, mdContent, 'utf8');
  console.log(`\n🎉 Audit completed! Report written to ${reportPath}`);
}

run();
