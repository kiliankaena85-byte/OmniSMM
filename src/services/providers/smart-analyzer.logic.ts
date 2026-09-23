/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Created by Artem (http://artmspektr.ru)
 * Unauthorized copying of this file is strictly prohibited.
 */
import { DescriptionSanitizer } from '@/utils/description-sanitizer';
import { compileServiceMetrics, normalizeGeo } from '@/utils/translation-dictionary';
import { NameTokenizerService } from './name-tokenizer.service';
import { detectGeoCode, checkExplicitNoWarranty, detectWarrantyDays } from './analyzer/geo-warranty.pure';
import {
    type Platform,
    PLATFORMS,
    PLATFORM_LABELS,
    PLATFORM_KEYWORDS,
    detectPlatform,
    type DynamicPlatformInput
} from './analyzer/platform-detector.pure';
import {
    type Category,
    CATEGORIES,
    CATEGORY_LABELS,
    DEFAULT_CATEGORY_METRICS,
    detectCategory
} from './analyzer/category-detector.pure';
import {
    TARGET_TYPES,
    TARGET_TYPE_LABELS,
    detectTargetType
} from './analyzer/target-type-detector.pure';
import {
    detectCustomDataType,
    detectMediaGroupAware,
    extractRequirements,
    detectStartTime,
    detectSpeedText,
    resolveQualityLabel
} from './analyzer/execution-metrics.pure';

// Re-export types and domain constants for backward compatibility
export type { Platform, Category };
export {
    PLATFORMS,
    PLATFORM_LABELS,
    PLATFORM_KEYWORDS,
    CATEGORIES,
    CATEGORY_LABELS,
    DEFAULT_CATEGORY_METRICS,
    TARGET_TYPES,
    TARGET_TYPE_LABELS
};

export interface ProcurementMetrics {
    quality: 'PREMIUM' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BOTS' | 'UNKNOWN';
    velocity: number | null; // Max items per day
    geo: string;
    dropRate: number | null; // e.g. 5 for 5%
    hasRefill: boolean;
    anomalyScore: number;
    startTime?: string;
    speedText?: string;
    warrantyDays?: number;
    qualityLabel?: string;
}

export interface AnalyzedService {
    platform: Platform;
    platformSlug: string;
    category: Category;
    targetType: string;
    isPrivate: boolean;
    description_ru: string;
    suggestedName?: string;
    requirements?: string;
    geo?: string;
    warranty?: number;
    startTime?: string;
    speedText?: string;
    qualityLabel?: string;
    metrics?: ProcurementMetrics;
    cleanName?: string;
    customDataType?: 'NONE' | 'TEXTAREA' | 'NUMBER';
    isMediaGroupAware?: boolean;
}

export class SmartAnalyzerLogic {
    static detectSync(
        name: string,
        description: string = '',
        categoryInput: string = '',
        dynamicPlatforms?: DynamicPlatformInput[],
        basePriceUsd: number = 0
    ): AnalyzedService {
        const sanitizedDescription = DescriptionSanitizer.sanitize(description);
        const nameNode = name.toLowerCase();
        const safeCategoryInput = String(categoryInput || '');
        const catInputLower = safeCategoryInput.toLowerCase();
        const fullContent = `${name} ${sanitizedDescription} ${safeCategoryInput}`.toLowerCase();

        // 1. Tokenize Name
        const tokenized = NameTokenizerService.tokenize(name, categoryInput);

        // 2. Geo & Warranty
        const rawDetectedGeo = detectGeoCode(fullContent);
        const isExplicitNoWarranty = checkExplicitNoWarranty(fullContent);
        const warranty = detectWarrantyDays(name, fullContent, isExplicitNoWarranty);

        // 3. Platform Detection
        const { platformEnum, platformSlug } = detectPlatform(
            nameNode,
            sanitizedDescription.toLowerCase(),
            catInputLower,
            fullContent,
            dynamicPlatforms
        );

        // 4. Category Detection
        const category = detectCategory(nameNode, fullContent, platformEnum);

        // 5. Target Type & Privacy
        const isAutoMention = fullContent.includes('подписк') || fullContent.includes('auto') || fullContent.includes('subscription') || fullContent.includes('будущ') || fullContent.includes('авто');
        const { targetType, isPrivate } = detectTargetType(platformEnum, category, fullContent, isAutoMention);

        // 6. Custom Data, Media Group & Requirements
        const customDataType = detectCustomDataType(category, fullContent);
        const isMediaGroupAware = detectMediaGroupAware(fullContent);
        const requirements = extractRequirements(sanitizedDescription);

        // 7. Geo & Metric Translation
        const geoTagMatch = name.match(/\[(.*?)\]/);
        let rawGeo = geoTagMatch ? geoTagMatch[1] : undefined;
        if (rawGeo && (rawGeo.includes('|') || rawGeo.length > 20)) {
            rawGeo = undefined;
        }
        const compiledGeo = rawGeo ? normalizeGeo(rawGeo) : normalizeGeo(rawDetectedGeo);
        const metricsCompiler = compileServiceMetrics(name, basePriceUsd);
        const tagsStr = metricsCompiler.translatedTags.filter(Boolean).join('. ');
        let finalDescription = tagsStr ? `${tagsStr}. Гео: ${compiledGeo}.` : `Гео: ${compiledGeo}.`;
        if (requirements) {
            finalDescription += `\nТребования: ${requirements}`;
        }
        if (!metricsCompiler.isRefill) {
            finalDescription += `\nВнимание: Возможны отписки. Без гарантии восстановления.`;
        }
        if (sanitizedDescription && sanitizedDescription.length > 5) {
            finalDescription += `\n\n--- Оригинальное описание провайдера ---\n${sanitizedDescription}`;
        }

        // 8. Execution Metrics (Start Time, Speed, Warranty, Quality)
        const catDefaults = DEFAULT_CATEGORY_METRICS[category] || DEFAULT_CATEGORY_METRICS.OTHER;
        const detectedStartTime = detectStartTime(name, fullContent, catDefaults.startTime);
        const detectedSpeedText = detectSpeedText(name, fullContent, tokenized.metrics?.velocity, catDefaults.speedText);

        const finalWarranty = isExplicitNoWarranty ? 0 : (metricsCompiler.warrantyDays || warranty || catDefaults.warranty);
        const hasRefillBadge = !isExplicitNoWarranty && (metricsCompiler.isRefill || warranty > 0 || tokenized.metrics?.hasRefill || catDefaults.warranty > 0);

        const finalQuality = resolveQualityLabel(tokenized.metrics?.quality, metricsCompiler.tier, catDefaults.qualityLabel);
        const categoryLabel = CATEGORY_LABELS[category] || 'Продвижение';
        const finalName = `${categoryLabel} (${finalQuality})`;

        const enrichedMetrics: ProcurementMetrics = {
            ...tokenized.metrics,
            startTime: detectedStartTime,
            speedText: detectedSpeedText,
            warrantyDays: finalWarranty,
            qualityLabel: finalQuality,
            hasRefill: hasRefillBadge
        };

        return {
            platform: platformEnum,
            platformSlug,
            category,
            targetType,
            isPrivate,
            description_ru: finalDescription,
            suggestedName: finalName,
            cleanName: tokenized.cleanName,
            requirements: requirements || undefined,
            geo: compiledGeo,
            warranty: finalWarranty,
            startTime: detectedStartTime,
            speedText: detectedSpeedText,
            qualityLabel: finalQuality,
            customDataType,
            isMediaGroupAware,
            metrics: enrichedMetrics
        };
    }

    static suggestTargetType(name: string, category: string, description: string = ''): string {
        return this.detectSync(name, description, category).targetType;
    }

    static suggestIsPrivate(name: string): boolean {
        return this.detectSync(name).isPrivate;
    }

    static suggestCategory(name: string, category: string = ''): Category {
        return this.detectSync(name, '', category).category;
    }
}
