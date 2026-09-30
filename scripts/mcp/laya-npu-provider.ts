/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Laya NPU Provider — Hardware Acceleration Controller.
 * Bridges Node.js TypeScript runtime with OpenVINO Intel(R) AI Boost NPU execution.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  LayaDecisionPayload,
  LayaDecisionEngine,
  LayaHardwareBackend,
  LayaDecisionScores,
  LayaClassificationResult,
  LayaGates
} from './laya-mcp-server';

export interface HardwareInfo {
  hasOpenVino: boolean;
  availableDevices: string[];
  npuDeviceName?: string;
  preferredBackend: LayaHardwareBackend;
  activeDevice?: string;
  isReady: boolean;
}

interface BridgeResponse {
  id?: number;
  result?: {
    rawOutputs?: number[];
    latencyMs?: number;
    hardwareBackend?: LayaHardwareBackend;
    hardwareDeviceName?: string;
    hasOpenVino?: boolean;
    availableDevices?: string[];
    npuDeviceName?: string;
    preferredBackend?: LayaHardwareBackend;
    activeDevice?: string;
    isReady?: boolean;
  };
  error?: string;
}

export class LayaNpuProvider {
  private static hardwareInfoCache: HardwareInfo | null = null;

  /**
   * Resolves the system Python executable path.
   */
  public static getPythonPath(): string {
    if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
    const candidates = [
      'C:\\Users\\Артем\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
      'python3',
      'python'
    ];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) return c;
      } catch {
        // Continue search
      }
    }
    return 'python';
  }

  public static isWarm(): boolean {
    return Boolean(this.hardwareInfoCache?.isReady);
  }

  /**
   * Detects available host hardware accelerators (Intel AI Boost NPU, Arc GPU, CPU).
   */
  public static async detectHardware(): Promise<HardwareInfo> {
    if (this.hardwareInfoCache) {
      return this.hardwareInfoCache;
    }

    try {
      const pythonPath = this.getPythonPath();
      const scriptPath = path.resolve(__dirname, 'laya-npu-bridge.py');
      const out = execFileSync(pythonPath, [scriptPath, '--info'], {
        timeout: 5000,
        encoding: 'utf-8',
        windowsHide: true
      });
      const parsed = JSON.parse(out.trim());
      this.hardwareInfoCache = {
        hasOpenVino: Boolean(parsed.hasOpenVino),
        availableDevices: parsed.availableDevices || [],
        npuDeviceName: parsed.npuDeviceName,
        preferredBackend: parsed.preferredBackend || 'CPU_CALIBRATED_FALLBACK',
        activeDevice: parsed.activeDevice,
        isReady: Boolean(parsed.isReady)
      };
      return this.hardwareInfoCache;
    } catch {
      this.hardwareInfoCache = {
        hasOpenVino: false,
        availableDevices: ['CPU'],
        preferredBackend: 'CPU_CALIBRATED_FALLBACK',
        isReady: false
      };
      return this.hardwareInfoCache;
    }
  }

  /**
   * Extracts a 32-dimensional normalized feature tensor [0.0 - 1.0] from layout markup.
   */
  public static extractFeatures(layout: string, context?: string): number[] {
    const text = layout.toLowerCase();
    const f = new Array<number>(32).fill(0.0);

    // [0..4] Slop-клише
    const hasPurpleNeon =
      text.includes('#8b5cf6') || text.includes('purple-500') || text.includes('violet-500') ||
      text.includes('shadow-purple') || text.includes('fuchsia-500');
    const hasDarkBg = text.includes('bg-slate-950') || text.includes('bg-[#090d16]') || text.includes('bg-black') || text.includes('bg-zinc-950');
    f[0] = (hasPurpleNeon && hasDarkBg) ? 1.0 : 0.0;

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiMatches = layout.match(emojiRegex);
    f[1] = (emojiMatches && emojiMatches.length >= 2) ? 1.0 : 0.0;

    const isSkeleton = text.includes('skeleton');
    f[2] = (!isSkeleton && text.includes('rounded-full') && text.includes('animate-pulse')) ? 1.0 : 0.0;
    f[3] = (text.includes('blur-3xl') && text.includes('bg-gradient-to-tr')) ? 1.0 : 0.0;
    f[4] = (text.includes('bg-clip-text') && text.includes('bg-gradient-to-r')) ? 1.0 : 0.0;

    // [5..9] Мобильная безопасность и тач-таргеты (Touch Targets)
    const hasSmallClickable =
      (text.includes('h-6 w-6') || text.includes('h-7 w-7') || text.includes('h-8 w-8') || text.includes('p-1')) &&
      (text.includes('<button') || text.includes('cursor-pointer') || text.includes('onclick'));
    f[5] = hasSmallClickable ? 1.0 : 0.0;
    f[6] = (text.includes('min-h-[44px]') || text.includes('h-11') || text.includes('h-12')) ? 1.0 : 0.0;
    f[7] = text.includes('touch-manipulation') ? 1.0 : 0.0;
    f[8] = text.includes('sticky bottom-0') ? 1.0 : 0.0;
    f[9] = text.includes('active:scale-95') || text.includes('active:scale-[0.98]') ? 1.0 : 0.0;

    // [10..14] WCAG AA контраст
    f[10] = (text.includes('text-gray-400') && text.includes('bg-white')) ? 1.0 : 0.0;
    f[11] = (text.includes('text-zinc-600') && text.includes('bg-zinc-900')) ? 1.0 : 0.0;
    f[12] = (text.includes('text-foreground') && text.includes('bg-background')) ? 1.0 : 0.0;
    f[13] = text.includes('border-border') ? 1.0 : 0.0;
    f[14] = text.includes('text-muted-foreground') ? 1.0 : 0.0;

    // [15..19] Плотность информации
    f[15] = text.includes('tabular-nums') ? 1.0 : 0.0;
    f[16] = (text.includes('text-xs') || text.includes('text-sm')) ? 1.0 : 0.0;
    f[17] = (text.includes('px-2 py-1') || text.includes('p-2')) ? 1.0 : 0.0;
    f[18] = (text.includes('py-24') || text.includes('py-32') || text.includes('h-screen')) ? 1.0 : 0.0;
    f[19] = text.includes('grid-cols-') ? 1.0 : 0.0;

    // [20..25] Дизайн-ДНК
    f[20] = text.includes('swiss') || text.includes('grid-cols-12') ? 1.0 : 0.0;
    f[21] = text.includes('financial') || text.includes('terminal') || text.includes('mono') ? 1.0 : 0.0;
    f[22] = text.includes('tactile') || text.includes('bevel') ? 1.0 : 0.0;
    f[23] = text.includes('editorial') || text.includes('serif') ? 1.0 : 0.0;
    f[24] = text.includes('obsidian') || text.includes('bg-[#0b0f19]') ? 1.0 : 0.0;
    f[25] = text.includes('spring') || text.includes('motion') ? 1.0 : 0.0;

    // [26..31] Контекст
    const ctx = (context || '').toLowerCase();
    f[26] = ctx.includes('mobile') || text.includes('viewport: mobile') ? 1.0 : 0.0;
    f[27] = ctx.includes('checkout') || ctx.includes('wizard') ? 1.0 : 0.0;
    f[28] = ctx.includes('terminal') || ctx.includes('dashboard') ? 1.0 : 0.0;
    f[29] = ctx.includes('admin') ? 1.0 : 0.0;
    f[30] = text.includes('table') || text.includes('<tr') ? 1.0 : 0.0;
    f[31] = hasDarkBg ? 1.0 : 0.0;

    return f;
  }

  /**
   * Executes inference via OpenVINO NPU bridge with automatic fallback to CPU calibrated engine.
   */
  public static async predictWithFallback(
    layout: string,
    context?: string,
    forceFallback = false,
    awaitNpu = false
  ): Promise<LayaDecisionPayload> {
    const startTime = Date.now();

    if (!forceFallback) {
      // If hardware wasn't checked yet and caller doesn't explicitly wait for NPU (cold start), return CPU fallback
      if (!this.hardwareInfoCache && !awaitNpu) {
        void this.detectHardware();
        const fallback = LayaDecisionEngine.decide(layout, context);
        return {
          ...fallback,
          hardwareBackend: 'CPU_CALIBRATED_FALLBACK',
          hardwareDeviceName: 'Host CPU (Warmup In Progress)'
        };
      }

      try {
        const hw = await this.detectHardware();
        if (hw.hasOpenVino && (hw.availableDevices.includes('NPU') || hw.availableDevices.includes('GPU'))) {
          const features = this.extractFeatures(layout, context);
          const pythonPath = this.getPythonPath();
          const scriptPath = path.resolve(__dirname, 'laya-npu-bridge.py');
          const inputJson = JSON.stringify({ id: 1, cmd: 'predict', features });

          const out = execFileSync(pythonPath, [scriptPath], {
            input: inputJson + '\n',
            timeout: 5000,
            encoding: 'utf-8',
            windowsHide: true
          });

          const parsed = JSON.parse(out.trim()) as BridgeResponse;
          if (parsed.result && parsed.result.rawOutputs) {
            const raw = parsed.result.rawOutputs;
            const latencyMs = Math.max(1, Date.now() - startTime);

            const baseScores = LayaDecisionEngine.scoreMetrics(layout);
            const classification = LayaDecisionEngine.classifyDna(layout);

            const densityDelta = (raw[0] ?? 0.0) * 0.05;
            const density = Math.min(1.0, Math.max(0.0, Number((baseScores.informationDensity + densityDelta).toFixed(2))));

            const hierarchyDelta = (raw[1] ?? 0.0) * 0.05;
            const hierarchy = Math.min(1.0, Math.max(0.0, Number((baseScores.visualHierarchy + hierarchyDelta).toFixed(2))));

            const scores: LayaDecisionScores = {
              informationDensity: density,
              visualHierarchy: hierarchy,
              wcagContrastScore: baseScores.wcagContrastScore,
              mobileTouchSafety: baseScores.mobileTouchSafety,
              slopPenalty: baseScores.slopPenalty
            };

            const refinements: string[] = [];
            const zeroSlopPass = !classification.slopDetected && scores.slopPenalty < 0.40;
            if (!zeroSlopPass) {
              refinements.push(`[ZERO_SLOP_VIOLATION] Обнаружено ИИ-клише: ${classification.slopType}. Требуется High-Density интерфейс.`);
            }

            const wcagAaPass = scores.wcagContrastScore >= 0.70;
            if (!wcagAaPass) {
              refinements.push(`[WCAG_AA_VIOLATION] Недостаточный контраст текста/фона (${scores.wcagContrastScore} < 0.70).`);
            }

            const isMobileContext = context?.includes('mobile') || layout.includes('viewport: mobile');
            const mobileSafePass = isMobileContext ? scores.mobileTouchSafety >= 0.75 : scores.mobileTouchSafety >= 0.50;
            if (!mobileSafePass) {
              refinements.push(`[TOUCH_TARGET_VIOLATION] Интерактивные элементы меньше 44x44px. Добавьте min-h-[44px] min-w-[44px].`);
            }

            const readyForSynthesis = zeroSlopPass && wcagAaPass && mobileSafePass && scores.informationDensity >= 0.45;

            let decision: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT' = 'APPROVED';
            if (!zeroSlopPass || scores.informationDensity < 0.30) {
              decision = 'REJECTED';
            } else if (!readyForSynthesis) {
              decision = 'NEEDS_REFINEMENT';
            }

            const gates: LayaGates = {
              zeroSlopPass,
              wcagAaPass,
              mobileSafePass,
              readyForSynthesis
            };

            return {
              decision,
              confidence: Number((0.92 + (readyForSynthesis ? 0.05 : -0.10)).toFixed(2)),
              latencyMs,
              scores,
              classification,
              gates,
              refinements,
              hardwareBackend: parsed.result.hardwareBackend || 'NPU_INTEL_AIBOOST',
              hardwareDeviceName: parsed.result.hardwareDeviceName || 'Intel(R) AI Boost'
            };
          }
        }
      } catch {
        // Fallback to CPU engine
      }
    }

    const fallback = LayaDecisionEngine.decide(layout, context);
    return {
      ...fallback,
      hardwareBackend: 'CPU_CALIBRATED_FALLBACK',
      hardwareDeviceName: 'Host CPU (Heuristic Fallback Engine)'
    };
  }

  /**
   * Resets hardware info cache.
   */
  public static shutdown(): Promise<void> {
    this.hardwareInfoCache = null;
    return Promise.resolve();
  }
}
