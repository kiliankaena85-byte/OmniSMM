---
name: figma-mcp
version: 1.2.0
description: >
  Connects to Figma via MCP, scans Figma design files, analyzes UI components,
  and validates design tokens from a provided Figma file URL.
  Activates only when an explicit Figma file URL or direct Figma MCP
  request is present. Not a general component generator — requires
  a valid figma.com/file/ or figma.com/design/ URL to operate.
  Use this skill to scan and check tokens when extracting components
  before production release.
---

# 🎨 Figma MCP Skill

## When to activate

| Trigger | Why |
|---------|-----|
| User provides `figma.com/file/` or `figma.com/design/` URL | Direct file access needed |
| User says "открой Figma", "подключись к Figma MCP" | Explicit MCP request |
| User says "извлеки токены из Figma", "адаптируй UI Kit" | Token extraction workflow |
| User says "скопируй дизайн из Figma в код" | Design-to-code workflow |
| User mentions Telegram UI Kit, Material 3, Ant Design + Figma | Design system adaptation |

| Do NOT activate when | Reason |
|----------------------|--------|
| No Figma URL is provided | Cannot connect without file reference |
| User asks about UI components without mentioning Figma | Use general component skill |
| User asks about backend, APIs, databases | Out of scope |
| User asks to "создай компонент" without Figma context | No source file |
| File is Sketch, Adobe XD, Penpot | Not supported |

---

## ⚠️ Safety

This skill may modify the following files.
Always show a diff and ask for confirmation before writing.

- `~/.gemini/antigravity/mcp_config.json`
- `src/tokens/*.ts`
- `tailwind.config.ts` — merge only, never overwrite existing `extend`
- `src/styles/*.css`

Never run `npm install -g` without explicit user confirmation.
Never patch files in `node_modules` without explicit user confirmation.
Never overwrite `tailwind.config.ts` — always merge and show diff first.

---

## Prerequisites

Before running any phase, verify the environment:

- Node.js ≥ 18 → `node --version`
- npx available → `npx --version`

```text
Node.js not found → https://nodejs.org (install LTS version)
npx not found     → npm install -g npx
```

For parallel agent orchestration (Phase 5):
verify that Antigravity multi-agent mode is active in the current session.
If unavailable → run phases sequentially.

---

## Step-by-step execution protocol

### Phase 0 — Pre-flight checklist

Run ALL checks. Stop and fix any failed step before proceeding.

#### Phase 0.1 — Check MCP config

