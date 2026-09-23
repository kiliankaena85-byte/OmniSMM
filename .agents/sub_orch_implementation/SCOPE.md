# Scope: Round Table Expert System Implementation

## Architecture
The Round Table Expert System is a TypeScript-based codebase representing a multi-agent consensus workflow.
It consists of:
- **skills/**: Domain prompt instruction files (architect, security_auditor, qa_engineer, deep_researcher).
- **src/types.ts**: Inputs/outputs definitions (Request, Draft, Review, Synthesis, etc.) using Zod schemas for validation.
- **src/graphrag.ts**: HTTP client interacting with the GraphRAG service at http://localhost:8100.
- **src/orchestrator.ts**: Core state machine orchestrating the consensus workflow (Maker-Checker loop, parallel review, self-correction, discussion logging).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Init Project | Initialize package.json, tsconfig.json, install dependencies | None | DONE |
| 2 | Skills Setup | Create skills/architect.md, skills/security_auditor.md, skills/qa_engineer.md, skills/deep_researcher.md | None | DONE |
| 3 | Types Definition | Create src/types.ts with interfaces & Zod schemas | None | DONE |
| 4 | GraphRAG Client | Create src/graphrag.ts with Search, Ingest, and Context Compression | M3 | DONE |
| 5 | Orchestrator Logic | Create src/orchestrator.ts implementing state machine, Maker-Checker loop, and DISCUSSION_LOG.json | M3, M4 | DONE |
| 6 | E2E Testing Verification | Wait for E2E testing track to write TEST_READY.md, run the test suite | M1-M5 | DONE |

## Interface Contracts
- **src/types.ts** ↔ **src/graphrag.ts & src/orchestrator.ts**:
  - `UserRequest`: string
  - `ExpertRole`: 'architect' | 'security_auditor' | 'qa_engineer' | 'deep_researcher'
  - `Draft`: { role: ExpertRole, content: string, citations: string[] }
  - `Review`: { reviewer: ExpertRole, status: 'approved' | 'rejected', comments: string, issues: string[] }
  - `Synthesis`: { finalResponse: string, consensusReached: boolean, openItems: string[], logPath: string }
