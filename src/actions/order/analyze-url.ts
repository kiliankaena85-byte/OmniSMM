'use server';

import { IntelligenceLinkAnalyzer } from "@/services/analyzer/link-analyzer";
import { RateLimitService } from '@/services/core/rate-limit.service';
import { safeUrlForLog } from "@/lib/log-safe";


import { IntelligenceAnalysisResult } from "@/services/analyzer/link-analyzer";
import { isUrlSafeForFetch } from "@/lib/ssrf-guard";

const MAX_ANALYZE_CACHE_ENTRIES = 1000;
const analyzeCache = new Map<string, { data: IntelligenceAnalysisResult; expiresAt: number }>();

/**
 * @public Safe public URL intelligence analyzer for order forms
 */
export async function analyzeUrl(url: string): Promise<{
  success: boolean;
  data?: IntelligenceAnalysisResult;
  error?: string;
  errorCode?: string;
  userHint?: string;
}> {
  try {
    if (!url || typeof url !== 'string' || url.length > 2048) {
      return { success: false, error: "URL exceeds maximum length of 2048 characters." };
    }

    const trimmed = url.trim();

    // If bare handle (@handle) or single word without domain, run analyzer directly for typed MISSING_DOMAIN and userHint
    if (trimmed.startsWith('@') || (!trimmed.includes('.') && !trimmed.includes('/'))) {
      const analyzer = new IntelligenceLinkAnalyzer();
      const result = await analyzer.analyze(trimmed);
      return {
        success: false,
        errorCode: result.errorCode || 'MISSING_DOMAIN',
        userHint: result.userHint,
        error: result.userHint || "Укажите полную ссылку с адресом сайта",
        data: result
      };
    }

    // Normalize protocol for safe fetch check (e.g. t.me/channel -> https://t.me/channel)
    const normalizedUrl = (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && trimmed.includes('.'))
      ? `https://${trimmed}`
      : trimmed;

    if (!isUrlSafeForFetch(normalizedUrl)) {
      return { success: false, error: "This URL format is not supported for analysis." };
    }

    const { getClientIp } = await import('@/utils/ip');
    const ip = await getClientIp();

    const isAllowed = await RateLimitService.checkCustomKey(`analyzeUrl:${ip}`, 60, 60, true);
    if (!isAllowed) {
       return { success: false, error: "Too many URL analysis requests." };
    }

    const cached = analyzeCache.get(url);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return { success: true, data: cached.data };
      }
      analyzeCache.delete(url);
    }

    const analyzer = new IntelligenceLinkAnalyzer();
    const result = await analyzer.analyze(normalizedUrl);
    
    if (!result) {
        return { success: false, error: "Failed to recognize link" };
    }

    if (result.errorCode) {
      return {
        success: false,
        errorCode: result.errorCode,
        userHint: result.userHint,
        error: result.userHint || "Не удалось распознать ссылку",
        data: result
      };
    }

    if (analyzeCache.size >= MAX_ANALYZE_CACHE_ENTRIES) {
      const oldestKey = analyzeCache.keys().next().value;
      if (oldestKey) analyzeCache.delete(oldestKey);
    }
    analyzeCache.set(url, { data: result, expiresAt: Date.now() + 60000 });

    return { success: true, data: result };
  } catch (error) {
    console.error(`Link analysis failed for ${safeUrlForLog(url)}:`, error);
    return { success: false, error: "Failed to analyze URL" };
  }
}
