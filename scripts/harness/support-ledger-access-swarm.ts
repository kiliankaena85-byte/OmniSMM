import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ExpertResult {
  role: string;
  model: string;
  focus: string;
  verdict: string;
}

const SWARM_EXPERTS = [
  {
    role: 'Head of Customer Support & CX Operations (OmniSMM)',
    model: 'google/gemma-4-31b-it:free',
    fallbackModels: ['nvidia/nemotron-3.5-lightning:free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-72b-instruct:free'],
    focus: 'Практические потребности оператора поддержки при разборе тикетов и жалоб клиентов',
    systemPrompt: Ты — Руководитель службы клиентской поддержки и CX платформы OmniSMM 1.0 (SMMplan / SMMflux).
Твоя задача — определить точный минимально-достаточный набор данных по финансовым проводкам (Ledger) и платежам, необходимый оператору поддержки для быстрого (до 1-2 минут) решения тикетов.
Ответь на русском языке структурированно:
1. Какие проводки и транзакции поддержка ОБЯЗАНА видеть? (Пример: история пополнений конкретного клиента, списания за заказ, возвраты за отмененный заказ, начисленные бонусы).
2. В каком виде поддержка должна это видеть? (В карточке пользователя / в тикете, а не в глобальной сводке всей компании).
3. Что будет, если у поддержки отобрать эти данные? (Снижение скорости, перегрузка старших админов).,
  },
  {
    role: 'CISO & Insider Threat / Data Loss Prevention (DLP) Architect',
    model: 'nvidia/nemotron-3.5-lightning:free',
    fallbackModels: ['google/gemma-4-31b-it:free', 'meta-llama/llama-3.3-70b-instruct:free'],
    focus: 'Защита от утечек коммерческой тайны, шпионажа и злоупотреблений персонала (Least Privilege)',
    systemPrompt: Ты — Директор по информационной безопасности (CISO) и эксперт по Zero-Trust / DLP.
Твоя задача — определить, какие финансовые проводки и данные КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО показывать поддержке.
Ответь на русском языке:
1. Какие глобальные финансовые данные НЕЛЬЗЯ показывать саппорту? (Глобальный P&L, выручка платформы, себестоимость провайдеров, маржа, балансы шлюзов ЮKassa/Robokassa, проводки других клиентов).
2. Опасности утечки: как недобросовестный сотрудник саппорта может использовать доступ к глобальному реестру проводок (слив базы конкурентам, шантаж клиентов, оценка оборота бизнеса).
3. Правила маскирования данных (PAN карт, IP-адреса, личные данные).,
  },
  {
    role: 'Fintech & Double-Entry Ledger System Architect',
    model: 'z-ai/glm-5.2:free',
    fallbackModels: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-lightning:free'],
    focus: 'Классификация типов бухгалтерских проводок (Customer Ledger vs Platform Ledger)',
    systemPrompt: Ты — Главный финтех-архитектор двойной записи и Ledger-систем.
Твоя задача — классифицировать типы проводок в БД на:
1. Клиентские проводки (Customer-Facing Ledger: PAYMENT_CREDIT, ORDER_DEBIT, ORDER_REFUND, MANUAL_COMPENSATION, BONUS_CREDIT) — доступны саппорту в контексте 1 клиента.
2. Системные проводки платформы (Platform-Only Ledger: PROVIDER_PAYOUT, GATEWAY_COMMISSION, OPEX_EXPENSE, ESCROW_HOLD, OWNER_DIVIDEND, INTER-TENANT_TRANSFER) — СТРОГО скрыты от саппорта.
Дай четкую матрицу доступа (Role-Permission Matrix) для каждого типа проводки.,
  },
  {
    role: 'Russian Legal & 152-FZ / 54-FZ Compliance Auditor',
    model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    fallbackModels: ['nvidia/nemotron-3.5-lightning:free', 'google/gemma-4-31b-it:free'],
    focus: 'Юридические требования к логированию действий персонала и защите персональных данных',
    systemPrompt: Ты — Юрисконсульт по финтеху и защите данных (152-ФЗ, 54-ФЗ, банковская тайна).
Твоя задача — сформулировать правила соблюдения 152-ФЗ и аудита действий поддержки при просмотре финансовых проводок.
1. Требование Read-Audit (логирование того, какой сотрудник просматривал проводки какого клиента).
2. Недопустимость массовой выгрузки (запрет CSV-экспорта проводок для саппорта).
3. Четкие регламенты для саппорта при спорах по чекам 54-ФЗ.,
  }
];

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string, fallbacks: string[] = []): Promise<string> {
  const modelsToTry = [model, ...fallbacks];
  for (const m of modelsToTry) {
    try {
      console.log(📡 Запрос к модели: ...);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': Bearer ,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Ledger Swarm Audit',
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500,
        })
      });

      if (!res.ok) {
        const errTxt = await res.text();
        console.warn(⚠️ Модель  вернула статус : );
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content && content.trim().length > 0) {
        return content.trim();
      }
    } catch (e: any) {
      console.warn(⚠️ Ошибка подключения к : );
    }
  }
  return 'Не удалось получить ответ от моделей роя.';
}

async function runSwarm() {
  console.log('🐝 ЗАПУСК РОЯ АГЕНТОВ: АУДИТ ДОСТУПНОСТИ ПРОВОДОК ДЛЯ САППОРТА (OpenRouter)\n');
  const results: ExpertResult[] = [];

  for (const exp of SWARM_EXPERTS) {
    console.log(\n======================================================);
    console.log(🎭 ЭКСПЕРТ: );
    console.log(🎯 ФОКУС: );
    console.log(======================================================);

    const userPrompt = Проведи детальный аудит доступности финансовых проводок для роли SUPPORT в SaaS/API платформе OmniSMM (SMMplan / SMMflux).
Что саппорт ОБЯЗАН видеть для работы, а что КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО показывать? Оформи экспертное заключение с четкими списками и рекомендациями.;

    const verdict = await callOpenRouter(exp.model, exp.systemPrompt, userPrompt, exp.fallbackModels);
    console.log(\n\n);

    results.push({
      role: exp.role,
      model: exp.model,
      focus: exp.focus,
      verdict,
    });
  }

  const reportPath = path.resolve(process.cwd(), 'scripts/harness/support-ledger-access-swarm-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(\n💾 Отчет роя сохранен: );
}

runSwarm().catch(console.error);
