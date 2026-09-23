/**
 * Format seconds into human-readable duration.
 * 
 * Examples:
 *   30    → "< 1 мин"
 *   900   → "15 мин"
 *   9000  → "2ч 30м"
 *   93600 → "1д 2ч"
 * 
 * Used by: Admin Orders ETA column, future client-facing ETA.
 */
export function formatEta(seconds: number): string {
  if (seconds < 60) return `< 1 мин`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h > 0 ? `${d}д ${h}ч` : `${d}д`;
}

export function formatEtaSpeedBadge(service: {
  speed?: string | null;
  etaP50Seconds?: number | null;
  etaP90Seconds?: number | null;
  etaSpeedClass?: string | null;
}): string {
  let speedText = 'Высокая';
  if (service.etaSpeedClass === 'FAST' || service.etaSpeedClass === 'ULTRA_FAST') {
    speedText = 'Высокая';
  } else if (service.etaSpeedClass === 'MEDIUM') {
    speedText = 'Средняя';
  } else if (service.etaSpeedClass === 'SLOW' || service.etaSpeedClass === 'ULTRA_SLOW') {
    speedText = 'Плавная';
  } else if (service.speed) {
    speedText = service.speed;
  }

  if (service.etaP50Seconds && service.etaP50Seconds > 0 && service.etaP90Seconds && service.etaP90Seconds > 0) {
    return `⚡ ${speedText} (ETA P50: ${formatEta(service.etaP50Seconds)}, P90: ${formatEta(service.etaP90Seconds)})`;
  } else if (service.etaP50Seconds && service.etaP50Seconds > 0) {
    return `⚡ ${speedText} (ETA P50: ${formatEta(service.etaP50Seconds)})`;
  }
  return `⚡ ${speedText}`;
}

