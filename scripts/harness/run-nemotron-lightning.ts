import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const key = process.env.OPENROUTER_API_KEY;

const prompt = `
Ты — NVIDIA Nemotron 3.5 Lightning, ведущий эксперт по архитектуре веб-систем.
Проведи разносторонний аудит бага в платформе SMMplan.

ПРОБЛЕМА:
При вводе ссылки на Telegram-канал (https://t.me/durov) не отображаются услуги в каталоге (0 услуг), хотя услуги (подписчики Telegram, просмотры) в БД есть.

КОД И АРХИТЕКТУРА:
1. Prisma schema: model Service { targetType String @default("POST") }. В БД у всех услуг targetType = "POST".
2. Анализ ссылки: t.me/durov -> detectedType = "channel".
3. В useOrderEngine.ts (строки 551 и 592):
   isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))
   Поскольку s.targetType равен "POST", он ВСЕГДА truthy! inferTargetTypeFromName(s.name) НИКОГДА не выполняется.
4. В link-service-compatibility.ts:
   LinkType.CHANNEL совместим ТОЛЬКО с CHANNEL, PROFILE, CHANNEL_POSTS. С POST он НЕ совместим!
   Поэтому 100% услуг Telegram отсекаются.
5. В target-type-mapper.ts уже написана функция resolveServiceTargetType(service), которая при targetType === 'POST' переопределяет тип на inferTargetTypeFromName(service.name). Но в useOrderEngine.ts её не вызвали!
6. В строках 803-806 и 884-888:
   selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name)
   тоже selectedService.targetType ("POST") глушит inferTargetTypeFromCategory!

ВОПРОСЫ:
1. Подтверждение логической неизбежности бага.
2. Сопутствующие скрытые дефекты (строки 803-806, 884-888, categoryServicesCache, mutateLink, useMobileWizard).
3. Точный пошаговый план исправления с кодом.
4. Pre-Mortem: 3 главных риска и контрмеры.
`;

async function main() {
  console.log('Sending to nvidia/nemotron-3.5-lightning:free...');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Nemotron Audit'
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3.5-lightning:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      temperature: 0.15
    }),
    signal: AbortSignal.timeout(45000)
  });
  const data = await res.json();
  const text = data.choices ? data.choices[0].message.content : JSON.stringify(data);
  fs.writeFileSync('scripts/harness/nemotron-lightning-audit.md', text, 'utf8');
  console.log('Saved to scripts/harness/nemotron-lightning-audit.md');
}
main().catch(console.error);
