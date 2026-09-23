import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Output Schema corresponding to the Multi-Pass Prompt
const ExtractedMetaSchema = z.object({
  geo: z.string().optional(),
  warrantyDays: z.number().optional(),
  quality: z.string().optional(),
  speed: z.string().optional(),
  start: z.string().optional(),
});

const RebrandOutputSchema = z.object({
  original_id: z.string(),
  newName: z.string().min(3),
  newDescription: z.string().min(10),
  extractedMeta: ExtractedMetaSchema
});

// Since the LLM returns an array of these
const BatchOutputSchema = z.array(RebrandOutputSchema);

const prisma = new PrismaClient();

const BATCH_SIZE = 15;
const DELAY_MS = 2000;

const PROMPT_FILE = path.join(process.cwd(), '..', '..', 'C:', 'Users', 'Артём', '.gemini', 'antigravity', 'brain', '06ce89dc-6a11-47fe-bacd-ab25d4e2434e', 'catalog_copywriting_prompt.md');

// We fallback to hardcoded if prompt file location is tricky
const SYSTEM_PROMPT = `
Вы — Старший AI Архитектор и Копирайтер API SMM Панели.
Ваша задача — структурировать массив грязных услуг. Возвращайте СТРОГО массив JSON без markdown-кода \`\`\`json.
Формат массива: [{"original_id": "...", "newName": "...", "newDescription": "...", "extractedMeta": {"geo": "...", "warrantyDays": 0, "quality": "...", "speed": "...", "start": "..."}}]
В newDescription обязательно используйте маркированные списки с эмодзи (⚡️ Запуск, 🚀 Скорость, 💧 Качество, 🛡 Гарантия).
`;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processBatch(services: any[], apiKey: string): Promise<any[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`;
  
  const payloadStr = JSON.stringify(services.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description || ""
  })));

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          { text: "INCOMING SERVICES BATCH:\n" + payloadStr }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2, // Low temp for structured adherence
      topP: 0.8,
      topK: 40,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${err}`);
  }

  const data = await (response.json() as Promise<any>);
  const textRaw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textRaw) {
    throw new Error('Empty response from LLM');
  }

  try {
    const parsedJson = JSON.parse(textRaw);
    // Validate with Zod
    return BatchOutputSchema.parse(parsedJson);
  } catch (err: any) {
    console.error("Failed to parse or validate LLM JSON output:", textRaw.substring(0, 200) + '...');
    throw err;
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const isApply = process.argv.includes('--apply');
  
  console.log('🤖 AI Catalog Rebrander Initiated');
  if (!apiKey) {
    console.error('❌ Missing GEMINI_API_KEY in environment variables.');
    process.exit(1);
  }

  if (!isApply) {
    console.log('👀 DRY RUN MODE. Pass --apply to save changes to DB.');
  }

  // Find all active services that don't have extracted features yet
  const services = await prisma.service.findMany({
    where: { isActive: true, features: { equals: Prisma.DbNull } },
    take: 100 // Limit for safety / demonstration
  });

  console.log(`Found ${services.length} services pending AI processing.`);

  let successCount = 0;

  for (let i = 0; i < services.length; i += BATCH_SIZE) {
    const batch = services.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)...`);
    
    try {
      const results = await processBatch(batch, apiKey);
      
      for (const res of results) {
         if (isApply) {
            await prisma.service.update({
               where: { id: res.original_id },
               data: {
                  name: res.newName,
                  description: res.newDescription,
                  features: res.extractedMeta as any
               }
            });
         } else {
            console.log(`✅ [SIMULATED] ${res.newName}`);
            console.log(`   Meta:`, res.extractedMeta);
         }
         successCount++;
      }
      
    } catch (err: any) {
      console.error(`❌ Batch failed:`, err.message);
      // We continue to next batch instead of completely crashing
    }

    if (i + BATCH_SIZE < services.length) {
      console.log(`Sleeping ${DELAY_MS}ms to respect rate limits...`);
      await delay(DELAY_MS);
    }
  }

  console.log(`\n🎉 Processing Complete. Successfully parsed ${successCount} services.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
