# SPEC-2026-09-29: Laya Decision Engine NPU Hardware Acceleration via OpenVINO & Intel(R) AI Boost (v1.0)

## 1. Metadata
- **Specification ID:** `SPEC-2026-09-29-LAYA-NPU-INTEL-BOOST-OPENVINO`
- **Target Subsystem:** Laya MCP Server (`scripts/mcp/laya-mcp-server.ts`), Design Boost Pipeline, Gemini-Stitch-Laya Triad
- **Target Hardware:** `Intel(R) AI Boost` NPU (Meteor Lake, 11.5 TOPS), `Intel(R) Arc(TM) Graphics` (Xe-LPG), CPU Fallback
- **Software Stack:** OpenVINO 2026.4.0, Node.js 22 / TypeScript 5.7+, Python 3.11, Vitest 4
- **Compliance:** RAC-2026, SDD-TDD 2026, Zero-Slop Anti-Cliche Standard, Multi-Tenant OmniSMM 1.0

---

## 2. Motivation & Objective
На хост-системе обнаружен активный аппаратный нейрочип **`Intel(R) AI Boost`** (Class: `ComputeAccelerator`, 11.5 TOPS INT8/FP16), интегрированный в процессор `Intel Core Ultra 5 125H`, а также встроенная графика `Intel Arc Graphics` и установленный рантайм `OpenVINO 2026.4.0`.

Текущая реализация Laya работала в режиме эвристического CPU-скоринга (~15–25 мс).  
**Цель настоящей спецификации:**
1. Подключить нативную аппаратную акселерацию Laya Decision Engine на чипе **`Intel(R) AI Boost` (NPU)** через OpenVINO.
2. Снизить задержку инференса скоринговых голов до **суб-миллисекундного диапазона (< 2 мс)**.
3. Разгрузить CPU во время параллельной работы компилятора Next.js/Turbopack, контейнеров Docker и сьютов Vitest.
4. Обеспечить трехуровневый отказоустойчивый каскад (Fail-Safe Hierarchy):
   $$\text{NPU (Intel AI Boost)} \longrightarrow \text{iGPU (Intel Arc)} \longrightarrow \text{CPU (Calibrated Heuristic)}$$
5. Сохранить 100% обратную совместимость с MCP инструментами (`laya_decide`, `laya_classify`, `laya_score`, `laya_check`) и добавить телеметрию `hardwareBackend`.

---

## 3. Архитектурная Топология и Поток Данных

```
                   ┌────────────────────────────────────────┐
                   │       Layout Markup (JSX / CSS)        │
                   └───────────────────┬────────────────────┘
                                       │
                                       ▼
                   ┌────────────────────────────────────────┐
                   │    LayaNpuProvider (TypeScript MCP)    │
                   │    - 32-dim Structural Feature Extr.   │
                   │    - Fail-Safe Health & Timeout Watch  │
                   └───────────────────┬────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │ (JSON-RPC stdio pipe / sub-millisecond)     │
                ▼                                             ▼ (Fallback если NPU недоступен)
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│     laya-npu-bridge.py (OpenVINO)      │       │     In-Memory CPU Calibrated Fallback  │
│ - Device: 'NPU' (Intel AI Boost)       │       │ - Pure TypeScript Engine               │
│ - Multi-Task Decision Neural Network   │       │ - Latency: 10–20 ms                    │
│ - Dense-128 -> GeGLU -> Dense-64 -> 8  │       │ - Backend: 'CPU_CALIBRATED_FALLBACK'   │
│ - Latency: 0.5–1.5 ms                  │       └────────────────────────────────────────┘
│ - Backend: 'NPU_INTEL_AIBOOST'         │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 LayaDecisionPayload Result                  │
│ - decision: APPROVED | REJECTED | NEEDS_REFINEMENT          │
│ - confidence: 0.0 - 1.0                                     │
│ - latencyMs: number (< 5ms with NPU)                        │
│ - hardwareBackend: 'NPU_INTEL_AIBOOST' | 'CPU_FALLBACK'     │
│ - scores: { density, hierarchy, wcag, touch, slop }         │
│ - classification: { designDna, slopDetected, slopType }     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Контракт Данных и Спецификация Интерфейсов

### 4.1. Расширение `LayaDecisionPayload`
```typescript
export type LayaHardwareBackend = 
  | 'NPU_INTEL_AIBOOST'
  | 'IGPU_INTEL_ARC'
  | 'CPU_CALIBRATED_FALLBACK';

export interface LayaDecisionPayload {
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT';
  confidence: number;
  latencyMs: number;
  scores: LayaDecisionScores;
  classification: LayaClassificationResult;
  gates: LayaGates;
  refinements: string[];
  // Добавлено в v1.1 для аппаратной телеметрии:
  hardwareBackend: LayaHardwareBackend;
  hardwareDeviceName?: string;
}
```

### 4.2. Вектор 32 структурных признаков (Feature Tensor)
Для инференса на NPU из разметки за 0.1 мс извлекается 32-мерный нормализованный тензор `float32[1, 32]`:
- `f[0..4]`: Slop-клише (purple_neon, bento_emoji, pill_badge, blob_mesh, gradient_text)
- `f[5..9]`: Touch targets (кнопки < 44px, наличие min-h-[44px], touch density)
- `f[10..14]`: WCAG контрастность (светлый на светлом, темный на темном, контрастные пары)
- `f[15..19]`: Плотность информации (tabular-nums, padding scale, компактные таблицы)
- `f[20..25]`: Признаки дизайн-ДНК (swiss, financial, tactile, editorial, obsidian, bio)
- `f[26..31]`: Контекстные флаги (mobile, checkout, dashboard, table, dark_mode, form)

---

## 5. План Реализации (SDD / WBS)
1. **Phase 1 (Red Phase):** Тесты в `src/__tests__/unit/laya-npu-acceleration.test.ts`. Проверяют инициализацию провайдера, компиляцию NPU-модели, задержку инференса, корректность вердикта и fallback.
2. **Phase 2 (Python NPU Bridge):** Создание `scripts/mcp/laya-npu-bridge.py` с компиляцией в OpenVINO на устройство `'NPU'`.
3. **Phase 3 (TypeScript Provider):** Создание `scripts/mcp/laya-npu-provider.ts` с IPC-мостом и пулом потоков.
4. **Phase 4 (Server Integration):** Подключение NPU-провайдера в `scripts/mcp/laya-mcp-server.ts`.
5. **Phase 5 (Verification):** Запуск Vitest, `tsc`, аудит секретов, сквозной запуск `/boost`.
