import fs from 'fs';
import path from 'path';

/**
 * CI Gate: Verify that /api-docs, robots.ts, sitemap.ts do not contain unauthorized hardcoded external domains.
 */
function main() {
  console.log('🛡️ [CI-GATE] Scanning api-docs and robots for forbidden hardcoded domains...');

  const filesToCheck = [
    path.join(process.cwd(), 'src/app/api-docs/page.tsx'),
    path.join(process.cwd(), 'src/app/robots.ts'),
    path.join(process.cwd(), 'src/app/sitemap.ts'),
  ];

  let hasErrors = false;
  const forbiddenPatterns = [
    /https:\/\/smmplan\.pro\/api\/v2/g,
    /http:\/\/0\.0\.0\.0/g,
    /http:\/\/host\.docker\.internal/g,
  ];

  for (const filePath of filesToCheck) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        console.error(`❌ [CI-GATE FAILED] Found forbidden hardcoded pattern ${pattern} in ${path.relative(process.cwd(), filePath)}`);
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    console.error('💥 CI Domain Gate failed! Replace hardcoded URLs with dynamic environment variables.');
    process.exit(1);
  }

  console.log('✅ [CI-GATE PASSED] 0 unauthorized hardcoded domains found in API docs & robots.');
}

main();
