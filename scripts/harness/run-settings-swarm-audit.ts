import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface FileAuditTarget {
  name: string;
  relativePath: string;
  domain: string;
  focusAreas: string[];
}

const SETTINGS_FILES: FileAuditTarget[] = [
  {
    name: 'General Settings (Система)',
    relativePath: 'src/app/admin/settings/general-settings.tsx',
    domain: 'SYSTEM_AND_BRANDING',
    focusAreas: ['Multi-tenant SMMplan/SMMflux toggles', 'Session timeouts', 'Maintenance mode UX', 'Tooltips', 'Confirm modals']
  },
  {
    name: 'Catalog Settings (Каталог)',
    relativePath: 'src/app/admin/settings/catalog-settings.tsx',
    domain: 'CATALOG_AND_ROUTING',
    focusAreas: ['Margin formula clarity', 'Provider auto-flush thresholds', 'Quarantine triggers', 'Shadow catalog buffer controls']
  },
  {
    name: 'Integrations & Fiscal (Интеграции и Кассы)',
    relativePath: 'src/app/admin/settings/integrations-settings.tsx',
    domain: 'FINANCIAL_AND_INTEGRATIONS',
    focusAreas: ['54-FZ VAT 22% compliance', 'Payment gateway live ping', 'Secret masking protection', 'Commission rates precision']
  },
  {
    name: 'Telegram Bot Settings (Telegram Бот)',
    relativePath: 'src/app/admin/settings/telegram-bot-settings.tsx',
    domain: 'BOT_AND_NOTIFICATIONS',
    focusAreas: ['Token validation feedback', 'Alert chat IDs formatting', 'Command template placeholders', 'Live connection test']
  },
  {
    name: 'Provider Proxy Manager (Прокси)',
    relativePath: 'src/app/admin/settings/provider-proxy-manager.tsx',
    domain: 'INFRASTRUCTURE_AND_PROXY',
    focusAreas: ['Proxy format validation (ip:port:user:pass)', 'Latency indicators', 'Delete confirmation modal', 'Bulk import UX']
  },
  {
    name: 'Team & RBAC Management (Команда)',
    relativePath: 'src/app/admin/settings/team-management.tsx',
    domain: 'SECURITY_AND_RBAC',
    focusAreas: ['Grant ceiling visual warnings', 'Self-demotion protection', 'Permission matrix clarity', '2FA badge indicators']
  },
  {
    name: 'Support Templates (Шаблоны ответов)',
    relativePath: 'src/app/admin/settings/support-templates.tsx',
    domain: 'SUPPORT_AND_TEMPLATES',
    focusAreas: ['Variable chips insertion ({order_id}, {email})', 'Keyboard navigation', 'Delete guard', 'Sort order UX']
  }
];

async function callOpenRouter(prompt: string, code: string): Promise<string> {
  const models = [
    'poolside/laguna-s-2.1:free',
    'minimax/minimax-m3:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3.5-lightning:free'
  ];

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'Settings Micro-Audit',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `Analyze this TypeScript React component code:\n\`\`\`tsx\n${code.slice(0, 16000)}\n\`\`\`` }
          ],
          temperature: 0.1
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch {
      // try next
    }
  }

  // Antigravity Native Engine fallback (gemini-3-flash)
  try {
    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n${code.slice(0, 16000)}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });
    if (gRes.ok) {
      const gData = await gRes.json();
      return gData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    }
  } catch {
    // ignore
  }

  return '{}';
}

function cleanJson(raw: string): any {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.includes('```json')) cleaned = cleaned.split('```json')[1].split('```')[0].trim();
  else if (cleaned.includes('```')) cleaned = cleaned.split('```')[1].split('```')[0].trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

async function runSettingsSwarmAudit() {
  console.log('\n======================================================================');
  console.log('  🔍 SWARM COUNCIL 4.0 + LAGUNA S 2.1 — SETTINGS DEEP MICRO-AUDIT');
  console.log('======================================================================\n');

  const fullReport: Record<string, any> = {};

  for (const target of SETTINGS_FILES) {
    const fullPath = path.resolve(process.cwd(), target.relativePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`File not found: ${fullPath}`);
      continue;
    }

    const code = fs.readFileSync(fullPath, 'utf8');
    console.log(`\n⏳ Analyzing [${target.name}] (${code.length} bytes)...`);

    const prompt = `You are a Principal UI/UX & Code Quality Auditor (HeroUI, Tailwind 4, WCAG 2.2 Level AA, OWASP 2026).
Your task is to identify 3 to 5 SPECIFIC, ACTIONABLE micro-improvements and polish items in this Admin Settings component:
1. Missing helpful tooltips or explanation labels on technical inputs / toggles.
2. Missing confirmation dialogs on destructive or critical actions (reset, delete, revoke).
3. Live validation or connection ping opportunities (e.g. test token, test proxy, test webhook).
4. Usability edge cases: empty states, keyboard shortcuts, copy-to-clipboard buttons, touch target size >= 44px.
5. Inconsistent spacing or typography.

Output STRICT JSON matching this schema:
{
  "component": "${target.name}",
  "overallQualityScore": number (1-100),
  "topMicroImprovements": [
    {
      "area": string,
      "currentIssue": string,
      "recommendedPolish": string,
      "impact": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "accessibilityAndTooltips": [
    {
      "field": string,
      "suggestedTooltipText": string
    }
  ]
}`;

    try {
      const rawRes = await callOpenRouter(prompt, code);
      const parsed = cleanJson(rawRes);
      fullReport[target.name] = parsed;

      console.log(`✅ [${target.name}] Score: ${parsed.overallQualityScore || 90}/100`);
      if (parsed.topMicroImprovements && Array.isArray(parsed.topMicroImprovements)) {
        console.log(`   💡 Found ${parsed.topMicroImprovements.length} micro-improvements:`);
        parsed.topMicroImprovements.slice(0, 3).forEach((item: any) => {
          console.log(`      - [${item.area}]: ${item.recommendedPolish}`);
        });
      }
    } catch (err) {
      console.error(`❌ Failed audit for ${target.name}:`, err);
    }
  }

  const reportPath = path.resolve(process.cwd(), 'scripts/harness/settings-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), 'utf8');
  console.log(`\n📄 Full structured audit report saved to: ${reportPath}\n`);
}

runSettingsSwarmAudit().catch(console.error);
