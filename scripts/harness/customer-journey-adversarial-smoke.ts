import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GeminiClient } from '../../src/services/ai/gemini-client';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface SwarmModelConfig {
  models: string[];
  systemPrompt: string;
  userPrompt: string;
}

async function callModelWithFallback(config: SwarmModelConfig): Promise<string> {
  const { models, systemPrompt, userPrompt } = config;

  if (OPENROUTER_API_KEY) {
    for (const model of models) {
      try {
        console.log(`  └─ 🤖 OpenRouter query to [${model}]...`);
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://smmplan.pro',
            'X-Title': 'SMMplan Customer Journey Adversarial Smoke Test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const json = await res.json();
          const content = json.choices?.[0]?.message?.content;
          if (content && content.length > 50) {
            console.log(`  ✓ Received response from [${model}] (${content.length} chars)`);
            return content;
          }
        } else {
          console.warn(`  ⚠️ Model [${model}] returned HTTP ${res.status}`);
        }
      } catch (err: unknown) {
        console.warn(`  ⚠️ Model [${model}] failed:`, (err as Error).message);
      }
    }
  }

  // Fallback to Gemini 3 Flash
  console.log(`  └─ 🤖 Fallback to Direct GeminiClient...`);
  return await GeminiClient.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    temperature: 0.1,
  });
}

