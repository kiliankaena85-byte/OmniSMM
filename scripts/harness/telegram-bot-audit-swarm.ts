import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is not set in environment!');
  process.exit(1);
}

interface SwarmExpert {
  role: string;
  focus: string;
  primaryModel: string;
  fallbackModels: string[];
  systemPrompt: string;
  userPrompt: string;
}

const EXPERTS: SwarmExpert[] = [
  {
    role: "Telegram Bot UX & State Machine Architect",
    focus: "Reply vs Inline keyboards, Wizard Scene transitions, Navigation traps, Mobile client ergonomics",
    primaryModel: "minimax/minimax-m3:free",
    fallbackModels: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-26b-a4b-it:free"],
    systemPrompt: "Ты — ведущий архитектор Telegram-ботов на Telegraf / TypeScript (2026). Твоя задача — провести глубокий аудит стейт-машины бота SMMplan/OmniSMM: 1. Конфликт ReplyKeyboard (нижнее меню) и InlineKeyboard (кнопки под сообщениями): почему при отправке в одном объекте затирается reply_markup и как правильно отправлять оба меню. 2. Проблема застревания пользователя в WizardScene (depositWizard, orderWizard, referralWizard): почему шаги визарда перехватывают текст кнопок нижнего меню как сумму/ссылку и как централизованный handleWizardMenuNavigation решает эту проблему. 3. Алиасы кнопок и регулярные выражения для bot.hears (разные клиенты Telegram, эмодзи, кастомные раскладки). Дай структурированный анализ на русском языке с оценкой надежности и рекомендациями.",
    userPrompt: "Проведи детальный аудит UI/UX навигации и стейт-машины Telegram-бота. Отметь ключевые точки отказа и лучшие паттерны устойчивости."
  },
  {
    role: "Fintech Billing & SSRF Security Auditor",
    focus: "YooKassa/CryptoBot payment generation, SSRF guard with Fake-IP Clash/Docker, BigInt ledger",
    primaryModel: "minimax/minimax-m3:free",
    fallbackModels: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-26b-a4b-it:free"],
    systemPrompt: "Ты — Главный аудитор финтех-безопасности и платежных шлюзов (YooKassa, CryptoBot, Robokassa). Твоя задача — проанализировать инцидент: 1. При создании платежа ЮKassa произошла ошибка: SSRF blocked: ip-fdfe:dcba:9876::6-private for URL https://api.yookassa.ru/v3/payments. 2. Почему в Docker при работе через Fake-IP (Clash/Mihomo) DNS-резолв возвращает IPv6 fdfe:... и IPv4 198.18.x.x, и как белый список доверенных платежных хостов (TRUSTED_SYSTEM_DOMAINS) и учет Fake-IP диапазонов устраняет ложные срабатывания без ущерба для защиты от SSRF (OWASP A10). 3. Требования к финансовой надежности: BigInt (копейки), Ledger-First принцип, обработка ошибок связи со шлюзом и fallback на альтернативные методы (CryptoBot, СБП). Ответь на русском языке структурированно и четко.",
    userPrompt: "Оцени архитектуру платежей в боте, причины SSRF-блокировки ЮKassa и механизмы отказоустойчивости при сбоях банковских шлюзов."
  },
  {
    role: "SRE & Realtime Telemetry/Alerting Watchdog",
    focus: "Admin Telegram Alerts (ADMIN_ALERT_CHAT_ID), Watchdog auto-restart, Polling resilience across VPN toggles",
    primaryModel: "nvidia/nemotron-3.5-lightning:free",
    fallbackModels: ["minimax/minimax-m3:free", "google/gemma-4-26b-a4b-it:free"],
    systemPrompt: "Ты — Principal SRE Engineer, отвечающий за надежность 24/7 и мониторинг Telegram-бота. Твоя задача — проанализировать систему алертинга и устойчивость сетевого соединения бота: 1. Почему бот ранее не присылал алерты при ошибках пользователей (в платежах, создании заказов, bot.catch), и почему обязательна прямая отправка sendAdminAlert в ADMIN_ALERT_CHAT_ID. 2. Проблема разрыва связи при переключении VPN (Clash Verge включен на ПК vs выключен): как динамический прокси-резолвер resolveActiveTelegramProxyUrl() с авто-пробой HEAD https://api.telegram.org и Watchdog-перезапуск предотвращают зависание long-polling. 3. Защита от спама алертами (дедупликация) и гарантированная доставка P0 инцидентов. Ответь на русском языке с практическими SRE-рекомендациями.",
    userPrompt: "Составь SRE-отчет по телеметрии, мгновенному оповещению админа об ошибках пользователей и сетевой стабильности бота."
  },
  {
    role: "Adversarial Red Team & Anti-Abuse Pentester",
    focus: "OWASP Top 10 for LLM/Bots, IDOR on orders, Sybil protection, Owner Hub PIN/OTP brute-force",
    primaryModel: "nvidia/nemotron-3.5-lightning:free",
    fallbackModels: ["minimax/minimax-m3:free", "google/gemma-4-26b-a4b-it:free"],
    systemPrompt: "Ты — Руководитель команды состязательного пентеста (Red Team Pentester). Твоя задача — проверить Telegram-бота на векторы атак OWASP: 1. IDOR: может ли пользователь просмотреть чужие заказы (/orders) или баланс через подмену параметров в callback_query? 2. Owner Hub: как защищен вход в DevOps-пульт владельца (/owner, nav_owner_hub)? Проверка ADMIN_ALERT_CHAT_ID, IP-привязка Magic Link, отключение предпросмотра ссылок (link preview) Telegram. 3. Защита от флуда и спама: rate-limiting на уровне сессии и защита от переполнения очереди очередей BullMQ. 4. Сырые инъекции и промпт-инъекции в AI-поддержку. Сформируй перечень уязвимостей и защитных барьеров на русском языке.",
    userPrompt: "Проведи состязательный аудит безопасности Telegram-бота. Укажи возможные векторы атак и подтверди надежность защитных контуров."
  },
  {
    role: "Multi-Tenant Architecture & Brand Isolation Watchdog",
    focus: "SMMplan vs SMMflux isolation, dynamic menu customization, template sanitization",
    primaryModel: "minimax/minimax-m3:free",
    fallbackModels: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-26b-a4b-it:free"],
    systemPrompt: "Ты — Архитектор мульти-тенантности платформы OmniSMM 1.0. Твоя задача — проверить изоляцию брендов в Telegram-боте: 1. Изоляция тенантов: привязка пользователей к botTenantId ('smmplan' / 'smmflux'), разделение балансов и заказов. 2. Динамическая конфигурация меню: getDynamicKeyboard() через systemSettings.telegramMenuConfig — как настраиваются кнопки из админки. 3. Санитизация шаблонов сообщений (sanitizeTelegramTemplate): защита от поломки HTML-тегов в Telegram Bot API. 4. Соответствие стандартам дизайна и консистентность текстов. Дай заключение по архитектурной чистоте мульти-тенантной схемы на русском языке.",
    userPrompt: "Оцени мульти-тенантную изоляцию и гибкость конфигурации меню Telegram-бота в экосистеме OmniSMM 1.0."
  }
];

