"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionLogSchema = exports.StepDetailSchema = exports.SynthesisSchema = exports.ReviewSchema = exports.DraftSchema = exports.UserRequestSchema = exports.ExpertRoleSchema = exports.DeepResearcherOutputSchema = exports.FactToIngestSchema = exports.QAEngineerOutputSchema = exports.SecurityAuditorOutputSchema = exports.ArchitectOutputSchema = void 0;
const zod_1 = require("zod");
// --- Original Schemas & Types (for backward compatibility) ---
exports.ArchitectOutputSchema = zod_1.z.object({
    proposal: zod_1.z.string(),
    architectureSummary: zod_1.z.string(),
    assumptions: zod_1.z.array(zod_1.z.string()),
});
exports.SecurityAuditorOutputSchema = zod_1.z.object({
    approved: zod_1.z.boolean(),
    vulnerabilities: zod_1.z.array(zod_1.z.string()),
    securityFeedback: zod_1.z.string(),
});
exports.QAEngineerOutputSchema = zod_1.z.object({
    approved: zod_1.z.boolean(),
    edgeCasesIdentified: zod_1.z.array(zod_1.z.string()),
    qaFeedback: zod_1.z.string(),
});
exports.FactToIngestSchema = zod_1.z.object({
    fact: zod_1.z.string(),
    sources: zod_1.z.array(zod_1.z.string()),
    confidence_score: zod_1.z.number().min(0).max(1),
});
exports.DeepResearcherOutputSchema = zod_1.z.object({
    factsToIngest: zod_1.z.array(exports.FactToIngestSchema),
    findings: zod_1.z.string(),
});
// --- New Schemas & Types as per specifications ---
// 1. ExpertRole: 'architect' | 'security_auditor' | 'qa_engineer' | 'deep_researcher'
exports.ExpertRoleSchema = zod_1.z.enum([
    "architect",
    "security_auditor",
    "qa_engineer",
    "deep_researcher"
]);
// 2. UserRequest: Zod schema and TypeScript type for the initial user request
exports.UserRequestSchema = zod_1.z.object({
    requestId: zod_1.z.string(),
    request: zod_1.z.string(),
});
// 3. Draft: Zod schema and TypeScript type for a Maker (Architect/Deep Researcher) draft
exports.DraftSchema = zod_1.z.object({
    role: exports.ExpertRoleSchema,
    content: zod_1.z.string(),
    citations: zod_1.z.array(zod_1.z.string()),
});
// 4. Review: Zod schema and TypeScript type for a Checker (Security/QA) review
exports.ReviewSchema = zod_1.z.object({
    reviewer: exports.ExpertRoleSchema,
    status: zod_1.z.enum(["approved", "rejected"]),
    comments: zod_1.z.string(),
    issues: zod_1.z.array(zod_1.z.string()),
});
// 5. Synthesis: Zod schema and TypeScript type for the final consensus synthesis
exports.SynthesisSchema = zod_1.z.object({
    finalResponse: zod_1.z.string(),
    consensusReached: zod_1.z.boolean(),
    openItems: zod_1.z.array(zod_1.z.string()),
    logPath: zod_1.z.string(),
});
// Step Detail schema helper
exports.StepDetailSchema = zod_1.z.object({
    expert: zod_1.z.string(),
    input: zod_1.z.string(),
    output: zod_1.z.any(),
    timestamp: zod_1.z.string(),
    compressedContext: zod_1.z.string().optional(),
});
// 6. DiscussionLog: Zod schema and TypeScript type
exports.DiscussionLogSchema = zod_1.z.object({
    requestId: zod_1.z.string(),
    request: zod_1.z.string(),
    steps: zod_1.z.array(exports.StepDetailSchema),
    citations: zod_1.z.array(zod_1.z.string()),
    // Compatibility fields for orchestrator.ts
    requestPayload: zod_1.z.string().optional(),
    turns: zod_1.z.array(zod_1.z.any()).optional(),
    finalStatus: zod_1.z.enum(["approved", "rejected"]).optional(),
    factsIngested: zod_1.z.array(exports.FactToIngestSchema).optional(),
    createdAt: zod_1.z.string().optional(),
});