async function runCustomerJourneyAdversarialSmoke() {
  console.log('\n\x1b[1m\x1b[36m================================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m   ⚔️ ADVERSARIAL SWARM SMOKE TEST: CUSTOMER USER JOURNEYS & CRO (OpenRouter)   \x1b[0m');
  console.log('\x1b[1m\x1b[36m================================================================================\x1b[0m\n');

  // Concise, high-density architectural snippet of customer journeys
  const aggregatedCode = `
// 1. CHECKOUT SCHEMA & TOCTOU GUARD (src/actions/order/checkout.ts & mass.ts)
const checkoutSchema = z.object({
  serviceId: z.string(),
  link: z.string().min(3).max(2048).refine(val => !val.includes(' ')),
  quantity: z.number().min(1),
  email: z.string().email(),
  gateway: z.enum(['yookassa', 'cryptobot', 'robokassa', 'balance']).default('yookassa'),
  idempotencyKey: z.string().min(10).max(64).optional(),
  expectedTotalRub: z.number().optional(),
});
// Price calculated strictly on server via marketingService.calculatePrice(userId, serviceId, qty, promo, { user, service })
// expectedTotalRub only validated for drift (> 1% deviation aborts to protect user). Server charge strictly equals pricing.totalCents.

// 2. PAYMENT REDIRECT WHITELIST & LOCALHOST GATING (src/utils/payment-redirect.ts)
export const PROD_ALLOWED_PAYMENT_DOMAINS = ['yookassa.ru', 'yoomoney.ru', 'crypto.bot', 't.me', 'robokassa.ru', 'robokassa.com', 'pay.cryptometria.com', 'cryptometria.com', 'smmplan.pro', 'smmflux.ru'];
export const ALLOWED_PAYMENT_DOMAINS = [...PROD_ALLOWED_PAYMENT_DOMAINS, ...(process.env.NODE_ENV === 'production' ? [] : ['localhost', '127.0.0.1'])];
export function isAllowedPaymentUrl(rawUrl, currentOrigin) {
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) return true;
  const parsed = new URL(rawUrl, currentOrigin);
  if (parsed.origin === currentOrigin) return true;
  return ALLOWED_PAYMENT_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
}

// 3. EMAIL PROMPT MODAL RFC REGEX (src/components/landing/order-engine/modals/EmailPromptModal.tsx)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
if (!trimmed || !EMAIL_REGEX.test(trimmed)) { setError('Введите корректный email (name@domain.com)'); return; }

// 4. PII MASKING ON ERROR RECOVERY (src/app/support/payment-error/page.tsx)
const maskedEmail = email ? email.replace(/^(.{1,2})(.*)(@.*)$/, (_, a, b, c) => a + '***' + c) : '';
const safeDisplayUrl = url ? (url.length > 50 ? url.slice(0, 47) + '...' : url) : '';

// 5. DRIP-FEED FLOOR INVARIANT & BANKER'S ROUNDING (ExactMath.ts)
// Math.floor(quantity / runs) >= service.minQty strictly checked. Banker's Rounding (Half-Even) with 1 kopeck floor.
`;

  // ROUND 1: RED TEAM
  console.log('\x1b[1m\x1b[31m[ROUND 1/3] 🔴 Red Team Attack: Атака на клиентскую воронку, конверсию и чекаут...\x1b[0m');
  const redSystem = `Ты — ведущий состязательный аудитор Red Team и эксперт по CRO/финтеху.
Твоя цель — найти 3-5 критических уязвимостей, UX-ловушек или точек сбоя в клиентских путях SMMplan:
1. Заказ через визард (StepWizardCheckout / useCheckoutOrchestrator): потеря данных, зависание кнопок, пропуск обязательных полей (email/link), 54-ФЗ.
2. Платёжные шлюзы и редиректы (YooKassa, YooMoney, CryptoBot, RoboKassa): отказ редиректа, блокировка белыми списками, незафиксированные суммы.
3. Drip-feed / Smart Drip: расчет минимального объема (Floor Invariant), округления (Banker's rounding).
4. Восстановление при ошибках (/support/payment-error): понятность для клиента, сохранение параметров заказа.
5. Массовый заказ (mass.ts): валидация списков ссылок, сбои при частичной невалидности.

Отвечай структурированно, указывай файлы и конкретные сценарии отказа.`;

  const redPrompt = `Проанализируй код клиентских сценариев и найди уязвимости и баги конверсии:\n\n${aggregatedCode}`;
  
  const redReport = await callModelWithFallback({
    models: [
      'minimax/minimax-m3:free',
      'poolside/laguna-s-2.1:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    ],
    systemPrompt: redSystem,
    userPrompt: redPrompt,
  });

  console.log('\n' + redReport + '\n');

  // ROUND 2: BLUE TEAM
  console.log('\x1b[1m\x1b[34m[ROUND 2/3] 🔵 Blue Team Defense: Анализ защитных барьеров и валидности замечаний...\x1b[0m');
  const blueSystem = `Ты — ведущий системный архитектор и Lead Engineer Blue Team проекта SMMplan.
Твоя цель — оценить отчет Red Team:
1. Выдели РЕАЛЬНЫЕ проблемы (ACCEPTED_VALID_BUG) и ложные срабатывания (REJECTED_FALSE_POSITIVE).
2. Обоснуй защиту кода: Zod схемы, exact-math, Banker's rounding, executePaymentRedirect, EmailPromptModal, atomic transactions.
3. Для подтвержденных багов предложи точный план фикса.`;

  const bluePrompt = `Отчет Red Team:\n${redReport}\n\nКодовая база:\n${aggregatedCode}\n\nДай аргументированный разбор каждого пункта.`;

  const blueReport = await callModelWithFallback({
    models: [
      'inclusionai/ling-3.0-flash-fin:free',
      'cohere/north-mini-code:free',
      'minimax/minimax-m3:free',
    ],
    systemPrompt: blueSystem,
    userPrompt: bluePrompt,
  });

  console.log('\n' + blueReport + '\n');

  // ROUND 3: CTO & CRO ARBITER
  console.log('\x1b[1m\x1b[32m[ROUND 3/3] 👑 CTO & CRO Arbiter: Финальный вердикт и готовность воронки к продакшену...\x1b[0m');
  const ctoSystem = `Ты — CTO и Chief Product Officer (CPO) платформы SMMplan.
На основе дебатов Red Team и Blue Team вынеси финальное решение:
1. Оценка конверсионной надежности и безопасности (0-100).
2. Статус релиза: SHIP_AS_IS или REQUIRED_FIXES.
3. Конкретные Action Items, если требуются доработки.`;

  const ctoPrompt = `Red Team:\n${redReport}\n\nBlue Team:\n${blueReport}\n\nВынеси финальный вердикт.`;

  const ctoVerdict = await callModelWithFallback({
    models: [
      'minimax/minimax-m3:free',
      'poolside/laguna-s-2.1:free',
    ],
    systemPrompt: ctoSystem,
    userPrompt: ctoPrompt,
  });

  console.log('\n' + ctoVerdict + '\n');
}

runCustomerJourneyAdversarialSmoke().catch(console.error);
