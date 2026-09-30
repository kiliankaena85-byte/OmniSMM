# Visual & Reference Extraction Rubric

When reverse engineering a reference UI for Google Stitch, systematically extract the following 6 layers:

---

## 1. Color Palette Matrix
- **Canvas / Background:** Base surface color in light and dark mode (e.g., `#070b14` vs `#ffffff`).
- **Surface Elevation:** Card background, hovered states, modal backdrop blur.
- **Primary Accent:** Brand CTA color, active border ring, selection tint.
- **Status Semantics:** Success (emerald/green), Warning (amber/gold), Error (rose/crimson).
- **Border Gradients:** Subtle border contrast ratio ($\ge 1.5:1$ against surface).

---

## 2. Spatial Rhythm (8pt Grid Standard)
- **Base Grid Unit:** 4px micro, 8px default.
- **Component Heights:**
  - Input field: `h-10` (40px) or `h-12` (48px)
  - Primary CTA: `h-12` (48px) or `h-14` (56px)
  - Table row: `h-10` (40px) compact or `h-12` (48px) standard
- **Container Padding:** Mobile `px-4`, Tablet `px-6`, Desktop `max-w-7xl px-8`.

---

## 3. Typography Scale & Weights
- **Heading Display:** Font family, tracking (e.g. `tracking-tight`), weight (700/800).
- **Body Text:** Size (14px / 15px), line-height (1.5 - 1.6), weight (400/500).
- **Tabular / Metric Data:** Monospace font (`font-mono`), tabular figures (`tabular-nums`).

---

## 4. Interactive Components & Micro-State Catalog
- Button hover states (translate, subtle glow, brightness shift).
- Tab switchers (underlined pill vs solid background segment).
- Input focus rings (ring-2 ring-primary/40 ring-offset-2).
