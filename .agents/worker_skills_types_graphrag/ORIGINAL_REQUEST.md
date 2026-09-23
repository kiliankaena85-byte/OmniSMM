## 2026-07-07T15:48:18Z

You are a teamwork_preview_worker.
Your working directory is d:\SMM_plan_2\.agents\worker_skills_types_graphrag.
Your task is to implement:
1. The 4 SKILL.md files under d:\SMM_plan_2\teamwork_projects\round_table_experts\skills/:
   - skills/architect.md
   - skills/security_auditor.md
   - skills/qa_engineer.md
   - skills/deep_researcher.md
2. src/types.ts
3. src/graphrag.ts

Here are the detailed specifications for each:

### 1. SKILL.md Files (in d:\SMM_plan_2\teamwork_projects\round_table_experts/skills/):
- **architect.md**: Instructions for architectural drafting, defining Server/Client boundaries, React 19 / Next.js 16 App Router structure, component sizes (<150 lines), design token usages (globals.css tokens, no hardcoded colors).
- **security_auditor.md**: Instructions for auditing drafts. Focus on OWASP Top 10, IDOR, Trust Boundary enforcement (verifying prices on the server, not UI), payment gateway compliance, session anomaly checks, compliance with Russian laws (152-FZ, 54-FZ, consumer protection).
- **qa_engineer.md**: Instructions for QA and UI verification. Focus on WCAG 2.2 AA accessibility, touch target sizes (>=44px), visual/UX density, forms validation rules (submit handler only, auto-scroll and focus first error, key-based re-triggerable shake animation).
- **deep_researcher.md**: Instructions for multi-pass research and GraphRAG vector search. Checks provider APIs, pricing models (USD pricing, margin calculation with CB RF cross-rate, converting in catalog to pricePerUnitRub shown in UI).

### 2. src/types.ts:
Define the following interfaces and Zod schemas:
- `ExpertRole`: 'architect' | 'security_auditor' | 'qa_engineer' | 'deep_researcher'
- `UserRequest`: Zod schema and TypeScript type for the initial user request.
- `Draft`: Zod schema and TypeScript type for a Maker (Architect/Deep Researcher) draft. Fields: `role` (ExpertRole), `content` (string), `citations` (array of string).
- `Review`: Zod schema and TypeScript type for a Checker (Security/QA) review. Fields: `reviewer` (ExpertRole), `status` ('approved' | 'rejected'), `comments` (string), `issues` (array of string).
- `Synthesis`: Zod schema and TypeScript type for the final consensus synthesis. Fields: `finalResponse` (string), `consensusReached` (boolean), `openItems` (array of string), `logPath` (string).
- `DiscussionLog`: Zod schema and TypeScript type. Fields: `requestId` (string), `request` (string), `steps` (array of step details), `citations` (array of string).

### 3. src/graphrag.ts:
Implement a client class/functions for GraphRAG operations:
- `search(query: string): Promise<any>`
  - Sends a `POST` to `http://localhost:8100/api/search`.
  - Strict limits: Must pass `top_k: 3`.
  - Collections to query: `["architecture_decisions", "business_rules", "coding_conventions"]`.
- `ingest(title: string, content: string, category: string, sources: string[]): Promise<any>`
  - Performs multi-source validation: must verify the fact in 2+ independent sources (validate length of `sources` >= 2).
  - Calculates confidence score based on the validation (e.g., scale 0.0 to 1.0 depending on the number of sources or specific rules).
  - Sends a `POST` to `http://localhost:8100/api/knowledge` with payload including: `title`, `content`, `category`, and `confidence_score`.
- `compressContext(messages: string[], maxLimit: number): string`
  - Context compression utility: Performs summary passing, conversational filtering (e.g. filters out system or greeting boilerplate), and enforces strict RAG limit (truncating or summary truncation to fit within `maxLimit` characters/tokens).

Make sure the files are correctly saved and that TypeScript compiled output is verified. Check typescript compilation via `npx tsc --noEmit` from the `round_table_experts` directory.
Write a `handoff.md` in your working directory (`d:\SMM_plan_2\.agents\worker_skills_types_graphrag`) once complete, outlining what was created, compilation results, and verification steps.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
