import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { providerService } from '@/services/providers/provider.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { ProxyAgent } from 'undici';
import * as dotenv from 'dotenv';

dotenv.config();

// Standard sleep helper to avoid rate limit issues
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function rebrandServices() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[Rewriter] Starting SMM service rewriter. Dry-run mode: ${dryRun ? 'ON' : 'OFF'}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set in the environment.");
    process.exit(1);
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash';

  // 1. Retrieve all active services with externalId from DB
  let activeServices;
  try {
    activeServices = await db.service.findMany({
      where: {
        isActive: true,
        externalId: { not: null },
        providerId: { not: null }
      },
      include: {
        provider: true
      }
    });
  } catch (err: any) {
    console.error(`[Rewriter] Failed to retrieve services from DB: ${err.message}`);
    process.exit(1);
  }

  if (activeServices.length === 0) {
    console.log('[Rewriter] No active services with an external ID found.');
    return;
  }

  console.log(`[Rewriter] Found ${activeServices.length} active services to process.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const service of activeServices) {
    console.log(`[Rewriter] Processing service ID: ${service.id} (name: "${service.name}", externalId: "${service.externalId}")`);

    if (!service.provider) {
      console.warn(`[Rewriter] Service ${service.id} has no provider record in DB. Skipping.`);
      skippedCount++;
      continue;
    }

    // 2. Fetch provider catalog to get the original provider specifications
    let providerServiceItem: any = null;
    const cacheKey = `provider:${service.providerId}:catalog`;

    try {
      const cachedStr = await redis.get(cacheKey);
      if (cachedStr) {
        const catalog = JSON.parse(cachedStr);
        if (Array.isArray(catalog)) {
          providerServiceItem = catalog.find(
            (item: any) => String(item.service) === String(service.externalId)
          );
        }
      }
    } catch (redisErr: any) {
      console.warn(`[Rewriter] Redis cache read failed for key ${cacheKey}: ${redisErr.message}`);
    }

    // Fallback to provider client API if cache empty or service missing
    if (!providerServiceItem) {
      console.log(`[Rewriter] Cache miss or service not found in cache for key ${cacheKey}. Fetching from provider API...`);
      try {
        const providerInstance = await providerService.getProviderInstance(service.provider);
        const rawServices = await providerInstance.getServices();
        
        if (Array.isArray(rawServices)) {
          // Cache the catalog in Redis with 24 hours TTL
          await redis.setex(cacheKey, 86400, JSON.stringify(rawServices));
          providerServiceItem = rawServices.find(
            (item: any) => String(item.service) === String(service.externalId)
          );
        } else {
          console.warn(`[Rewriter] Provider client did not return an array of services.`);
        }
      } catch (apiErr: any) {
        console.warn(`[Rewriter] Provider client API call failed for service ${service.id}: ${apiErr.message}`);
        skippedCount++;
        continue;
      }
    }

    if (!providerServiceItem) {
      console.warn(`[Rewriter] Service ${service.id} (externalId: ${service.externalId}) not found in provider catalog. Skipping.`);
      skippedCount++;
      continue;
    }

    // Get provider name/desc
    const providerName = providerServiceItem.name || "";
    const rawDesc = providerServiceItem.description || providerServiceItem.desc;
    const providerDescription = rawDesc ? String(rawDesc).trim() : "";

    // local name/description
    const localName = service.name;
    const localDescription = service.description || "";

    // 3. Gemini Prompt construction
    const systemInstruction = `Вы — профессиональный AI копирайтер для API панели SMM-услуг. Ваша задача — переписать название и описание услуги на русском языке, ориентируясь на предоставленные технические данные от провайдера и текущие локальные название/описание.

Вы должны строго следовать следующим правилам:
1. Честность и соответствие спецификациям (Anti-Liar): Описание должно строго соответствовать техническим параметрам провайдера. Запрещено обещать отсутствие падений ("no drop" / "без списаний"), если у провайдера нет гарантии/refill. Указывайте реальное время запуска и задержки (например, "запуск до 12-24 часов", если услуга медленная).
2. Структура описания: Описание должно быть в формате чистого русского Markdown-списка со следующими разделами:
   - **Скорость**: [описание скорости запуска и выполнения]
   - **Гарантия**: [описание гарантии/refill или её отсутствия]
   - **Лимиты**: [минимальный и максимальный заказ, если указаны]
   - **Особенности**: [дополнительные важные детали, например, тип профиля, качество аккаунтов]
3. Фильтрация спама и запрещенных слов: Удаляйте любые ссылки, URL-адреса, контакты, логины Telegram (@username) и стоп-слова из сферы накрутки (такие как "накрутка", "накрутить" и т.д.). Вместо них используйте нейтральные термины, например "продвижение", "увеличение показателей", "подписчики", "просмотры".
4. Формат вывода: Вы обязаны вернуть строго JSON-объект со следующей структурой:
{
  "name": "Новое оптимизированное название услуги",
  "description": "Новое описание услуги в виде Markdown списка"
}`;

    const userPrompt = `Текущие локальные данные услуги:
- Название: ${localName}
- Описание: ${localDescription}

Технические данные от провайдера:
- Название от провайдера: ${providerName}
- Описание от провайдера: ${providerDescription || 'Описание отсутствует'}
- Дополнительные параметры (гарантия, лимиты, скорость, если известны):
  - Refill (Гарантия): ${providerServiceItem.refill ? 'Да' : 'Нет'}
  - Cancel (Отмена): ${providerServiceItem.cancel ? 'Да' : 'Нет'}
  - Dripfeed (Капельная подача): ${providerServiceItem.dripfeed ? 'Да' : 'Нет'}
  - Rate: ${providerServiceItem.rate} за 1000 шт.
  - Min/Max: ${providerServiceItem.min} / ${providerServiceItem.max}

Пожалуйста, перепишите название и описание этой услуги. Ответьте строго в формате JSON, без лишнего текста вокруг или markdown-оберток (типа \`\`\`json).`;

    // 4. Query Gemini API via REST fetch with retry on 429
    let newName = "";
    let newDescription = "";
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !success) {
      try {
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
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
          dispatcher
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 429) {
            attempts++;
            let waitTime = 60000; // default to 60s
            try {
              const parsed = JSON.parse(errText);
              const retryInfo = parsed.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
              if (retryInfo && retryInfo.retryDelay) {
                const seconds = parseInt(retryInfo.retryDelay);
                if (!isNaN(seconds)) {
                  waitTime = (seconds + 2) * 1000;
                }
              }
            } catch (e) {}
            console.warn(`[Rewriter] Rate limit hit (429) for service ${service.id}. Waiting ${waitTime / 1000}s before retry attempt ${attempts}/${maxAttempts}...`);
            await sleep(waitTime);
            continue;
          }
          throw new Error(`API Error (HTTP ${res.status}): ${errText}`);
        }

        const data = await res.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResponse) {
          throw new Error("Empty response parts from Gemini API");
        }

        let cleanedJsonText = textResponse.trim();
        if (cleanedJsonText.startsWith("```")) {
          cleanedJsonText = cleanedJsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        const parsedJson = JSON.parse(cleanedJsonText);
        newName = parsedJson.name?.trim() || "";
        newDescription = parsedJson.description?.trim() || "";

        if (!newName || !newDescription) {
          throw new Error("Invalid output format: name or description fields are missing/empty in JSON");
        }

        success = true;
      } catch (geminiErr: any) {
        if (attempts >= maxAttempts || !geminiErr.message?.includes('HTTP 429')) {
          console.error(`[Rewriter] Gemini API request failed for service ${service.id}: ${geminiErr.message}`);
          errorCount++;
          await sleep(2000);
          break;
        }
      }
    }

    if (!success) {
      continue;
    }

    // 5. Check if changed and apply (or simulate if dry-run)
    const hasNameChanged = newName !== service.name;
    const hasDescriptionChanged = newDescription !== (service.description || "");

    if (hasNameChanged || hasDescriptionChanged) {
      if (dryRun) {
        console.log(`[DRY-RUN] Proposed updates for Service ID: ${service.id}`);
        console.log(`  Category: ${service.categoryId}`);
        console.log(`  Provider ID: ${service.providerId} (External ID: ${service.externalId})`);
        if (hasNameChanged) {
          console.log(`  Name: "${service.name}" -> "${newName}"`);
        } else {
          console.log(`  Name: "${service.name}" (Unchanged)`);
        }
        if (hasDescriptionChanged) {
          console.log(`  Description:`);
          console.log(`    OLD: "${service.description || ""}"`);
          console.log(`    NEW: "${newDescription}"`);
        } else {
          console.log(`  Description: (Unchanged)`);
        }
        console.log(`--------------------------------------------------------------------------------`);
      } else {
        try {
          // Perform database update
          await db.service.update({
            where: { id: service.id },
            data: {
              name: newName,
              description: newDescription
            }
          });

          // Log admin audit
          await auditAdminAwaitable({
            adminId: "system",
            adminEmail: "system@smmplan.pro",
            action: "SERVICE_AUTO_FIX",
            target: service.id,
            targetType: "SERVICE",
            oldValue: {
              name: service.name,
              description: service.description
            },
            newValue: {
              name: newName,
              description: newDescription
            }
          });

          console.log(`[Rewriter] Successfully updated service ${service.id} and recorded audit log.`);
        } catch (dbUpdateErr: any) {
          console.error(`[Rewriter] Database update failed for service ${service.id}: ${dbUpdateErr.message}`);
          errorCount++;
          continue;
        }
      }
      updatedCount++;
    } else {
      console.log(`[Rewriter] Service ${service.id} name and description matched Gemini output exactly. No update needed.`);
      skippedCount++;
    }

    // Short delay to respect rate limits
    await sleep(1000);
  }

  console.log(`\n[Rewriter] Finished processing.`);
  console.log(`  Services Processed/Updated: ${updatedCount}`);
  console.log(`  Services Skipped/No Change: ${skippedCount}`);
  console.log(`  Errors Encountered: ${errorCount}`);
}

async function cleanup() {
  try {
    await db.$disconnect();
  } catch (err) {
    console.error("Error disconnecting from Prisma:", err);
  }
  try {
    await redis.quit();
  } catch (err) {
    console.error("Error quitting Redis connection:", err);
  }
}

// Only execute if run directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith('marketing-description-rewriter.ts') ||
  process.argv[1].endsWith('marketing-description-rewriter.js') ||
  process.argv[1].endsWith('marketing-description-rewriter')
);

if (isMain) {
  rebrandServices()
    .then(async () => {
      await cleanup();
      console.log("[Rewriter] Done.");
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("[Rewriter] Fatal error in main loop:", err);
      await cleanup();
      process.exit(1);
    });
}

export { rebrandServices, cleanup };
