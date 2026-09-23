# Plan 006: ChatWindow God Component Decomposition

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 004
- **Category**: tech-debt
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

`ChatWindow.tsx` is an unmaintainable ~1700 line God Component. It mixes state management, SSE connectivity, multiple sub-components (modals, lists, inputs), and business logic. Decomposing it reduces cognitive load and adheres to the `AGENTS.md` rule: "Компоненты максимум 150 строк".

## Current state

- `src/components/support/ChatWindow.tsx`: 1696 lines, 30+ useState calls.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`          | exit 0, no errors   |
| Lint      | `npm run lint`              | exit 0              |
| Build     | `npm run build`             | exit 0              |

## Scope

**In scope**:
- `src/components/support/ChatWindow.tsx`
- `src/components/support/chat/` (create new sub-directory)
- All new files created in the new directory.

**Out of scope**:
- Modifying `ClientProfileSidebar.tsx` or other support components.
- Rewriting the SSE logic (just move it).

## Steps

### Step 1: Create sub-directory and files

Create `src/components/support/chat/` and the following empty files:
- `ChatMessageList.tsx`
- `ChatInput.tsx`
- `ChatTemplateManager.tsx`
- `useChatSSE.ts`
- `useChatMessages.ts`
- `ImageZoomModal.tsx`

### Step 2: Extract hooks

Move the SSE logic from `ChatWindow.tsx` into `useChatSSE.ts`.
Move the local message array state and send/edit/delete logic into `useChatMessages.ts`.

### Step 3: Extract presentation components

Move the `ImageZoomModal` inline component into `ImageZoomModal.tsx`.
Extract the message rendering list into `ChatMessageList.tsx`.
Extract the input area (textarea, attach button, send button) into `ChatInput.tsx`.
Extract the template selector/manager into `ChatTemplateManager.tsx`.

### Step 4: Re-assemble ChatWindow

Update `ChatWindow.tsx` to be a lightweight orchestrator that uses the new hooks and renders the new sub-components. Pass necessary state down via props.

### Step 5: Verify

```bash
npx tsc --noEmit
npm run lint
```

## STOP conditions

- If extracting the SSE hook breaks the realtime update flow irreparably during refactoring.

## Git workflow

Commit with: `refactor: decompose ChatWindow god component (plan 006)`
