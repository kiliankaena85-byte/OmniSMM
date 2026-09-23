import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

async function main() {
  const prisma = new PrismaClient();
  try {
    const services = await prisma.service.findMany({
      include: {
        category: {
          include: {
            network: true
          }
        }
      }
    });

    console.log(`Starting deep audit of ${services.length} services...`);

    const errors: Array<{
      id: string;
      externalId: string | null;
      network: string;
      category: string;
      name: string;
      rule: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      details: string;
      proposedFix: {
        category?: string;
        targetType?: string;
        customDataType?: string;
      };
    }> = [];

    for (const s of services) {
      const name = s.name;
      const nameLower = name.toLowerCase();
      const desc = s.description || '';
      const descLower = desc.toLowerCase();
      const categoryName = s.category?.name || '';
      const categoryNameLower = categoryName.toLowerCase();
      const categorySlug = s.category?.slug || '';
      const networkName = s.category?.network?.name || 'Unknown';
      const networkSlug = s.category?.network?.slug || 'unknown';
      const targetType = s.targetType;
      const customDataType = s.customDataType;

      // Rule 1: Auto-services (multi-post) must target channel / channel_posts, not single post
      const isAuto = nameLower.includes('авто') || nameLower.includes('auto') || 
                     nameLower.includes('последних') || nameLower.includes('последние') || 
                     nameLower.includes('будущие') || nameLower.includes('на посты') || 
                     nameLower.includes('на новые посты');
      
      if (isAuto && targetType === 'POST') {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Auto-Service Link Target Mismatch',
          severity: 'HIGH',
          details: `Service seems to be auto-views or auto-reactions distributed over multiple posts, but targetType is set to 'POST' (which requires a single post link).`,
          proposedFix: { targetType: 'CHANNEL_POSTS' }
        });
      }

      // Rule 2: Subscribers / Members / Followers / Channel level boosts must target CHANNEL
      const isSubscriber = categoryNameLower.includes('подписч') || categoryNameLower.includes('участн') || 
                           categoryNameLower.includes('фолловер') || categoryNameLower.includes('subscriber') || 
                           categoryNameLower.includes('follower') || categoryNameLower.includes('групп') || 
                           categoryNameLower.includes('буст') || categoryNameLower.includes('boost') ||
                           categoryNameLower.includes('друзья') || categoryNameLower.includes('friend');
      
      if (isSubscriber && !nameLower.includes('истори') && !nameLower.includes('story') && !nameLower.includes('пост') && targetType === 'POST') {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Subscriber Target Type Mismatch',
          severity: 'HIGH',
          details: `Category is '${categoryName}' but targetType is 'POST'. It should be 'CHANNEL'.`,
          proposedFix: { targetType: 'CHANNEL' }
        });
      }

      // Rule 3: Single post services (likes, views, reactions, comments) must NOT target CHANNEL
      const isSinglePost = (categoryNameLower.includes('лайк') || categoryNameLower.includes('like') || 
                            categoryNameLower.includes('просмотр') || categoryNameLower.includes('view') || 
                            categoryNameLower.includes('реакц') || categoryNameLower.includes('reaction') || 
                            categoryNameLower.includes('репост') || categoryNameLower.includes('share') || 
                            categoryNameLower.includes('коммент') || categoryNameLower.includes('comment')) &&
                           !isAuto;
      
      if (isSinglePost && targetType === 'CHANNEL' && !nameLower.includes('канал') && !nameLower.includes('профиль') && !nameLower.includes('аккаунт')) {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Single Post Service Mapped to Channel',
          severity: 'HIGH',
          details: `Category is '${categoryName}' but targetType is 'CHANNEL'. It should be 'POST'.`,
          proposedFix: { targetType: 'POST' }
        });
      }

      // Rule 4: Comment services requiring custom text must have TEXTAREA customDataType
      const isCustomComment = nameLower.includes('свои комментари') || nameLower.includes('кастомные комментари') || 
                              nameLower.includes('со своим текстом') || nameLower.includes('custom comments') || 
                              nameLower.includes('custom text') || nameLower.includes('со своими') ||
                              nameLower.includes('текстовые') || descLower.includes('свой текст') || 
                              descLower.includes('свои комментари') || descLower.includes('кастомные комментари');
      
      if (isCustomComment && customDataType !== 'TEXTAREA' && !nameLower.includes('рандом')) {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Comment Service Custom Data Type Mismatch',
          severity: 'HIGH',
          details: `Service is custom/own comments, but customDataType is '${customDataType}'. Users cannot submit custom text. It should be 'TEXTAREA'.`,
          proposedFix: { customDataType: 'TEXTAREA' }
        });
      }

      // Rule 5: Poll / Vote services must have NUMBER customDataType
      const isPoll = (categoryNameLower.includes('опрос') || categoryNameLower.includes('голос') || 
                     categoryNameLower.includes('poll') || categoryNameLower.includes('vote') ||
                     nameLower.includes('опрос') || nameLower.includes('голос') || nameLower.includes('викторин')) &&
                     !nameLower.includes('автопросмотр') && !categoryNameLower.includes('автопросмотр') &&
                     !nameLower.includes('голосовой') && !categoryNameLower.includes('голосовой');
      
      if (isPoll && customDataType !== 'NUMBER') {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Poll Service Custom Data Type Mismatch',
          severity: 'MEDIUM',
          details: `Service is for polls/votes, but customDataType is '${customDataType}'. Users cannot select options. It should be 'NUMBER'.`,
          proposedFix: { customDataType: 'NUMBER' }
        });
      }

      // Rule 6: Platform keyword mismatch
      if (networkSlug === 'telegram' && (nameLower.includes('instagram') || nameLower.includes('vkontakte') || nameLower.includes('tiktok') || nameLower.includes('youtube'))) {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Network Platform Mismatch',
          severity: 'HIGH',
          details: `Service belongs to Telegram network but name contains keywords for other platforms.`,
          proposedFix: {}
        });
      }

      // Rule 7: Telegram Reactions Category Mismatch
      const isTgReactionKeyword = nameLower.includes('реакци') || nameLower.includes('reaction') || 
                                  nameLower.includes('эмодзи') || nameLower.includes('emoji') ||
                                  (nameLower.includes('👍') && nameLower.includes('🔥') && nameLower.includes('❤️'));
      
      if (isTgReactionKeyword && networkSlug === 'telegram' && !categoryNameLower.includes('реакц') && !categoryNameLower.includes('эмодзи') && !categoryNameLower.includes('автореакц')) {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Telegram Reaction Category Mismatch',
          severity: 'HIGH',
          details: `Telegram reaction service mapped to '${categoryName}' category. It should be in '🎭 Реакции / Эмодзи'.`,
          proposedFix: {} // Need to find appropriate category ID programmatically
        });
      }
      
      // Rule 8: Telegram Members / Subscribers in Reaction Category
      if (categoryNameLower.includes('реакц') && (nameLower.includes('подписч') || nameLower.includes('участн')) && !nameLower.includes('реакции на')) {
        errors.push({
          id: s.id,
          externalId: s.externalId,
          network: networkName,
          category: categoryName,
          name,
          rule: 'Subscriber in Reaction Category',
          severity: 'HIGH',
          details: `Subscriber service mapped to Reaction category.`,
          proposedFix: {}
        });
      }
    }

    console.log(`\n=== AUDIT COMPLETE: FOUND ${errors.length} ERRORS ===`);
    
    // Write markdown report
    let md = `# Catalog Deep Audit Report\n\n`;
    md += `**Total Services Audited:** ${services.length}\n`;
    md += `**Total Issues Found:** ${errors.length}\n\n`;
    
    md += `## Summary of Issues\n\n`;
    const severityCount = errors.reduce((acc, curr) => {
      acc[curr.severity] = (acc[curr.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    md += `- **HIGH Severity:** ${severityCount['HIGH'] || 0}\n`;
    md += `- **MEDIUM Severity:** ${severityCount['MEDIUM'] || 0}\n`;
    md += `- **LOW Severity:** ${severityCount['LOW'] || 0}\n\n`;

    md += `## Detailed Errors Table\n\n`;
    md += `| ID | Ext ID | Platform | Category | Name | Issue | Severity | Proposed Fix |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    
    for (const e of errors) {
      md += `| \`${e.id}\` | \`${e.externalId || 'N/A'}\` | ${e.network} | ${e.category} | ${e.name} | ${e.details} | **${e.severity}** | ${JSON.stringify(e.proposedFix)} |\n`;
    }

    md += `\n\n## Action Items & Recommendations\n`;
    md += `1. **Fix database records:** Run a script to apply the proposed fixes.\n`;
    md += `2. **Update smart-analyzer.logic.ts:** Refine keyword mappings so that subsequent catalog synchronizations don't re-introduce these errors.\n`;

    fs.writeFileSync('scripts/comprehensive-services-audit-report.md', md, 'utf-8');
    console.log(`Report written to scripts/comprehensive-services-audit-report.md`);

  } catch (error) {
    console.error('Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
