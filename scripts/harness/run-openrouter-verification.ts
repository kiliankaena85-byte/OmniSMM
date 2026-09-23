import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function runModel(model: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Swarm',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${model} HTTP ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

async function runSwarm() {
  console.log('🤖 Running OpenRouter Multi-Model Verification (MiniMax M3 / M2.7)...');

  const testPlan = `
  МАСТЕР-ПЛАН ТЕСТИРОВАНИЯ OMNISMM 1.0 (Каталог, RegEx Engine ссылок, Price Drift):
  1. ReDoS & Safe Regex Validator:
     - Проверка всех регулярных выражений на ReDoS (вложенные квантификаторы (a+)+$).
     - Изоляция сбоев regex в try/catch с fallback на встроенный LINK_RULES.
  2. Матрица распознавания 50+ ссылок (Telegram, VK, YouTube, Instagram, etc.):
     - Telegram: каналы (@durov, t.me/durov), инвайты (+Abc, joinchat), посты (t.me/durov/123), обсуждения (?comment=456).
     - VK: посты (wall-123_456, ?w=wall-123_456), клипы (clip-123_456), видео (vkvideo.ru), группы/паблики, пользователи.
     - YouTube: видео (watch?v=, youtu.be/?t=), shorts (/shorts/), live (/live/), каналы (@channel).
     - Instagram: посты (/p/), reels (/reel/), stories (/stories/), трекинг параметры (?igsh=).
  3. Price Drift Auto-Policy:
     - Маржа >= 0: заказ выполняется без задержки, цена в каталоге обновляется.
     - Отрицательная маржа: заказ отменяется (status CANCELED), 100% возврат на баланс (WalletOps.refund с уникальным idempotencyKey), цена в каталоге обновляется, в ЛК кнопка "Перезаказать по новой цене в 1 клик".
  4. Cherry-Pick Импорт:
     - Выборка из буфера Shadow Catalog в Redis, привязка providerServiceId, расчет розничной цены в копейках BigInt.
  `;

  const review = await runModel(
    'minimax/minimax-m3:free',
    'Ты — ведущий эксперт по архитектуре распределенных систем и QA-инженерии.',
    `Оцени следующий план тестирования платформы OmniSMM 1.0. Подтверди его надежность, выдели 3 ключевых преимущества и дай финальное подтверждение на старт реализации:\n\n${testPlan}`
  );

  console.log('\n================== OPENROUTER VERIFICATION REPORT ==================\n');
  console.log(review);
  console.log('\n====================================================================\n');

  fs.writeFileSync('scripts/harness/openrouter-verified-report.txt', review, 'utf8');
}

runSwarm().catch(console.error);
