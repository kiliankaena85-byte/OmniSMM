import { db } from "@/lib/db";
import { applyBeautifulRounding, applyPricingLadder } from "@/lib/financial-constants";
import { sanitizeServiceDescription } from "@/lib/sanitize";

export class ServiceAuditEngine {
  /**
   * Sanitizes the name or description of a service.
   * Removes advertising links, competitor domains, contact info, and replaces forbidden Cyrillic words.
   */
  static cleanText(text: string): string {
    if (!text) return text;

    // 1. Remove URLs/Links starting with http/https or www (excluding smmplan.pro)
    let cleaned = text.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi, (match) => {
      if (match.toLowerCase().includes("smmplan.pro")) {
        return match;
      }
      return "";
    });

    // 2. Remove competitor domains with TLDs (.ru, .com, .net, .org, .pro) but NOT smmplan.pro
    cleaned = cleaned.replace(/\b([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\.(ru|com|net|org|pro)\b(?:\/[^\s]*)?/gi, (match) => {
      if (match.toLowerCase().includes("smmplan.pro")) {
        return match;
      }
      return "";
    });

    // 3. Remove contact info
    // - Emails
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "");

    // - Telegram contacts (@username, t.me/xxx, telegram.me/xxx)
    cleaned = cleaned.replace(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]+\b/gi, "");
    cleaned = cleaned.replace(/\B@[a-zA-Z0-9_]+\b/g, "");

    // - VK/WA contacts (vk.com/xxx, vk.me/xxx, wa.me/xxx)
    cleaned = cleaned.replace(/(?:https?:\/\/)?(?:www\.)?(?:vk\.com|vk\.me|wa\.me)\/[a-zA-Z0-9_.]+\b/gi, "");

    // - Phone numbers
    cleaned = cleaned.replace(/\+?[78]\s*\(?\d{3}\)?\s*\d{3}[-\s]?\d{2}[-\s]?\d{2}/g, "");
    cleaned = cleaned.replace(/\+?[78]\d{10}\b/g, "");

    // 4. Replace Cyrillic forbidden words case-insensitively
    const wordReplacements = [
      { pattern: /накрутки/gi, replacement: "продвижения" },
      { pattern: /накрутка/gi, replacement: "продвижение" },
      { pattern: /накрутить/gi, replacement: "увеличить" },
      { pattern: /накручено/gi, replacement: "добавлено" },
    ];

    for (const { pattern, replacement } of wordReplacements) {
      cleaned = cleaned.replace(pattern, (match) => {
        const isCapital = match[0] === match[0].toUpperCase();
        if (isCapital) {
          return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }

    return cleaned;
  }

  /**
   * Audits a service, cleans advertising/contacts, and auto-corrects markup to 5.0 if it's below 5.0.
   * Returns an array of Prisma operations to be executed in a transaction, and writes a SERVICE_AUTO_FIX audit log.
   */
  static auditAndFixService(
    service: {
      id: string;
      name: string;
      description: string | null;
      markup: number;
      pricePer1000Cents: number;
      isQuarantined: boolean;
      quarantineReason: string | null;
      quarantinedAt: Date | null;
    },
    external: {
      rate: string | number;
    },
    exchangeRate: number
  ) {
    const originalName = service.name;
    const originalDescription = service.description || "";
    const originalMarkup = service.markup;
    const originalPrice = service.pricePer1000Cents;

    const cleanedName = this.cleanText(originalName);
    const cleanedDescription = service.description ? sanitizeServiceDescription(this.cleanText(service.description)) : null;

    let newMarkup = originalMarkup;
    let newPrice = originalPrice;

    // Curated markup preservation & Beautiful Rounding Enforcement
    const rate = parseFloat(String(external.rate)) || 0;

    if (!service.isQuarantined && rate > 0) {
      const costRub = rate * exchangeRate;
      if (originalMarkup <= 0) {
        const retailFromLadder = applyPricingLadder(costRub);
        newMarkup = costRub > 0 ? Math.round((retailFromLadder / costRub) * 100) / 100 : 3.0;
        newPrice = Math.round(applyBeautifulRounding(retailFromLadder) * 100);
      } else {
        newPrice = Math.round(applyBeautifulRounding(costRub * originalMarkup) * 100);
      }
    }

    const nameChanged = cleanedName !== originalName;
    const descriptionChanged = cleanedDescription !== service.description;
    const priceChanged = newPrice !== originalPrice;
    const markupChanged = newMarkup !== originalMarkup;

    const payloads: unknown[] = [];

    if (nameChanged || descriptionChanged || priceChanged || markupChanged) {
      payloads.push(
        db.service.update({
          where: { id: service.id },
          data: {
            name: cleanedName,
            description: cleanedDescription,
            markup: newMarkup,
            pricePer1000Cents: newPrice,
          },
        })
      );

      // Update in-memory service object so calling methods see the fixed values
      service.name = cleanedName;
      service.description = cleanedDescription;
      service.markup = newMarkup;
      service.pricePer1000Cents = newPrice;

      // Prepare diffs for AdminAuditLog
      const oldValue: Record<string, string | number | null> = {};
      const newValue: Record<string, string | number | null> = {};

      if (nameChanged) {
        oldValue.name = originalName;
        newValue.name = cleanedName;
      }
      if (descriptionChanged) {
        oldValue.description = service.description === null ? null : originalDescription;
        newValue.description = cleanedDescription;
      }
      if (markupChanged) {
        oldValue.markup = originalMarkup;
        newValue.markup = newMarkup;
      }
      if (priceChanged) {
        oldValue.pricePer1000Cents = originalPrice;
        newValue.pricePer1000Cents = newPrice;
      }

      if (db.adminAuditLog) {
        payloads.push(
          db.adminAuditLog.create({
            data: {
              adminId: "system",
              adminEmail: "system@smmplan.pro",
              action: "SERVICE_AUTO_FIX",
              target: service.id,
              targetType: "SERVICE",
              oldValue: JSON.stringify(oldValue),
              newValue: JSON.stringify(newValue),
            },
          })
        );
      }
    }
    
    return payloads;
  }
}
