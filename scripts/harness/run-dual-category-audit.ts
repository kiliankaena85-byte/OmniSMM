import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryModel(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  console.log(`[OpenRouter] Запрос к модели ${model}...`);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Deep Category Audit',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 3500
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
  console.log('🚀 Запуск глубокого аудита управления соцсетями и категориями через OpenRouter...');

  const categoryActions = fs.readFileSync('src/actions/admin/catalog/categories.ts', 'utf8');
  const categoryPage = fs.readFileSync('src/app/admin/catalog/categories/page.tsx', 'utf8');
  const categoryManagerUI = fs.readFileSync('src/app/admin/catalog/categories/components/category-manager.tsx', 'utf8');

  const context = `
ПРОЕКТ: OmniSMM 1.0 (API/B2C SMM платформа: smmplan.pro и smmflux.ru)
ОБЪЕКТ АУДИТА: Экран и логика управления соцсетями и категориями (/admin/catalog/categories).

КОД КОМПОНЕНТОВ:

=== 1. SERVER ACTIONS (src/actions/admin/catalog/categories.ts) ===
${categoryActions}

=== 2. СЕРВЕРНАЯ СТРАНИЦА (src/app/admin/catalog/categories/page.tsx) ===
${categoryPage}

=== 3. КЛИЕНТСКИЙ ИНТЕРФЕЙС УПРАВЛЕНИЯ (src/app/admin/catalog/categories/components/category-manager.tsx) ===
${categoryManagerUI}
`;

  const prompt = `
Проведи глубокий технический и состязательный аудит (Security, Architecture, UX, Multi-Tenancy) функционала создания и редактирования социальных сетей и категорий:

1. 🛡️ Безопасность и RBAC:
   - Проверка прав доступа requireStaffPermission('CATALOG', 'edit') на каждое действие.
   - Защита от IDOR при удалении и слиянии категорий.
   - Аудит всех действий через auditAdminAwaitable с фиксацией oldValue и newValue.
   - Обработка исключений и типизированные ответы без падения сервера.

2. 🏢 Мультитенантность (Multi-Tenant Isolation):
   - Разделение и фильтрация по tenantId (smmplan, flux, all).
   - Защита от утечки категорий и услуг между разными брендами.
   - Корректная инвалидация тегов кэша (catalog, services, catalog-smmplan, catalog-flux).

3. 🔄 Целостность данных и каскадные операции:
   - Защита от удаления соцсетей/категорий, содержащих активные услуги (Delete Block / Safety Guard).
   - Атомарность операции слияния категорий (mergeCategoriesAction) и перенос связанных услуг.
   - Валидация Zod: санитизация slug, запрет дубликатов, обязательные поля предупреждений.

4. 🎨 UX & Операционная надежность UI:
   - Плотность отображения данных (No horizontal scroll, компактные отступы).
   - Индикация загрузки (loading spinners), обработка пустых состояний.
   - Удобство поиска, создания на лету и редактирования соцсетей/категорий.

5. 📊 Итоговое заключение:
   - Оценка зрелости (1-10) по каждому направлению.
   - Таблица выявленных сильных сторон, потенциальных краевых случаев и рекомендаций.
`;

  const models = [
    { name: 'MiniMax M3', id: 'minimax/minimax-m3:free' },
    { name: 'GLM-5.2 Free', id: 'z-ai/glm-5.2:free' }
  ];

  const results: Record<string, string> = {};

  for (const m of models) {
    try {
      console.log(`\n⏳ Опрос модели ${m.name} (${m.id})...`);
      const res = await queryModel(
        m.id,
        'Ты — ведущий состязательный архитектор безопасности и Principal Engineer платформы OmniSMM. Предоставь глубокий, профессиональный и бескомпромиссный аудит на русском языке.',
        context + '\n\n' + prompt
      );
      if (res && res.length > 200) {
        results[m.name] = res;
        console.log(`✅ Ответ получен от ${m.name} (${res.length} символов)!`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Ошибка при запросе к ${m.name}: ${err.message}`);
    }
  }

  // Сохраняем объединенный отчет
  let reportMarkdown = `# 🛡️ ОТЧЁТ ДВУХКОМПОНЕНТНОГО АУДИТА: MINIMAX M3 & GLM-5.2\n\n`;
  reportMarkdown += `**Дата аудита:** ${new Date().toISOString()}\n`;
  reportMarkdown += `**Объект:** /admin/catalog/categories (Создание, редактирование, слияние и удаление соцсетей и категорий)\n\n`;

  for (const [mName, mContent] of Object.entries(results)) {
    reportMarkdown += `## 🤖 Вердикт аудита от ${mName}\n\n${mContent}\n\n---\n\n`;
  }

  fs.writeFileSync('scripts/harness/DUAL_CATEGORY_AUDIT_REPORT.md', reportMarkdown, 'utf8');
  console.log('📄 Итоговый отчет сохранен в scripts/harness/DUAL_CATEGORY_AUDIT_REPORT.md');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
