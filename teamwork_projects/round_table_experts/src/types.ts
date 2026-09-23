import { z } from "zod";

// --- Original Schemas & Types (for backward compatibility) ---
export const ArchitectOutputSchema = z.object({
  proposal: z.string(),
  architectureSummary: z.string(),
  assumptions: z.array(z.string()),
});

export const SecurityAuditorOutputSchema = z.object({
  approved: z.boolean(),
  vulnerabilities: z.array(z.string()),
  securityFeedback: z.string(),
});

export const QAEngineerOutputSchema = z.object({
  approved: z.boolean(),
  edgeCasesIdentified: z.array(z.string()),
  qaFeedback: z.string(),
});

export const FactToIngestSchema = z.object({
  fact: z.string(),
  sources: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
});

export const DeepResearcherOutputSchema = z.object({
  factsToIngest: z.array(FactToIngestSchema),
  findings: z.string(),
});

export type ArchitectOutput = z.infer<typeof ArchitectOutputSchema>;
export type SecurityAuditorOutput = z.infer<typeof SecurityAuditorOutputSchema>;
export type QAEngineerOutput = z.infer<typeof QAEngineerOutputSchema>;
export type FactToIngest = z.infer<typeof FactToIngestSchema>;
export type DeepResearcherOutput = z.infer<typeof DeepResearcherOutputSchema>;

export interface DiscussionTurn {
  expert: "Architect" | "SecurityAuditor" | "QAEngineer" | "DeepResearcher";
  input: string;
  output: any;
  timestamp: string;
  compressedContext?: string;
}

// --- New Schemas & Types as per specifications ---

// 1. ExpertRole: 'architect' | 'security_auditor' | 'qa_engineer' | 'deep_researcher'
export const ExpertRoleSchema = z.enum([
  "architect",
  "security_auditor",
  "qa_engineer",
  "deep_researcher"
]);
export type ExpertRole = z.infer<typeof ExpertRoleSchema>;

// 2. UserRequest: Zod schema and TypeScript type for the initial user request
export const UserRequestSchema = z.object({
  requestId: z.string(),
  request: z.string(),
});
export type UserRequest = z.infer<typeof UserRequestSchema>;

// 3. Draft: Zod schema and TypeScript type for a Maker (Architect/Deep Researcher) draft
export const DraftSchema = z.object({
  role: ExpertRoleSchema,
  content: z.string(),
  citations: z.array(z.string()),
});
export type Draft = z.infer<typeof DraftSchema>;

// 4. Review: Zod schema and TypeScript type for a Checker (Security/QA) review
export const ReviewSchema = z.object({
  reviewer: ExpertRoleSchema,
  status: z.enum(["approved", "rejected"]),
  comments: z.string(),
  issues: z.array(z.string()),
});
export type Review = z.infer<typeof ReviewSchema>;

// 5. Synthesis: Zod schema and TypeScript type for the final consensus synthesis
export const SynthesisSchema = z.object({
  finalResponse: z.string(),
  consensusReached: z.boolean(),
  openItems: z.array(z.string()),
  logPath: z.string(),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

// Step Detail schema helper
export const StepDetailSchema = z.object({
  expert: z.string(),
  input: z.string(),
  output: z.any(),
  timestamp: z.string(),
  compressedContext: z.string().optional(),
});
export type StepDetail = z.infer<typeof StepDetailSchema>;

// 6. DiscussionLog: Zod schema and TypeScript type
export const DiscussionLogSchema = z.object({
  requestId: z.string(),
  request: z.string(),
  steps: z.array(StepDetailSchema),
  citations: z.array(z.string()),

  // Compatibility fields for orchestrator.ts
  requestPayload: z.string().optional(),
  turns: z.array(z.any()).optional(),
  finalStatus: z.enum(["approved", "rejected"]).optional(),
  factsIngested: z.array(FactToIngestSchema).optional(),
  createdAt: z.string().optional(),
});
export type DiscussionLog = z.infer<typeof DiscussionLogSchema>;
