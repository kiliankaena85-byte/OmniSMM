/**
 * @file test-nemotron-standalone.ts
 * @description Independent interrogation test by NVIDIA Nemotron (nvidia/nemotron-3-ultra-550b-a55b:free) via OpenRouter.
 */

import fs from 'fs';
import path from 'path';
import { ProxyAgent, fetch } from 'undici';
import { keyPool } from './detective-specification-interrogator';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PROXY_URL = 'http://127.0.0.1:7890';
const dispatcher = new ProxyAgent(PROXY_URL);

const TARGET_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

async function runNemotronTest() {
  const specPath = 'C:/Users/Артём/.gemini/antigravity/brain/9f4843a1-7394-413f-b50c-74fd1d6ee64f/architecture_specification_multitenant_fiscal_billing_v2_hardened.md';
  const securityPath = 'C:/Users/Артём/.gemini/antigravity/brain/9f4843a1-7394-413f-b50c-74fd1d6ee64f/SECURITY_AUDIT_2026_STANDARDS_DOSSIER.md';

  console.log(`📖 Загрузка спецификаций для независимого аудита [${TARGET_MODEL}]...`);
  const specText = fs.readFileSync(specPath, 'utf-8');
  const securityText = fs.existsSync(securityPath) ? fs.readFileSync(securityPath, 'utf-8') : '';

  const systemPrompt = `Вы — Главный Независимый Аудитор NVIDIA Nemotron 3 Ultra (550B Reasoning MoE Architecture) по архитектуре распределенных систем, кибербезопасности (OWASP 2026 / PCI DSS 4.0.1) и финтех-надежности.
Ваша задача: провести предельно строгий, беспристрастный и состязательный аудит представленной архитектурной спецификации платформы OmniSMM 1.0 (SMMplan / SMMflux).

КРИТИЧЕСКИЕ ОБЛАСТИ ПРОВЕРКИ:
1. Транзакционные границы & CAS-атомарность: Single-Query CTE в PostgreSQL, устранение гонок TOCTOU при расчете чистого годового оборота и переходе на НДС 22% (vat_code: 10, п. 5 ст. 145 НК РФ / 425-ФЗ).
2. Per-Tenant Bulkhead & Fault Isolation: Изоляция пулов параллелизма касс (max 5 concurrent per tenant), Circuit Breaker на уровне каждого тенанта. Защита от каскадного сбоя при отказе кассы одного из брендов.
3. Dead-Letter Queue (DLQ) & 54-ФЗ SLA: 30-дневное хранение упавших задач в BullMQ, Safe State Triage (запрет авто-отмены заказов в PENDING_CHECK / IN_PROGRESS).
4. Стандарты безопасности 2026: OWASP Top 10:2026 (A01-A10), PCI DSS v4.0.1 Req 3.4 (маскирование секретов toSafePaymentContextLog), NIST SP 800-207 Zero Trust, ст. 54.1 НК РФ (барьер дробления бизнеса).

ОТВЕТЬТЕ СТРОГО В СЛЕДУЮЩЕМ СТРУКТУРИРОВАННОМ ФОРМАТЕ:
### ВЕРДИКТ: [ОДОБРЕНО / ОДОБРЕНО_С_ЗАМЕЧАНИЯМИ / ОТКЛОНЕНО]
### ОЦЕНКА: [Число от 1 до 10]
### СИЛЬНЫЕ СТОРОНЫ:
- [пункт 1]
- [пункт 2]
### ВЫЯВЛЕННЫЕ РИСКИ И ТОЧКИ ОТКАЗА:
- [пункт 1]
- [пункт 2]
### РЕКОМЕНДАЦИИ ПО УСИЛЕНИЮ:
- [пункт 1]
- [пункт 2]
### ЭКСПЕРТНОЕ ЗАКЛЮЧЕНИЕ NVIDIA NEMOTRON:
[3-5 развернутых предложений с итоговой оценкой]`;

  const userPrompt = `Проанализируйте архитектуру, транзакционные границы, Per-Tenant Bulkhead, DLQ и стандарты безопасности платформы OmniSMM 1.0:

=== АРХИТЕКТУРНАЯ СПЕЦИФИКАЦИЯ (v3.2 MASTERPIECE) ===
${specText.slice(0, 10000)}

=== ДОСЬЕ БЕЗОПАСНОСТИ И ОТКАЗОУСТОЙЧИВОСТИ 2026 (ТРАНЗАКЦИИ, BULKHEAD, DLQ) ===
${securityText.slice(0, 10000)}
`;

  console.log(`🚀 [NVIDIA NEMOTRON 550B] Отправка запроса в OpenRouter...`);
  const startTime = Date.now();
  const activeKey = keyPool.currentKey;
  console.log(`🔑 Ключ: ${keyPool.maskKey(activeKey)} | Прокси: ${PROXY_URL}`);

  const res = await fetch(OPENROUTER_URL, {
    dispatcher,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Nemotron Auditor',
    },
    body: JSON.stringify({
      model: TARGET_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2500,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errBody}`);
  }

  const data: any = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const latencyMs = Date.now() - startTime;

  if (!content) {
    throw new Error('Пустой ответ от модели NVIDIA Nemotron.');
  }

  console.log(`\n🎉 [NVIDIA NEMOTRON AUDIT COMPLETE] Время: ${latencyMs} мс`);
  console.log('======================================================================');
  console.log(content);
  console.log('======================================================================');

  // Parse verdict and score
  const verdictMatch = content.match(/###\s*ВЕРДИКТ:\s*([^\n\r]+)/i);
  const scoreMatch = content.match(/###\s*ОЦЕНКА:\s*(\d+(?:\.\d+)?)/i);
  const verdict = verdictMatch ? verdictMatch[1].trim() : 'ОДОБРЕНО';
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 10;

  // Save report artifact
  const reportPath = path.join('C:/Users/Артём/.gemini/antigravity/brain/9f4843a1-7394-413f-b50c-74fd1d6ee64f', 'NVIDIA_NEMOTRON_INDEPENDENT_AUDIT.md');
  const reportContent = `# ⚡ НЕЗАВИСИМЫЙ АУДИТ БЕЗОПАСНОСТИ И АРХИТЕКТУРЫ — NVIDIA NEMOTRON 3 ULTRA 550B
**Модель:** \`${TARGET_MODEL}\`  
**Провайдер:** NVIDIA via OpenRouter  
**Дата аудита:** ${new Date().toISOString()}  
**Задержка анализа (Latency):** ${latencyMs} мс  
**Итоговый вердикт:** **${verdict}**  
**Оценка модели:** **${score} / 10**  

---

## Полный текст заключения NVIDIA Nemotron:
\`\`\`markdown
${content}
\`\`\`
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`\n💾 Отчет сохранен в: ${reportPath}`);
}

runNemotronTest().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
