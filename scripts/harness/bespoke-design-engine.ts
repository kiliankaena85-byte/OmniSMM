/**
 * 🎨 ANTIGRAVITY BESPOKE PRODUCT DESIGN HARNESS v1.0 (Zero-Slop & Anti-Template Engine)
 *
 * Харнес уникального продуктового дизайна, уничтожающий шаблонные ИИ-клише:
 * ❌ БАН 1: "Неоновый фиолетовый/циановый на черном" (Purple on Dark Cliché)
 * ❌ БАН 2: "Бенто-сетка, набитая случайными иконками и эмодзи" (Icon-Stuffed Bento)
 * ❌ БАН 3: "Пилюля с пульсирующей точкой над H1" (Biscuit Pill Cliché)
 * ❌ БАН 4: "Размытые фоновые цветные круги-пятна" (Blob Mesh Overuse)
 * ❌ БАН 5: "Градиентный текст поперек всех ключевых слов" (Gradient Keyword Fatigue)
 *
 * ✅ ВМЕСТО ЭТОГО — 6 Уникальных дизайн-ДНК и физических метафор:
 *  1. Swiss Kinetic Precision (Швейцарская сетка, строгая гротескная типографика, плотная тактильность)
 *  2. High-Frequency Financial Terminal (Эстетика терминалов Bloomberg/Linear, монохромные контрасты, чистые данные)
 *  3. Tactile Industrial Hardware (Физические переключатели, фрезерованные фаски, текстуры анодированного алюминия)
 *  4. Neo-Editorial Luxury (Журнальная эстетика, драматические типографические контрасты, асимметричный ритм)
 *  5. Obsidian Monolith (Глубокий монохром, игра матовых и зеркальных фактур, микро-грани света)
 *  6. Bio-Mechanical Precision (Органические пружинные физики, кинетические ползунки, кастомные индикаторы)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DesignMetaphorDNA {
  id: string;
  name: string;
  philosophy: string;
  palette: {
    canvas: string;
    surface: string;
    surfaceElevated: string;
    inkPrimary: string;
    inkSecondary: string;
    accent: string;
    accentSecondary?: string;
    border: string;
  };
  typography: {
    displayFont: string;
    bodyFont: string;
    monoFont: string;
    trackingDisplay: string;
    displayWeight: string;
  };
  texturesAndSurfaces: string;
  interactionMechanics: string[];
  forbiddenElements: string[];
}

export const BESPOKE_DESIGN_METAPHORS: DesignMetaphorDNA[] = [
  {
    id: 'swiss-kinetic',
    name: 'Swiss Kinetic Precision',
    philosophy: 'Абсолютная типографическая ясность, вдохновленная швейцарской школой дизайна (Max Bill, Josef Müller-Brockmann). Никаких цветных неонов — фокус на микро-типографике, бескомпромиссной сетке и кинетическом отклике.',
    palette: {
      canvas: '#F4F4F0', // Теплый минеральный холст (Off-white / Warm Gray)
      surface: '#FFFFFF',
      surfaceElevated: '#EBEBE5',
      inkPrimary: '#0C0D0E', // Глубокий типографический графит
      inkSecondary: '#5A5E65',
      accent: '#E63946', // Сигнальный швейцарский кармин (точечно для главных действий)
      border: 'rgba(12, 13, 14, 0.08)',
    },
    typography: {
      displayFont: 'PP Neue Montreal / Inter Tight / Manrope',
      bodyFont: 'Inter',
      monoFont: 'JetBrains Mono',
      trackingDisplay: '-0.04em',
      displayWeight: '800',
    },
    texturesAndSurfaces: 'Матовые бумажные фактуры, ультратонкие 0.5px сетки-разделители, полное отсутствие дешевых блюров и светящихся кругов.',
    interactionMechanics: [
      'Тактильные переключатели с механическим щелчком (haptic snap)',
      'Интерактивная лента заказов в виде биржевой бегущей строки с точными временными метками',
      'Калькулятор объема с оцифрованной шкалой миллиметровых рисок',
    ],
    forbiddenElements: [
      'Неоновые градиенты',
      'Размытые цветные пятна на фоне',
      'Пилюли с пульсирующими точками',
      'Иконки в разноцветных кружочках',
    ],
  },
  {
    id: 'high-freq-terminal',
    name: 'High-Frequency SMM Terminal (Linear Pro Style)',
    philosophy: 'Эстетика сверхбыстрых торговых систем и профессиональных инженерных консолей. Каждый пиксель служит передаче данных. Экстремальная плотность, матовый графит и точечный янтарный/титановый акцент.',
    palette: {
      canvas: '#0B0C0E', // Глубокий графитовый титан
      surface: '#13151A',
      surfaceElevated: '#1C1F26',
      inkPrimary: '#F1F3F7',
      inkSecondary: '#8B929E',
      accent: '#FF8A00', // Тактильный янтарный индикатор (Amber Hardware)
      accentSecondary: '#00E5A3', // Сигнальный зеленый для подтвержденных транзакций
      border: 'rgba(255, 255, 255, 0.07)',
    },
    typography: {
      displayFont: 'Geist / Space Grotesk',
      bodyFont: 'Geist / Inter',
      monoFont: 'Geist Mono / Fira Code',
      trackingDisplay: '-0.03em',
      displayWeight: '700',
    },
    texturesAndSurfaces: 'Фрезерованные фаски 1px, субпиксельные внутренние тени inset, тончайшие разделители, 0% визуального шума.',
    interactionMechanics: [
      'Горячие клавиши (Keyboard-First навигация: 1..7 для выбора соцсети)',
      'Мгновенный ввод ссылок с авто-определением платформы (Telegram/VK/YT)',
      'Живой стрим пропускной способности провайдеров в виде ASCII/SVG спарклайнов',
    ],
    forbiddenElements: [
      'Фиолетовый неон',
      'Случайные смайлики и декоративные эмодзи',
      'Градиентный текст',
      'Круглые мультяшные кнопки',
    ],
  },
  {
    id: 'neo-editorial-luxury',
    name: 'Neo-Editorial High-Trust Architecture',
    philosophy: 'Премиальный закрытый клуб. Сочетание благородной современной антиквы/гротеска с архитектурной асимметрией. Позиционирует сервис не как дешевую "накрутку", а как элитное агентское медиа-продвижение для брендов и селебрити.',
    palette: {
      canvas: '#0D0E11', // Угольный обсидиан
      surface: '#15171D',
      surfaceElevated: '#1E2129',
      inkPrimary: '#FAF8F5', // Теплый благородный фарфор
      inkSecondary: '#9A9CA3',
      accent: '#D4AF37', // Приглушенное шампанское / матовое золото
      border: 'rgba(212, 175, 55, 0.15)',
    },
    typography: {
      displayFont: 'Playfair Display / Fraunces / Instrument Serif + Plus Jakarta Sans',
      bodyFont: 'Plus Jakarta Sans',
      monoFont: 'JetBrains Mono',
      trackingDisplay: '-0.02em',
      displayWeight: '600',
    },
    texturesAndSurfaces: 'Золотое сечение, микро-тиснение, тонкие золотисто-платиновые фаски, благородный минимализм.',
    interactionMechanics: [
      'Плавные кинематографические карточки с раскрытием кейсов',
      'Консьерж-селектор индивидуальных пакетов роста',
      'Интерактивная карта медиа-охватов с мягкой подсветкой',
    ],
    forbiddenElements: [
      'Игровые тапалки и кричащие баннеры',
      'Неоновые фиолетовые трубки',
      'Стандартные иконки из бесплатных паков',
    ],
  },
];

export class BespokeDesignEngine {
  /**
   * Генерация бескомпромиссного промпта без шаблонов и клише для Stitch / Designer Agent
   */
  public static generateAntiSlopPrompt(metaphorId: string = 'swiss-kinetic', targetProduct: string = 'SMMplan Pro'): string {
    const dna = BESPOKE_DESIGN_METAPHORS.find((m) => m.id === metaphorId) || BESPOKE_DESIGN_METAPHORS[0];

    return `
================================================================================
STRICT BESPOKE DESIGN CONTRACT: ${dna.name.toUpperCase()} (ANTI-CLICHE DIRECTIVE)
================================================================================

PRODUCT: ${targetProduct} — Next-Generation Social Media Growth & Infrastructure Engine.
DESIGN METAPHOR: ${dna.name}
PHILOSOPHY: ${dna.philosophy}

🛑 ABSOLUTE ZERO-TOLERANCE BANNED PATTERNS (DO NOT GENERATE ANY OF THESE):
${dna.forbiddenElements.map((f) => `❌ FORBIDDEN: ${f}`).join('\n')}
❌ FORBIDDEN: Cheap purple/cyan glow on black (NO generic neon SMM template).
❌ FORBIDDEN: Unrelated icon-stuffed bento boxes.
❌ FORBIDDEN: Pulsing green dot biscuit pills above headlines.
❌ FORBIDDEN: Full-screen rainbow gradients or muddy background mesh blobs.

🎨 PALETTE & MATERIAL ARCHITECTURE:
- Canvas/Base: ${dna.palette.canvas}
- Surface Layer: ${dna.palette.surface}
- Elevated Layer: ${dna.palette.surfaceElevated}
- Primary Ink (High-contrast typography): ${dna.palette.inkPrimary}
- Secondary Ink: ${dna.palette.inkSecondary}
- Surgical Accent (Used ONLY for conversion triggers): ${dna.palette.accent}
- Structural Borders: ${dna.palette.border} (Ultra-fine 0.5px - 1px hairline precision)

✍️ TYPOGRAPHIC SCALE & RHYTHM:
- Display Headline: ${dna.typography.displayFont}, weight ${dna.typography.displayWeight}, tracking ${dna.typography.trackingDisplay}
- Body Text: ${dna.typography.bodyFont} (High legibility, leading-relaxed, text-wrap: balance)
- Metrics & Values: ${dna.typography.monoFont} with tabular-nums for instant numeric readability

📐 BESPOKE LAYOUT & INTERACTIVE COMPONENTS:
1. HEADER:
   - Ultra-minimalist navigation with monolithic brand mark.
   - Live Infrastructure Metric: "Engine Latency 1.2ms • 100% Direct Carrier Dispatch".
   - Minimalist "Sign In / Launch" tactile button.

2. HERO ARCHITECTURE (Functional Masterpiece):
   - Left Column (55%): Asymmetrical editorial headline focused on business velocity, zero drop guarantee, and direct API routing.
   - Right Column (45%): Bespoke Interactive Sandbox:
     * Custom platform selector with tactile millwork tabs.
     * Tactile stepped quantity slider with calibrated mechanical tick-marks.
     * Real-time transparent pricing per unit (strictly "0.18 ₽ / шт").
     * One-stroke tactile submit trigger with instant haptic state.

3. SOCIAL PROOF & INFRASTRUCTURE TELEMETRY:
   - High-density live telemetry ticker showing real-time anonymized order routing and throughput.
   - Trust markers: 54-FZ Automated Receipting, 152-FZ Sovereign Data Protection.

4. BESPOKE FEATURE CHASSIS (Not a generic bento):
   - Asymmetrical architectural panels showcasing Direct Routing Engine, Auto-Refill Mechanics, and Instant SBP Settlement.

5. TIERED WHOLESALE & RETAIL MATRIX:
   - Precision comparison table with monolithic typography, clear per-unit unit economics, and feature matrices.
================================================================================
`.trim();
  }
}

