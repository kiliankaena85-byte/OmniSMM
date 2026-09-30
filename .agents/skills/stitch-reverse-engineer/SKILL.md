---
name: stitch-reverse-engineer
description: "Deconstructs screenshots, mockups, and live URLs into structured Google Stitch prompts, design token contracts, and layout blueprints."
metadata:
  tags:
    - google-stitch
    - reverse-engineering
    - vision-to-code
    - design-tokens
    - competitive-analysis
---

# stitch-reverse-engineer — Vision & Reference Deconstruction for Stitch

## 1. Overview & Purpose

Often the best starting point for a high-converting UI is a reference: a screenshot of a competitor's checkout, an award-winning dashboard, or a live URL.

`stitch-reverse-engineer` applies automated visual and structural deconstruction to extract:
1. **Color Palette & Contrast Tokens** (Surface, Accent, Border, Text).
2. **Typography Scale & Rhythm** (Font weights, line heights, letter-spacing).
3. **Spatial Grid & Information Density** (Padding hierarchy, column breaks).
4. **Interactive Component Primitives** (Cards, Badges, Tabs, Steppers).

The extracted data is synthesized directly into a **Google Stitch Design Brief** and a `.stitch/DESIGN.md` contract.

---

## 2. The 4-Layer Deconstruction Pipeline

```mermaid
flowchart TD
    Input[Screenshot / Figma / Live URL] --> L1[Layer 1: Visual Token Extractor]
    Input --> L2[Layer 2: Spatial & Grid Analyzer]
    Input --> L3[Layer 3: Information Architecture]
    L1 & L2 & L3 --> Synth[Layer 4: Stitch Brief Synthesizer]
    Synth --> Out1[DESIGN.md Token Contract]
    Synth --> Out2[Enhanced Stitch Prompt]
```

### Layer 1: Visual Token Extractor
- Ingests image or uses Playwright to snapshot computed styles.
- Quantizes dominant colors into OKLCH / HEX tokens.
- Checks text-to-background contrast ratios against WCAG 2.2 AA.

### Layer 2: Spatial & Grid Analyzer
- Identifies container boundaries (fixed vs fluid, multi-column split, sticky panels).
- Measures padding/margin intervals (4px, 8px, 12px, 16px, 24px).
- Categorizes density tier (`compact`, `standard`, `spacious`).

### Layer 3: Information Architecture
- Maps cognitive reading flow (F-pattern, Z-pattern, Gutenberg diagram).
- Identifies primary conversion funnel CTA and secondary controls.

### Layer 4: Stitch Brief Synthesizer
- Compiles findings into an enhanced prompt conforming to `stitch-prompt-enhancer`.
- Saves extracted tokens into `.stitch/DESIGN.md`.

---

## 3. Execution CLI

```bash
# Deconstruct an image reference
npx tsx scripts/stitch/stitch-reverse-engineer.ts --image ./references/checkout.png --output .stitch/

# Deconstruct a live web page
npx tsx scripts/stitch/stitch-reverse-engineer.ts --url https://example.com/pricing --output .stitch/
```
