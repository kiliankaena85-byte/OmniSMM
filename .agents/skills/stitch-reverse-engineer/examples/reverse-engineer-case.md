# Example: Reverse Engineering a Reference Pricing Table

## Input Reference: Modern High-Density SaaS Pricing

### 1. Extracted Color Palette
- Canvas: `#090d16` (Deep Midnight Blue)
- Card Surface: `#111827` with 1px border `#1e293b`
- Primary Highlight: `#6366f1` (Indigo 500)
- Badge Accent: `#10b981` (Emerald 500) for "Popular"
- Text Primary: `#f8fafc`, Secondary: `#94a3b8`

### 2. Extracted Grid & Spacing
- 3-Column Grid on desktop (gap-6), 1-Column stack on mobile (gap-4).
- Featured center tier elevated by 8px with `border-indigo-500/80` and subtle glow.
- Pricing figure: `text-4xl font-bold tracking-tight font-mono`.

### 3. Generated Stitch Prompt
```markdown
Generate a high-density 3-tier SaaS pricing table in High-Frequency Financial Terminal aesthetic:
- Viewport: Desktop 1440px / Mobile 375px responsive.
- Color Palette: Midnight dark theme (#090d16 canvas, #111827 cards, #6366f1 accent).
- Tiers: Starter ($19/mo), Pro ($49/mo, Featured with Popular badge), Enterprise ($149/mo).
- Feature Matrix: 6 bullet points per tier with checkmark icons, no icon-stuffed clutter.
- Action Buttons: High-contrast 48px full-width buttons. Pro tier has glowing primary CTA.
```

### 4. Generated `.stitch/DESIGN.md` Slice
```markdown
## Extracted Tokens
--color-surface-base: #090d16;
--color-surface-card: #111827;
--color-accent-primary: #6366f1;
--radius-card: 16px;
--font-display: "Inter", -apple-system, sans-serif;
```
