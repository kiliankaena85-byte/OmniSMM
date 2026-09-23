import { z } from 'zod';

export const SkillDomainSchema = z.enum([
  'domain_boundary',
  'concurrency_acid',
  'resilience_multitenant',
  'api_blast_nfr',
  'ai_governance',
  'infra_host_ops',
  'security_defense',
  'spec_driven_dev',
  'frontend_ui'
]);

export type SkillDomain = z.infer<typeof SkillDomainSchema>;

export const SkillManifestSchema = z.object({
  name: z.string().min(3).regex(/^[a-z0-9-]+$/),
  title: z.string().min(5),
  description: z.string().min(15),
  domain: SkillDomainSchema,
  keywords: z.array(z.string()).min(2),
  maxL1Lines: z.number().int().default(65),
  hardInvariants: z.array(z.string()).min(1)
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

export const SkillRouteMatchSchema = z.object({
  name: z.string(),
  title: z.string(),
  domain: SkillDomainSchema,
  confidence: z.number().min(0).max(1),
  matchedKeywords: z.array(z.string()),
  corePath: z.string(),
  deepPath: z.string(),
  coreContent: z.string().optional()
});

export type SkillRouteMatch = z.infer<typeof SkillRouteMatchSchema>;

export const SkillRoutingResultSchema = z.object({
  query: z.string(),
  matchedSkills: z.array(SkillRouteMatchSchema),
  totalTokensEstimated: z.number().nonnegative(),
  bundledCorePrompt: z.string()
});

export type SkillRoutingResult = z.infer<typeof SkillRoutingResultSchema>;

export const SkillEvolutionLessonSchema = z.object({
  skillName: z.string(),
  incidentSlug: z.string().min(3),
  triggerCondition: z.string().min(10),
  solutionPattern: z.string().min(10),
  verifiedDate: z.string().regex(/^202[0-9]-[0-1][0-9]-[0-3][0-9]$/)
});

export type SkillEvolutionLesson = z.infer<typeof SkillEvolutionLessonSchema>;
