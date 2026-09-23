---
name: taste-skill
description: "Anti-slop frontend design taste skill for landing pages, portfolios, and web apps. Enforces design dials (VARIANCE, MOTION, DENSITY), bans AI-slop cliches (no purple neon glows, no centered hero over dark mesh, no generic bento grids), mandates real typography, deliberate color calibration, and micro-interactions."
version: 2.0.0
---

# tasteskill: Anti-Slop Frontend Skill

> Landing pages, portfolios, product UI and web apps.
> Every rule below is **contextual**. First read the brief, infer the design read, then pull only what fits.

---

## 0. BRIEF INFERENCE (Read the Room Before Anything Else)

Before touching code or tweaking dials, **infer what the user actually wants**. Most LLM design output is bad because the model jumps to a default aesthetic instead of reading the room.

### 0.A Read these signals first
1. **Page kind** — landing (SaaS / consumer / agency / event), portfolio (dev / designer / creative studio), redesign (preserve vs overhaul), editorial / blog.
2. **Vibe words** the user used — "minimalist", "calm", "Linear-style", "Awwwards", "brutalist", "premium consumer", "Apple-y", "playful", "serious B2B", "editorial", "agency-y", "glassy", "dark tech".
3. **Reference signals** — URLs they linked, screenshots they pasted, products they named, brands they're competing with.
4. **Audience** — B2B procurement panel vs. design-conscious consumer vs. recruiter scanning a portfolio. The audience picks the aesthetic, not your taste.
5. **Brand assets that already exist** — logo, color, type, photography. For redesigns, these are starting material, not optional input.
6. **Quiet constraints** — accessibility-first audiences, public-sector, regulated industries, trust-first commerce, kids' products. These constraints OVERRIDE aesthetic preference.

### 0.B Output a one-line "Design Read" before generating
Before any code, state in one line: **"Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <design system or aesthetic family>."**

Example reads:
- *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Tailwind utilities + Geist + restrained motion."*
- *"Reading this as: solo designer portfolio for hiring managers, with an editorial / kinetic-type language, leaning toward native CSS + scroll-driven animation + custom typography."*

### 0.C Anti-Default Discipline
Do not default to: AI-purple gradients, centered hero over dark mesh, three equal feature cards, generic glassmorphism on everything, infinite-loop micro-animations everywhere, Inter + slate-900. These are the LLM defaults. Reach past them deliberately based on the design read.

---

## 1. THE THREE DIALS (Core Configuration)

After the design read, set three dials. Every layout, motion, and density decision below is gated by these.

* **`DESIGN_VARIANCE: 8`** — 1 = Perfect Symmetry, 10 = Artsy Chaos
* **`MOTION_INTENSITY: 6`** — 1 = Static, 10 = Cinematic / Physics
* **`VISUAL_DENSITY: 4`** — 1 = Art Gallery / Airy, 10 = Cockpit / Packed Data

**Baseline:** `8 / 6 / 4`. Use these unless the design read overrides them.

### 1.A Dial Inference (design read → dial values)
| Signal | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm / editorial / Linear-style" | 5-6 | 3-4 | 2-3 |
| "premium consumer / Apple-y / luxury / brand" | 7-8 | 5-7 | 3-4 |
| "playful / wild / Dribbble / Awwwards / experimental / agency" | 9-10 | 8-10 | 3-4 |
| "landing page / portfolio / marketing site (default)" | 7-9 | 6-8 | 3-5 |
| "trust-first / public-sector / regulated / accessibility-critical" | 3-4 | 2-3 | 4-5 |

---

## 2. DESIGN ENGINEERING DIRECTIVES (Anti-AI Slop)

### 2.1 Typography
* **Display / Headlines:** Default `text-4xl md:text-6xl tracking-tighter leading-none`.
* **Body / Paragraphs:** Default `text-base text-muted-foreground leading-relaxed max-w-[65ch]`.
* **Sans font choice:** Default `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`, or brand-appropriate sans. Avoid Inter as a lazy default unless requested for strict neutral SaaS.
* **Serif Discipline:** Serif is **very discouraged as default** for generic modern brands. Use serif ONLY when the brand identity is genuinely editorial, vintage, or literary.
* **Mixed-family ban:** When emphasizing words in headlines, use italic/bold of the SAME font family. Do NOT inject a random serif word into a sans headline.

### 2.2 Color Calibration
* **Max 1 primary accent color.** Saturation < 80% by default.
* **THE LILA RULE:** The "AI Purple / Blue glow" aesthetic is banned as a default. No automatic purple button glows, no random neon mesh gradients.
* **Color Consistency Lock:** Once an accent is chosen, use it consistently across the entire page.

### 2.3 Layout & Structure
* **ANTI-CENTER BIAS:** Centered Hero sections are avoided when `DESIGN_VARIANCE > 4`. Prefer Split Screen (50/50), Left-aligned content with right-aligned interactive asset, or Asymmetric grid.
* **HERO VIEWPORT CAP:** Hero MUST fit in initial viewport without forcing scroll to reach the primary CTA.
* **HERO TOP PADDING CAP:** Max `pt-24` desktop top padding. Avoid empty voids.
* **EYEBROW RESTRAINT:** Max 1 uppercase tracking eyebrow per 3 sections. Do not put an eyebrow over every single headline.
* **ZIGZAG ALTERNATION BAN:** Avoid repeating 3+ consecutive "left-image / right-text" zigzag blocks. Vary with full-width statements, bento grids, interactive carousels, or metric cards.

### 2.4 Tactility, Shadows & Micro-Interactions
* **Interactive UI States:** Complete states for buttons, cards, inputs (Hover, Focus-Visible, Active/Press, Disabled, Loading, Error).
* **Tactile Feedback:** On `:active`, use `scale-[0.98]` or `-translate-y-[1px]` to simulate physical push.
* **Motion Guardrails:** Hardware-accelerated transforms (`transform`, `opacity`) via `motion/react`. Avoid animating height/width directly.
* **Shadows:** Tint shadows to background hue; avoid harsh pure-black shadows on light themes.

### 2.5 Visual Asset Strategy
* **Real Images Over Placeholders:** Use real high-res photography, generated imagery, or actual UI components. Div-based fake wireframe mockups are banned.
* **Logo Walls:** Clean, monochrome SVG logos via Simple Icons or Devicon. Do not put category sub-labels under logos.
