# Scope: E2E Test Suite for Round Table Expert System

## Architecture
The E2E test suite resides in `d:\SMM_plan_2\teamwork_projects\round_table_experts/`.
It contains:
- `test_round_table.ts`: Programmatic test file using Vitest.
- `TEST_READY.md`: Certification of E2E coverage and run instructions.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Test Infra Setup | Initialize target folder, ensure dependencies, package scripts and tsconfig support. | none | PLANNED |
| 2 | Test Case Development | Write E2E tests covering gap simulation, security, GraphRAG search/knowledge, context compression, and Fake Fact rejection. | M1 | PLANNED |
| 3 | Verification & Ready | Run the tests, verify success, and publish TEST_READY.md. | M2 | PLANNED |

## Interface Contracts
- **Test Command**: `npx vitest run teamwork_projects/round_table_experts/test_round_table.ts`
- **Output**: Clean exit (code 0) with all assertions passing.

## Test Case Design (4 Tiers)
### Feature Inventory:
1. **F1: Orchestrator Flow**: Valid transitions Input -> Architect -> Checkers -> Synthesis.
2. **F2: GraphRAG Search**: Querying `POST /api/search` at top_k: 3.
3. **F3: Multi-Source Validation**: Rejecting facts with < 2 independent sources, accepting facts with >= 2 sources.
4. **F4: Self-Correction Loop**: Checker rejection leads to maker correction/retries.
5. **F5: Context Compression**: Context is compressed/stripped (summaries, filters) between turns.
6. **F6: Audit Trail**: Creating `DISCUSSION_LOG.json` containing chains of thought and citations.

### Coverage Tiers:
- **Tier 1 - Feature Coverage**:
  - Test orchestrator starts and finishes flow.
  - Test GraphRAG query parameters are set correctly.
  - Test Researcher triggers on knowledge gap.
  - Test Checker rejection triggers revision.
  - Test context compression filter removes noise.
- **Tier 2 - Boundary & Corner Cases**:
  - Test fact with 0 sources (rejection).
  - Test fact with 1 source (rejection).
  - Test fact with 2 identical sources (rejection - must be independent).
  - Test fact with 2 independent sources (acceptance).
  - Test self-correction loop limit (retry cap exceeded leads to graceful failure/synthesis).
- **Tier 3 - Cross-Feature Combinations**:
  - Test request containing BOTH a knowledge gap AND a security vulnerability (requires researcher validation and security correction).
- **Tier 4 - Real-World Workload**:
  - Complex multi-turn workflow with a Fake Fact injection attempt during research, verifying it is rejected and does not write to GraphRAG, followed by a valid fact that is ingested.
