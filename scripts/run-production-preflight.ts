import { execSync } from "child_process";

interface CheckStep {
  name: string;
  category: string;
  command: string;
}

const STEPS: CheckStep[] = [
  {
    name: "TypeScript Strict Typecheck (Next.js 16 & React 19)",
    category: "TYPES",
    command: "npx tsc --noEmit",
  },
  {
    name: "Tailwind CSS 4 Semantic Design Tokens Audit (UI Arsenal)",
    category: "DESIGN",
    command: "npx tsx scripts/check-design-system.ts src/components/ui",
  },
  {
    name: "Legal Compliance Suite (5 Documents, 152-FZ, 54-FZ, 115-FZ, 15-40% FPR)",
    category: "LEGAL",
    command: "npx dotenv -e .env.test -- npx vitest run src/__tests__/legal/legal-compliance-and-enterprise-pages.test.ts",
  },
  {
    name: "ExactMath Financial Calculations & Half-Even Rounding",
    category: "FINANCE",
    command: "npx dotenv -e .env.test -- npx vitest run src/__tests__/financial/exact-math.test.ts",
  },
  {
    name: "Drip-Feed Floor Invariant & Runs Integrity",
    category: "E2E",
    command: "npx dotenv -e .env.test -- npx vitest run src/__tests__/orders/drip-feed-min-quantity-and-runs-integrity.test.ts",
  },
  {
    name: "Safe InProgress TTL & Anti-Drain Financial Invariant",
    category: "FINANCE",
    command: "npx dotenv -e .env.test -- npx vitest run src/__tests__/orders/safe-in-progress-ttl-and-anti-drain.test.ts",
  },
  {
    name: "Order TTL & Provider Lifecycle Matrix (Manual SMM Prime, Drip-Feed, Provider Not Found)",
    category: "E2E",
    command: "npx dotenv -e .env.test -- npx vitest run src/__tests__/orders/order-ttl-and-provider-lifecycle-matrix.test.ts",
  },
  {
    name: "Self-Learning Immunity & Architectural Invariant Audit (F-9.1, F-7.2, F-7.3, HTTP/2)",
    category: "IMMUNITY",
    command: "npx tsx scripts/harness/self-learning-immunity.ts",
  },
  {
    name: "Comprehensive Pentest & Security Invariant Battery",
    category: "SECURITY",
    command: "npx dotenv -e .env.test -- npx vitest run src/__tests__/pentest/comprehensive-pentest.test.ts",
  },
];

async function runPreflight() {
  console.log("\n================================================================");
  console.log("   OMNISMM 1.0 — PRODUCTION GO-LIVE AUTOMATED PREFLIGHT BATTERY");
  console.log("================================================================\n");

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    process.stdout.write(`[${i + 1}/${STEPS.length}] ${step.name}... `);
    
    try {
      execSync(step.command, { stdio: "pipe", encoding: "utf8" });
      console.log("✅ PASS");
      passed++;
    } catch (err: any) {
      console.log("❌ FAIL");
      console.error(`\n--- ERROR IN STEP ${step.name} ---\n`, err.stdout || err.message);
      failed++;
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n================================================================");
  console.log(`📊 RESULTS: ${passed}/${STEPS.length} PASSED (${failed} failed) in ${durationSec}s`);
  
  if (failed === 0) {
    console.log("🎉 VERDICT: 🟢 READY FOR PRODUCTION GO-LIVE (100% PASS)");
    console.log("================================================================\n");
    process.exit(0);
  } else {
    console.log("⚠️ VERDICT: 🔴 BLOCKED — FIX ISSUES BEFORE GO-LIVE");
    console.log("================================================================\n");
    process.exit(1);
  }
}

runPreflight();
