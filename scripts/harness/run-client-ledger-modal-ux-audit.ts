import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function askLLM(prompt: string): Promise<string> {
  // 1. Try Gemini
  if (GEMINI_API_KEY) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
    for (const gm of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2 }
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        } else {
          console.log(`Gemini ${gm} returned ${res.status}`);
        }
      } catch (e) {
        console.error('Gemini error:', e);
      }
    }
  }

  // 2. Try OpenRouter free models
  if (OPENROUTER_API_KEY) {
    const freeModels = [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-chat:free'
    ];

    for (const model of freeModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://smmplan.pro',
            'X-Title': 'OmniSMM UX Audit',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2
          })
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return text;
        }
      } catch {}
    }
  }

  return 'Failed to reach external auditor';
}

async function runAudit() {
  console.log('🤖 Running Principal UX Audit on Client Card & Ledger Modals...');

  const prompt = `
Ты — ведущий международный Principal UX/UI Architect и Staff Ergonomics Specialist (специалист по интерфейсам служб поддержки, CRM, банковским выпискам, WCAG 2.2 AA, Modal Hoisting, Bento Grids, ISO 9241-110).

КОНТЕКСТ И ПРОБЛЕМА:
Оператор службы поддержки или администратор находится в карточке клиента (/admin/clients/[id]).
Оператору часто нужно посмотреть историю транзакций (Ledger): пополнения, списания за заказы, авто-возвраты, ручные корректировки, либо платежи эквайринга.
Сейчас при нажатии кнопки "Показать транзакции Ledger" таблица просто раскрывается в самом низу страницы, вынуждая оператора скроллить вниз на 1000px, теряя из виду шапку, баланс и форму управления.

ТРЕБОВАНИЕ ПОЛЬЗОВАТЕЛЯ (ВЛАДЕЛЬЦА):
"Переход из карточки клиента в транзакции в леджер очень неудобный. Нужно открывать отдельное окно на всю страницу (полноэкранный / широкоформатный модал с затемнением и порталом в body), чтобы было удобно смотреть, а не пролистывать вниз. Это лишние движения. Надо эту логику UX продумать с внешними аудиторами из OpenRouter. Цель — сделать usability карточки клиента лучше, чтобы было удобно пользоваться. Сейчас этим пользоваться неудобно."

СФОРМУЛИРУЙ ИСЧЕРПЫВАЮЩИЙ АУДИТ И ДИЗАЙН-СПЕЦИФИКАЦИЮ:
1. Архитектура модального окна (Fullscreen Bento Modal / Viewport Hoisted Dialog):
   - Почему полноэкранное / широкоформатное модальное окно (max-w-6xl или fixed inset-4/6 с createPortal в document.body) превосходит скролл вниз?
   - Какие горячие клавиши и триггеры закрытия (Escape, клик по оверлею, кнопка "Закрыть [Esc]")?
2. Точки входа (Triggers):
   - Где разместить кнопку вызова транзакций Ledger:
     а) В сводной плашке "БАЛАНС" (иконка или кликабельная надпись "История Ledger →")
     б) В колонке 1 "Баланс и операции" как заметная контрастная кнопка
     в) В верхней шапке страницы клиента (кнопка "Книга Ledger" рядом с поиском/возвратом)
3. Внутренняя компоновка модального окна Ledger:
   - Header: Заголовок "Книга транзакций Ledger", Email клиента, Текущий баланс, кнопка экспорта/печати (если есть) и закрытия.
   - Сводные карточки (Metrics bar): 4 плашки (Всего пополнено, Списано, Возвращено, Корректировки).
   - Интерактивные фильтры (Pill Chips): Все, Пополнения, Заказы, Возвраты, Корректировки.
   - Таблица: Дата/время (ClientDate), Тип, Сумма (+ / - с цветом), Причина, Инициатор, Статус. Без горизонтального скролла.
4. Отдельное модальное окно для внешних платежей (Payments Modal):
   - Аналогичный быстрый просмотр платежей через ЮKassa / CryptoBot.
5. Чеклист юзабилити по эвристикам Нильсена (NN/g) и стандартам ISO 9241-110:2020.
`;

  const report = await askLLM(prompt);
  console.log('\n=== 📋 PRINCIPAL UX AUDIT REPORT ===\n');
  console.log(report);
  console.log('\n====================================\n');

  fs.writeFileSync(
    path.resolve(process.cwd(), 'scripts/harness/CLIENT_LEDGER_UX_AUDIT_REPORT.md'),
    report,
    'utf-8'
  );
}

runAudit().catch(console.error);
