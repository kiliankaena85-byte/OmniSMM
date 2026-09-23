import fs from 'fs';
import path from 'path';
import { validateEvidencePack, EvidencePack } from './evidence-validator';

export interface EvalRunResult {
  eval_id: string;
  passed: boolean;
  actualValid: boolean;
  expectedValid: boolean;
  matchedErrorsCount: number;
}

export function runGoldenEvals(): { passed: boolean; results: EvalRunResult[] } {
  const goldenDir = path.resolve(process.cwd(), '.antigravity/evals/golden');
  const expectedDir = path.resolve(process.cwd(), '.antigravity/evals/expected');

  if (!fs.existsSync(goldenDir)) {
    console.error(`Golden evals directory not found: ${goldenDir}`);
    return { passed: false, results: [] };
  }

  const files = fs.readdirSync(goldenDir).filter(f => f.endsWith('.json'));
  const results: EvalRunResult[] = [];
  let allPassed = true;

  for (const file of files) {
    const evalId = file.replace('.json', '');
    const goldenPath = path.join(goldenDir, file);
    const expectedPath = path.join(expectedDir, `${evalId}.expected.json`);

    const goldenData: EvidencePack = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    const expectedData = fs.existsSync(expectedPath) ? JSON.parse(fs.readFileSync(expectedPath, 'utf8')) : {};

    const actualReport = validateEvidencePack(goldenData);
    const expectedValid = expectedData.valid ?? false;

    const validMatch = actualReport.valid === expectedValid;
    let errorsMatch = true;

    if (expectedData.rejectedControls) {
      for (const ctrlId of expectedData.rejectedControls) {
        if (!actualReport.rejectedControls.includes(ctrlId)) {
          errorsMatch = false;
        }
      }
    }

    const evalPassed = validMatch && errorsMatch;
    if (!evalPassed) allPassed = false;

    results.push({
      eval_id: evalId,
      passed: evalPassed,
      actualValid: actualReport.valid,
      expectedValid,
      matchedErrorsCount: actualReport.errors.length
    });
  }

  return { passed: allPassed, results };
}

if (require.main === module) {
  console.log('=== AEARH GOLDEN EVALS RUNNER ===');
  const res = runGoldenEvals();
  console.log(JSON.stringify(res, null, 2));

  if (!res.passed) {
    console.error('\nFAIL: Some golden evals failed validation checks!');
    process.exit(1);
  } else {
    console.log('\nSUCCESS: All golden evals passed matching expected criteria.');
  }
}
