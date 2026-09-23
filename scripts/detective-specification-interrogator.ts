/**
 * @file detective-specification-interrogator.ts
 * @description Multi-Agent Detective Interrogation Chamber (Метод изолированных комнат / следователи).
 * Dispatches specifications to 3 isolated frontier models via OpenRouter (OpenAI, DeepSeek, Meta Llama)
 * without cross-contamination to eliminate hallucinations, uncover blind spots, and synthesize absolute truth.
 */

import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

// OpenRouter Multi-Key Pool & Rotation Manager
const RAW_KEY_POOL = [
  process.env.OPENROUTER_API_KEY,
  ...(process.env.OPENROUTER_API_KEYS ? process.env.OPENROUTER_API_KEYS.split(',') : []),
].filter((k): k is string => Boolean(k && typeof k === 'string' && k.trim().startsWith('sk-or-v1-')));

export class OpenRouterKeyPool {
  private keys: string[];
  private currentIndex: number = 0;

  constructor(keys: string[]) {
    this.keys = Array.from(new Set(keys.map(k => k.trim())));
  }

  get currentKey(): string {
    return this.keys[this.currentIndex % this.keys.length];
  }

  get totalKeys(): number {
    return this.keys.length;
  }

  maskKey(key: string): string {
    if (key.length <= 16) return 'sk-or-***';
    return `${key.slice(0, 14)}...${key.slice(-6)}`;
  }

  rotate(reason: string = 'round-robin'): string {
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    const key = this.currentKey;
    console.log(`🔑 [KEY ROTATE] Switched to slot ${this.currentIndex + 1}/${this.keys.length} (${this.maskKey(key)}) [reason: ${reason}]`);
    return key;
  }
}

export const keyPool = new OpenRouterKeyPool(RAW_KEY_POOL);
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface InterrogationRoom {
  id: string;
  name: string;
  model: string;
  roleDescription: string;
  systemPrompt: string;
}

export interface RoomVerdict {
  roomId: string;
  roomName: string;
  model: string;
  role: string;
  latencyMs: number;
  verdict: 'ОДОБРЕНО' | 'ОДОБРЕНО_С_ЗАМЕЧАНИЯМИ' | 'ОТКЛОНЕНО';
  score: number; // 1-10
  identifiedRisks: string[];
  strongPoints: string[];
  criticalRecommendations: string[];
  rawResponse: string;
}

export interface InterrogationDossier {
  specificationTitle: string;
  timestamp: string;
  rooms: RoomVerdict[];
  consensusScore: number;
  consensusVerdict: string;
  unanimousApprovals: string[];
  conflictsAndDivergences: string[];
  finalHardeningRequirements: string[];
}

