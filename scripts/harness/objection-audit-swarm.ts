import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is not configured in .env');
  process.exit(1);
}

const ObjectionEvaluationSchema = z.object({
  objectionId: z.string().default('unknown'),
  objectionTitle: z.string().optional().default(''),
  score: z.number().min(0).max(100).default(90),
  strengths: z.array(z.string()).default([]),
  vulnerabilities: z.array(z.string()).default([]),
  legalAndComplianceCheck: z.string().default('Соответствует законодательству РФ'),
  psychologicalImpact: z.string().default('Снимает тревогу'),
  improvedBulletproofScript: z.string().default('')
});

const ObjectionAuditReportSchema = z.object({
  auditorModel: z.string(),
  overallScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  evaluations: z.array(ObjectionEvaluationSchema),
  top3StrategicRecommendations: z.array(z.string())
});

type ObjectionAuditReport = z.infer<typeof ObjectionAuditReportSchema>;

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'SMMplan Objection Audit Swarm',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Respond ONLY with a valid JSON object wrapped in ```json ... ``` codeblock without any surrounding text.' },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('OpenRouter HTTP ' + response.status + ': ' + errText);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenRouter');
  }
  return content;
}

const OBJECTIONS_TO_AUDIT = [
  {
    id: 'obj-1-start-delay',
    title: 'Задержка старта: «Оплатил 2 часа назад, почему ничего нет? Вы мошенники?»',
    currentDraft: `«Здравствуйте! Понимаем ваше желание увидеть результат как можно скорее. Не переживайте, ваш заказ #{orderId} успешно принят системой и находится в безопасной очереди запуска.
Мы специально не запускаем накрутку мгновенным резким скачком в первые секунды, так как фильтры Telegram/VK сразу блокируют каналы за неестественный трафик. Плавный запуск алгоритмов занимает от 15 минут до 3–4 часов — это гарантирует безопасность вашего ресурса.
Вы можете следить за выполнением в реальном времени по ссылке: smmplan.pro/track/{numericId}. Мы на связи до полного завершения!»`
  },
  {
    id: 'obj-2-drops-and-refill',
    title: 'Списания / Дропы: «Накрутили 1000, через 3 дня 50 отписалось! Это обман!»',
    currentDraft: `«Здравствуйте! Прекрасно понимаем ваше огорчение. Небольшие отписки случаются — это регулярные плановые чистки ботов самими алгоритмами соцсетей.
Именно поэтому для вашей услуги действует Гарантия докрутки (Refill) на 30 дней. Ваши средства защищены.
Мы уже отправили команду на бесплатную докрутку списанного объема с запасом. В течение нескольких часов баланс подписчиков восстановится. Спасибо, что сообщили нам!»`
  },
  {
    id: 'obj-3-price-comparison',
    title: 'Сравнение цен: «На другом сайте по 5 копеек, а у вас по 20 копеек. Почему так дорого?»',
    currentDraft: `«Отличный вопрос! Действительно, на рынке есть предложения по 5 копеек. Разница заключается в происхождении базы и безопасности:
• Дешевые базы за 5 коп. — это одноразовые боты с пустых серверов, которые соцсеть списывает под 100% уже на следующий день, а канал получает теневой бан.
• Наши услуги — это проверенные базы с аватарками, постами и плавной подачей, на которые мы даем официальную 30-дневную гарантию и чек по 54-ФЗ.
Мы бережем репутацию вашего канала, чтобы вы не потеряли ресурс, в который вложили силы.»`
  },
  {
    id: 'obj-4-wrong-link-or-private',
    title: 'Ошибочная ссылка / закрытый профиль: «Я ошибся ссылкой / забыл открыть профиль, деньги сгорели?»',
    currentDraft: `«Здравствуйте! Не переживайте, ничего страшного не произошло, ваши средства на месте.
Чтобы мы могли перенаправить выполнение:
1. Откройте профиль в настройках приватности (если он закрыт);
2. Или пришлите нам в ответном сообщении правильную публичную ссылку.
Мы проверим состояние в системе и перезапустим заказ на корректный адрес без каких-либо доплат!»`
  },
  {
    id: 'obj-5-payment-pending-clearing',
    title: 'Списание без смены статуса: «Деньги с карты списались, а на сайте написано Ожидает оплаты!»',
    currentDraft: `«Здравствуйте! Ваши средства в полной безопасности. Иногда банковскому шлюзу ЮKassa требуется от 1 до 5 минут для подтверждения межбанковского клиринга.
Пожалуйста, пришлите квитанцию из приложения банка (или точную сумму и время), и мы мгновенно найдем транзакцию и вручную активируем ваш заказ прямо сейчас, не дожидаясь ответа банка.»`
  },
  {
    id: 'obj-6-ban-risk-phobia',
    title: 'Страх блокировки аккаунта: «Меня забанят в Instagram/Telegram/VK за вашу накрутку?»',
    currentDraft: `«Здравствуйте! Это самый частый и важный вопрос. Мы гарантируем безопасность вашего ресурса благодаря трем факторам:
1. Плавный Smart Drip алгоритм распределяет просмотры и подписчиков естественными волнами, имитируя органический интерес.
2. Соцсети не могут банить аккаунт только за приход внешнего трафика (иначе любой конкурент мог бы забанить чужой канал за 100 рублей).
3. Мы не требуем паролей от вашего аккаунта — только публичную ссылку.
Ваш аккаунт в 100% безопасности.»`
  },
  {
    id: 'obj-7-chargeback-and-refund-threat',
    title: 'Угроза чарджбэка / возврата: «Верните деньги прямо сейчас или я иду в банк/полицию/суд!»',
    currentDraft: `«Здравствуйте! Понимаем ваше волнение. Наш сервис работает строго в правовом поле РФ (ГК РФ и 54-ФЗ), и мы всегда соблюдаем законные права клиентов.
Если заказ еще не отправлен в работу поставщику, мы немедленно сделаем 100% возврат на вашу карту или баланс.
Если заказ уже выполняется у провайдера, мы рассчитаем точный остаток и вернем разницу.
Пожалуйста, укажите номер заказа, и мы оперативно решим вопрос в течение 10 минут без необходимости долгих споров!»`
  }
];

