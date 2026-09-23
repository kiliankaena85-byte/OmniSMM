---
name: react-expert
version: 1.0.0
description: Use when the user requests to analyze, research, or audit React API behaviors. This skill analyzes tests and source code to validate Flow and TypeScript signatures before writing documentation.
---

# React Expert Research Skill

## Overview

This skill produces exhaustive documentation research on any React API or concept by searching authoritative sources (tests, source code, PRs, issues) rather than relying on LLM training knowledge.

<CRITICAL>
**Strict Source Authority Mandate:** Do NOT rely on your prior training knowledge about React APIs, as it may be outdated, incomplete, or incorrect. Treat the React source material and tests as the sole source of truth. If any findings contradict your initial assumptions or commonly described web patterns, you must explicitly document and highlight these discrepancies.

**Red Flags - STOP if you catch yourself thinking:**
- "I know this API does X" → Verify by finding source evidence first.
- "Common pattern is Y" → Confirm by checking actual React test files.
- Generating example code → Ensure you have a direct source file reference.
</CRITICAL>

## Invocation

```bash
/react-expert useTransition
/react-expert suspense boundaries
/react-expert startTransition
```

## Sources (Priority Order)

1. **React Repo Tests** - Most authoritative for actual behavior
2. **React Source Code** - Warnings, errors, implementation details
3. **Git History** - Commit messages with context
4. **GitHub PRs & Comments** - Design rationale (via `gh` CLI)
5. **GitHub Issues** - Confusion/questions (facebook/react + reactjs/react.dev)
6. **React Working Group** - Design discussions for newer APIs
7. **Flow Types** - Source of truth for type signatures
8. **TypeScript Types** - Note discrepancies with Flow
9. **Current react.dev docs** - Baseline (not trusted as complete)

**No web search** - No Stack Overflow, blog posts, or web searches. GitHub API via `gh` CLI is allowed.

## Workflow

### Step 1: Setup React Repo

First, ensure the React repo is available locally:

```bash
# Check if React repo exists, clone or update
if [ -d ".claude/react" ]; then
  cd .claude/react && git pull origin main
else
  git clone --depth=100 https://github.com/facebook/react.git .claude/react
fi
```

Get the current commit hash for the research document:
```bash
cd .claude/react && git rev-parse --short HEAD
```

### Step 2: Dispatch 6 Parallel Research Agents

Spawn these agents IN PARALLEL using the Task tool. Each agent receives the skepticism preamble:

> "You are researching React's `<TOPIC>`. CRITICAL: Do NOT rely on your prior knowledge about this API. Your training may contain outdated or incorrect patterns. Only report what you find in the source files. If your findings contradict common understanding, explicitly highlight this discrepancy."

| Agent | subagent_type | Focus | Instructions |
|-------|---------------|-------|--------------|
| test-explorer | Explore | Test files for usage patterns | Search `.claude/react/packages/*/src/__tests__/` for test files mentioning the topic. Extract actual usage examples WITH file paths and line numbers. |
| source-explorer | Explore | Warnings/errors in source | Search `.claude/react/packages/*/src/` for console.error, console.warn, and error messages mentioning the topic. Document trigger conditions. |
| git-historian | Explore | Commit messages | Run `git log --all --grep="<topic>" --oneline -50` in `.claude/react`. Read full commit messages for context. |
| pr-researcher | Explore | PRs introducing/modifying API | Run `gh pr list -R facebook/react --search "<topic>" --state all --limit 20`. Read key PR descriptions and comments. |
| issue-hunter | Explore | Issues showing confusion | Search issues in both `facebook/react` and `reactjs/react.dev` repos. Look for common questions and misunderstandings. |
| types-inspector | Explore | Flow + TypeScript signatures | Find Flow types in `.claude/react/packages/*/src/*.js` (look for `@flow` annotations). Find TS types in `.claude/react/packages/*/index.d.ts`. Note discrepancies. |

### Step 3: Agent Prompts

Use these exact prompts when spawning agents:

#### test-explorer
````markdown
You are researching React's <TOPIC>.

CRITICAL: Do NOT rely on your prior knowledge about this API. Your training may contain outdated or incorrect patterns. Only report what you find in the source files.

Your task: Find test files in .claude/react that demonstrate <TOPIC> usage.

