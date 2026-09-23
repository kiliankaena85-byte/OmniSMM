import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryOpenRouter(model: string, systemPrompt: string, userPrompt: string, maxRetries = 5): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxRetries}] Querying ${model} via OpenRouter...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Category System Audit',
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

      if (res.status === 429) {
        console.warn(`[429 RateLimit] ${model} upstream busy, waiting ${attempt * 3}s...`);
        await new Promise(r => setTimeout(r, attempt * 3000));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        console.warn(`HTTP ${res.status}: ${text}`);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      console.warn(`Attempt ${attempt} error for ${model}:`, err.message);
      if (attempt === maxRetries) {
        // Try fallback model if available
        if (model.includes('free') && model !== 'openrouter/free') {
          console.log(`Falling back to openrouter/free...`);
          return queryOpenRouter('openrouter/free', systemPrompt, userPrompt, 2);
        }
        throw err;
      }
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  return '';
}

async function main() {
  console.log('🔍 Starting GLM-5.2 Deep Adversarial Audit of Category Management Architecture...');

  const categoryActions = fs.readFileSync('src/actions/admin/catalog/categories.ts', 'utf8');
  const categoryPage = fs.readFileSync('src/app/admin/catalog/categories/page.tsx', 'utf8');
  const categoryManager = fs.readFileSync('src/app/admin/catalog/categories/components/category-manager.tsx', 'utf8').slice(0, 5000);
  const adminLayout = fs.readFileSync('src/app/admin/layout.tsx', 'utf8').slice(0, 4000);
  const catalogPage = fs.readFileSync('src/app/admin/catalog/page.tsx', 'utf8').slice(0, 4000);

  const context = `
PROJECT: OmniSMM 1.0 (Multi-tenant SMM platform for smmplan.pro and smmflux.ru)
STACK: Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (Prisma ORM), Tailwind CSS 4.

AUDITED CODE:

1. CATEGORY SERVER ACTIONS (src/actions/admin/catalog/categories.ts):
\`\`\`typescript
${categoryActions}
\`\`\`

2. CATEGORY ADMIN PAGE (src/app/admin/catalog/categories/page.tsx):
\`\`\`typescript
${categoryPage}
\`\`\`

3. CATEGORY MANAGER UI COMPONENT (src/app/admin/catalog/categories/components/category-manager.tsx):
\`\`\`typescript
${categoryManager}
\`\`\`

4. ADMIN LAYOUT & NAVIGATION (src/app/admin/layout.tsx):
\`\`\`typescript
${adminLayout}
\`\`\`

5. CATALOG PAGE HEADER & QUICK ACTIONS (src/app/admin/catalog/page.tsx):
\`\`\`typescript
${catalogPage}
\`\`\`
`;

  const auditPrompt = `
Проведи строгий, глубокий и состязательный технический аудит (Adversarial Security & Architecture Audit) представленной системы управления категориями и соцсетями на платформе OmniSMM 1.0.

Оцени систему по следующим критическим направлениям:
1. **Безопасность и RBAC (OWASP / Broken Access Control / IDOR):**
   - Корректность guards requireStaffPermission('CATALOG', 'edit')
   - Аудит-логирование всех критических мутаций через auditAdminAwaitable
   - Безопасность при удалении и слиянии категорий (защита от сиротских услуг и потери данных)
2. **Мультитенантная изоляция (Multi-Tenant Isolation):**
   - Корректность обработки tenantId ('smmplan' | 'flux' | 'all') в БД и Server Actions
   - Изоляция фильтрации категорий на витринах
3. **UX и Доступность архитектуры (Information Architecture & User Journey):**
   - Вывод в главное боковое меню (Sidebar)
   - Точки быстрого входа из каталога и форм услуг
   - Валидация форм (название, slug, предупреждения для клиентов requireWarning, теги analyzerTags)
4. **Устойчивость к граничным условиям (Edge Cases & Fail-Closed):**
   - Пустые категории, дубликаты slug/name у соцсетей, слияние категории с самой собой
5. **Итоговый вердикт и таблица выявленных рисков (P0 / P1 / P2 / P3 / INFO).**

Формат ответа: детальный технический отчет на русском языке.
`;

  const models = ['z-ai/glm-5.2:free', 'z-ai/glm-5.2', 'thudm/glm-4-9b-chat:free', 'openrouter/free'];
  let report = '';

  for (const m of models) {
    try {
      console.log(`Trying model: ${m}...`);
      report = await queryOpenRouter(m, 'Ты — ведущий состязательный архитектор и специалист по безопасности веб-систем.', context + '\n\n' + auditPrompt);
      if (report && report.length > 200) {
        console.log(`✅ Received audit report from ${m} (${report.length} chars)!`);
        break;
      }
    } catch (e: any) {
      console.warn(`Model ${m} failed:`, e.message);
    }
  }

  if (!report) {
    throw new Error('All OpenRouter models failed to respond.');
  }

  const finalDoc = `# 🛡️ ОТЧЁТ СОСТЯЗАТЕЛЬНОГО АУДИТА: GLM-5.2 (OpenRouter)
**Объект аудита:** Архитектура управления категориями и соцсетями OmniSMM 1.0
**Дата проведения:** ${new Date().toISOString()}

${report}
`;

  fs.writeFileSync('scripts/harness/GLM_CATEGORY_AUDIT_REPORT.md', finalDoc, 'utf8');
  console.log('🎉 Report saved to scripts/harness/GLM_CATEGORY_AUDIT_REPORT.md');
}

main().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
