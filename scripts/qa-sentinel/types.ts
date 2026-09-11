/**
 * scripts/qa-sentinel/types.ts
 *
 * Типы данных и DTO автономной студии сквозного QA-инспектирования Omni-Sentinel QA.
 */

export interface OverflowElementInfo {
  selector: string;
  tagName: string;
  className: string;
  boundingWidth: number;
  overflowAmount: number;
}

export interface DomInspectionResult {
  hasHorizontalScroll: boolean;
  scrollWidth: number;
  innerWidth: number;
  overflowPixels: number;
  overflowElements: OverflowElementInfo[];
  hydrationErrorDetected: boolean;
  hydrationErrorMessage?: string;
  smallTouchTargetsCount: number;
}

export type UserRole = 'GUEST' | 'USER_SMMPLAN' | 'USER_FLUX' | 'SUPPORT' | 'OWNER';

export interface ScreenScenario {
  id: string;
  name: string;
  role: UserRole;
  tenantId: string;
  path: string;
  viewport: { width: number; height: number; name: string };
  screenshotFileName: string;
  isQuick?: boolean;
}

export interface ScreenCheckResult {
  id: string;
  name: string;
  role: UserRole;
  tenantId: string;
  path: string;
  url: string;
  viewport: { width: number; height: number; name: string };
  screenshotPath: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  failedNetworkRequests: Array<{ url: string; status: number; method: string }>;
  domMetrics: DomInspectionResult;
  durationMs: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

export interface QASentinelSummary {
  timestamp: string;
  targetUrl: string;
  totalScreens: number;
  passedScreens: number;
  warnScreens: number;
  failedScreens: number;
  totalConsoleErrors: number;
  totalFailedRequests: number;
  totalOverflowIssues: number;
  totalDurationMs: number;
  verdict: 'EXCELLENT' | 'STABLE_WITH_WARNINGS' | 'CRITICAL_DEFECTS';
  screens: ScreenCheckResult[];
}