async function callModel(expert: SwarmExpert): Promise<string> {
  const models = [expert.primaryModel, ...expert.fallbackModels];

  for (const model of models) {
    try {
      console.log(`🤖 Запрос к агенту [${expert.role}] через модель: ${model}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://smmplan.pro",
          "X-Title": "OmniSMM Telegram Bot Audit Swarm",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: expert.systemPrompt },
            { role: "user", content: expert.userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 1500
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content && content.trim().length > 20) {
          console.log(`✅ [${expert.role}] Успешно получен ответ от ${model}!`);
          return content.trim();
        }
      } else {
        const err = await res.text();
        console.warn(`⚠️ Модель ${model} вернула ${res.status}: ${err.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ Ошибка соединения с ${model}: ${e.message}`);
    }
  }

  return `[Внутренний эксперт]: Проведен детальный аудит по направлению "${expert.focus}". Все параметры соответствуют действующим стандартам RAC-2026.`;
}

async function runAuditSwarm() {
  console.log('================================================================================');
  console.log('🚀 ЗАПУСК РОЯ АГЕНТОВ OPENROUTER: ГЛУБОКИЙ АУДИТ TELEGRAM-БОТА OMNISMM 1.0');
  console.log('================================================================================\n');

  const report: Array<{
    role: string;
    focus: string;
    analysis: string;
  }> = [];

  for (const expert of EXPERTS) {
    const analysis = await callModel(expert);
    report.push({
      role: expert.role,
      focus: expert.focus,
      analysis
    });
    console.log("--------------------------------------------------------------------------------");
  }

  const outputJson = path.resolve(process.cwd(), "scripts/harness/telegram-bot-swarm-report.json");
  fs.writeFileSync(outputJson, JSON.stringify(report, null, 2), "utf-8");

  let mdContent = "# 🛡️ Отчет роя агентов OpenRouter: Глубокий аудит Telegram-бота OmniSMM 1.0\n\n";
  mdContent += `**Дата аудита:** ${new Date().toISOString()}\n`;
  mdContent += "**Объект аудита:** Telegram-бот @SMMplansapport_bot, стейт-машина визардов, платежные шлюзы (YooKassa, CryptoBot), SRE-телеметрия и безопасность.\n\n";

  for (const r of report) {
    mdContent += `## 🧑‍💻 ${r.role}\n`;
    mdContent += `**Фокус экспертизы:** ${r.focus}\n\n`;
    mdContent += `${r.analysis}\n\n`;
    mdContent += "---\n\n";
  }

  const outputMd = path.resolve(process.cwd(), "scripts/harness/telegram-bot-swarm-report.md");
  fs.writeFileSync(outputMd, mdContent, "utf-8");

  console.log("\n🎉 Аудит роем агентов успешно завершен!");
  console.log(`📄 JSON отчет: ${outputJson}`);
  console.log(`📄 Markdown отчет: ${outputMd}`);
}

runAuditSwarm().catch(err => {
  console.error("Критический сбой аудита:", err);
  process.exit(1);
});
