import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { ProxyAgent } from 'undici';

const prisma = new PrismaClient();

const BATCH_SIZE = 50;
const CONCURRENCY = 5;

async function callGeminiForBatch(servicesBatch: any[]): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  // Format batch into a readable string for the LLM
  const servicesData = servicesBatch.map(s => 
    `ID: ${s.id}
Network: ${s.category?.network?.name || 'UNKNOWN'}
Category: ${s.category?.name || 'UNKNOWN'}
Name: ${s.name}
TargetType: ${s.targetType}
CustomDataType: ${s.customDataType}`
  ).join('\n---\n');

  const systemInstruction = `You are a strict QA AI auditor for an SMM (Social Media Marketing) panel catalog.
Your task is to analyze the provided batch of services and find ONLY the ones that have mapping errors, logical mismatches, or legal risks.

Rules for correctness:
1. TargetType 'POST' is for single posts, likes, views.
2. TargetType 'CHANNEL' is for subscribers, groups, channel-wide boosts.
3. TargetType 'CHANNEL_POSTS' is for Auto-views or Auto-likes (e.g., "Последние X постов", "Автопросмотры").
4. TargetType 'STORY' is for stories.
5. CustomDataType 'NUMBER' is MANDATORY for Polls / Votes / Голосования / Опросы.
6. CustomDataType 'TEXTAREA' is MANDATORY for Custom Comments / Свои комментарии.
7. Legal Risk: Any service mentioning spam, hacks, or illegal actions must be flagged.

Analyze the services carefully. Note: "Автопросмотры" are NOT polls, they are views, so they don't need CustomDataType 'NUMBER'.

You MUST return a valid JSON array. If all services in the batch are perfectly fine, return an empty array: []
If you find anomalies, return an array of objects matching this structure:
[
  {
    "id": "cmqqaqx...",
    "anomalyType": "TARGET_TYPE_MISMATCH" | "CUSTOM_DATA_MISMATCH" | "LEGAL_RISK" | "CATEGORY_MISMATCH",
    "description": "Explanation of what is wrong",
    "suggestedFix": "What should be changed"
  }
]`;

  const model = 'gemini-3-flash';
  const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

  const proxyUrl = process.env.GEMINI_PROXY || process.env.HTTPS_PROXY;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: servicesData }] }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    }),
    dispatcher,
    signal: AbortSignal.timeout(60000)
  } as any);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  
  try {
    return JSON.parse(rawText);
  } catch (e) {
    console.error("Failed to parse JSON from LLM:", rawText);
    return [];
  }
}

async function processBatchWithRetry(batch: any[], retries = 2): Promise<any[]> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await callGeminiForBatch(batch);
    } catch (err: any) {
      console.warn(`Batch failed (Attempt ${i + 1}/${retries + 1}):`, err.message);
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function main() {
  console.log('Fetching all active services...');
  const services = await prisma.service.findMany({
    include: {
      category: {
        include: {
          network: true
        }
      }
    }
  });

  console.log(`Loaded ${services.length} services. Starting parallel AI scan...`);
  
  const batches = [];
  for (let i = 0; i < services.length; i += BATCH_SIZE) {
    batches.push(services.slice(i, i + BATCH_SIZE));
  }

  console.log(`Total batches to process: ${batches.length} (Batch size: ${BATCH_SIZE})`);

  let allAnomalies: any[] = [];
  let completed = 0;

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const chunkPromises = chunk.map(batch => processBatchWithRetry(batch));
    
    const chunkResults = await Promise.all(chunkPromises);
    for (const result of chunkResults) {
      if (Array.isArray(result)) {
        allAnomalies = allAnomalies.concat(result);
      }
    }
    
    completed += chunk.length;
    console.log(`Progress: ${completed} / ${batches.length} batches completed.`);
  }

  console.log(`\nAI Scan Complete! Found ${allAnomalies.length} potential anomalies.`);

  const dateStr = new Date().toISOString().split('T')[0];
  const reportDir = path.join(process.cwd(), '.planning', 'analytics', dateStr);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, 'ai-catalog-audit.json');
  fs.writeFileSync(reportPath, JSON.stringify(allAnomalies, null, 2), 'utf8');

  // Also write a markdown version
  let md = `# 🤖 AI Catalog Scan Report\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Services Scanned:** ${services.length}\n`;
  md += `**Anomalies Found:** ${allAnomalies.length}\n\n`;

  if (allAnomalies.length === 0) {
    md += `✅ AI did not find any mapping or legal anomalies!\n`;
  } else {
    md += `| ID | Type | Description | Suggested Fix |\n`;
    md += `|---|---|---|---|\n`;
    for (const a of allAnomalies) {
      md += `| \`${a.id}\` | **${a.anomalyType}** | ${a.description} | ${a.suggestedFix} |\n`;
    }
  }

  const mdPath = path.join(reportDir, 'ai-catalog-audit.md');
  fs.writeFileSync(mdPath, md, 'utf-8');

  console.log(`Saved reports to:\n- ${reportPath}\n- ${mdPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
