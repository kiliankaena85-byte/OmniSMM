import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// OpenRouter API setup
let apiKey = process.env.OPENROUTER_API_KEY || '';
if (!apiKey) {
  try {
    const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('OPENROUTER_API_KEY=')) {
        apiKey = line.split('=')[1].trim().replace(/["']/g, '');
      }
    }
  } catch (e) {}
}

const MODELS = [
  'nvidia/nemotron-3.5-lightning:free',
  'minimax/minimax-m3:free',
  'google/gemma-4-31b-it:free',
  'z-ai/glm-5.2:free',
];

const ROLES = [
  {
    role: 'Линейный саппорт-студент (20 лет)',
    angle: 'Смотрит график со смартфона перед сном. Хочет за 2 секунды понять, когда выходит на работу, и в 1 клик попросить замену, если завтра экзамен/заболел. Ненавидит сложные таблицы и кучу настроек.',
  },
  {
    role: 'Старший смены / Тимлид саппорта (27 лет)',
    angle: 'Отвечает за бесперебойность 24/7. Нужно видеть, нет ли пустых смен без дежурного, быстро закрывать дыры и раскатывать график 2/2 на месяц вперед без рутины.',
  },
  {
    role: 'Senior UX/UI Дизайнер (Enterprise & Mobile API)',
    angle: 'Оценивает информационную плотность, когнитивную нагрузку, адаптивность для мобилок и десктопа, WCAG 2.2 AA, закон Хика (минимизация выбора).',
  },
  {
    role: 'Овнер SMM-платформы (Бизнес & Эффективность)',
    angle: 'Хочет инструмент, который не требует обучения персонала, исключает прогулы и споры («я думал, ты выходишь»), работает надежно и просто.',
  },
];

const PROMPT_TEMPLATE = (role: string, angle: string) => `
Ты выступаешь в роли: "${role}".
Твоя специфика и боли: ${angle}.

Мы перерабатываем модуль управления сменами и графиком техподдержки (Workforce Management / График смен) в панели управления OmniSMM.
Рассматриваются 4 варианта:

ВАРИАНТ 1: «Лента дежурств (Feed/Stories)» — сверху плашка «Кто сейчас на смене», ниже карточки на 7 дней вперед (День / Ночь), клик на слот -> «Занять» или «Поменяться».
ВАРИАНТ 2: «Единый простой календарь» — классический чистый календарь на месяц, в ячейке дня просто 2 строчки: ☀️ Имя, 🌙 Имя, свои смены подсвечены синим, 1 кнопка «Отпуск/Больничный».
ВАРИАНТ 3: «Сменный табель 2/2 (Excel-шахматка)» — таблица: сотрудники слева, числа месяца сверху (1..30), в ячейках буквы Д / Н / В / О / Б.
ВАРИАНТ 4: «Гибридный Bento-виджет (Личный фокус + Общая шахматка)» — вверху компактный виджет: «Моя смена сегодня/завтра» с кнопкой «Заболел / Нужна подмена» + виджет «Кто сейчас на линии», а ниже — простая наглядная шахматка смен всей команды.

Дай свой честный, бескомпромиссный вердикт на русском языке:
1. Какой вариант лучший с твоей точки зрения и почему?
2. Какие 2-3 критические детали сделают его максимально удобным?
3. От чего нужно КАТЕГОРИЧЕСКИ отказаться (антипаттерны)?
`;

async function queryModel(model: string, roleObj: { role: string; angle: string }) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: PROMPT_TEMPLATE(roleObj.role, roleObj.angle) },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    return {
      model,
      role: roleObj.role,
      reply: data.choices?.[0]?.message?.content || JSON.stringify(data),
    };
  } catch (err: any) {
    return { model, role: roleObj.role, error: err.message };
  }
}

async function main() {
  console.log('🚀 Запуск фокус-группы из 4 ролей через OpenRouter AI Swarm...');
  const results = [];

  for (let i = 0; i < ROLES.length; i++) {
    const model = MODELS[i % MODELS.length];
    const roleObj = ROLES[i];
    console.log(`📡 Опрос [${roleObj.role}] через модель ${model}...`);
    const res = await queryModel(model, roleObj);
    results.push(res);
  }

  writeFileSync(
    resolve(process.cwd(), 'scripts/harness/focus-group-wfm-report.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('✅ Фокус-группа завершена! Отчет сохранен в focus-group-wfm-report.json');
}

main().catch(console.error);
