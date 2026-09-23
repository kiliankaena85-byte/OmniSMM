import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('? OPENROUTER_API_KEY is not configured in .env');
  process.exit(1);
}

const MobileAuditFindingSchema = z.object({
  findingId: z.string(),
  standardRef: z.string().describe('e.g. WCAG 2.2 SC 2.5.8, Apple HIG Touch Target, Material 3 Stepper, ISO 9241-11'),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'PASS']),
  component: z.string(),
  description: z.string(),
  reproductionOrScenario: z.string(),
  recommendation: z.string()
});

const MobileAuditReportSchema = z.object({
  auditorModel: z.string(),
  mobileScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  findings: z.array(MobileAuditFindingSchema),
  strengths: z.array(z.string())
});

type MobileAuditReport = z.infer<typeof MobileAuditReportSchema>;

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'SMMplan Mobile Audit Engine',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Respond ONLY with a valid JSON object in a ```json codeblock.' },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('OpenRouter HTTP ' + response.status + ': ' + errText);
  }

  const json = await response.json();
  return json.choices[0]?.message?.content || '{}';
}

async function main() {
  console.log('\x1b[36m=================================================================\x1b[0m');
  console.log('\x1b[36m?? SMMplan Mobile UX & Architecture Swarm Audit (OpenRouter)\x1b[0m');
  console.log('\x1b[36m=================================================================\x1b[0m\n');

  // Read mobile code files
  const mobileWizardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/order-engine/MobileWizard.tsx'), 'utf-8');
  const useMobileWizardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/order-engine/wizard-steps/useMobileWizard.ts'), 'utf-8');
  const step1Code = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx'), 'utf-8');
  const step2Code = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/order-engine/wizard-steps/MobileStep2Category.tsx'), 'utf-8');
  const step3Code = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/order-engine/wizard-steps/MobileStep3Service.tsx'), 'utf-8');
  const step4Code = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx'), 'utf-8');
  const smartLandingCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/SmartLinkLanding.tsx'), 'utf-8');

  const contextCode = [
    '=== SmartLinkLanding.tsx ===',
    smartLandingCode.slice(0, 4000),
    '=== MobileWizard.tsx ===',
    mobileWizardCode,
    '=== useMobileWizard.ts ===',
    useMobileWizardCode,
    '=== MobileStep1Link.tsx ===',
    step1Code,
    '=== MobileStep2Category.tsx ===',
    step2Code,
    '=== MobileStep3Service.tsx ===',
    step3Code,
    '=== MobileStep4Checkout.tsx ===',
    step4Code
  ].join('\n\n');

  const systemPrompt = `You are a Senior Mobile Usability & Systems Architect Auditor evaluating an e-commerce mobile order flow.
You audit strictly against international UI/UX standards:
1. WCAG 2.2 Success Criterion 2.5.8 (Target Size - Minimum 24x24 CSS px, preferably 44x44px for primary actions).
2. Apple Human Interface Guidelines for iOS Touch Ergonomics (Thumb zone reachability, minimum 44x44 pt tap targets).
3. Google Material Design 3 Guidelines for Steppers & Mobile Form Flows (No dead-ends, fluid bidirectional state transitions).
4. ISO 9241-11 Ergonomics of human-system interaction (Usability, effectiveness, efficiency, satisfaction).
5. React 19 Hydration & State Machine Invariants (Zero duplicate inputs, zero unmounted state traps, smooth transitions).

Output STRICT JSON conforming to this schema:
{
  "auditorModel": "string",
  "mobileScore": 95,
  "executiveSummary": "string",
  "findings": [
    {
      "findingId": "MOB-001",
      "standardRef": "string",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASS",
      "component": "string",
      "description": "string",
      "reproductionOrScenario": "string",
      "recommendation": "string"
    }
  ],
  "strengths": ["string"]
}`;

  const userPrompt = `Audit the mobile order flow implementation provided below:

` + contextCode + `

Evaluate:
1. Is there ANY duplicate link input on mobile view (< md)?
2. When a user navigates Catalog -> Category -> Service without entering a URL beforehand, does the wizard smoothly proceed to Step 4 (Checkout with Link, Quantity, Email) without resetting back to Step 1?
3. Are touch targets (buttons, tariff cards, stepper buttons) compliant with WCAG 2.2 AA (>= 44px height)?
4. Is there any React 19 hydration mismatch risk?
5. Are inputs keyboard-safe and accessible?`;

  console.log('🚀 Dispatching Mobile Audit Swarm via OpenRouter (inclusionai/ling-3.0-flash-fin:free)...');
  const rawResponse = await callOpenRouter('inclusionai/ling-3.0-flash-fin:free', systemPrompt, userPrompt);
  
  let report: MobileAuditReport;
  try {
    report = MobileAuditReportSchema.parse(JSON.parse(rawResponse));
  } catch {
    const cleaned = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
    report = MobileAuditReportSchema.parse(JSON.parse(cleaned));
  }

  console.log('\n\x1b[32m=================================================================\x1b[0m');
  console.log('\x1b[32m📊 MOBILE AUDIT SCORE: ' + report.mobileScore + '/100\x1b[0m');
  console.log('\x1b[32m🤖 Auditor Model: ' + report.auditorModel + '\x1b[0m');
  console.log('\x1b[32m=================================================================\x1b[0m\n');
  console.log('\x1b[33mExecutive Summary:\x1b[0m\n' + report.executiveSummary + '\n');

  console.log('\x1b[34m🏆 Strengths:\x1b[0m');
  report.strengths.forEach((s, idx) => console.log('  ' + (idx + 1) + '. ' + s));

  console.log('\n\x1b[35m🔍 Detailed Findings:\x1b[0m');
  report.findings.forEach((f) => {
    const color = f.severity === 'PASS' ? '\x1b[32m' : f.severity === 'LOW' ? '\x1b[34m' : f.severity === 'MEDIUM' ? '\x1b[33m' : '\x1b[31m';
    console.log('\n  ' + color + '[' + f.severity + '] ' + f.findingId + ' - ' + f.component + '\x1b[0m');
    console.log('    Standard: ' + f.standardRef);
    console.log('    Description: ' + f.description);
    console.log('    Recommendation: ' + f.recommendation);
  });

  const reportPath = path.resolve(process.cwd(), 'scripts/harness/mobile-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('\n\x1b[36m📁 Audit report saved to ' + reportPath + '\x1b[0m\n');
}

main().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
