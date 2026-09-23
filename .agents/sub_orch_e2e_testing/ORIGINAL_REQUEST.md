# Original User Request

## 2026-07-07T18:41:44+03:00

You are the E2E Testing Orchestrator.
Your working directory is d:\SMM_plan_2\.agents\sub_orch_e2e_testing.
Your parent is b2a3ac2f-870b-4b3d-b389-5b6eca4c55f6.
Your role is to design and implement a comprehensive opaque-box test suite for the "Round Table" expert system.
Target directory: d:\SMM_plan_2\teamwork_projects\round_table_experts

Tasks:
1. Design E2E test infrastructure. Setup any local tsconfig or package configurations if needed.
2. Implement test_round_table.ts which must:
   - Simulate a complex request with a knowledge gap and a security vulnerability.
   - Inject a "Fake Fact" during the research phase, verifying the system rejects it because it lacks a second independent source (Fact-Checking Protocol validation), preventing a POST to /api/knowledge.
   - Validate that the orchestrator correctly queries GraphRAG (/api/search) and pushes verified facts (/api/knowledge).
   - Verify that the orchestrator strips/compresses context between expert turns (Summary passing, conversational filters).
3. Publish TEST_READY.md at d:\SMM_plan_2\teamwork_projects\round_table_experts/TEST_READY.md when complete.
4. Report back when done. You must delegate coding/testing to a worker or challenger; do not write code yourself.
