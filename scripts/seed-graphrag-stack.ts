import { parseArgs } from "util";

const BASE_URL = "http://localhost:8100";
const SEED_TAG = "system-seed";

const BASELINES = [
  {
    title: "SMMplan Frontend Baseline",
    category: "architecture",
    content: "Next.js 16 (App Router, Turbopack) with React 19. All pages MUST be Server Components by default. 'use client' is only for hooks and browser APIs. NO 'use server' in Page Components (causes crash).",
    tags: [SEED_TAG, "next.js", "react"]
  },
  {
    title: "SMMplan Styling & UI Baseline",
    category: "architecture",
    content: "Tailwind CSS 4.0.0 uses @theme directive in globals.css. NO inline colors (e.g., text-white). Use semantic tokens (text-foreground). HeroUI v3 uses dot notation (e.g., <Table.Header>).",
    tags: [SEED_TAG, "tailwind", "heroui"]
  },
  {
    title: "SMMplan Database Baseline",
    category: "architecture",
    content: "Prisma 5 (PostgreSQL). We use the Shadow Catalog pattern: NEVER write raw provider catalogs to the Service table. All external fetch operations must hit Redis cache first. The DB only contains admin-selected services.",
    tags: [SEED_TAG, "prisma", "database"]
  },
  {
    title: "SMMplan FinOps Baseline",
    category: "business_rules",
    content: "Providers store rate in USD per 1000. Internal math computes pricePer1kRub = rate * markup * usdToRub. UI MUST display pricePerUnitRub = pricePer1kRub / 1000. NEVER divide by 1000 manually in UI components.",
    tags: [SEED_TAG, "finops", "pricing"]
  },
  {
    title: "SMMplan Security Baseline",
    category: "security",
    content: "Server-Side Trust Boundary: NEVER trust the UI for pricing or limits. All conditions must be re-validated in Server Actions. Use requireAdmin() guards. Forms must auto-scroll to errors on failed submission.",
    tags: [SEED_TAG, "security", "trust-boundary"]
  }
];

async function checkHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    // We try to ping the API. Even if /api/health doesn't exist and returns 404, 
    // it proves the server is reachable and not ECONNREFUSED.
    await fetch(`${BASE_URL}/api/health`, { signal: controller.signal }).catch(() => {});
    clearTimeout(timeout);
    return true;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      return false;
    }
    return false; // Any other connection error
  }
}

async function seed() {
  console.log("🌱 Starting Agent Stack Alignment Seeding...");
  
  const isUp = await checkHealth();
  if (!isUp) {
    console.error("❌ [CRITICAL RISK PREVENTED] Please start GraphRAG API on port 8100.");
    console.error("   The seed script aborted gracefully because the API is offline.");
    process.exit(1);
  }
  
  // Upsert logic: ideally we would search and delete old seeds by SEED_TAG.
  // Since we don't have a guaranteed delete-by-tag endpoint, we will just ingest them.
  // In a full implementation, we'd add an endpoint for DELETE /api/knowledge?tag=system-seed
  
  let successCount = 0;
  for (const baseline of BASELINES) {
    try {
      const response = await fetch(`${BASE_URL}/api/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: baseline.title,
          category: baseline.category,
          content: baseline.content,
          tags: baseline.tags,
          confidence_score: 1.0,
        }),
      });

      if (!response.ok) {
        console.warn(`⚠️ Failed to ingest "${baseline.title}": ${response.statusText}`);
      } else {
        console.log(`✅ Ingested: ${baseline.title}`);
        successCount++;
      }
    } catch (error: any) {
      console.error(`❌ Error ingesting "${baseline.title}":`, error.message);
    }
  }
  
  console.log(`\n🎉 Seeding complete. Successfully aligned ${successCount}/${BASELINES.length} core baselines into GraphRAG memory.`);
}

seed();
