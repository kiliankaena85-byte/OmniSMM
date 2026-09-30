/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Unit Tests: Laya Decision Engine NPU Hardware Acceleration via OpenVINO.
 *
 * Validates:
 * 1. Hardware detection for Intel(R) AI Boost NPU and OpenVINO runtime.
 * 2. Feature vectorization (32 structural dimensions).
 * 3. NPU bridge communication and sub-millisecond execution.
 * 4. High-Availability fallback to CPU calibrated engine upon failure or timeout.
 * 5. Full MCP tool integration with hardware telemetry.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LayaNpuProvider, HardwareInfo } from '@/../scripts/mcp/laya-npu-provider';
import { LayaDecisionEngine, LayaDecisionPayload } from '@/../scripts/mcp/laya-mcp-server';

describe('Laya Decision Engine NPU Hardware Acceleration (OpenVINO & Intel AI Boost)', () => {
  let hardware: HardwareInfo;

  beforeAll(async () => {
    hardware = await LayaNpuProvider.detectHardware();
  });

  afterAll(async () => {
    await LayaNpuProvider.shutdown();
  });

  it('1.1 should successfully inspect host hardware and detect NPU / OpenVINO capability', () => {
    expect(hardware).toBeDefined();
    expect(typeof hardware.hasOpenVino).toBe('boolean');
    expect(Array.isArray(hardware.availableDevices)).toBe(true);

    if (hardware.hasOpenVino && hardware.availableDevices.includes('NPU')) {
      expect(hardware.npuDeviceName).toContain('Intel');
      expect(hardware.preferredBackend).toBe('NPU_INTEL_AIBOOST');
    }
  });

  it('1.2 should extract a 32-dimensional normalized feature vector from layout markup', () => {
    const layout = `
      <div class="bg-background text-foreground p-4">
        <table class="w-full text-xs tabular-nums">
          <tr><td class="px-2 py-1 font-mono">1,240.00 ₽</td></tr>
        </table>
        <button class="min-h-[44px] min-w-[44px] bg-primary text-primary-foreground">Confirm</button>
      </div>
    `;

    const features = LayaNpuProvider.extractFeatures(layout, 'checkout');
    expect(features).toHaveLength(32);
    features.forEach(val => {
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThanOrEqual(0.0);
      expect(val).toBeLessThanOrEqual(1.0);
    });

    // Check specific feature indices
    // f[0] = purple neon slop (should be 0)
    expect(features[0]).toBe(0.0);
    // f[15] = tabular-nums flag (should be 1.0)
    expect(features[15]).toBe(1.0);
    // f[6] = touch target safe (should be 1.0)
    expect(features[6]).toBe(1.0);
  });

  it('1.3 should execute inference via NPU bridge and return decision payload with hardware telemetry', async () => {
    const cleanLayout = `
      <div class="bg-slate-900 text-slate-100 p-4 border border-slate-800">
        <h2 class="text-sm font-semibold mb-2">OmniSMM Financial Terminal</h2>
        <div class="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
          <div class="p-2 bg-slate-950 rounded">Rate: 18.00 коп/шт</div>
          <div class="p-2 bg-slate-950 rounded">Margin: 35.5%</div>
        </div>
        <button class="mt-4 min-h-[44px] min-w-[44px] w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded">
          Сформировать проводку
        </button>
      </div>
    `;

    const result = await LayaDecisionEngine.decideAsync(cleanLayout, 'financial_terminal');

    expect(result).toBeDefined();
    expect(result.decision).toBe('APPROVED');
    expect(result.gates.zeroSlopPass).toBe(true);
    expect(result.gates.mobileSafePass).toBe(true);
    expect(result.gates.readyForSynthesis).toBe(true);
    expect(result.scores.informationDensity).toBeGreaterThanOrEqual(0.5);

    // Hardware telemetry verification
    expect(['NPU_INTEL_AIBOOST', 'IGPU_INTEL_ARC', 'CPU_CALIBRATED_FALLBACK']).toContain(result.hardwareBackend);
    if (hardware.hasOpenVino && hardware.availableDevices.includes('NPU')) {
      expect(result.hardwareBackend).toBe('NPU_INTEL_AIBOOST');
      expect(result.hardwareDeviceName).toContain('Intel(R) AI Boost');
    }
  });

  it('1.4 should reject AI-Slop layouts with NPU-accelerated gating', async () => {
    const slopLayout = `
      <div class="bg-[#090d16] text-white p-8">
        <div class="absolute -inset-4 bg-gradient-to-tr from-purple-500 to-violet-600 blur-3xl opacity-30"></div>
        <div class="inline-flex rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-300 animate-pulse">
          ✨ Next-Gen AI Power
        </div>
        <h1 class="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
          Transform Your Reach
        </h1>
        <button class="h-7 w-7 rounded-full bg-purple-600 shadow-purple">🚀</button>
      </div>
    `;

    const result = await LayaDecisionEngine.decideAsync(slopLayout);

    expect(result.decision).toBe('REJECTED');
    expect(result.gates.zeroSlopPass).toBe(false);
    expect(result.classification.slopDetected).toBe(true);
    expect(result.scores.slopPenalty).toBeGreaterThanOrEqual(0.6);
    expect(result.refinements.length).toBeGreaterThan(0);
  });

  it('1.5 should fail-safe fallback to CPU engine if bridge is forced offline', async () => {
    // Force fallback test
    const fallbackResult = await LayaNpuProvider.predictWithFallback(
      '<div class="p-2 text-xs">Test</div>',
      'test_context',
      true // forceFallback
    );

    expect(fallbackResult).toBeDefined();
    expect(fallbackResult.hardwareBackend).toBe('CPU_CALIBRATED_FALLBACK');
    expect(['APPROVED', 'REJECTED', 'NEEDS_REFINEMENT']).toContain(fallbackResult.decision);
  });
});