1. Search for test files: Glob for `**/__tests__/**/*<topic>*` and `**/__tests__/**/*.js` then grep for <topic>
2. For each relevant test file, extract:
   - The test description (describe/it blocks)
   - The actual usage code
   - Any assertions about behavior
   - Edge cases being tested
3. Report findings with exact file paths and line numbers

Format your output as:
### Test File: <path>
#### Test: "<test description>"
```javascript
<exact code from test>
```
**Behavior:** <what the test asserts>
````

#### source-explorer
```markdown
You are researching React's <TOPIC>.

CRITICAL: Do NOT rely on your prior knowledge about this API. Only report what you find in the source files.

Your task: Find warnings, errors, and implementation details for <TOPIC>.

1. Search .claude/react/packages/*/src/ for:
   - console.error mentions of <topic>
   - console.warn mentions of <topic>
   - Error messages mentioning <topic>
   - The main implementation file
2. For each warning/error, document:
   - The exact message text
   - The condition that triggers it
   - The source file and line number

Format your output as:
### Warnings & Errors Output
| Message | Trigger Condition | Source |
|---------|------------------|--------|
| "<exact message>" | <condition> | <file:line> |

### Implementation Notes Output
<key details from source code>
```

#### git-historian
```markdown
You are researching React's <TOPIC>.

CRITICAL: Do NOT rely on your prior knowledge. Only report what you find in git history.

Your task: Find commit messages that explain <TOPIC> design decisions.

1. Run: cd .claude/react && git log --all --grep="<topic>" --oneline -50
2. For significant commits, read full message: git show <hash> --stat
3. Look for:
   - Initial introduction of the API
   - Bug fixes (reveal edge cases)
   - Behavior changes
   - Deprecation notices

Format your output as:
### Key Commits Output
#### <short hash> - <subject>
**Date:** <date>
**Context:** <why this change was made>
**Impact:** <what behavior changed>
```

#### pr-researcher
```markdown
You are researching React's <TOPIC>.

CRITICAL: Do NOT rely on your prior knowledge. Only report what you find in PRs.

Your task: Find PRs that introduced or modified <TOPIC>.

1. Run: gh pr list -R facebook/react --search "<topic>" --state all --limit 20 --json number,title,url
2. For promising PRs, read details: gh pr view <number> -R facebook/react
3. Look for:
   - The original RFC/motivation
   - Design discussions in comments
   - Alternative approaches considered
   - Breaking changes

Format your output as:
### Key PRs Output
#### PR #<number>: <title>
**URL:** <url>
**Summary:** <what it introduced/changed>
**Design Rationale:** <why this approach>
**Discussion Highlights:** <key points from comments>
```

#### issue-hunter
```markdown
You are researching React's <TOPIC>.

CRITICAL: Do NOT rely on your prior knowledge. Only report what you find in issues.

Your task: Find issues that reveal common confusion about <TOPIC>.

1. Search facebook/react: gh issue list -R facebook/react --search "<topic>" --state all --limit 20 --json number,title,url
2. Search reactjs/react.dev: gh issue list -R reactjs/react.dev --search "<topic>" --state all --limit 20 --json number,title,url
3. For each issue, identify:
   - What the user was confused about
   - What the resolution was
   - Any gotchas revealed

Format your output as:
### Common Confusion Output
#### Issue #<number>: <title>
**Repo:** <facebook/react or reactjs/react.dev>
**Confusion:** <what they misunderstood>
**Resolution:** <correct understanding>
**Gotcha:** <if applicable>
```

#### types-inspector
````markdown
You are researching React's <TOPIC>.

CRITICAL: Do NOT rely on your prior knowledge. Only report what you find in type definitions.

Your task: Find and compare Flow and TypeScript type signatures for <TOPIC>.

1. Flow types (source of truth): Search .claude/react/packages/*/src/*.js for @flow annotations related to <topic>
2. TypeScript types: Search .claude/react/packages/*/index.d.ts and @types/react
3. Compare and note any discrepancies

Format your output as:
### Flow Types Output
**File:** <path>
```flow
<exact type definition>
```

### TypeScript Types Output
**File:** <path>
```typescript
<exact type definition>
```

### Discrepancies Output
<any differences between Flow and TS definitions>
````

