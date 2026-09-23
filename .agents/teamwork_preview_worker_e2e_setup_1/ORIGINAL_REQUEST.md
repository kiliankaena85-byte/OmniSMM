## 2026-07-07T15:43:06Z
You are the E2E Test Writer for the "Round Table" expert system.
Your working directory is d:\SMM_plan_2\.agents\teamwork_preview_worker_e2e_setup_1.
Your task is to design and implement a comprehensive opaque-box test suite for the "Round Table" expert system.

Target directory: d:\SMM_plan_2\teamwork_projects\round_table_experts

Tasks:
1. Create the target directory d:\SMM_plan_2\teamwork_projects\round_table_experts and its src/ subfolder.
2. Design and create the E2E test infrastructure. Setup a local tsconfig.json extending the root config and a package.json for test scripts.
3. Define the TypeScript interfaces and Zod schemas in src/types.ts for the inter-expert communication based on the following:
   - Architect Output: proposal: string, architectureSummary: string, assumptions: string[]
   - Security Auditor Output: approved: boolean, vulnerabilities: string[], securityFeedback: string
   - QA Engineer Output: approved: boolean, edgeCasesIdentified: string[], qaFeedback: string
   - Deep Researcher Output: factsToIngest: Array<{ fact: string, sources: string[], confidence_score: number }>, findings: string
4. Implement test_round_table.ts using Vitest:
   - Spin up a mock HTTP server or stub the global fetch to intercept:
     - POST http://localhost:8100/api/search (GraphRAG Search)
     - POST http://localhost:8100/api/knowledge (GraphRAG Ingestion)
     - LLM calls (e.g. fetch requests to Gemini API or other LLM endpoints used by the orchestrator) to mock the expert agents' responses dynamically.
   - Simulate a complex request that contains a knowledge gap AND a security vulnerability:
     - The mock Architect first returns a proposal with a security vulnerability.
     - The mock Security Auditor rejects the proposal, triggering the Self-Correction Loop.
     - The mock Architect is called again with feedback and resolves the vulnerability.
     - The request triggers the Deep Researcher due to a knowledge gap.
     - The mock Deep Researcher returns two facts: one "Fake Fact" with only 1 source (or 2 identical sources) and one "Valid Fact" with >= 2 independent sources.
     - Assert that the system rejects the Fake Fact and only POSTs the Valid Fact to http://localhost:8100/api/knowledge with a confidence_score between 0.0 and 1.0.
   - Assert that the orchestrator correctly queried http://localhost:8100/api/search (top_k: 3).
   - Assert that the orchestrator strips/compresses context between expert turns (verifying that subsequent turns pass summaries or filtered messages instead of full conversation logs).
   - Assert that the final DISCUSSION_LOG.json is created and contains the complete audit trail (thoughts, citations, revisions).
5. Implement a basic/mock version of the orchestrator in src/orchestrator.ts (running the state machine, fetching GraphRAG, calling the mocked LLM, performing context compression, fact-checking sources, and writing DISCUSSION_LOG.json) to prove that your test suite runs successfully and all assertions pass.
6. Run the tests using vitest (e.g., `npx vitest run teamwork_projects/round_table_experts/test_round_table.ts`) and confirm they pass perfectly.
7. Publish TEST_READY.md at d:\SMM_plan_2\teamwork_projects\round_table_experts/TEST_READY.md with:
   - How to run tests command
   - Coverage summary and tier breakdown
   - Feature checklist
8. Report back with the test results and a summary of files created.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
