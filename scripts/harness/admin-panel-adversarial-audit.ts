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
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://smmplan.pro',
            'X-Title': 'SMMplan Admin Adversarial Audit',
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
          signal: AbortSignal.timeout(20000),
        });

        if (res.ok) {
          const json = await res.json();
          const content = json.choices?.[0]?.message?.content;
          if (content && content.length > 50) return content;
        }
      } catch {
        // continue to next model
      }
    }
  }

  // Fallback to Gemini 3 Flash
  return await GeminiClient.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    temperature: 0.1,
  });
}

async function runAdminAdversarialAudit() {
  console.log('\n\x1b[1m\x1b[36m================================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m   ⚔️ ADVERSARIAL SWARM AUDIT: SMMpanel 1.0 ADMIN BUSINESS LOGIC & BUTTONS   \x1b[0m');
  console.log('\x1b[1m\x1b[36m================================================================================\x1b[0m\n');

  // Gather key admin controllers
  const adminFiles = [
    'src/actions/admin/catalog/services.ts',
    'src/actions/admin/catalog/price-drift.ts',
    'src/actions/admin/orders.ts',
    'src/actions/admin/providers.ts',
    'src/actions/admin/system-settings.ts',
    'src/actions/admin/tenants.action.ts',
    'src/actions/admin/balance-adjustments.ts',
    'src/actions/admin/staff.action.ts',
  ];

  let aggregatedCode = '';
  for (const f of adminFiles) {
    const fullPath = path.resolve(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      aggregatedCode += `\n// --- FILE: ${f} ---\n` + code.slice(0, 1500) + '\n';
    }
  }

  // ROUND 1: RED TEAM
  console.log('\x1b[1m\x1b[31m[ROUND 1/3] 🔴 Red Team Attack: Поиск логических дыр, мертвых кнопок и заглушек...\x1b[0m');
  const redSystem = `Ты — ведущий состязательный аудитор Red Team. Твоя цель — атаковать административную панель SMMpanel 1.0.
Найди 3-5 потенциальных уязвимостей в бизнес-логике:
1. Заглушки, псевдо-мутации или кнопки без реального сохранения.
2. Несогласованность данных при массовых операциях (Bulk Actions).
3. Обход прав доступа RBAC или отсутствие проверки прав на чувствительные действия.
4. Отсутствие обработки ошибок или падение UI при сбое внешнего сервиса.
Выдай структурированный список на русском языке.`;

  const redOutput = await callModelWithFallback({
    models: ['inclusionai/ling-3.0-flash-fin:free', 'google/gemini-2.0-flash-exp:free'],
    systemPrompt: redSystem,
    userPrompt: `Код основных Server Actions админ-панели:\n${aggregatedCode}`,
  });

  console.log(`\n\x1b[33m${redOutput}\x1b[0m\n`);

  // ROUND 2: BLUE TEAM
  console.log('\x1b[1m\x1b[34m[ROUND 2/3] 🔵 Blue Team Defense: Анализ валидности и проверка защитных барьеров...\x1b[0m');
  const blueSystem = `Ты — ведущий архитектор Blue Team. Проанализируй замечания Red Team.
Определи, какие замечания реальны (ACCEPTED_VALID_BUG), а какие уже защищены Zod/Prisma/RBAC guards или являются избыточными.`;

  const blueOutput = await callModelWithFallback({
    models: ['inclusionai/ling-3.0-flash-fin:free', 'google/gemini-2.0-flash-exp:free'],
    systemPrompt: blueSystem,
    userPrompt: `Замечания Red Team:\n${redOutput}\n\nКод:\n${aggregatedCode}`,
  });

  console.log(`\n\x1b[36m${blueOutput}\x1b[0m\n`);

  // ROUND 3: CTO SYNTHESIS
  console.log('\x1b[1m\x1b[32m[ROUND 3/3] 👑 CTO Arbiter: Финальный вердикт и готовность к продакшену...\x1b[0m');
  const ctoSystem = `Ты — CTO Arbiter. Вынеси финальный вердикт по качеству и надежности админ-панели SMMpanel 1.0 (Оценка 0-100, вердикт: SHIP_AS_IS или REQUIRED_FIXES, и список обязательных действий).`;

  const ctoOutput = await callModelWithFallback({
    models: ['inclusionai/ling-3.0-flash-fin:free', 'google/gemini-2.0-flash-exp:free'],
    systemPrompt: ctoSystem,
    userPrompt: `Red Team:\n${redOutput}\n\nBlue Team:\n${blueOutput}`,
  });

  console.log(`\n\x1b[32m${ctoOutput}\x1b[0m\n`);
}

runAdminAdversarialAudit().catch((e) => {
  console.error('Ошибка аудита:', e);
  process.exit(1);
});
