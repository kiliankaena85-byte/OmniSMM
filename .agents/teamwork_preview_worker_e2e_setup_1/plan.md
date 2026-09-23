# Implementation Plan — Round Table E2E Test Suite

This plan details the steps required to implement the opaque-box test suite for the "Round Table" expert system and the corresponding mock orchestrator.

## Verification Steps & Goals

1. **Setup test environment**: Verify `tsconfig.json` and `package.json` in `teamwork_projects/round_table_experts`.
2. **Define interfaces and schemas**: Verify `src/types.ts` exposes Zod schemas and TypeScript types for `ArchitectOutput`, `SecurityAuditorOutput`, `QAEngineerOutput`, and `DeepResearcherOutput`.
3. **Implement Mock Orchestrator**: Create `src/orchestrator.ts` running the state machine, fetching GraphRAG search and ingestion, calling mock LLMs, performing context compression, fact-checking sources (unique sources >= 2), and writing `DISCUSSION_LOG.json`.
4. **Implement Test Suite**: Create `test_round_table.ts` using Vitest to stub `global.fetch` and assert all required behaviors.
5. **Run and verify tests**: Run Vitest and confirm that all tests pass perfectly.
6. **Publish documentation**: Publish `TEST_READY.md`.

## Risk Analysis & Pre-Mortem

| Risk Scenario | Preventative Mechanism |
|---|---|
| Vitest cannot run because `fetch` is undefined or stubbed incorrectly | Use `vi.stubGlobal('fetch', ...)` to cleanly mock global fetch in Node.js environment. |
| Deep Researcher returns duplicate source list that fools the unique source check | Implement a Set-based uniqueness check on trimmed/lowercased URLs (`validateSources`) to reject duplicate sources. |
| Context compression fails to strip raw logs | Implement a dedicated `compressContext` helper mapping expert output to custom summaries instead of serializing the raw JSON payload. |

## Timeline
- **Step 1: Setup types and schemas** (Completed)
- **Step 2: Implement Orchestrator** (Completed)
- **Step 3: Implement E2E Test Suite** (Next)
- **Step 4: Run Tests & Publish TEST_READY.md** (Pending)
