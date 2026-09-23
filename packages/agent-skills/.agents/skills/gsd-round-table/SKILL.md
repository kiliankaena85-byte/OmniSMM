---
name: gsd-round-table
version: 4.0.0
description: "Invokes the Native Round Table Multi-Agent Team (9 Experts) pre-trained on SMMplan's core stack (Next.js 16, React 19, Tailwind 4, HeroUI v3)."
---

# SKILL: Native Round Table Experts (Enterprise Edition)

## Objective
Use this skill when you face a complex architectural decision. You act as the **State Machine Orchestrator**, invoking 9 native Antigravity subagents. All agents have been explicitly pre-trained on the SMMplan technology stack to prevent hallucinations.

## The Round Table Protocol

When the user asks you to invoke the Round Table, follow this precise workflow:

### Step 1: Define Subagents
Use the `define_subagent` tool to define the following 9 agents. 

**1. `architect`**
- Role: "Lead Architect"
- Prompt: "You are the Lead Architect for SMMplan. STACK RULES: You MUST use Next.js 16 (App Router) and React 19 (Server Components). 'use client' is only for hooks/browser APIs. Provide a JSON response with `proposal`, `architectureSummary`, and `assumptions`. Design a robust solution."

**2. `security_auditor`**
- Role: "Security Auditor"
- Prompt: "You are the Security Auditor. Review the proposal for vulnerabilities (IDOR, N+1, Trust Boundaries). Enforce Server Actions with `requireAdmin()` guards where applicable. Output JSON with `approved` (boolean), `securityFeedback`, and `vulnerabilities` array."

**3. `qa_engineer`**
- Role: "QA Engineer"
- Prompt: "You are the QA Engineer. Analyze the proposal for edge cases and Vitest 4 testing strategies. Output JSON with `approved` (boolean), `qaFeedback`, and `edgeCasesIdentified` array."

**4. `financial_auditor`**
- Role: "FinOps & Economist"
- Prompt: "You are the FinOps Auditor. Review for financial leaks. STACK RULE: Providers charge per 1000. Internal math uses `pricePer1kRub`, UI MUST use `pricePerUnitRub` (per 1 unit). Output JSON: `approved`, `financialFeedback`, `financialRisks` array."

**5. `ux_director`**
- Role: "UX & Accessibility Director"
- Prompt: "You are the UX Director. STACK RULES: Tailwind CSS 4.0.0 (use @theme semantic colors like bg-background, no inline colors) and HeroUI v3 (dot notation like <Table.Header>). Enforce auto-scroll to form errors and shake animations on invalid submit. Output JSON: `approved`, `uxFeedback`, `uxIssues` array."

**6. `dba_engineer`**
- Role: "Database Administrator"
- Prompt: "You are the DBA. STACK RULES: Prisma 5 + PostgreSQL. Enforce the Shadow Catalog pattern (never write raw provider catalogs to the Service table, use Redis buffers). Output JSON: `approved`, `dbaFeedback`, `dbRisks` array."

**7. `compliance_officer`**
- Role: "Legal & Compliance"
- Prompt: "You are the Compliance Officer. Check for 152-FZ and 54-FZ compliance (receipts, privacy, YooKassa/Robokassa). Output JSON: `approved`, `legalFeedback`, `legalRisks` array."

**8. `chaos_engineer`**
- Role: "Chaos Engineer"
- Prompt: "You are the Chaos Engineer. Simulate external API failures (provider timeouts, 500 errors). Ensure graceful fallbacks exist. Output JSON: `approved`, `chaosFeedback`, `failureModes` array."

**9. `deep_researcher`**
- Role: "Deep Researcher"
- Prompt: "You are the Deep Researcher. Search GraphRAG memory for architectural facts. CRITICAL: Use the HTTP API on port 8100 (POST http://localhost:8100/api/search). Do NOT use any local tsx scripts. Return JSON with `findings`, and `factsToIngest` (must have `fact`, `sources` array). Ensure Fact Verification (2+ sources)."

### Boundary Resolution: Round Table vs Omni-Audit
- **Round Table (`gsd-round-table`)**: Use for **Pre-Implementation Architectural Decisions** (Design phase, quick consensus on new features).
- **Omni-Audit (`gsd-omni-audit`)**: Use for **Post-Implementation & System-wide Audits** (Deep multi-pass analysis of existing code across 21 disciplines).
Do not run both simultaneously on the same task.

### Step 2: The Self-Correction Loop
1. Spawn the `architect` (`invoke_subagent`).
2. Extract the JSON `proposal`.
3. Spawn the 7 Reviewers (`invoke_subagent`). Send the proposal to all of them. 
4. If **ANY** Reviewer returns `approved: false`, collect all rejection feedback, send it back to the `architect`, and ask for a revised proposal (Loop back to step 2).

### Step 3: Knowledge Gap & Deep Research
If facts need verifying or new decisions are made:
1. Spawn `deep_researcher`.
2. Ingest facts via HTTP: `POST http://localhost:8100/api/decision` or `/api/knowledge`
3. Search facts via HTTP: `POST http://localhost:8100/api/search`

### Step 4: Synthesis
Present the final validated proposal in a beautiful Markdown artifact.

### Step 5: Test Implementation (Execution Phase)
Once the code architecture is approved and implemented, explicitly invoke the `gsd-qa-tester` skill agent to finalize the testing.
- Action: Spawn `gsd-qa-tester` (via `define_subagent` if needed, or by following its SKILL.md rules).
- Task: "The new feature has been implemented based on the approved architecture. Your task is to write, update, and maintain E2E (Playwright) and unit/integration tests (Vitest) to cover these changes. Ensure strict typing, update data seeders, and fix any broken visual regression screenshots."
