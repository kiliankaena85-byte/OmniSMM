import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryModel(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  console.log(`[OpenRouter] Запрос к ${model}...`);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Settings Multi-Model Audit',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

async function main() {
  console.log('🚀 Запуск состязательного аудита всех вкладок /admin/settings...');

  const pageCode = fs.readFileSync('src/app/admin/settings/page.tsx', 'utf8');
  const generalCode = fs.readFileSync('src/app/admin/settings/general-settings.tsx', 'utf8');
  const catalogCode = fs.readFileSync('src/app/admin/settings/catalog-settings.tsx', 'utf8');
  const integrationsCode = fs.readFileSync('src/app/admin/settings/integrations-settings.tsx', 'utf8');
  const telegramCode = fs.readFileSync('src/app/admin/settings/telegram-bot-settings.tsx', 'utf8');
  const proxyCode = fs.readFileSync('src/app/admin/settings/provider-proxy-manager.tsx', 'utf8');
  const teamCode = fs.readFileSync('src/app/admin/settings/team-management.tsx', 'utf8');
  const templatesCode = fs.readFileSync('src/app/admin/settings/support-templates.tsx', 'utf8');

  const context = `
ПРОЕКТ: OmniSMM 1.0 (Dual-Brand SMM: smmplan.pro & smmflux.ru)
ОБЪЕКТ: Модуль глобальных настроек /admin/settings и все 8 вкладок:
1. System (general-settings.tsx, test-mode-panel)
2. Catalog (catalog-settings.tsx)
3. Integrations (integrations-settings.tsx)
4. Telegram Bot (telegram-bot-settings.tsx)
5. Provider Proxies (provider-proxy-manager.tsx)
6. Team Management (team-management.tsx)
7. Support Templates (support-templates.tsx)
8. Audit Log (audit-columns.tsx)

СВОДНЫЙ КОД ВКЛАДОК:
=== PAGE.TSX ===
${pageCode}

=== GENERAL SETTINGS ===
${generalCode.slice(0, 3000)}

=== CATALOG SETTINGS ===
${catalogCode.slice(0, 3000)}

=== INTEGRATIONS SETTINGS ===
${integrationsCode.slice(0, 3500)}

=== TELEGRAM BOT SETTINGS ===
${telegramCode.slice(0, 3000)}

=== TEAM MANAGEMENT ===
${teamCode.slice(0, 3000)}
`;

  const prompt = `
Проведи глубокий состязательный аудит всех вкладок /admin/settings и составь премортем-анализ:

1. 🔍 Аудит верстки и горизонтального скролла (Zero Column Clipping & Viewport 100% Fit):
   - Проверь все flex-контейнеры, таблицы, табы, поля ввода ключей и карточки.
   - Есть ли переполнение ширины на экранах 1024px-1440px?
   - Где не хватает truncate, min-w-0 или адаптивного переноса flex-wrap?

2. ⚙️ Функциональный аудит (Работоспособность и заглушки):
   - Проверь каждую настройку: сохраняются ли данные в БД через Server Actions / SettingsService?
   - Есть ли фейковые кнопки, TODO-заглушки или неработающие тумблеры?
   - Как обрабатываются маскированные секретные ключи (••••••••••••)? Не затираются ли они при сохранении?

3. 🛡️ Безопасность и RBAC:
   - Разграничение прав на изменение критических настроек (API ключи, тестовый режим, роли сотрудников).
   - Защита от утечки секретов в клиентский HTML/бандл.

4. 💀 Премортем-анализ (Failure Simulation - Таблица рисков):
   - Составь таблицу минимум из 5 сценариев гипотетических сбоев с вероятностью, влиянием и защитными механизмами.

5. 📋 Конкретный план необходимых правок с файлами и строками.
`;

  const models = [
    { name: 'MiniMax M3', id: 'minimax/minimax-m3:free' },
    { name: 'GLM-5.2 Free', id: 'z-ai/glm-5.2:free' },
    { name: 'Nvidia Nemotron 550B', id: 'nvidia/nemotron-3-ultra-550b-a55b:free' }
  ];

  let auditDone = false;
  for (const m of models) {
    try {
      console.log(`\n⏳ Опрос модели ${m.name} (${m.id})...`);
      const res = await queryModel(
        m.id,
        'Ты — Principal Architect & Security Auditor платформы OmniSMM 1.0. Предоставь бескомпромиссный аудит на русском языке.',
        context + '\n\n' + prompt
      );
      if (res && res.length > 200) {
        fs.writeFileSync('scripts/harness/SETTINGS_AUDIT_REPORT.md', `# 🛡️ ОТЧЁТ АУДИТА НАСТРОЕК (/admin/settings)\n\n**Модель:** ${m.name}\n**Дата:** ${new Date().toISOString()}\n\n${res}`, 'utf8');
        console.log(`✅ Аудит успешно выполнен моделью ${m.name} (${res.length} символов)!`);
        auditDone = true;
        break;
      }
    } catch (err: any) {
      console.warn(`⚠️ Модель ${m.name} вернула ошибку: ${err.message}`);
    }
  }

  if (!auditDone) {
    console.error('Не удалось получить ответ ни от одной модели OpenRouter');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
