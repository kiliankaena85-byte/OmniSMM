# Plan 022: God Components & Silent Errors Cleanup

## Status
- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt

## Why this matters
The codebase has two massive "God" components that violate the 150-line rule set in AGENTS.md, making them extremely difficult to maintain, test, and performant. Additionally, there are dozens of empty `catch { }` blocks that swallow runtime exceptions without logging them, causing silent failures that are impossible to trace.

## Current state
- `src/components/admin/catalog-table-v2.tsx` (1154 lines)
- `src/app/admin/tickets/components/unified-workspace.tsx` (1094 lines)
- Multiple files containing `catch { }` or `catch { /* ignore */ }`.

## Smmplan default commands
| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Lint | `npm run lint` | exit 0 |

## Scope
**In scope**:
- `src/components/admin/catalog-table-v2.tsx`
- `src/app/admin/tickets/components/unified-workspace.tsx`
- Files containing empty `catch` blocks identified via regex `catch\s*\{\s*\}`.

**Out of scope**:
- Feature additions or logic changes inside components.

## Steps

### Step 1: Decompose Catalog Table V2
In `src/components/admin/catalog-table-v2.tsx`:
1. Extract modal components (e.g., Edit Modal, Delete Modal) into separate files in `src/components/admin/catalog/modals/`.
2. Extract the table row rendering logic if applicable.
3. Keep `catalog-table-v2.tsx` as the main orchestrator orchestrating state and the extracted components.

### Step 2: Decompose Unified Workspace
In `src/app/admin/tickets/components/unified-workspace.tsx`:
1. Extract the sidebar (ticket list) into `WorkspaceSidebar.tsx`.
2. Extract the main chat area into `WorkspaceChatArea.tsx`.
3. Extract the user context panel into `WorkspaceContextPanel.tsx`.
4. Keep `unified-workspace.tsx` as the layout orchestrator managing the selected ticket state.

### Step 3: Replace Empty Catch Blocks
Perform a search for `catch {` and `catch (e) { }` across `src/`.
Replace silent catches with `console.warn(err)` or logging logic so the error leaves a trace. For cases where ignoring is truly intended, use `catch (err) { /* Expected failure, continuing */ }` but prefer logging.

### Step 4: Verify
Run `npx tsc --noEmit` and `npm run lint` to ensure imports and types match after decomposition.

## Git workflow
Commit with: `refactor: decompose god components and remove empty catch blocks (plan 022)`
