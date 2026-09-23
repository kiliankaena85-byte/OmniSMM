/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Pure Geo & Warranty detection module for SmartAnalyzer.
 */
import { GEO_MAP } from '@/constants/geo-registry';

export function detectGeoCode(fullContent: string): string {
    let geo = 'WORLDWIDE';
    for (const [code, keywords] of Object.entries(GEO_MAP)) {
        if (keywords.some(k => fullContent.includes(k))) {
            geo = code;
            break;
        }
    }
    return geo;
}

export function checkExplicitNoWarranty(fullContent: string): boolean {
    return (
        fullContent.includes('без гарантии') ||
        fullContent.includes('без гарантий') ||
        fullContent.includes('без автодокрутки') ||
        fullContent.includes('no refill') ||
        fullContent.includes('no-refill') ||
        fullContent.includes('norefill') ||
        /\b0\s*(?:d|day|days)\s*refill/i.test(fullContent) ||
        /\bnon[\s-]refill/i.test(fullContent) ||
        fullContent.includes('no warranty') ||
        fullContent.includes('without warranty') ||
        fullContent.includes('no drop guarantee') ||
        fullContent.includes('no drop protection') ||
        fullContent.includes('без восстановления')
    );
}

export function detectWarrantyDays(name: string, fullContent: string, isExplicitNoWarranty: boolean): number {
    if (isExplicitNoWarranty) {
        return 0;
    }
    const warrantyMatch = name.match(/(\d+)\s*(?:дней|дня|день|day|d|days)/i);
    if (warrantyMatch) {
        return parseInt(warrantyMatch[1], 10);
    }
    if (
        fullContent.includes('♻️') ||
        fullContent.includes('с гарантией') ||
        fullContent.includes('гарантия') ||
        fullContent.includes('гарантией')
    ) {
        return 30; // Default warranty if icon present or positive guarantee text
    }
    return 0;
}
