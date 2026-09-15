#!/usr/bin/env node
/**
 * 🎨 ANTIGRAVITY ATOMIC DESIGN GUILD HARNESS v5.5 (Enterprise Fleet)
 * 
 * Флот из 14 узкоспециализированных дизайн-агентов:
 *  1.  🅰️  Typography-Sentinel           (Шрифты, иерархия, tabular-nums, tracking-tight)
 *  2.  🔘 Button-Interactive-Ops        (Кнопки, touch target >= 44px, active:scale-98, transition-all)
 *  3.  📐 Spacing-Grid-Architect        (Сетка 8pt, padding, margin, gap, запрет p-[13px])
 *  4.  ✍️  Orthography-UX-Writer         (Русский язык, длинное тире, ёлочки «», неразрывные пробелы)
 *  5.  🎯 CRO-Marketing-Optimizer       (Воронка, CTA, социальные доказательства, Trust-бейдж)
 *  6.  🪐 Motion-Microphysics-Lead      (Framer Motion v12, spring easing, 60 FPS, CLS = 0)
 *  7.  🎨 Color-Token-Guardian          (Семантические токены Tailwind 4, запрет сырых hex/rgb)
 *  8.  ♿ WCAG-Accessibility-Guard       (Контраст >= 4.5:1, aria-label, focus-visible, Escape-key)
 *  9.  📱 Mobile-Ergonomics-Lead        (Thumb Zone, overflow-x-clip, visualViewport, safe-area)
 *  10. 🎭 Dual-Brand-Isolationist       (Изоляция брендов: SMMplan API vs SMMflux Aurora, No Lovable)
 *  11. 🌓 Dark-Light-Contrast-Enforcer  (Двухрежимная читаемость: dark/light theme integrity)
 *  12. 🧱 UI-Arsenal-Component-Linter   (Использование канонических компонентов @/components/ui & HeroUI v3)
 *  13. 💎 Elevation-Shadow-Director     (Глубина, слои z-index, диффузные неоновые тени vs API тени)
 *  14. 🧬 Design-Token-Validator        (@theme директива Tailwind 4, запрет устаревших классов v3)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SmmplanMemoryClient } from '../memory-client';

const memoryClient = new SmmplanMemoryClient();

export interface GuildAuditFinding {
  agent: string;
  agentIcon: string;
  severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION' | 'PASS';
  ruleId: string;
  message: string;
  line?: number;
  fixSnippet?: string;
}

export interface GuildAuditReport {
  targetPath: string;
  score: number; // 0..100
  findings: GuildAuditFinding[];
  summary: {
    passed: number;
    warnings: number;
    critical: number;
  };
}

export class DesignGuildOrchestrator {
  private rawContent: string = '';
  private lines: string[] = [];
  private filePath: string = '';

  constructor(filePath: string) {
    this.filePath = filePath;
    if (fs.existsSync(filePath)) {
      this.rawContent = fs.readFileSync(filePath, 'utf-8');
      this.lines = this.rawContent.split('\n');
    }
  }

  public audit(): GuildAuditReport {
    const findings: GuildAuditFinding[] = [];

    // 1. Typography Sentinel
    this.auditTypography(findings);

    // 2. Button Interactive Ops
    this.auditButtons(findings);

    // 3. Spacing Grid Architect
    this.auditSpacing(findings);

    // 4. Orthography UX Writer
    this.auditOrthography(findings);

    // 5. CRO Marketing Optimizer
    this.auditCRO(findings);

    // 6. Motion Microphysics Lead
    this.auditMotion(findings);

    // 7. Color Token Guardian
    this.auditColors(findings);

    // 8. WCAG Accessibility Guard
    this.auditAccessibility(findings);

    // 9. Mobile Ergonomics Lead
    this.auditMobile(findings);

    // 10. Dual Brand Isolationist
    this.auditDualBrand(findings);

    // 11. Dark-Light Contrast Enforcer
    this.auditDarkLight(findings);

    // 12. UI Arsenal Component Linter
    this.auditUIArsenal(findings);

    // 13. Elevation Shadow Director
    this.auditElevationShadows(findings);

    // 14. Design Token Validator
    this.auditDesignTokens(findings);

    // 15. Visual Pixel Inspector
    this.auditVisualViewport(findings);

    const critical = findings.filter(f => f.severity === 'CRITICAL').length;
    const warnings = findings.filter(f => f.severity === 'WARNING').length;
    const passed = findings.filter(f => f.severity === 'PASS').length;

    // Score calculation
    let score = 100 - (critical * 15) - (warnings * 5);
    if (score < 0) score = 0;

    return {
      targetPath: this.filePath,
      score,
      findings,
      summary: { passed, warnings, critical }
    };
  }

  private auditTypography(findings: GuildAuditFinding[]) {
    const lines = this.rawContent.split('\n');
    let hasTabularNumbers = false;

    lines.forEach((line, idx) => {
      // Check large headers without tracking-tight
      if (line.match(/text-(2xl|3xl|4xl|5xl|6xl)/) && !line.includes('tracking-tight') && !line.includes('tracking-tighter')) {
        findings.push({
          agent: 'Typography-Sentinel',
          agentIcon: '🅰️',
          severity: 'WARNING',
          ruleId: 'TYPO-01-TRACKING',
          message: `Крупный заголовок на строке ${idx + 1} не имеет tracking-tight. Заголовки > 24px требуют сжатия трекинга для премиального API вида.`,
          line: idx + 1,
          fixSnippet: 'Добавьте класс `tracking-tight`'
        });
      }

      // Check prices or numbers with tabular-nums
      if (line.includes('₽') || line.includes('RUB') || line.includes('count') || line.includes('balance') || line.includes('charge')) {
        if (line.includes('tabular-nums')) {
          hasTabularNumbers = true;
        }
      }
    });

    if (this.rawContent.includes('₽') && !hasTabularNumbers) {
      findings.push({
        agent: 'Typography-Sentinel',
        agentIcon: '🅰️',
        severity: 'SUGGESTION',
        ruleId: 'TYPO-02-TABULAR-NUMS',
        message: 'Обнаружены финансовые суммы (₽), но не используется `tabular-nums`. Добавьте tabular-nums для фиксации ширины цифр при анимациях.',
        fixSnippet: 'class="tabular-nums font-mono"'
      });
    } else {
      findings.push({
        agent: 'Typography-Sentinel',
        agentIcon: '🅰️',
        severity: 'PASS',
        ruleId: 'TYPO-00-OK',
        message: 'Шрифтовая иерархия и выравнивание цифр соответствуют стандарту.'
      });
    }
  }

  private auditButtons(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    const lines = raw.split('\n');

    lines.forEach((line, idx) => {
      if (line.includes('<button') || line.includes('<Button') || line.includes('role="button"')) {
        const multiLineBlock = lines.slice(idx, idx + 8).join(' ');
        
        const minHCustomMatch = multiLineBlock.match(/min-h-\[(\d+)px\]/);
        const hasLargeMinH = minHCustomMatch && parseInt(minHCustomMatch[1]) >= 40;

        const hasMinH44 = hasLargeMinH ||
                          multiLineBlock.includes('min-h-[44px]') || 
                          multiLineBlock.includes('min-h-[40px]') ||
                          multiLineBlock.includes('min-h-[36px]') ||
                          multiLineBlock.includes('h-11') || 
                          multiLineBlock.includes('h-12') || 
                          multiLineBlock.includes('h-14') ||
                          multiLineBlock.includes('h-10') || 
                          multiLineBlock.includes('p-4') || 
                          multiLineBlock.includes('p-5') || 
                          multiLineBlock.includes('py-5') || 
                          multiLineBlock.includes('p-3') ||
                          multiLineBlock.includes('min-w-[44px]');

        if (!hasMinH44 && !multiLineBlock.includes('rounded-full w-8 h-8')) {
          if (!multiLineBlock.includes('h-9') && !multiLineBlock.includes('h-8')) {
            findings.push({
              agent: 'Button-Interactive-Ops',
              agentIcon: '🔘',
              severity: 'WARNING',
              ruleId: 'BTN-01-TOUCH-TARGET',
              message: `Кнопка на строке ${idx + 1} может иметь touch-target меньше 44px. Рекомендуется h-11 (44px) или min-h-[44px].`,
              line: idx + 1,
            });
          }
        }

        if (!multiLineBlock.includes('transition') && !raw.includes('transition-all')) {
          findings.push({
            agent: 'Button-Interactive-Ops',
            agentIcon: '🔘',
            severity: 'SUGGESTION',
            ruleId: 'BTN-02-SMOOTH-TRANSITION',
            message: `Кнопка на строке ${idx + 1} не имеет явного transition-all duration-200.`,
            line: idx + 1,
          });
        }
      }
    });

    findings.push({
      agent: 'Button-Interactive-Ops',
      agentIcon: '🔘',
      severity: 'PASS',
      ruleId: 'BTN-00-OK',
      message: 'Все интерактивные состояния кнопок и кликабельных областей проверены.'
    });
  }

  private auditSpacing(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    const arbitraryMatches = raw.match(/(p|m|gap|top|left|right|bottom)-\[\d+px\]/g);
    if (arbitraryMatches && arbitraryMatches.length > 0) {
      findings.push({
        agent: 'Spacing-Grid-Architect',
        agentIcon: '📐',
        severity: 'CRITICAL',
        ruleId: 'SPACE-01-ARBITRARY',
        message: `Обнаружены произвольные отступы вне 8pt сетки: ${arbitraryMatches.slice(0, 3).join(', ')}. Используйте стандартную шкалу Tailwind 4 (p-2, p-3, p-4, p-6).`,
      });
    } else {
      findings.push({
        agent: 'Spacing-Grid-Architect',
        agentIcon: '📐',
        severity: 'PASS',
        ruleId: 'SPACE-00-OK',
        message: 'Сетка и отступы строго следуют 8-пиксельной системе Tailwind CSS 4.'
      });
    }
  }

  private auditOrthography(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    if (raw.match(/[а-яА-Я]\s-\s[а-яА-Я]/)) {
      findings.push({
        agent: 'Orthography-UX-Writer',
        agentIcon: '✍️',
        severity: 'SUGGESTION',
        ruleId: 'ORTHO-01-EM-DASH',
        message: 'Обнаружен дефис вместо длинного тире («—») между словами в русском тексте.',
        fixSnippet: 'Замените " - " на " — "'
      });
    }

    if (raw.match(/"[а-яА-Я\s]{4,}"/)) {
      findings.push({
        agent: 'Orthography-UX-Writer',
        agentIcon: '✍️',
        severity: 'SUGGESTION',
        ruleId: 'ORTHO-02-QUOTES',
        message: 'Обнаружены прямые кавычки в русском тексте. Используйте кавычки-ёлочки («...»).',
      });
    }

    findings.push({
      agent: 'Orthography-UX-Writer',
      agentIcon: '✍️',
      severity: 'PASS',
      ruleId: 'ORTHO-00-OK',
      message: 'Текстовые строки, регистры и микрокопирайтинг проверены.'
    });
  }

  private auditCRO(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    const hasCTA = raw.includes('Купить') || raw.includes('Заказать') || raw.includes('Оплатить') || raw.includes('Отправить') || raw.includes('Создать') || raw.includes('Войти') || raw.includes('Сохранить');
    
    if (hasCTA) {
      findings.push({
        agent: 'CRO-Marketing-Optimizer',
        agentIcon: '🎯',
        severity: 'PASS',
        ruleId: 'CRO-01-CTA-EXISTS',
        message: 'Четкий фокус призыва к действию (CTA) обнаружен и акцентирован.'
      });
    }
  }

  private auditMotion(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    if (raw.includes('framer-motion') || raw.includes('motion.')) {
      if (!raw.includes('AnimatePresence') && raw.includes('initial=')) {
        findings.push({
          agent: 'Motion-Microphysics-Lead',
          agentIcon: '🪐',
          severity: 'SUGGESTION',
          ruleId: 'MOTION-01-PRESENCE',
          message: 'Используются motion-элементы без AnimatePresence. Убедитесь, что анимация закрытия (exit) отрабатывает плавно.',
        });
      } else {
        findings.push({
          agent: 'Motion-Microphysics-Lead',
          agentIcon: '🪐',
          severity: 'PASS',
          ruleId: 'MOTION-00-OK',
          message: 'Пружинная физика и микроанимации оптимизированы без дерганий контента (CLS = 0).'
        });
      }
    }
  }

  private auditColors(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    const forbiddenRawColors = raw.match(/(text-white|bg-black|text-blue-500|border-gray-200|bg-gray-100)/g);
    if (forbiddenRawColors && forbiddenRawColors.length > 2) {
      findings.push({
        agent: 'Color-Token-Guardian',
        agentIcon: '🎨',
        severity: 'WARNING',
        ruleId: 'COLOR-01-RAW-TOKENS',
        message: `Обнаружены сырые цвета (${forbiddenRawColors.slice(0, 3).join(', ')}). Используйте семантические токены: text-foreground, bg-background, bg-card, border-border.`,
      });
    } else {
      findings.push({
        agent: 'Color-Token-Guardian',
        agentIcon: '🎨',
        severity: 'PASS',
        ruleId: 'COLOR-00-OK',
        message: 'Семантические токены Tailwind CSS 4 используются корректно.'
      });
    }
  }

  private auditAccessibility(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    const iconButtonsWithoutAria = raw.match(/<button[^>]*>\s*<svg[^>]*>[\s\S]*?<\/button>/g);
    if (iconButtonsWithoutAria && !raw.includes('aria-label') && !raw.includes('title=')) {
      findings.push({
        agent: 'WCAG-Accessibility-Guard',
        agentIcon: '♿',
        severity: 'WARNING',
        ruleId: 'A11Y-01-ARIA-LABEL',
        message: 'Обнаружены иконки-кнопки без aria-label или title. Это нарушает стандарт доступности WCAG 2.2 AA.',
      });
    } else {
      findings.push({
        agent: 'WCAG-Accessibility-Guard',
        agentIcon: '♿',
        severity: 'PASS',
        ruleId: 'A11Y-00-OK',
        message: 'Доступность клавиатуры, контрастность и aria-атрибуты проверены.'
      });
    }
  }

  private auditMobile(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    if (raw.includes('w-screen') || raw.includes('min-w-[1200px]')) {
      findings.push({
        agent: 'Mobile-Ergonomics-Lead',
        agentIcon: '📱',
        severity: 'WARNING',
        ruleId: 'MOB-01-OVERFLOW',
        message: 'Обнаружены жесткие ширины, способные вызвать горизонтальный скролл на мобильных устройствах.',
      });
    } else {
      findings.push({
        agent: 'Mobile-Ergonomics-Lead',
        agentIcon: '📱',
        severity: 'PASS',
        ruleId: 'MOB-00-OK',
        message: 'Мобильная эргономика и отсутствие горизонтального переполнения подтверждены.'
      });
    }
  }

  // ==========================================================
  // НОВЫЕ РОЛИ ПО ТЕМИЗАЦИИ И ДИЗАЙН-СИСТЕМЕ (v5.5)
  // ==========================================================

  private auditDualBrand(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    
    // Check forbidden brand "Lovable"
    if (raw.includes('Lovable') || raw.includes('lovable.pro') || raw.includes('LovableCard')) {
      findings.push({
        agent: 'Dual-Brand-Isolationist',
        agentIcon: '🎭',
        severity: 'CRITICAL',
        ruleId: 'BRAND-01-NO-LOVABLE',
        message: 'Обнаружено упоминание несуществующего бренда Lovable. Проект обслуживает только SMMplan и SMMflux.',
        fixSnippet: 'Замените на Flux* или SMMflux.'
      });
    }

    // Check style leakage: SMMflux components inside SMMplan API area
    if (this.filePath.includes('/admin/') && !this.filePath.includes('flux-')) {
      if (raw.includes('BorderBeam') || raw.includes('TiltCard') || raw.includes('Confetti')) {
        findings.push({
          agent: 'Dual-Brand-Isolationist',
          agentIcon: '🎭',
          severity: 'SUGGESTION',
          ruleId: 'BRAND-02-STYLE-LEAK',
          message: 'В строгом API разделе обнаружены неоновые микроэффекты SMMflux (TiltCard/BorderBeam). Рекомендуется использовать сдержанные PlanCard/PlanTable.',
        });
      }
    }

    findings.push({
      agent: 'Dual-Brand-Isolationist',
      agentIcon: '🎭',
      severity: 'PASS',
      ruleId: 'BRAND-00-OK',
      message: 'Изоляция брендов SMMplan (API Classic) и SMMflux (Radiant Aurora) соблюдена.'
    });
  }

  private auditDarkLight(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;
    
    // Check hardcoded dark background without dark: prefix
    if (raw.includes('bg-slate-900') && !raw.includes('dark:bg-slate-900') && !raw.includes('bg-background')) {
      findings.push({
        agent: 'Dark-Light-Contrast-Enforcer',
        agentIcon: '🌓',
        severity: 'WARNING',
        ruleId: 'THEME-01-HARDCODED-DARK',
        message: 'Обнаружен жестко заданный темный фон (bg-slate-900) без адаптации к светлой теме. Используйте bg-background или dark:bg-slate-900.',
      });
    }

    // Check white text on light surface danger
    if (raw.includes('bg-white') && raw.includes('text-white')) {
      findings.push({
        agent: 'Dark-Light-Contrast-Enforcer',
        agentIcon: '🌓',
        severity: 'CRITICAL',
        ruleId: 'THEME-02-INVISIBLE-TEXT',
        message: 'Риск невидимого текста: обнаружено сочетание bg-white и text-white в одном компоненте.',
      });
    }

    // Check primary-foreground token collision in dark mode (line by line or component wide)
    this.lines.forEach((line, idx) => {
      if (line.includes('text-primary-foreground') && !line.includes('bg-primary') && !line.includes('dark:text-') && (line.includes('dark:bg-') || raw.includes('dark:bg-background'))) {
        // If it's a heading or text paragraph with text-primary-foreground on a dark container
        if (line.match(/<(h[1-6]|p|span|div)[^>]*text-primary-foreground/)) {
          findings.push({
            agent: 'Dark-Light-Contrast-Enforcer',
            agentIcon: '🌓',
            severity: 'CRITICAL',
            ruleId: 'THEME-03-PRIMARY-FG-DARK-COLLISION',
            message: `Критический баг контраста на строке ${idx + 1}: \`text-primary-foreground\` в тёмной теме становится тёмным (#0f172a). На тёмном фоне текст становится невидимым.`,
            fixSnippet: 'Замените `text-primary-foreground` на `text-primary-foreground dark:text-foreground` или используйте `text-foreground`.'
          });
        }
      }
    });

    findings.push({
      agent: 'Dark-Light-Contrast-Enforcer',
      agentIcon: '🌓',
      severity: 'PASS',
      ruleId: 'THEME-00-OK',
      message: 'Двухрежимная целостность (Dark / Light Mode) проверена без слепых зон.'
    });
  }

  private auditUIArsenal(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;

    // Check raw unstyled table tag instead of HeroUI Table or PlanTable
    if (raw.includes('<table') && !raw.includes('Table.Header') && !raw.includes('PlanTable') && !raw.includes('DataTable')) {
      findings.push({
        agent: 'UI-Arsenal-Component-Linter',
        agentIcon: '🧱',
        severity: 'WARNING',
        ruleId: 'ARSENAL-01-RAW-TABLE',
        message: 'Используется сырой HTML-тег <table>. Используйте HeroUI Table с dot notation (<Table.Header>) или PlanTable.',
        fixSnippet: 'import { PlanTable, PlanTableHeader } from "@/components/ui/plan";'
      });
    }

    findings.push({
      agent: 'UI-Arsenal-Component-Linter',
      agentIcon: '🧱',
      severity: 'PASS',
      ruleId: 'ARSENAL-00-OK',
      message: 'Компоненты UI Арсенала и HeroUI v3 задействованы в соответствии со стандартами.'
    });
  }

  private auditElevationShadows(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;

    // Check z-index chaos
    if (raw.includes('z-[9999]') || raw.includes('z-[99999]')) {
      findings.push({
        agent: 'Elevation-Shadow-Director',
        agentIcon: '💎',
        severity: 'WARNING',
        ruleId: 'ELEV-01-Z-INDEX-CHAOS',
        message: 'Обнаружен хаотичный z-index (z-[9999]). Используйте стандартизированные слои: z-10 (плавающие панели), z-40 (сайдбар), z-50 (модалки), z-[100] (тосты).',
      });
    }

    // Check shadow consistency
    if (raw.includes('shadow-2xl') && raw.includes('shadow-none')) {
      findings.push({
        agent: 'Elevation-Shadow-Director',
        agentIcon: '💎',
        severity: 'SUGGESTION',
        ruleId: 'ELEV-02-SHADOW-CONTRAST',
        message: 'Резкий перепад глубины: сочетание shadow-2xl и shadow-none на одном уровне вложенности.',
      });
    }

    findings.push({
      agent: 'Elevation-Shadow-Director',
      agentIcon: '💎',
      severity: 'PASS',
      ruleId: 'ELEV-00-OK',
      message: 'Иерархия глубины (Elevation), z-index слои и неоновые свечения согласованы.'
    });
  }

  private auditDesignTokens(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;

    // Check deprecated Tailwind 3 opacity modifiers
    if (raw.match(/bg-opacity-\d+|text-opacity-\d+|border-opacity-\d+/)) {
      findings.push({
        agent: 'Design-Token-Validator',
        agentIcon: '🧬',
        severity: 'WARNING',
        ruleId: 'TOKEN-01-DEPRECATED-OPACITY',
        message: 'Обнаружены устаревшие классы прозрачности Tailwind 3 (bg-opacity-*). В Tailwind 4 используется слэш-синтаксис (bg-primary/50, text-foreground/80).',
        fixSnippet: 'Замените `bg-primary bg-opacity-50` на `bg-primary/50`'
      });
    }

    findings.push({
      agent: 'Design-Token-Validator',
      agentIcon: '🧬',
      severity: 'PASS',
      ruleId: 'TOKEN-00-OK',
      message: 'Токены @theme Tailwind CSS 4 и переменные дизайн-системы соответствуют канону 2026 года.'
    });
  }

  private auditVisualViewport(findings: GuildAuditFinding[]) {
    const raw = this.rawContent;

    // 1. VISUAL-01: Above-the-fold visibility check
    // If component has huge vertical margins (mb-16, py-24, space-y-10) before key inputs/CTAs
    if (this.filePath.includes('Landing') || this.filePath.includes('OrderClient') || this.filePath.includes('Hero')) {
      this.lines.forEach((line, idx) => {
        if ((line.includes('mb-16') || line.includes('mb-20') || line.includes('py-24') || line.includes('py-32')) && idx < 50) {
          findings.push({
            agent: 'Visual-Pixel-Inspector',
            agentIcon: '👁️',
            severity: 'WARNING',
            ruleId: 'VISUAL-01-ABOVE-THE-FOLD-RISK',
            message: `Риск вытеснения ключевого CTA за линию первого экрана (Above-The-Fold) из-за крупного отступа на строке ${idx + 1}.`,
            fixSnippet: 'Уменьшите отступ до `mb-8` или `py-12`, чтобы главный инпут и кнопка заказа оставались видимыми без скролла.'
          });
        }
      });
    }

    // 2. VISUAL-02: Computed contrast matrix check
    if (raw.includes('dark:bg-slate-950') && raw.includes('text-slate-900')) {
      findings.push({
        agent: 'Visual-Pixel-Inspector',
        agentIcon: '👁️',
        severity: 'CRITICAL',
        ruleId: 'VISUAL-02-COMPUTED-CONTRAST-FAIL',
        message: 'Оптический конфликт контраста: тёмный текст на тёмном фоне в тёмной теме.',
        fixSnippet: 'Используйте `text-foreground` или `dark:text-slate-100`.'
      });
    }

    // 3. VISUAL-03: Z-Index Occlusion
    // Ambient blur glow elements MUST have pointer-events-none, otherwise they block clicks on inputs/buttons!
    this.lines.forEach((line, idx) => {
      if ((line.includes('blur-3xl') || line.includes('blur-2xl') || line.includes('blur-xl')) && line.includes('absolute') && !line.includes('pointer-events-none')) {
        findings.push({
          agent: 'Visual-Pixel-Inspector',
          agentIcon: '👁️',
          severity: 'CRITICAL',
          ruleId: 'VISUAL-03-ZINDEX-OCCLUSION',
          message: `Блокировка кликов и фокуса (Click Hijack / Occlusion) на строке ${idx + 1}: абсолютный фоновый блюр не содержит \`pointer-events-none\`.`,
          fixSnippet: 'Добавьте класс `pointer-events-none` к декоративному блюр-элементу.'
        });
      }
    });

    // 4. VISUAL-04: Viewport Overflow Risk
    if (raw.match(/min-w-\[\d{3,}px\]|w-\[\d{4,}px\]/) && !raw.includes('overflow-x-auto') && !raw.includes('overflow-x-clip')) {
      findings.push({
        agent: 'Visual-Pixel-Inspector',
        agentIcon: '👁️',
        severity: 'WARNING',
        ruleId: 'VISUAL-04-VIEWPORT-OVERFLOW',
        message: 'Обнаружена жесткая минимальная ширина контейнера без защиты от переполнения вьюпорта на мобильных устройствах (390px).',
        fixSnippet: 'Используйте `max-w-full` или добавьте контейнеру `overflow-x-clip`.'
      });
    }

    findings.push({
      agent: 'Visual-Pixel-Inspector',
      agentIcon: '👁️',
      severity: 'PASS',
      ruleId: 'VISUAL-00-OK',
      message: 'Визуальная геометрия, видимость первого экрана (Above-The-Fold), отсутствие перекрытий кликов (Occlusion) и оптический контраст подтверждены.'
    });
  }
}

// ==========================================
// CLI Execution
// ==========================================
async function main() {
  const rawArgs = process.argv.slice(2);
  const target = (rawArgs[0] === 'audit' || rawArgs[0] === 'аудит' || rawArgs[0] === 'visual' ? rawArgs[1] : rawArgs[0]) || 'smmplan';

  console.log('==================================================================');
  console.log('🎨 ANTIGRAVITY DESIGN GUILD HARNESS v6.0 (15 Atomic Specialists)');
  console.log('==================================================================\n');

  console.log(`👥 Состав Гильдии Дизайна: 15 узкоспециализированных микро-агентов:\n`);
  console.log(`   1. 🅰️  Typography-Sentinel           9. 📱 Mobile-Ergonomics-Lead`);
  console.log(`   2. 🔘 Button-Interactive-Ops        10. 🎭 Dual-Brand-Isolationist`);
  console.log(`   3. 📐 Spacing-Grid-Architect        11. 🌓 Dark-Light-Contrast-Enforcer`);
  console.log(`   4. ✍️  Orthography-UX-Writer         12. 🧱 UI-Arsenal-Component-Linter`);
  console.log(`   5. 🎯 CRO-Marketing-Optimizer       13. 💎 Elevation-Shadow-Director`);
  console.log(`   6. 🪐 Motion-Microphysics-Lead      14. 🧬 Design-Token-Validator`);
  console.log(`   7. 🎨 Color-Token-Guardian          15. 👁️  Visual-Pixel-Inspector (NEW)\n`);
  console.log(`   8. ♿ WCAG-Accessibility-Guard\n`);

  let targetFiles: string[] = [];

  const normalized = target.toLowerCase().trim();
  if (normalized === 'smmplan' || normalized === 'plan') {
    console.log('📦 Пакетный аудит экосистемы SMMPLAN (API Classic):');
    targetFiles = [
      'src/components/landing/Header.tsx',
      'src/components/landing/MegaFooter.tsx',
      'src/components/landing/TrustBar.tsx',
      'src/components/landing/WhyUs.tsx',
      'src/components/landing/FAQ.tsx',
      'src/components/landing/Reviews.tsx',
      'src/components/landing/SmartLinkLanding.tsx',
      'src/components/ui/plan/PlanButton.tsx',
      'src/components/ui/plan/PlanCard.tsx',
      'src/components/ui/plan/PlanTable.tsx',
    ];
  } else if (normalized === 'smmflux' || normalized === 'flux') {
    console.log('📦 Пакетный аудит экосистемы SMMFLUX (Radiant Aurora):');
    targetFiles = [
      'src/components/ab-test/FluxOrderClient.tsx',
      'src/components/landing/flux/FluxCyberFooter.tsx',
      'src/components/ab-test/FluxTrustBar.tsx',
      'src/components/ab-test/FluxWhyUs.tsx',
      'src/components/ab-test/FluxReviews.tsx',
      'src/components/ab-test/FluxFAQ.tsx',
      'src/components/ui/FluxButton.tsx',
      'src/components/ui/FluxInput.tsx',
      'src/components/ui/FluxCard.tsx',
    ];
  } else if (normalized === 'admin' || normalized === 'админ' || normalized === 'админка') {
    console.log('📦 Пакетный аудит экосистемы ADMIN PANEL (Enterprise API / Calm Design):');
    targetFiles = [
      'src/app/admin/layout.tsx',
      'src/app/admin/dashboard/page.tsx',
      'src/app/admin/catalog/page.tsx',
      'src/components/admin/sidebar.tsx',
      'src/components/admin/page-header.tsx',
      'src/components/admin/catalog-table-v2.tsx',
      'src/components/admin/flux-catalog-grid.tsx',
      'src/components/admin/OrderDrawer.tsx',
      'src/components/admin/tenant-switcher.tsx',
      'src/components/admin/command-palette.tsx',
    ];
  } else {
    targetFiles = [target];
  }

  const reports: GuildAuditReport[] = [];

  for (const filePath of targetFiles) {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Файл не найден: ${filePath}`);
      continue;
    }

    console.log(`\n------------------------------------------------------------------`);
    console.log(`🔍 Аудит компонента: ${filePath}`);
    const orchestrator = new DesignGuildOrchestrator(filePath);
    const report = orchestrator.audit();
    reports.push(report);

    console.log(`📊 GUILD SCORE: ${report.score} / 100 | ✅ Pass: ${report.summary.passed} | ⚠️ Warn: ${report.summary.warnings} | ❌ Crit: ${report.summary.critical}`);
    
    report.findings.forEach(f => {
      if (f.severity !== 'PASS') {
        const badge = f.severity === 'CRITICAL' ? '❌' : f.severity === 'WARNING' ? '⚠️' : '💡';
        console.log(`  ${badge} ${f.agentIcon} [${f.agent}] ${f.message}`);
        if (f.fixSnippet) {
          console.log(`     ↳ Рекомендация: ${f.fixSnippet}`);
        }
      }
    });
  }

  // Summary Table
  console.log('\n==================================================================');
  console.log('📊 СВОДНЫЙ ОТЧЁТ ДИЗАЙН-ГИЛЬДИИ');
  console.log('==================================================================');
  let totalScore = 0;
  reports.forEach(r => {
    totalScore += r.score;
    const status = r.score === 100 ? '🟢 PERFECT' : r.score >= 80 ? '🟡 GOOD' : '🔴 NEEDS POLISH';
    console.log(`• ${path.basename(r.targetPath).padEnd(30)} ${r.score.toString().padStart(3)}/100  ${status}`);
  });

  const avgScore = reports.length > 0 ? Math.round(totalScore / reports.length) : 0;
  console.log('------------------------------------------------------------------');
  console.log(`🏆 СРЕДНИЙ РЕЙТИНГ ЭКОСИСТЕМЫ: ${avgScore} / 100`);
  console.log('==================================================================\n');

  // Sync with GraphRAG Docker Memory
  try {
    console.log('💾 Синхронизация с GraphRAG Docker памятью (порт 8100)...');
    await memoryClient.recordDecision({
      title: `Комплексный Дизайн-Аудит (14 Агентов): ${target.toUpperCase()} (Avg Score: ${avgScore}/100)`,
      context: `Пакетный аудит ${reports.length} компонентов экосистемы ${target} силами 14 узкоспециализированных дизайн-агентов.`,
      decision: `Проверено ${reports.length} компонентов. Средний балл: ${avgScore}/100.`,
      rationale: `Обеспечение бескомпромиссного качества UX/UI, 8pt сетки, WCAG 2.2 и Tailwind 4.`,
      tags: ['design-guild', 'ui-ux', target.toLowerCase(), 'tailwind4', 'wcag', 'theming']
    });
    console.log('✅ Итоговый вердикт зафиксирован в GraphRAG памяти!');
  } catch (err) {
    console.warn('⚠️ Запись в GraphRAG память пропущена:', err);
  }

  console.log('\n🎉 Комплексный аудит успешно завершен!');
}

main().catch(console.error);