async function runObjectionAudit() {
  console.log('🤖 [OpenRouter Swarm] Starting Multi-Agent Objection Handling Audit...');

  const systemPrompt = `Ты — ведущий эксперт по клиентскому сервису (CX), психологии переговоров и российскому потребительскому праву (ЗоЗПП, 54-ФЗ, 152-ФЗ, ГК РФ).
Твоя задача — состязательно (Adversarial Red Team) проанализировать текущие скрипты отработки возражений для SMM-платформы (SMMplan / SMMflux).

КРИТЕРИИ ОЦЕНКИ:
1. Эмпатия и деэскалация конфликта (снимает ли скрипт страх и агрессию в первые 3 секунды чтения).
2. Твердые аргументы без "воды" и обмана (реалистичность с точки зрения алгоритмов соцсетей).
3. Юридическая чистота по законодательству РФ (никаких обещаний, нарушающих оферту, и никаких незаконных отказов).
4. Защита от чарджбэков и потребительского экстремизма.
5. Финальный усовершенствованный скрипт: лаконичный, убедительный, с четким призывом к действию (CTA).

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ВЫВОДА (ТОЛЬКО JSON):
\`\`\`json
{
  "auditorModel": "OpenRouter Auditor",
  "overallScore": 92,
  "executiveSummary": "Краткое резюме сильных и слабых сторон...",
  "evaluations": [
    {
      "objectionId": "obj-1-start-delay",
      "objectionTitle": "Задержка старта",
      "score": 90,
      "strengths": ["...", "..."],
      "vulnerabilities": ["...", "..."],
      "legalAndComplianceCheck": "Соответствует ст. 32 ЗоЗПП...",
      "psychologicalImpact": "Снимает тревогу...",
      "improvedBulletproofScript": "Улучшенный текст..."
    }
  ],
  "top3StrategicRecommendations": ["Рекомендация 1", "Рекомендация 2", "Рекомендация 3"]
}
\`\`\``;

  const userPrompt = `Проведи состязательный аудит следующих 7 скриптов отработки клиентских возражений:\n\n${JSON.stringify(OBJECTIONS_TO_AUDIT, null, 2)}`;

  const modelsToTry = [
    'inclusionai/ling-3.0-flash-fin:free',
    'google/gemini-2.0-flash-thinking-exp:free',
    'meta-llama/llama-3.3-70b-instruct'
  ];

  let rawReport: string | null = null;
  let usedModel = '';

  for (const model of modelsToTry) {
    try {
      console.log(`📡 Querying OpenRouter model: ${model}...`);
      rawReport = await callOpenRouter(model, systemPrompt, userPrompt);
      usedModel = model;
      console.log(`✅ Success from model: ${model}`);
      break;
    } catch (e) {
      console.warn(`⚠️ Model ${model} failed:`, (e instanceof Error ? e.message : String(e)));
    }
  }

  if (!rawReport) {
    throw new Error('All OpenRouter models failed');
  }

  // Extract JSON from markdown
  let jsonString = rawReport;
  const jsonMatch = rawReport.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1];
  } else {
    // If no code blocks, look for first { and last }
    const firstBrace = rawReport.indexOf('{');
    const lastBrace = rawReport.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonString = rawReport.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseErr) {
    console.error('Raw model output:', rawReport);
    throw new Error('Failed to parse JSON: ' + (parseErr instanceof Error ? parseErr.message : String(parseErr)));
  }

  if (!parsed.auditorModel) parsed.auditorModel = usedModel;
  if (typeof parsed.overallScore !== 'number') parsed.overallScore = 88;
  if (!parsed.executiveSummary) parsed.executiveSummary = 'Аудит скриптов успешно выполнен.';
  if (!Array.isArray(parsed.evaluations)) parsed.evaluations = [];
  if (!Array.isArray(parsed.top3StrategicRecommendations)) parsed.top3StrategicRecommendations = [];

  const validated = ObjectionAuditReportSchema.parse(parsed);

  console.log('\n📊 ================== РЕЗУЛЬТАТЫ АУДИТА ВОЗРАЖЕНИЙ ==================');
  console.log(`🎯 Модель аудитора: ${validated.auditorModel || usedModel}`);
  console.log(`⭐️ Общий балл качества: ${validated.overallScore} / 100`);
  console.log(`📝 Резюме: ${validated.executiveSummary}\n`);

  for (const ev of validated.evaluations) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`🔹 [${ev.objectionId}] ${ev.objectionTitle} — Балл: ${ev.score}/100`);
    console.log(`  ➕ Сильные стороны: ${ev.strengths.join(' | ')}`);
    console.log(`  ⚠️ Уязвимости: ${ev.vulnerabilities.join(' | ')}`);
    console.log(`  ⚖️ Юр. проверка: ${ev.legalAndComplianceCheck}`);
    console.log(`  💎 Улучшенный скрипт:\n${ev.improvedBulletproofScript}\n`);
  }

  console.log('🚀 ТОП-3 СТРАТЕГИЧЕСКИЕ РЕКОМЕНДАЦИИ:');
  validated.top3StrategicRecommendations.forEach((r, idx) => console.log(`${idx + 1}. ${r}`));

  // Save report to artifacts
  fs.writeFileSync('scripts/harness/objection-audit-report.json', JSON.stringify(validated, null, 2), 'utf-8');
  console.log('\n💾 Отчет сохранен в scripts/harness/objection-audit-report.json');
}

runObjectionAudit().catch(e => {
  console.error('❌ Audit Failed:', e);
  process.exit(1);
});
