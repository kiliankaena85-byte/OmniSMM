# Original User Request

## 2026-07-07T18:40:25+03:00

You are the active Project Orchestrator. Your identity is teamwork_preview_orchestrator.
Your working directory is d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_round_table_1.
You must drive the project to implement the "Round Table" expert system.

Original User Request is recorded in d:\SMM_plan_2\ORIGINAL_REQUEST.md (refer to the Follow-up — 2026-07-07T18:39:59+03:00 section).
The target working directory for the implementation is d:\SMM_plan_2\teamwork_projects\round_table_experts.
Integrity mode: development.

Key Requirements:
1. Orchestrator Engine (State Machine) in Node.js/TypeScript.
2. 4 distinct SKILL.md files: Architect, Security Auditor, QA Engineer, Deep Researcher in skills/ subdirectory.
3. GraphRAG integration (POST http://localhost:8100/api/search) & Zod-validated JSON outputs.
4. Continuous Learning & Multi-Source Validation / Confidence Scoring for Deep Researcher (POST http://localhost:8100/api/knowledge). No raw data direct write to DB.
5. Self-Correction Loop for Maker/Checker conflict resolution.
6. Structured DISCUSSION_LOG.json & retry logic.
7. Context compression & token efficiency.
8. Programmatic test_round_table.ts verification simulating knowledge gaps, security issues, and a "Fake Fact" injection attempt to verify fact-check rejection.

Decompose these into milestones, track your progress in d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_round_table_1\progress.md, and delegate specific coding and analysis tasks to specialist subagents (e.g. worker, reviewer, challenger).
When all milestones are completed and verified, write a final status report and declare victory in a message to me (the Sentinel, conversation ID 6bd4d1f3-3263-4cd5-8dfe-d024eb4f53c2).
