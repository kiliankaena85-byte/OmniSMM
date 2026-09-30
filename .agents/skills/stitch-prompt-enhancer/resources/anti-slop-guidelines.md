# Anti-Slop Design Guidelines & Negative Constraints

AI-generated interfaces often suffer from repetitive design tropes. When crafting prompts for Google Stitch, always enforce the following negative constraints and positive replacements:

---

## 1. Negative Constraints (Strictly Banned)

| AI Cliche | Why It Fails | Negative Prompt Directives |
| :--- | :--- | :--- |
| **Purple Neon Glow** | Overused, damages contrast, feels dated | `NO neon purple ambient blobs, NO generic violet gradients on dark cards` |
| **Icon-Stuffed Bento** | Meaningless visual noise, cognitive overload | `NO random Lucide icons in every corner, NO emojis inside metric badges` |
| **Floating Status Pills** | Wastes vertical space, creates visual clutter | `NO pulsing green/purple badge above headline unless it conveys real-time status` |
| **White-on-White Washed Out** | Poor WCAG contrast, unreadable cards | `NO #ffffff cards on #ffffff background without explicit border and shadow depth` |
| **Disabled Submit Buttons** | Bad UX: traps users without error explanation | `NEVER disable submit CTA; show validation tooltip or inline prompt on click` |

---

## 2. Positive Architectural Replacements

1. **Deliberate Contrast & Borders:**
   - Use high-contrast borders: `border border-slate-200/90 dark:border-zinc-800`.
   - Subtle tactile elevation: `shadow-sm hover:shadow-md transition-shadow`.

2. **Monochrome First, Color Second:**
   - Establish hierarchy with shades of slate/zinc before adding color accents.
   - Use accent colors exclusively for primary actions and active state changes.

3. **High-Density Typography:**
   - Use tabular numbers (`font-mono tracking-tight font-semibold`) for financial data.
   - Limit heading scales to max 3 sizes per view (e.g. 24px, 16px, 13px).

4. **Zero Horizontal Overflow:**
   - Enforce explicit `w-full min-w-0 break-words` containers.
   - For data tables, prioritize keyset pagination and high-density 100% width grids.
