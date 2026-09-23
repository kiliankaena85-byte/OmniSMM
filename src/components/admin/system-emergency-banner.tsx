'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ShieldAlert, Volume2, VolumeX, X, RefreshCw } from 'lucide-react';

interface ActiveAlert {
  code: string;
  category: string;
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  details: string;
  suggestedAction: string;
}

export function SystemEmergencyBanner() {
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Synthesize gentle emergency siren using Web Audio API
  const playSirenBeep = useCallback(() => {
    if (isMuted || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5 note

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio playback best-effort
    }
  }, [isMuted]);

  const checkHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/telemetry/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.activeAlerts && data.activeAlerts.length > 0) {
          setActiveAlerts(data.activeAlerts);
          if (data.activeAlerts.some((a: ActiveAlert) => a.severity === 'CRITICAL')) {
            playSirenBeep();
          }
        } else {
          setActiveAlerts([]);
        }
      }
    } catch {
      // Best-effort polling
    } finally {
      setIsLoading(false);
    }
  }, [playSirenBeep]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [checkHealth]);

  if (activeAlerts.length === 0 || isDismissed) {
    return null;
  }

  const criticalAlert = activeAlerts.find((a) => a.severity === 'CRITICAL') || activeAlerts[0];
  const isCritical = criticalAlert.severity === 'CRITICAL';

  return (
    <div
      role="alert"
      className={`w-full px-4 py-2.5 transition-all text-xs font-medium flex items-center justify-between z-50 border-b ${
        isCritical
          ? 'bg-rose-950/90 text-rose-200 border-rose-800/60 shadow-lg shadow-rose-950/30 animate-pulse'
          : 'bg-amber-950/90 text-amber-200 border-amber-800/60 shadow-lg shadow-amber-950/30'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isCritical ? (
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        )}
        <div className="truncate">
          <span className="font-semibold uppercase tracking-wider text-[11px] mr-2 px-1.5 py-0.5 rounded bg-black/40">
            {criticalAlert.severity}
          </span>
          <span className="font-semibold text-white mr-1.5">{criticalAlert.title}:</span>
          <span className="opacity-90">{criticalAlert.details}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {criticalAlert.suggestedAction && (
          <span className="hidden md:inline-block opacity-80 text-[11px] italic mr-2">
            {criticalAlert.suggestedAction}
          </span>
        )}

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title={isMuted ? 'Включить звук сирены' : 'Отключить звук сирены'}
          aria-label="Toggle Siren Audio"
        >
          {isMuted ? <VolumeX className="h-3.5 w-3.5 opacity-70" /> : <Volume2 className="h-3.5 w-3.5 opacity-90" />}
        </button>

        <button
          onClick={checkHealth}
          disabled={isLoading}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Обновить состояние"
          aria-label="Refresh Health"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : 'opacity-70'}`} />
        </button>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Скрыть оповещение"
          aria-label="Dismiss Alert"
        >
          <X className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>
    </div>
  );
}
