import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const key = process.env.OPENROUTER_API_KEY;

const prompt = `
Ты — NVIDIA Nemotron, ведущий ИИ-архитектор.
Проанализируй баг в платформе SMMplan:
Ввод https://t.me/durov -> услуг Telegram в каталоге 0 (пусто), хотя в базе есть услуги: подписчики, просмотры, бусты.

Причина:
- В Prisma: model Service { targetType String @default("POST") }. В базе у услуг targetType = "POST".
- Ссылка https://t.me/durov -> detectedType = "channel".
- В useOrderEngine.ts:
  isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))
  Поскольку s.targetType === "POST", правая часть по || никогда не выполняется.
- В link-service-compatibility.ts: channel НЕ совместим с POST. Все услуги отсекаются!
- В целевом коде target-type-mapper.ts уже написана функция resolveServiceTargetType(service), которая при targetType === 'POST' подменяет тип на результат inferTargetTypeFromName(service.name), но в useOrderEngine.ts она не импортирована и не вызвана.
- В строках 803-806 и 884-888 хука useOrderEngine.ts:
  normalizeServiceTargetType(selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name))
  тоже зашит тот же баг: selectedService.targetType === 'POST' глушит inferTargetTypeFromCategory!

Дай компактный экспертный вердикт:
1. Подтверждение логической неизбежности бага.
2. Опасность строк 803-806 и 884-888 (будет ли ложная ошибка при заказе).
3. Точные правки в useOrderEngine.ts (с кодом diff).
4. Три главных риска (Pre-Mortem) и контрмеры.
`;

async function main() {
  const t0 = Date.now();
  console.log('Querying nvidia/nemotron-3-super-120b-a12b:free...');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Nemotron Audit'
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.15
    }),
    signal: AbortSignal.timeout(60000)
  });
  const data = await res.json();
  const text = data.choices ? data.choices[0].message.content : JSON.stringify(data);
  console.log('✅ Received Nemotron verdict in ' + (Date.now() - t0) + 'ms');
  fs.writeFileSync('scripts/harness/nemotron-direct-verdict.md', text, 'utf8');
}
main().catch(console.error);
