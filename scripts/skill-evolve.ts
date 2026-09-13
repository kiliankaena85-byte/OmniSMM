import fs from 'fs';
import path from 'path';
import {
  SkillEvolutionLesson,
  SkillEvolutionLessonSchema
} from '../src/types/skills-contract';

const SKILLS_DIR = path.resolve(__dirname, '../.agents/skills');

export interface EvolveOptions {
  dryRun?: boolean;
}

export function evolveSkillWithLesson(
  rawLesson: unknown,
  options: EvolveOptions = {}
): { success: boolean; updatedContent?: string; error?: string } {
  try {
    const lesson = SkillEvolutionLessonSchema.parse(rawLesson);
    const skillPath = path.join(SKILLS_DIR, lesson.skillName, 'SKILL.md');

    if (!fs.existsSync(skillPath)) {
      return { success: false, error: `Skill ${lesson.skillName} does not exist at ${skillPath}` };
    }

    const currentContent = fs.readFileSync(skillPath, 'utf-8');

    // Проверка на идемпотентность
    if (currentContent.includes(lesson.incidentSlug)) {
      return {
        success: true,
        updatedContent: currentContent
      };
    }

    const lessonBlock = [
      `### [LESSON-${lesson.verifiedDate}] ${lesson.incidentSlug}`,
      `- **Trigger Condition:** ${lesson.triggerCondition}`,
      `- **Enforced Solution Pattern:** ${lesson.solutionPattern}`,
      `- **Verified Date:** ${lesson.verifiedDate}\n`
    ].join('\n');

    let updatedContent = '';
    const lessonsSectionHeader = '## Known Anti-Patterns & Lessons Learned';

    if (currentContent.includes(lessonsSectionHeader)) {
      // Вставляем сразу после заголовка секции
      const parts = currentContent.split(lessonsSectionHeader);
      updatedContent = parts[0] + lessonsSectionHeader + '\n\n' + lessonBlock + parts.slice(1).join(lessonsSectionHeader);
    } else {
      // Добавляем секцию в конец файла
      updatedContent = currentContent.trim() + '\n\n---\n\n' + lessonsSectionHeader + '\n\n' + lessonBlock;
    }

    if (!options.dryRun) {
      // Резервная копия
      const backupPath = `${skillPath}.bak`;
      fs.writeFileSync(backupPath, currentContent, 'utf-8');
      fs.writeFileSync(skillPath, updatedContent, 'utf-8');
    }

    return {
      success: true,
      updatedContent
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const match = args.find(a => a.startsWith(`--${name}=`));
    return match ? match.split('=')[1] : '';
  };

  const skillName = getArg('skill');
  const incidentSlug = getArg('slug');
  const triggerCondition = getArg('trigger');
  const solutionPattern = getArg('solution');
  const verifiedDate = getArg('date') || new Date().toISOString().split('T')[0];

  if (!skillName || !incidentSlug || !triggerCondition || !solutionPattern) {
    console.log('Usage: npx tsx scripts/skill-evolve.ts --skill=<name> --slug=<id> --trigger=<desc> --solution=<fix>');
    process.exit(1);
  }

  const result = evolveSkillWithLesson({
    skillName,
    incidentSlug,
    triggerCondition,
    solutionPattern,
    verifiedDate
  });

  if (result.success) {
    console.log(`✅ Skill "${skillName}" successfully evolved with lesson "${incidentSlug}"!`);
  } else {
    console.error(`❌ Failed to evolve skill: ${result.error}`);
    process.exit(1);
  }
}
