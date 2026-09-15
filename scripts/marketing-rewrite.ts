import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function callGemini(services: any[]): Promise<any[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment");

    const systemPrompt = `Ты — Директор по маркетингу премиальной SMM-панели Smmplan.
Твоя задача — взять текущие технические описания услуг и превратить их в премиальный, продающий, но честный продукт (API стиль).

ПРАВИЛА ДЛЯ ОПИСАНИЯ (description):
- Пиши чисто, в API стиле. Никаких КАПСЛОКОВ, мусорных эмодзи (🔥❗), и грубых фраз. Допускается 1-2 минималистичных эмодзи (например: 🌍, ⚡).
- Честность (Anti-Liar): Если в оригинальном описании указано "без гарантии", "отписки" — напиши об этом экологично: "Возможен естественный процент отписок. Услуга предоставляется без гарантии восстановления."
- Структура описания: Сделай его связным текстом или маркированным списком. Обязательно укажи скорость, гео и гарантии (если они есть).
- ВАЖНО: Название услуги (name) менять НЕЛЬЗЯ. Возвращай его как есть.

ВХОД: JSON массив объектов.
ВЫХОД: ТОЛЬКО JSON массив такой же длины, где каждый объект содержит:
{
  "id": "original_id",
  "description": "Новое премиальное описание"
}`;

    const userPrompt = JSON.stringify(services.map(s => ({
        id: s.id,
        raw_description: s.description,
    })));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`;
    
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Gemini API Error: ${data.error?.message || JSON.stringify(data)}`);
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error("Empty response from Gemini");
    }

    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("Gemini returned non-array JSON");
        return parsed;
    } catch (e: any) {
        console.error("Gemini raw text was:", text);
        // eslint-disable-next-line preserve-caught-error
        throw new Error("Failed to parse Gemini JSON: " + e.message);
    }
}

async function main() {
    console.log("Starting full marketing rewrite for descriptions only...");
    
    // We only process active services 
    const services = await prisma.service.findMany({
        where: { isActive: true },
        select: { id: true, name: true, description: true }
    });

    console.log(`Found ${services.length} active services to rewrite.\n`);

    const batchSize = 30; // Gemini prompt size limits
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < services.length; i += batchSize) {
        const batch = services.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} services)...`);
        
        try {
            const results = await callGemini(batch);
            
            // Map results back
            for (const result of results) {
                if (!result.id || !result.description) continue;
                
                // Validate it actually belongs to this batch to prevent hallucination ID mapping
                const original = batch.find(s => s.id === result.id);
                if (!original) continue;

                await prisma.service.update({
                    where: { id: result.id },
                    data: { description: result.description }
                });
                processed++;
            }
            
            // Rate limit safety
            await new Promise(r => setTimeout(r, 4000));
        } catch (e: any) {
            console.error(`Error during rewrite batch: ${e.message}`);
            errors += batch.length;
            // Wait longer on error (likely 429)
            await new Promise(r => setTimeout(r, 10000));
        }
    }

    console.log(`\nMarketing Rewrite Complete!`);
    console.log(`✅ Successfully updated descriptions: ${processed}`);
    console.log(`❌ Failed/Skipped: ${errors}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