Verify `~/.gemini/antigravity/mcp_config.json` exists and contains a `figma` entry.
If missing — show this config to user and ask confirmation before writing:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--stdio"],
      "env": {
        "FIGMA_API_KEY": "figd_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

#### Phase 0.2 — Check Figma API Key

If `FIGMA_API_KEY` is missing or contains a placeholder — ask user:

> "Нужен Figma Personal Access Token:
> Figma → Settings → Security → Generate new token
> Обязательное право: Resources → file_content:read
> Токен начинается с figd_..."

#### Phase 0.3 — Detect connection mode

Present three options to user:

**Mode A — Remote MCP** (`https://mcp.figma.com/mcp`):
- Requires Full or Dev seat (Professional / Organization / Enterprise)
- ⚠️ Only whitelisted MCP clients can connect.
  Antigravity may not be in the whitelist.
- If user selects Mode A and connection is refused →
  inform user and ask: "Switch to Mode B?"
  Wait for confirmation before switching.

**Mode B — figma-developer-mcp via stdio** (recommended default):
- Works without whitelist restriction
- Works on any Figma plan
- Command: `npx -y figma-developer-mcp --stdio`

**Mode C — Desktop MCP** (`http://127.0.0.1:3845/mcp`):
- Requires Figma Desktop app open with file loaded
- Enable: Dev Mode (`Shift+D`) → Inspect panel →
  click "Enable desktop MCP server"
- Selection-based: user must select a layer in Figma FIRST, then query
- No API token required

If user does not specify → default to **Mode B**.

#### Phase 0.4 — Check rate limits

```text
Starter / Free plan
  → max 6 MCP tool calls per month across all sessions
  → Telegram DS (41 pages) will exceed this limit
  → strongly recommend Mode B — no monthly cap

Professional+ with Dev/Full seat
  → per-minute rate limits, no monthly hard cap
  → parallel agents may hit per-minute limit
  → add 2-second delay between batched calls if errors occur
```

#### Phase 0.5 — Test connection

Send a minimal test call to verify MCP responds.
If test fails → check Error decision tree below.

---

### Phase 1 — File discovery

Extract `file_key` from the URL provided by user:

```text
https://www.figma.com/file/{FILE_KEY}/Title
https://www.figma.com/design/{FILE_KEY}/Title
                     ↑ file_key: 20-30 alphanumeric chars
```

If no URL provided and user asked for Telegram UI Kit →
suggest duplicating from Figma Community:

```text
1. Telegram Design System (41 pages, CC BY 4.0)
   → figma.com/community → search "Telegram Design System"

2. Telegram Mini Apps UI Kit (25+ components + web library)
   → figma.com/community → search "Telegram Mini Apps UI Kit"

3. Telegram UI Kit 310 Screens (iOS + Android, Light/Dark)
   → figma.com/community → search "Telegram UI Kit 310 Screens"
```

After user duplicates → ask for the new URL from their personal Figma Drafts.
Community file URLs are view-only and cannot be read via MCP.

---

### Phase 2 — Design system analysis

Use ONLY real MCP tools:

```text
get_design_context      → get design context for a node or selection
get_code_connect_map    → get Code Connect component mapping
get_image               → get rendered image of a node
```

⚠️ DO NOT use Figma Plugin API — not available via MCP:

```text
figma.getLocalPaintStyles()         → Plugin API only
figma.variables.getLocalVariables() → Plugin API only
figma.getLocalTextStyles()          → Plugin API only
figma.getLocalEffectStyles()        → Plugin API only
```

#### Phase 2.1 — Extract color tokens

Use `get_design_context` on color style frames.
Organize output by:

```text
light / dark mode
  └── background: primary, secondary
  └── text: primary, secondary, hint
  └── accent: primary, destructive
  └── bubble: out, in
  └── border: default, separator
```

If `get_design_context` returns empty styles:
→ Try parent frame (one level up in layer hierarchy).
→ If still empty → use fallback values from Telegram token defaults below.

#### Phase 2.2 — Extract spacing

Map values to 4px grid.
Expected Telegram scale: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`

#### Phase 2.3 — Extract typography

For each text style capture:
`fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`

Map to semantic names:
`caption → footnote → body → callout → headline → title → display`

```text
iOS / macOS  → SF Pro
Android      → Roboto
Web          → Inter
```

#### Phase 2.4 — Extract shadows and border radius

Capture from effect styles and float variables.
If unavailable → use fallback values from Telegram token defaults below.

#### Phase 2.5 — Map component structure

```text
Atoms     : Button, Icon, Badge, Avatar, Chip, Divider
Molecules : ListItem, ChatBubble, InputBar, SearchBar
Organisms : ChatView, NavigationBar, TabBar, ProfileScreen
Templates : ChatListScreen, SettingsScreen, MediaViewer
```

For Mode C (Desktop MCP):
→ Ask user to select the target component in Figma first.
→ Call `get_design_context` on the selection.
→ Repeat per component — Desktop MCP is selection-based, no bulk extraction.

---

### Phase 3 — Token generation

Generate `src/tokens/[design-system-name].ts`:

```typescript
// Auto-generated by Figma MCP Skill v1.2.0
// Source: {FIGMA_FILE_URL}
// Generated: {DATE}
// DO NOT edit manually — re-run skill to regenerate

export const tokens = {
  colors: {
    light: {
      background: { primary: '', secondary: '' },
      text:       { primary: '', secondary: '', hint: '' },
      accent:     { primary: '', destructive: '' },
      bubble:     { out: '', in: '' },
      border:     { default: '', separator: '' },
    },
    dark: {
      background: { primary: '', secondary: '' },
      text:       { primary: '', secondary: '', hint: '' },
      accent:     { primary: '', destructive: '' },
      bubble:     { out: '', in: '' },
      border:     { default: '', separator: '' },
    },
  },
  spacing: {
    xxs: 4, xs: 8, s: 12, m: 16,
    l: 20, xl: 24, xxl: 32, xxxl: 48,
  },
  typography: {
    caption:  { fontSize: 11, fontWeight: 400, lineHeight: 14 },
    footnote: { fontSize: 13, fontWeight: 400, lineHeight: 18 },
    body:     { fontSize: 15, fontWeight: 400, lineHeight: 20 },
    callout:  { fontSize: 16, fontWeight: 400, lineHeight: 21 },
    headline: { fontSize: 17, fontWeight: 600, lineHeight: 22 },
    title:    { fontSize: 20, fontWeight: 400, lineHeight: 25 },
    display:  { fontSize: 34, fontWeight: 700, lineHeight: 41 },
  },
  radius: {
    xs: 4, s: 8, m: 12, l: 16,
    bubble: 18, card: 12, full: 9999,
  },
  shadows: {
    card:   '0 1px 4px rgba(0,0,0,0.08)',
    modal:  '0 8px 32px rgba(0,0,0,0.18)',
    navbar: '0 1px 0 rgba(0,0,0,0.08)',
  },
} as const;

export type ColorScheme   = typeof tokens.colors.light;
export type SpacingKey    = keyof typeof tokens.spacing;
export type TypographyKey = keyof typeof tokens.typography;
export type RadiusKey     = keyof typeof tokens.radius;
```

Also generate:
- `tailwind.config.ts` — merge into existing `extend`, never replace.
  Show full diff before writing. Ask confirmation.
- `src/styles/[design-system]-vars.css` — CSS custom properties

Validation after generation — verify these 5 specific values against Figma:

```text
1. Primary background color  (light mode)
2. Primary text color        (light mode)
3. Base spacing unit         (must be 4px)
4. Body font size            (must be 15px for Telegram/iOS)
5. Bubble border radius      (must be 18px)
```

---

### Phase 4 — Component generation

Rules:
1. Use `tokens` from Phase 3 — no hardcoded values anywhere
2. Tailwind CSS only — no inline styles
3. Light/Dark mode via CSS custom properties
4. `aria-*` on all interactive elements
5. Named + default export
6. JSDoc with source Figma component URL
7. `React.memo` for all list-rendered items

Component template:

```tsx
// src/components/{category}/{ComponentName}.tsx
// Figma: {FIGMA_COMPONENT_URL}
// Generated: {DATE} by Figma MCP Skill v1.2.0

import React from 'react';
import { tokens } from '@/tokens/[design-system]';

interface {ComponentName}Props {
  variant?:   'primary' | 'secondary';
  size?:      'sm' | 'md' | 'lg';
  className?: string;
  children?:  React.ReactNode;
}

/**
 * {ComponentName} — {DesignSystem} Design System
 * @see {FIGMA_COMPONENT_URL}
 */
const {ComponentName} = React.memo<{ComponentName}Props>(({
  variant   = 'primary',
  size      = 'md',
  className,
  children,
}) => {
  return (
    <div
      role="..."
      aria-label="..."
      className={[className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
});

{ComponentName}.displayName = '{ComponentName}';

export { {ComponentName} };
export default {ComponentName};
```

Priority order for Telegram UI Kit:

```text
1.  ChatBubble     (sent / received / media / service)
2.  ChatInput      (text + attach + send buttons)
3.  ChatListItem   (avatar + name + preview + meta)
4.  NavigationBar  (title + back + actions)
5.  TabBar         (Chats / Calls / Contacts / Stories / Settings)
6.  Avatar         (image + initials + online indicator)
7.  Badge          (unread count + muted + pinned)
8.  SearchBar
9.  SettingsRow    (icon + label + value + chevron)
10. MediaViewer    (fullscreen photo/video)
```

---

### Phase 5 — Parallel agent orchestration

Write coordination rules — prevent race conditions:

```text
Agent 1 — Token Agent
  WRITES: src/tokens/telegram.ts  ← exclusive write
  WRITES: tailwind.config.ts extension (merge + diff + confirm)
  WRITES: src/styles/telegram-vars.css

Agent 2 — Chat Components Agent
  READS:  src/tokens/telegram.ts  ← read-only
  WRITES: src/components/chat/*.tsx

Agent 3 — Navigation Components Agent
  READS:  src/tokens/telegram.ts  ← read-only
  WRITES: src/components/navigation/*.tsx

Agent 4 — Test Agent
  READS:  generated components    ← read-only
  WRITES: *.test.tsx alongside each component
  TARGET: ≥ 80% coverage

Agent 5 — Docs Agent
  READS:  Figma component descriptions via get_design_context
  WRITES: Storybook stories + JSDoc
```

If parallel mode unavailable → run agents sequentially in order above.
If per-minute rate limit errors appear → add 2-second delay between tool calls.

---

### Phase 6 — Write to canvas (Beta)

⚠️ BETA — currently free, will become a paid feature.
Available only with Mode A. Requires Full or Dev seat.
Activate only on explicit user request.
Always confirm before any write operation.
Never write to canvas as part of default extraction workflow.

---

### Phase 7 — Validation checklist

```text
□ Verify 5 specific token values against Figma source
□ No hardcoded hex/px in any component file
□ Dark mode works via CSS variables
□ TypeScript strict check passes: tsc --noEmit
□ Tailwind purge includes all new component paths
□ Every interactive element has aria-label
□ Components render correctly at 375px / 768px / 1280px
□ tokens.ts is single source of truth
□ Source Figma URL in every generated file header
□ tailwind.config.ts existing extend was preserved
```

---

## Error handling

```text
Connection refused / not whitelisted (Mode A)
  → Inform user → ask confirmation → switch to Mode B

"Unauthorized" / 403
  → Check FIGMA_API_KEY has file_content:read
  → Figma → Settings → Security → regenerate token

Rate limit hit (Free plan — 6 calls/month)
  → Switch to Mode B (no cap)
  → Batch: combine >3 node IDs per get_design_context call
  → Use Telegram token defaults below for token values

Desktop MCP not responding (Mode C)
  → Figma Desktop open + file loaded?
  → Dev Mode ON? → press Shift+D
  → "Enable desktop MCP server" clicked in Inspect panel?
  → URL correct? http://127.0.0.1:3845/mcp
                NOT localhost:34669 ← wrong port
  → Layer selected in Figma before query?

"Cannot read components" / view-only
  → Community file — cannot be read via MCP
  → Ask user: Figma Community → "Duplicate"
    → get new URL from personal Drafts

get_design_context returns empty styles
  → Try parent frame (one level up)
  → Try page root frame
  → Still empty → use Telegram token defaults below
  → Add: // FALLBACK — verify against Figma source

tokens.ts write conflict (parallel agents)
  → Halt all agents except Token Agent
  → Let Token Agent finish
  → Resume others in read-only mode

tailwind.config.ts conflict
  → Never overwrite — always merge
  → Show full diff → ask confirmation

Node.js / npx not found
  → Stop at Phase 0
  → Node.js: https://nodejs.org → LTS
  → npx: npm install -g npx
  → Re-run Phase 0 after install confirmed
```

---

## Telegram token defaults

Use ONLY when MCP extraction fails.
Add inline comment: `// FALLBACK — verify against Figma source`

```text
── Light Mode ──────────────────────────────
button-color:       #3390EC
bg-color:           #FFFFFF
secondary-bg:       #F4F4F5
text-color:         #000000
hint-color:         #707579
bubble-out:         #EFFDDE
bubble-in:          #FEEEDD
separator:          #E6E6EA
destructive:        #FF3B30

── Dark Mode ───────────────────────────────
bg-color:           #0E1621
secondary-bg:       #182533
text-color:         #F5F5F5
hint-color:         #708499
link-color:         #6AB2F2
bubble-out:         #2B5278
bubble-in:          #1C2B3A
separator:          #2A3B4D

── Typography iOS (SF Pro) ─────────────────
caption:   11px / 400 / 14px
footnote:  13px / 400 / 18px
body:      15px / 400 / 20px
callout:   16px / 400 / 21px
headline:  17px / 600 / 22px
title:     20px / 400 / 25px
display:   34px / 700 / 41px

── Spacing (4px grid) ──────────────────────
4 / 8 / 12 / 16 / 20 / 24 / 32 / 48

── Border Radius ───────────────────────────
xs:4 s:8 m:12 l:16 bubble:18 full:9999

── Shadows ─────────────────────────────────
card:   0 1px 4px rgba(0,0,0,0.08)
modal:  0 8px 32px rgba(0,0,0,0.18)
navbar: 0 1px 0 rgba(0,0,0,0.08)
```

---

## Scope boundaries

This skill works only with Figma files via MCP connection.

It does NOT:
- Work with Sketch, Adobe XD, Penpot, or Framer files
- Validate MCP server configuration correctness
- Guarantee semantic accuracy of extracted components
- Execute or test generated component logic
- Work without a valid figma.com/file/ or figma.com/design/ URL
- Replace manual design review — always verify tokens against source

---

## References

- figma-developer-mcp: npmjs.com/package/figma-developer-mcp
- Figma MCP docs: help.figma.com → search "MCP server"
- Telegram Design System (CC BY 4.0): figma.com/community
- Telegram Mini Apps UI Kit: figma.com/community
