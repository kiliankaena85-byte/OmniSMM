import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryOpenRouter(model: string, system: string, user: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return 'OPENROUTER_API_KEY is not set';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Client Card & Ledger UX Audit',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      return `HTTP ${res.status}: ${err.slice(0, 200)}`;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err: any) {
    return `Error: ${err.message}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log('🚀 Running OpenRouter UX Audit Swarm for Client Card & Ledger UX Usability...');

  const system = `Ты — ведущий международный Principal UX/UI Architect и Staff Product Designer (эксперт по CRM, Финтех-дашбордам, эргономике рабочих мест операторов саппорта и администраторов, WCAG 2.2 AA, Modal Hoisting, Bento Grid, Zero Friction Navigation).`;

  const user = `
ПРОБЛЕМА USABILITY В КАРТОЧКЕ КЛИЕНТА OMNISMM 1.0 (/admin/clients/[id]):

Контекст:
Оператор службы поддержки (роль SUPPORT) или администратор (ADMIN / OWNER) находится в карточке клиента (/admin/clients/[id]).
Наверху расположены 4 сводных плашки (Баланс, LTV, Количество заказов, Реферальный баланс).
Ниже расположен 3-колоночный командный центр:
- Колонка 1: Баланс и операции (начисление/списание с Poka-Yoke причинами, персональная скидка, кнопки "Показать транзакции Ledger", "Показать платежи").
- Колонка 2: Безопасность и доступ (Magic Link, смена email, завершение сессий, пароль, логи входов).
- Колонка 3: Заметки оператора (история заметок, добавление, удаление) + последние 5 заказов.

Текущая проблема:
При нажатии на кнопку "Показать транзакции Ledger" (или платежи) таблица разворачивается в самом низу страницы под всеми 3 колонками и списком заказов.
Оператору приходится:
1. Кликать по кнопке.
2. Прокручивать экран вниз (Scroll Friction), теряя контекст карточки клиента.
3. Просматривать таблицу внизу, а затем снова скроллить наверх, чтобы начислить баланс или скопировать данные.

Пользователь (владелец платформы) требует:
"Переход из карточки клиента в транзакции в леджер очень неудобный. Нужно открывать отдельное окно на всю страницу (полноэкранный / широкоформатный модал или Side-Drawer / Viewport Overlay), чтобы было удобно смотреть, а не пролистывать вниз. Это лишние движения. Надо эту логику UX продумать с внешними аудиторами из OpenRouter. Цель — сделать usability карточки клиента лучше, чтобы было удобно пользоваться. Сейчас этим пользоваться неудобно."

ЗАДАЧА:
Сформулируй идеальное архитектурно-дизайнерское решение:
1. Как лучше всего оформить открытие транзакций Ledger и Платежей из карточки клиента (Широкоформатный модал / Bento Drawer / Fullscreen Modal с hoising через React Portal)?
2. Какие элементы управления должны быть в модальном окне:
   - Заголовок с ID и Email клиента, текущим балансом.
   - 4 сводные метрики (Пополнено, Списано за заказы, Возвращено, Корректировки).
   - Быстрые фильтры-чипы (Все, Пополнения, Заказы, Возвраты, Корректировки).
   - Таблица транзакций с пагинацией и поиском/фильтром.
   - Кнопка быстрого закрытия (Escape, крестик, клик по оверлею) без потери стейта основной карточки.
3. Где в карточке клиента разместить кнопки вызова Ledger и Платежей (в шапке карточки / в плашке баланса / в колонке операций), чтобы оператор моментально видел их без поиска?
4. Предоставь конкретный пошаговый UX-план внедрения.
`;

  const models = [
    'google/gemini-2.5-flash',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.3-70b-instruct'
  ];

  for (const model of models) {
    console.log(`\n⏳ Querying ${model}...`);
    const result = await queryOpenRouter(model, system, user);
    console.log(`\n=== 🤖 AUDIT RESULTS FROM ${model} ===\n`);
    console.log(result.slice(0, 1500));
    console.log('\n-----------------------------------------\n');

    fs.writeFileSync(
      path.resolve(process.cwd(), `scripts/harness/UX_AUDIT_${model.replace(/[\/:]/g, '_')}.md`),
      result,
      'utf-8'
    );
  }
}

main().catch(console.error);
