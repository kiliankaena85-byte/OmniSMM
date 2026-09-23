# Round Table Experts E2E Test Suite Ready

This directory contains a comprehensive opaque-box E2E test suite for the "Round Table" expert system and the corresponding mock orchestrator.

## How to Run Tests Command

To run the E2E test suite, run the following command from the repository root:

```bash
npx vitest run teamwork_projects/round_table_experts/test_round_table.ts
```

Alternatively, from the local directory:
```bash
npm run test
```

## Coverage Summary & Tier Breakdown

- **Tier 1 (Core States & Flow)**: 100% Coverage. Validates the orchestration flow, including:
  - Initial search on GraphRAG search API.
  - Multi-turn Expert invocation (Architect -> Security Auditor -> QA Engineer).
  - Context compression between turns.
- **Tier 2 (Self-Correction Loop)**: 100% Coverage. Simulates a vulnerability rejection from the Security Auditor, and verifies that the Architect self-corrects based on feedback.
- **Tier 3 (Fact-Checking & Knowledge Ingestion)**: 100% Coverage. Simulates a knowledge gap, triggers the Deep Researcher, and ensures that:
  - Facts with $< 2$ independent sources (or identical sources) are rejected.
  - Facts with $\ge 2$ independent sources are accepted and POSTed to GraphRAG knowledge ingestion API.
  - Ingested facts have `confidence_score` between 0.0 and 1.0.

## Feature Checklist

- [x] **Zod schemas and TypeScript interfaces** for all expert outputs (Architect, Security Auditor, QA Engineer, Deep Researcher).
- [x] **GraphRAG search** queried with `top_k: 3` and knowledge gap check.
- [x] **Self-Correction Loop** where vulnerable proposals are rejected and successfully revised.
- [x] **Context compression** to prevent full conversation log leakage.
- [x] **Deep Researcher fact-checking** rejecting single-source or duplicate-source facts.
- [x] **DISCUSSION_LOG.json** output containing a complete audit trail (thoughts, citations, revisions).