async function main() {
  console.log('\n==================================================================');
  console.log('💎 ANTIGRAVITY BESPOKE DESIGN ENGINE (Anti-Template Fleet)');
  console.log('==================================================================\n');

  console.log('Доступные уникальные дизайн-ДНК:');
  BESPOKE_DESIGN_METAPHORS.forEach((m, idx) => {
    console.log(`  ${idx + 1}. \x1b[36m${m.name}\x1b[0m — ${m.philosophy.slice(0, 80)}...`);
  });

  const promptSwiss = BespokeDesignEngine.generateAntiSlopPrompt('swiss-kinetic');
  const promptTerminal = BespokeDesignEngine.generateAntiSlopPrompt('high-freq-terminal');
  const promptLuxury = BespokeDesignEngine.generateAntiSlopPrompt('neo-editorial-luxury');

  const outDir = path.resolve(process.cwd(), '.planning/bespoke-design');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, 'prompt_swiss_kinetic.txt'), promptSwiss, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'prompt_high_freq_terminal.txt'), promptTerminal, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'prompt_neo_editorial.txt'), promptLuxury, 'utf-8');

  console.log(`\n✅ Сгенерированы 3 уникальных бескомпромиссных промпта в: \x1b[34m${outDir}\x1b[0m\n`);
}

if (require.main === module) {
  main();
}