### Step 4: Synthesize Results

After all agents complete, combine their findings into a single research document.

**DO NOT add information from your own knowledge.** Only include what agents found in sources.

### Step 5: Save Output

Write the final document to `.claude/research/<topic>.md`

Replace spaces in topic with hyphens (e.g., "suspense boundaries" → "suspense-boundaries.md")

## Output Document Template

````markdown
# React Research: <topic>

> Generated by /react-expert on YYYY-MM-DD
> Sources: React repo (commit <hash>), N PRs, M issues

## Summary

[Brief summary based SOLELY on source findings, not prior knowledge]

## API Signature

### Flow Types (Source of Truth)

[From types-inspector agent]

### TypeScript Types

[From types-inspector agent]

### Discrepancies

[Any differences between Flow and TS]

## Usage Examples

### From Tests

[From test-explorer agent - with file:line references]

### From PRs/Issues

[Real-world patterns from discussions]

## Caveats & Gotchas

[Each with source link]

- **<gotcha>** - Source: <link>

## Warnings & Errors

| Message | Trigger Condition | Source File |
|---------|------------------|-------------|
[From source-explorer agent]

## Common Confusion

[From issue-hunter agent]

## Design Decisions

[From git-historian and pr-researcher agents]

## Source Links

### Commits
- <hash>: <description>

### Pull Requests
- PR #<number>: <title> - <url>

### Issues
- Issue #<number>: <title> - <url>
````

## Common Mistakes to Avoid

1. **Trusting prior knowledge** - If you "know" something about the API, find the source evidence anyway
2. **Generating example code** - Every code example must come from an actual source file
3. **Skipping agents** - All 6 agents must run; each provides unique perspective
4. **Summarizing without sources** - Every claim needs a file:line or PR/issue reference
5. **Using web search** - No Stack Overflow, no blog posts, no social media

## When to activate

Activate this skill when:
- The user requests deep research on a specific React API (e.g. `useTransition`, `Suspense`, `useDeferredValue`).
- You need to write accurate documentation or guides about React features.
- A React-related test is failing and you need to verify how React behaves under the hood.
- You encounter a discrepancy between how a React API is documented and how it behaves.

## Step-by-step execution protocol

1. **Environment Setup**: Run the checkout commands to ensure `.claude/react` is cloned and active.
2. **Launch Subagents**: Dispatch the 6 parallel explorer subagents with the exact specified prompts.
3. **Monitor Status**: Periodically check the progress of each subagent until they successfully complete.
4. **Synthesize Findings**: Gather the outputs, cross-reference them, and build the unified markdown document.
5. **Quality Review**: Validate the final output against the "Common Mistakes to Avoid" checklist.
6. **Save Artifact**: Write the final file under `.claude/research/<topic>.md` and present it to the user.

## Scope boundaries

### In Scope
- Deep analysis of the official Facebook React repository (source code and tests).
- Analyzing Flow types and TypeScript types definitions for React.
- Searching GitHub issues, PRs, and commit history for design decisions.

### Out of Scope
- Searching generic web sources, Stack Overflow, Medium blogs, or Google.
- Executing live production React apps or writing application-level mock setups.
- Third-party React libraries (e.g. React Router, Redux, Zustand) unless they are built-in React APIs.

## Error handling

If an error or failure occurs during the execution:
- **Git Clone fails**: Fall back to using standard fetch calls to GitHub API to inspect the required files, or ask the user to verify their internet connection.
- **Subagent crashes**: Log the error details, respawn the failed subagent with a smaller topic scope, or manually perform the search on that specific area.
- **Missing credentials for `gh` CLI**: Report the lack of token to the user and request manual authentication, or fall back to searching local React source directories only.

## References

- [Official React Repository](https://github.com/facebook/react)
- [React Dev Documentation](https://react.dev)
- [React Working Group Discussions](https://github.com/reactwg/react-18)

## Verification Checklist

Before finalizing the research document:

- [ ] React repo is at `.claude/react` with known commit hash
- [ ] All 6 agents were spawned in parallel
- [ ] Every code example has a source file reference
- [ ] Warnings/errors table has source locations
- [ ] No claims made without source evidence
- [ ] Discrepancies between Flow/TS types documented
- [ ] Source links section is complete
