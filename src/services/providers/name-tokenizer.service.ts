/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Created by Artem (http://artmspektr.ru)
 * Unauthorized copying of this file is strictly prohibited.
 */

import { GEO_MAP } from '@/constants/geo-registry';

interface ProcurementMetrics {
    quality: 'PREMIUM' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BOTS' | 'UNKNOWN';
    velocity: number | null; // Max items per day
    geo: string;
    dropRate: number | null; // e.g. 5 for 5%
    hasRefill: boolean;
    anomalyScore: number;
}

export interface TokenizedName {
    cleanName: string;
    metrics: ProcurementMetrics;
}

export class NameTokenizerService {
    /**
     * Extracts metrics from a chaotic provider service name and returns a cleaned version.
     */
    static tokenize(rawName: string, category: string = ''): TokenizedName {
        let cleanName = rawName;
        let quality: ProcurementMetrics['quality'];
        let velocity: number | null = null;
        let dropRate: number | null = null;
        let hasRefill = false;
        let geo = 'WORLDWIDE';
        let anomalyScore = 0;

        const lowerName = rawName.toLowerCase();
        const lowerCat = category.toLowerCase();

        // 1. Quality Detection
        if (lowerName.includes('premium') || lowerName.includes('премиум')) {
            quality = 'PREMIUM';
        } else if (lowerName.includes('hq') || lowerName.includes('high quality') || lowerName.includes('real') || lowerName.includes('живые')) {
            quality = 'HIGH';
        } else if (lowerName.includes('lq') || lowerName.includes('low quality') || lowerName.includes('cheap') || lowerName.includes('дешево')) {
            quality = 'LOW';
        } else if (lowerName.includes('bot') || lowerName.includes('бот') || lowerName.includes('fake')) {
            quality = 'BOTS';
        } else {
            quality = 'MEDIUM';
        }

        // 2. Velocity Detection (e.g. 10k/d, 500/day, 10K/Day)
        const speedRegex = /\[?(\d+)(k|m)?\s*\/\s*(d|day|день)\]?/i;
        const speedMatch = rawName.match(speedRegex);
        if (speedMatch) {
            let base = parseInt(speedMatch[1], 10);
            const multiplier = speedMatch[2]?.toLowerCase();
            if (multiplier === 'k') base *= 1000;
            if (multiplier === 'm') base *= 1000000;
            velocity = base;
        }

        // 3. Drop Rate Detection
        if (lowerName.includes('no drop') || lowerName.includes('без списаний') || lowerName.includes('0% drop')) {
            dropRate = 0;
        } else if (lowerName.includes('high drop') || lowerName.includes('большие списания')) {
            dropRate = 50; // Assume 50%
        } else {
            // Find explicit drop rate like "5-10% drop" or "drop 5%"
            const dropRegex = /(?:drop|списания)\s*(\d+)%/i;
            const dropMatch = rawName.match(dropRegex);
            if (dropMatch) {
                dropRate = parseInt(dropMatch[1], 10);
            }
        }

        // 4. Refill & Warranty Detection (with Strict Anti-Contradiction Negative Guard)
        const hasExplicitNoRefill =
            lowerName.includes('без гарантии') ||
            lowerName.includes('без гарантий') ||
            lowerName.includes('без автодокрутки') ||
            lowerName.includes('no refill') ||
            lowerName.includes('no-refill') ||
            lowerName.includes('norefill') ||
            /\b0\s*(?:d|day|days)\s*refill/i.test(lowerName) ||
            /\bnon[\s-]refill/i.test(lowerName) ||
            lowerName.includes('no warranty') ||
            lowerName.includes('without warranty') ||
            lowerName.includes('no drop guarantee') ||
            lowerName.includes('no drop protection') ||
            lowerName.includes('без восстановления');

        if (hasExplicitNoRefill) {
            hasRefill = false;
        } else if (
            lowerName.includes('с гарантией') ||
            lowerName.includes('гарантия') ||
            lowerName.includes('гарантией') ||
            lowerName.includes('автодокрутка') ||
            lowerName.includes('докрутк') ||
            lowerName.includes('refill') ||
            lowerName.includes('re-fill') ||
            lowerName.includes('auto-refill') ||
            lowerName.includes('warranty') ||
            lowerName.includes('♻️') ||
            lowerName.match(/(\d+)\s*(?:дней|дня|день|day|d|days)\s*(?:refill|гарант|warranty)?/i)
        ) {
            hasRefill = true;
        }

        // 5. Geo Detection (SIL-2026: using shared canonical GEO_MAP)
        for (const [code, keywords] of Object.entries(GEO_MAP)) {
            if (keywords.some(k => lowerName.includes(k) || lowerCat.includes(k))) {
                geo = code;
                break;
            }
        }

        // 6. Name Cleaning (Removing tags, emojis, and brackets)
        // Remove IDs like "ID: 412" or "123 -" at start
        cleanName = cleanName.replace(/^(id:?\s*\d+\s*[-|]?\s*)/i, '');
        cleanName = cleanName.replace(/^(\d+\s*[-|]\s*)/i, '');
        // Remove stuff in brackets like [10K/D], [No Drop], (Refill 30D)
        cleanName = cleanName.replace(/\[.*?\]/g, '');
        cleanName = cleanName.replace(/\(.*?\)/g, '');
        // Remove emojis
        cleanName = cleanName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
        cleanName = cleanName.replace(/[\u{2600}-\u{26FF}]/gu, '');
        cleanName = cleanName.replace(/[\u{2700}-\u{27BF}]/gu, '');
        cleanName = cleanName.replace(/♻️/g, '');
        // Remove typical provider spam tags
        const spamTags = ['|', '⭐', '⚡', '🔥', '🚀', '✅', '✔️', 'VIP', 'SUPER', 'FAST', 'INSTANT', 'CHEAP'];
        for (const tag of spamTags) {
            cleanName = cleanName.split(tag).join(' ');
        }
        // Cleanup extra spaces
        cleanName = cleanName.replace(/\s{2,}/g, ' ').trim();

        // 7. Base Anomaly Detection
        // If it claims NO DROP but quality is LOW or BOTS, that's highly suspicious
        if (dropRate === 0 && (quality === 'LOW' || quality === 'BOTS')) {
            anomalyScore += 40;
        }

        return {
            cleanName,
            metrics: {
                quality,
                velocity,
                geo,
                dropRate,
                hasRefill,
                anomalyScore
            }
        };
    }
}
