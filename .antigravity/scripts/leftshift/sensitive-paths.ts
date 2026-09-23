export type RiskCategory = 'financial' | 'security' | 'race' | 'tenant';

export interface SensitivePathRule {
  category: RiskCategory;
  patterns: string[];
}

export const SENSITIVE_PATH_RULES: SensitivePathRule[] = [
  {
    category: 'financial',
    patterns: ['**/financial/**', '**/checkout/**', '**/wallet/**', '**/refund/**', '**/commission/**', '**/promo**']
  },
  {
    category: 'security',
    patterns: ['**/webhooks/**', '**/auth/**', '**/telegram/**', '**/session/**', '**/api/v2/**']
  },
  {
    category: 'race',
    patterns: ['**/workers/**', '**/processors/**', '**/cron/**', '**/dripfeed**']
  },
  {
    category: 'tenant',
    patterns: ['**/order.service**', '**/services/core/**', '**/api/v2/**']
  }
];

export function categorizeFile(filePath: string): RiskCategory[] {
  const categories = new Set<RiskCategory>();
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();

  for (const rule of SENSITIVE_PATH_RULES) {
    for (const pattern of rule.patterns) {
      const cleanPattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
      if (normalized.includes(cleanPattern)) {
        categories.add(rule.category);
      }
    }
  }

  return Array.from(categories);
}
