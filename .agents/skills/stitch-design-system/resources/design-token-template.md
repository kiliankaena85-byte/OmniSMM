# Canonical DESIGN.md Token Template for Stitch

```markdown
# [Brand Name] Design System Specification

## 1. Color Palette (OKLCH & Hex)
- Background Base: #080b14 (oklch(0.12 0.02 260))
- Surface Card: #0f172a (oklch(0.18 0.03 260))
- Surface Card Hover: #1e293b (oklch(0.24 0.04 260))
- Border Subtle: #334155 / 0.8 (oklch(0.35 0.04 260))
- Primary Accent: #a855f7 (oklch(0.62 0.25 300))
- Secondary Accent: #ec4899 (oklch(0.65 0.23 340))
- Text Primary: #f8fafc (oklch(0.98 0.01 260))
- Text Muted: #94a3b8 (oklch(0.70 0.02 260))

## 2. Typography Hierarchy
- Font Family Body: "Inter", system-ui, sans-serif
- Font Family Monospace: "JetBrains Mono", monospace
- Scale:
  - Hero Display: 40px / 1.1 / font-extrabold tracking-tight
  - Section Title: 24px / 1.2 / font-bold tracking-tight
  - Card Title: 16px / 1.3 / font-semibold
  - Body Text: 14px / 1.5 / font-normal
  - Micro / Meta: 12px / 1.4 / font-medium

## 3. Radii & Elevation
- Radius Small: 8px (rounded-lg)
- Radius Medium: 12px (rounded-xl)
- Radius Card / Modal: 16px (rounded-2xl)
- Elevation: soft diffuse shadows (0 4px 20px rgba(0,0,0,0.25))

## 4. Layout Constraints
- Max Container Width: 1280px (max-w-7xl)
- Grid Gutters: 16px mobile, 24px desktop
- Minimum Touch Target: 44px
```
