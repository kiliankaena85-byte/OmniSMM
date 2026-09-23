# Project: Round Table Expert System

## Architecture
The "Round Table" expert system implements a Node.js/TypeScript-based multi-agent state machine that coordinates 4 distinct expert agents (Architect, Security Auditor, QA Engineer, Deep Researcher) to design, review, and synthesize technical solutions.

### State Machine Flow:
1. **User Request (INPUT)**: Receives task, queries GraphRAG for background context (top_k: 3).
2. **Architect Draft (MAKER)**: Produces the first design proposal draft.
3. **Parallel Review (CHECKERS)**:
   - **Security Auditor**: Checks the draft for OWASP, prompt injection, trust boundaries.
   - **QA Engineer**: Validates component limits, edge cases, stack adherence.
4. **Self-Correction Loop**: If any Checker rejects the draft, the state machine routes the failure logs back to the Maker (Architect or Deep Researcher) for revision (up to a configured retry limit).
5. **Deep Researcher (KNOWLEDGE HARVESTER)**: Triggered when a knowledge gap is identified. Queries GraphRAG, verifies facts using **Multi-Source Validation** (requires at least 2 independent authoritative sources) and calculates a `confidence_score` (0.0 to 1.0) before proposing knowledge ingestion via `POST /api/knowledge`. No raw database writes.
6. **Synthesis (OUTPUT)**: Aggregates the reviewed proposal and prints the structured `DISCUSSION_LOG.json`.

### Token Efficiency & Context Compression:
- Summary Passing: High-level summaries instead of full history.
- Conversational Filter: Retain only structurally relevant messages.
- Strict RAG Limits: Cap retrieved context at `top_k: 3`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Infrastructure & Types | Define TypeScript types, Zod schemas, & 4 SKILL.md files | none | PLANNED |
| 2 | GraphRAG & Context Utility | Implement GraphRAG API client & Context Compression utilities | M1 | PLANNED |
| 3 | Expert Simulation & Loop | Implement State Machine logic, retry mechanism, and Self-Correction Loop | M2 | PLANNED |
| 4 | Verification & Audit | Implement test_round_table.ts covering gap simulation, security, and Fake Fact rejection. Pass all tests. | M3 | PLANNED |

## Code Layout
- `d:\SMM_plan_2\teamwork_projects\round_table_experts/`
  - `skills/`
    - `architect.md`
    - `security_auditor.md`
    - `qa_engineer.md`
    - `deep_researcher.md`
  - `src/`
    - `types.ts`
    - `graphrag.ts`
    - `orchestrator.ts`
  - `test_round_table.ts`
  - `DISCUSSION_LOG.json`
  - `tsconfig.json`
  - `package.json`

## Interface Contracts
- **Architect Output Schema**: Zod object containing `proposal`, `architectureSummary`, `assumptions`.
- **Security Auditor Output Schema**: Zod object containing `approved: boolean`, `vulnerabilities: string[]`, `securityFeedback: string`.
- **QA Engineer Output Schema**: Zod object containing `approved: boolean`, `edgeCasesIdentified: string[]`, `qaFeedback: string`.
- **Deep Researcher Output Schema**: Zod object containing `factsToIngest: Array<{ fact: string, sources: string[], confidence_score: number }>`, `findings: string`.