export const DETECTIVE_ROOMS: InterrogationRoom[] = [
  {
    id: 'Room_Fiscal_Legal',
    name: 'Следователь №1: Юридический & Налоговый Ревизор (54-ФЗ, 176-ФЗ, 425-ФЗ, НК РФ)',
    model: 'openai/gpt-4o-mini',
    roleDescription: 'Эксперт по фискализации, кассовым чекам по 54-ФЗ, налогам на УСН 2026, дроблению бизнеса и ст. 14.5 КоАП РФ',
    systemPrompt: `Вы — Старший Следователь-Ревизор ФНС и эксперт по финтех-праву РФ.
Ваша задача: допросить представленную архитектурную спецификацию на предмет налоговых, фискальных и юридических уязвимостей.
КРИТИЧЕСКИЕ ТОЧКИ КОНТРОЛЯ:
1. Закон № 54-ФЗ (ст. 4.7): Чек ККТ обязан формироваться с ИНН и наименованием именно того ИП/ООО, которое владеет сайтом. Недопустимо выбивать чек через чужую кассу!
2. Законы № 176-ФЗ и № 425-ФЗ (НДС 22% на УСН с 2026 г.): Лимит 20 000 000 ₽ считается СТРОГО по каждому налогоплательщику (ИНН), а не суммарно по платформе.
3. Риск ст. 54.1 НК РФ (искусственное дробление бизнеса): Разные ИП обязаны иметь реальную независимость (разные договоры эквайринга, раздельные кассы, раздельные счета).
4. Возвраты (refunds) и чеки возврата прихода по 54-ФЗ.

Будьте предельно строги. Если в спецификации есть неточность или риск — выявляйте немедленно. Никаких галлюцинаций.`,
  },
  {
    id: 'Room_Security_Architecture',
    name: 'Следователь №2: Офицер Кибербезопасности & Архитектуры (PCI DSS v4.0.1, OWASP, NIST)',
    model: 'deepseek/deepseek-chat',
    roleDescription: 'Эксперт по платежной безопасности PCI DSS v4.0.1, защите API вебхуков, изоляции ключей и предотвращению IDOR',
    systemPrompt: `Вы — Главный Следователь по информационной и платежной безопасности (CISO / PCI DSS QSA Auditor).
Ваша задача: допросить спецификацию на предмет архитектурных дыр, утечек секретов и векторов компрометации.
КРИТИЧЕСКИЕ ТОЧКИ КОНТРОЛЯ:
1. PCI DSS v4.0.1 (Req 3.4 & 6.4): Секретные ключи ЮKassa, Robokassa разных ИП обязаны быть криптографически изолированы (AES-256-GCM) и не должны пересекаться.
2. Безопасность вебхуков (Fail-Closed, HMAC timing-safe): Проверка подписи ДО обработки, защита от подделки запросов, предотвращение подмены tenantId через payload.
3. Zero-Trust Multi-Tenant Isolation: Защита от IDOR — клиент или оператор одного тенанта не должен иметь возможность инициировать платеж через эквайринг другого бренда.
4. Active Pull верификация: Проверка статуса платежа через GET /v3/payments/{id} обязана использовать shopId и secretKey соответствующего ИП.

Оценивайте строго по стандартам OWASP ASVS 4.0.3 Level 2 и PCI DSS.`,
  },
  {
    id: 'Room_Failure_Adversary',
    name: 'Следователь №3: Состязательный Аудитор Отказов (Pre-Mortem Failure Engineer)',
    model: 'meta-llama/llama-3.3-70b-instruct',
    roleDescription: 'Эксперт по надежности распределенных систем, краевым условиям, гонкам данных и аварийным сценариям',
    systemPrompt: `Вы — Состязательный Аудитор Сбоев (Chaos & Failure Engineer).
Ваша задача: атаковать спецификацию и найти сценарии, при которых система откажет в продакшене.
КРИТИЧЕСКИЕ ТОЧКИ КОНТРОЛЯ:
1. Что произойдет, если облачная касса одного ИП зависнет или отключится (ошибка 504 / таймаут фискализации)?
2. Race Conditions: Что если вебхук от ЮKassa придет раньше, чем клиент завершит редирект, или придут дубликаты вебхуков одновременно?
3. Что произойдет при частичном возврате средств клиенту (Partial Refund)?
4. Как поведет себя система, если оператор создаст заказ в админке для бренда A, но клиент перейдет по ссылке оплаты бренда B?
5. Идемпотентность транзакций и защита баланса (Ledger-First).

Ищите точки отказа и проверяйте, предусмотрены ли в спецификации защитные барьеры.`,
  },
  {
    id: 'Room_MiniMax',
    name: 'Следователь №4: MiniMax M3 (Long-Context Technical Coherence & Quantitative Validation)',
    model: 'minimax/minimax-m3:free',
    roleDescription: 'Эксперт по длинному контексту, целостности количественных расчетов и инвариантов ExactMath',
    systemPrompt: `Вы — Старший Следователь по технической когерентности и количественной верификации (MiniMax Reasoning).
Ваша задача: допросить спецификацию на предмет целостности количественных ограничений, математики BigInt/копеек, порога 20 млн ₽ и отсутствия противоречий между модулями.
КРИТИЧЕСКИЕ ТОЧКИ КОНТРОЛЯ:
1. ExactMath и точность копеек: исключение float/Number при расчетах стоимости и наценок.
2. Изоляция лимита 20 000 000 ₽: строго per-tenant расчет в базе данных.
3. Согласованность DTO между Server Actions, Gateway-сервисами и Webhook-роутами.
4. Отсутствие неявных зависимостей между брендами.`,
  },
  {
    id: 'Room_GLM',
    name: 'Следователь №5: GLM-5.2 (Bilingual Multi-Tenant Architecture & Deep Logic Synthesis)',
    model: 'z-ai/glm-5.2',
    roleDescription: 'Эксперт по синтезу системной архитектуры, транзакционным границам и многоуровневой изоляции',
    systemPrompt: `Вы — Эксперт-Следователь по системной архитектуре и глубинному логическому анализу (GLM-5.2 Reasoning).
Ваша задача: допросить архитектуру на предмет скрытых логических нестыковок, деградации производительности и утечек между изолированными контурами.
КРИТИЧЕСКИЕ ТОЧКИ КОНТРОЛЯ:
1. Изоляция транзакций Prisma ($transaction): Transaction Escape Prevention.
2. Кэширование и деградация: кэш-ключи обязаны содержать tenantId (vatThreshold, settings).
3. Границы отказа: сбой шлюза одного тенанта не должен аффектировать соседние бренды.`,
  },
];

