/**
 * Antigravity Stitch-State Multi-Skill Pipeline Bridge
 *
 * Двунаправленный мост между анализом состояния (State/Playwright) и генеративным UI (StitchMCP):
 * 1. [State/Analyzer] -> Парсит и структурирует DOM, стили, формы и навигацию сайта-образца
 * 2. [Prompt Adapter] -> Компилирует структурированный промпт для генератора Stitch с дизайн-токенами
 * 3. [Stitch Generator] -> Формирует UI-спецификацию и визуальный макет
 * 4. [Reflector & Code Synth] -> Анализирует ответ Stitch, проводит валидацию и переводит в React 19 код
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SiteAnalysisData {
  title: string;
  url: string;
  hasSidebar: boolean;
  navSections: Array<{
    tag: string;
    links: Array<{ text: string; href: string }>;
  }>;
}

export interface StitchPromptSpec {
  projectId?: string;
  screenTitle: string;
  prompt: string;
  designSystemContext: string;
}

export class StitchPipelineBridge {
  /**
   * Слой 1: Адаптер промпта (State/Audit -> Structured Stitch Prompt)
   */
  public static adaptAuditToStitchPrompt(analysis: SiteAnalysisData, targetStyle: 'flux' | 'plan' = 'plan'): StitchPromptSpec {
    const totalLinks = analysis.navSections.reduce((acc, s) => acc + s.links.length, 0);
    const topCategories = analysis.navSections[0]?.links.slice(0, 8).map(l => l.text).join(', ') || 'Telegram, VK, Instagram, TikTok, YouTube';

    let designTokens = '';
    let visualStyle = '';

    if (targetStyle === 'flux') {
      visualStyle = 'Dark Neon Radiant Aurora theme with deep obsidian background (#090d16), frosted glass blur (24px), border-beam neon glow accents (cyan #00f2fe to purple #4facfe), 3D interactive tilt cards, and vibrant status badges.';
      designTokens = 'Tailwind 4 @theme semantic tokens: bg-background, bg-card/80, text-foreground, text-primary (#00f2fe), border-border with subtle neon glow.';
    } else {
      visualStyle = 'Enterprise Clean API SaaS theme (Linear/Vercel aesthetic) with high-density data presentation, 280px left collapsible sidebar, HUD top navbar with instant wallet balance, fluid 12-column grid, and tabular data tables.';
      designTokens = 'Tailwind 4 @theme tokens: bg-card (#ffffff / #12161f in dark), border-border, text-foreground, high WCAG 2.2 AA contrast, 48px touch targets.';
    }

    const structuredPrompt = `
Generate a high-fidelity Desktop SMM Dashboard screen based on "${analysis.title}" (${analysis.url}).

Layout Architecture:
1. Fixed Left Sidebar (280px):
   - Brand Logo & Header with status chip
   - Multi-platform navigation sections: ${topCategories}
   - Real-time Balance Widget with "+ Add Funds" CTA button
   - User Profile info and settings gear icon

2. Top HUD Bar (64px):
   - Quick platform switcher pills
   - Search bar for instant service filtering
   - Notification bell and account balance badge

3. Main Canvas (Fluid 12-Column Grid):
   - Hero banner featuring hot service categories (${topCategories})
   - Multi-platform service grid with pricing per unit (e.g. 0.18 ₽ / unit)
   - Fast 4-step Order Wizard (1. Platform -> 2. Category -> 3. Service -> 4. Target Link & Quantity)
   - Live order stream / recent transactions summary table

Visual Aesthetics:
- ${visualStyle}
- ${designTokens}
- Typography: Inter with tabular-nums for numeric rates and prices
`.trim();

    return {
      screenTitle: `SMM Dashboard (${analysis.title.split('|')[0].trim()})`,
      prompt: structuredPrompt,
      designSystemContext: targetStyle,
    };
  }

  /**
   * Слой 2: Чтение данных анализа из файловой системы
   */
  public static loadLatestAnalysis(customPath?: string): SiteAnalysisData {
    const analysisFilePath = customPath || path.resolve(process.cwd(), '.planning/screenshots/analysis_https___smmprime_ru.json');
    if (!fs.existsSync(analysisFilePath)) {
      throw new Error(`Файл анализа не найден по пути: ${analysisFilePath}`);
    }
    const raw = fs.readFileSync(analysisFilePath, 'utf-8');
    return JSON.parse(raw);
  }
}

async function main() {
  console.log('\n==================================================================');
  console.log('🌉 STITCH-STATE MULTI-SKILL PIPELINE BRIDGE v1.0');
  console.log('==================================================================\n');

  try {
    const analysis = StitchPipelineBridge.loadLatestAnalysis();
    console.log(`📥 Загружены данные анализа: \x1b[36m${analysis.title}\x1b[0m (${analysis.url})`);
    console.log(`📊 Сайдбар: ${analysis.hasSidebar ? 'Обнаружен' : 'Нет'} | Секций навигации: ${analysis.navSections.length}`);

    const stitchPlanSpec = StitchPipelineBridge.adaptAuditToStitchPrompt(analysis, 'plan');
    const stitchFluxSpec = StitchPipelineBridge.adaptAuditToStitchPrompt(analysis, 'flux');

    const outputDir = path.resolve(process.cwd(), '.planning/stitch');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'stitch_prompt_plan.json'), JSON.stringify(stitchPlanSpec, null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'stitch_prompt_flux.json'), JSON.stringify(stitchFluxSpec, null, 2), 'utf-8');

    console.log('\n✅ Сгенерирован структурированный контракт для Stitch:');
    console.log(`📁 Сохранено в: \x1b[34m${path.join(outputDir, 'stitch_prompt_plan.json')}\x1b[0m`);
    console.log('\n--- [ПРОМПТ ДЛЯ STITCH] ---');
    console.log(stitchPlanSpec.prompt);
    console.log('---------------------------\n');

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Ошибка моста: ${msg}`);
  }
}

if (require.main === module) {
  main();
}
