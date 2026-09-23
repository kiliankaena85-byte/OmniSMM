# Plan 008: Build & DX Infrastructure

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
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

`ignoreBuildErrors: true` allows type errors to slip into production builds. The lack of a `README.md` creates friction for new developers. Junk files in the project root create cognitive overhead.

## Current state

- `next.config.mjs`: Line 6 has `ignoreBuildErrors: true`.
- `tsconfig.json`: Excludes `src/bot/` scene files from type checking.
- Root directory: Contains many `.log` files, `.txt` reports, and one-off scripts.
- No `README.md`.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`          | exit 0, no errors   |
| Build     | `npm run build`             | exit 0              |

## Scope

**In scope**:
- `next.config.mjs`
- `tsconfig.json`
- `package.json`
- `.gitignore`
- Root directory temp files/scripts
- `README.md` (create)

## Steps

### Step 1: Cleanup Root Directory

Remove all temp logs and move scripts:
```bash
git rm *.log *.txt
mkdir -p scratch
git mv audit-db-target-types.ts check-db.ts clean-db.ts analyze-vocab.ts scratch/
```
Add `*.log` to `.gitignore`.

### Step 2: Fix TS Exclusions & Build Errors

In `next.config.mjs`, set `ignoreBuildErrors: false`.
In `tsconfig.json`, remove the exclusions for `src/bot/` files.
Run `npx tsc --noEmit`. You WILL see type errors. Fix the type errors in the bot files until `tsc` passes cleanly.

### Step 3: Add `typecheck` script

In `package.json`, add `"typecheck": "tsc --noEmit"` to the scripts section.

### Step 4: Create README.md

Create `README.md` in the root containing:
- Project overview (Smmplan Lite Core)
- Prerequisites (Node 20, PostgreSQL, Redis)
- Setup commands (npm install, docker-compose, etc.)
- Available npm scripts

### Step 5: Verify

```bash
npm run typecheck
npm run build
```

## STOP conditions

- If fixing the bot type errors requires a massive refactoring of Telegraf scenes (report and revert Step 2).

## Git workflow

Commit with: `chore: improve DX, add README, enforce typecheck on build (plan 008)`