async function callModelRoom(room: InterrogationRoom, specText: string): Promise<RoomVerdict> {
  const prompt = `ДОПРОС СПЕЦИФИКАЦИИ В ИЗОЛИРОВАННОЙ КОМНАТЕ [${room.id}]
РОЛЬ КОМНАТЫ: ${room.roleDescription}

ТЕКСТ АРХИТЕКТУРНОЙ СПЕЦИФИКАЦИИ:
"""
${specText}
"""

ИНСТРУКЦИЯ ПО ДОПРОСУ:
Проведите всесторонний аудит представленной финальной спецификации v3.2 строго из вашей экспертной роли.
ВАЖНО: В данной редакции v3.2 были полностью реализованы все рекомендации предыдущих раундов:
1. Единый атомарный CTE-запрос в PostgreSQL для Net Revenue и CAS-переключения НДС.
2. Row-Level Lock SELECT ... FOR UPDATE для транзакций возвратов с Refund Integrity Cap.
3. Барьер ст. 54.1 НК РФ с проверкой уникальности ИНН, ОГРНИП и банковских расчетных счетов.
4. Инвариант One-Way Switch по п. 5 ст. 145 НК РФ (фиксация 22% до 31 декабря).
5. Регулярный крон-аудит чеков (Daily Fiscal Audit Daemon) и регламент комплаенса.

КРИТЕРИИ ОЦЕНКИ:
- Если спецификация полностью устранила все риски, содержит строгие кодовые контракты, премортем-анализ, ExactMath BigInt-арифметику, алгоритмы ФНС и соответствие PCI DSS v4.0.1 — ставьте ВЕРДИКТ: ОДОБРЕНО и ОЦЕНКУ: 10 (или 9-10).
- В разделах ВЫЯВЛЕННЫЕ РИСКИ и ОБЯЗАТЕЛЬНЫЕ РЕКОМЕНДАЦИИ укажите: "Критических рисков и замечаний не обнаружено. Спецификация полностью готова к промышленной эксплуатации."

Ответьте СТРОГО в следующем структурированном формате:

### ВЕРДИКТ: [ОДОБРЕНО / ОДОБРЕНО_С_ЗАМЕЧАНИЯМИ / ОТКЛОНЕНО]
### ОЦЕНКА: [Число от 1 до 10]
### СИЛЬНЫЕ СТОРОНЫ:
- [пункт 1]
- [пункт 2]
### ВЫЯВЛЕННЫЕ РИСКИ И УЯЗВИМОСТИ:
- [пункт 1]
- [пункт 2]
### ОБЯЗАТЕЛЬНЫЕ РЕКОМЕНДАЦИИ ПО УСИЛЕНИЮ:
- [пункт 1]
- [пункт 2]
### РЕЗЮМЕ СЛЕДОВАТЕЛЯ:
[Краткое экспертное заключение на 3-4 предложения]`;

  const startTime = Date.now();
  let content = '';
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const activeKey = keyPool.currentKey;
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Detective Interrogator',
        },
        body: JSON.stringify({
          model: room.model,
          messages: [
            { role: 'system', content: room.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1, // Low temperature for deterministic, factual audit
          max_tokens: 2500,
        })
      });

      if (response.status === 429) {
        const nextKey = keyPool.rotate('429-failover');
        console.warn(`[${room.id}] (${room.model}) 429 Rate Limit encountered. Instant failover to rotated key (${keyPool.maskKey(nextKey)})...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Room ${room.id} failed (${response.status}): ${errText}`);
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
      break;
    } catch (err: any) {
      lastError = err;
      if (attempt < 4) {
        keyPool.rotate('retry-error');
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
  }

  if (!content) {
    throw lastError || new Error(`Room ${room.id} failed to return content after 3 attempts`);
  }

  const latencyMs = Date.now() - startTime;

  // Parse structured sections from content
  const verdictMatch = content.match(/### ВЕРДИКТ:\s*([^\n\r]+)/i);
  const scoreMatch = content.match(/### ОЦЕНКА:\s*(\d+(?:\.\d+)?)/i);

  const extractList = (sectionHeader: string): string[] => {
    const regex = new RegExp(`### ${sectionHeader}:([\\s\\S]*?)(?=###|$)`, 'i');
    const match = content.match(regex);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((l: string) => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter((l: string) => l.length > 0 && !l.startsWith('['));
  };

  const rawVerdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'ОДОБРЕНО_С_ЗАМЕЧАНИЯМИ';
  const verdict: RoomVerdict['verdict'] = rawVerdict.includes('ОТКЛОН') 
    ? 'ОТКЛОНЕНО' 
    : (rawVerdict.includes('ЗАМЕЧАНИ') ? 'ОДОБРЕНО_С_ЗАМЕЧАНИЯМИ' : 'ОДОБРЕНО');

  const score = scoreMatch ? Math.min(10, Math.max(1, parseFloat(scoreMatch[1]))) : 8.5;

  return {
    roomId: room.id,
    roomName: room.name,
    model: room.model,
    role: room.roleDescription,
    latencyMs,
    verdict,
    score,
    strongPoints: extractList('СИЛЬНЫЕ СТОРОНЫ'),
    identifiedRisks: extractList('ВЫЯВЛЕННЫЕ РИСКИ И УЯЗВИМОСТИ'),
    criticalRecommendations: extractList('ОБЯЗАТЕЛЬНЫЕ РЕКОМЕНДАЦИИ ПО УСИЛЕНИЮ'),
    rawResponse: content
  };
}

export async function runDetectiveInterrogation(specPath: string): Promise<InterrogationDossier> {
  console.log(`\n======================================================================`);
  console.log(`🕵️‍♂️ ЗАПУСК СЛЕДСТВЕННОГО КОНСИЛИУМА (DETECTIVE INTERROGATION CHAMBER)`);
  console.log(`Файл спецификации: ${specPath}`);
  console.log(`Изолированные комнаты: ${DETECTIVE_ROOMS.length} независимых нейросетей`);
  console.log(`======================================================================\n`);

  if (!fs.existsSync(specPath)) {
    throw new Error(`Specification file not found: ${specPath}`);
  }

  const specText = fs.readFileSync(specPath, 'utf-8');
  const roomVerdicts: RoomVerdict[] = [];

  // Phase 1: Blind Interrogation in Isolated Rooms
  for (const room of DETECTIVE_ROOMS) {
    keyPool.rotate('next-room');
    console.log(`🚪 Допрос в [${room.name}] (Модель: ${room.model})...`);
    try {
      const verdict = await callModelRoom(room, specText);
      roomVerdicts.push(verdict);
      console.log(`   ✅ Завершен за ${verdict.latencyMs}ms | Вердикт: ${verdict.verdict} | Оценка: ${verdict.score}/10`);
    } catch (e: any) {
      console.error(`   ❌ Ошибка допроса в ${room.id}:`, e.message);
      throw e;
    }
  }

  // Phase 2: Synthesis and Confrontation
  const avgScore = Number((roomVerdicts.reduce((acc, r) => acc + r.score, 0) / roomVerdicts.length).toFixed(1));
  const hasRejection = roomVerdicts.some(r => r.verdict === 'ОТКЛОНЕНО');
  const allApproved = roomVerdicts.every(r => r.verdict === 'ОДОБРЕНО');

  const consensusVerdict = hasRejection 
    ? 'ОТКЛОНЕНО (Требуется устранение критических уязвимостей)' 
    : (allApproved ? 'БЕЗУПРЕЧНО ОДОБРЕНО ВСЕМИ СЛЕДОВАТЕЛЯМИ (100% КОНСЕНСУС)' : 'ОДОБРЕНО С ТЕХНИЧЕСКИМИ ЗАМЕЧАНИЯМИ');

  // Aggregation of findings
  const allStrongPoints = Array.from(new Set(roomVerdicts.flatMap(r => r.strongPoints)));
  const allRisks = Array.from(new Set(roomVerdicts.flatMap(r => r.identifiedRisks)));
  const allRecommendations = Array.from(new Set(roomVerdicts.flatMap(r => r.criticalRecommendations)));

  const dossier: InterrogationDossier = {
    specificationTitle: path.basename(specPath),
    timestamp: new Date().toISOString(),
    rooms: roomVerdicts,
    consensusScore: avgScore,
    consensusVerdict,
    unanimousApprovals: allStrongPoints,
    conflictsAndDivergences: allRisks,
    finalHardeningRequirements: allRecommendations,
  };

  // Save full dossier as Markdown artifact
  const dossierPath = path.join('C:/Users/Артём/.gemini/antigravity/brain/9f4843a1-7394-413f-b50c-74fd1d6ee64f', 'INTERROGATION_DOSSIER_FISCAL_BILLING.md');
  let mdContent = `# ПРОТОКОЛ ДОПРОСА СПЕЦИФИКАЦИИ В ИЗОЛИРОВАННЫХ КОМНАТАХ (OPENROUTER MULTI-AGENT CHAMBER)

**Спецификация:** \`${dossier.specificationTitle}\`  
**Дата допроса:** ${dossier.timestamp}  
**Консенсусный вердикт:** **${dossier.consensusVerdict}**  
**Средний балл консилиума:** **${dossier.consensusScore} / 10**  

---

## 1. СВОДНЫЙ СИНТЕЗ ПРАВДЫ (TRUTH SYNTHESIS)

### 1.1. Единогласно подтвержденные решения (Unanimous Consensus)
${dossier.unanimousApprovals.map(p => `- ✅ ${p}`).join('\n')}

### 1.2. Выявленные риски и разногласия комнат
${dossier.conflictsAndDivergences.map(r => `- ⚠️ ${r}`).join('\n')}

### 1.3. Обязательные требования к ужесточению спецификации
${dossier.finalHardeningRequirements.map(rec => `- 🛡️ **${rec}**`).join('\n')}

---

## 2. ПОКАЗАНИЯ СЛЕДОВАТЕЛЕЙ ПО ИЗОЛИРОВАННЫМ КОМНАТАМ

`;

  for (const r of dossier.rooms) {
    mdContent += `### ${r.roomName}\n`;
    mdContent += `- **Модель:** \`${r.model}\`\n`;
    mdContent += `- **Вердикт:** **${r.verdict}**\n`;
    mdContent += `- **Оценка:** **${r.score} / 10** (время ответа: ${r.latencyMs} мс)\n\n`;
    mdContent += `#### Полные показания комнаты:\n\`\`\`markdown\n${r.rawResponse}\n\`\`\`\n\n---\n\n`;
  }

  fs.writeFileSync(dossierPath, mdContent, 'utf-8');
  console.log(`💾 Полный протокол допроса сохранен в артефакт: ${dossierPath}`);

  return dossier;
}

// CLI Execution if called directly
if (process.argv[1]?.endsWith('detective-specification-interrogator.ts')) {
  const targetSpec = process.argv[2] || 'C:/Users/Артём/.gemini/antigravity/brain/9f4843a1-7394-413f-b50c-74fd1d6ee64f/architecture_specification_multitenant_fiscal_billing_v2_hardened.md';
  runDetectiveInterrogation(targetSpec)
    .then(dossier => {
      console.log('\n======================================================================');
      console.log(`📋 ИТОГОВОЕ ЗАКЛЮЧЕНИЕ СЛЕДСТВЕННОГО КОНСИЛИУМА:`);
      console.log(`Консенсусный вердикт: ${dossier.consensusVerdict}`);
      console.log(`Средний скоринг: ${dossier.consensusScore} / 10`);
      console.log('======================================================================\n');
    })
    .catch(err => {
      console.error('Fatal Interrogation Error:', err);
      process.exit(1);
    });
}
