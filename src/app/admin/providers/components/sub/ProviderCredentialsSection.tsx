'use client';

import React from 'react';
import { RefreshCw, Zap, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { inputCls, labelCls, ProviderFormData } from '../types';
import type { ProviderProbeResult } from '@/services/admin/provider-diagnostic.service';

interface ProviderCredentialsSectionProps {
  formData: ProviderFormData;
  isEditMode: boolean;
  hasApiKey?: boolean;
  checkLoading: boolean;
  probeResult: ProviderProbeResult | null;
  fieldErrors: Record<string, string[]>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onUrlBlur: () => void;
  onKeyBlur: () => void;
  onDeepProbe: () => void;
  onApplySuggestedUrl: (suggestedUrl: string) => void;
}

export function ProviderCredentialsSection({
  formData,
  isEditMode,
  hasApiKey,
  checkLoading,
  probeResult,
  fieldErrors,
  onChange,
  onUrlBlur,
  onKeyBlur,
  onDeepProbe,
  onApplySuggestedUrl,
}: ProviderCredentialsSectionProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
      <h2 className="text-base font-bold text-foreground">Подключение к API</h2>

      <div>
        <label htmlFor="provider-name" className={labelCls}>
          Название провайдера <span className="text-destructive">*</span>
        </label>
        <input
          id="provider-name"
          type="text"
          name="name"
          value={formData.name}
          onChange={onChange}
          placeholder="Например: JustAnotherPanel"
          required
          aria-label="Название провайдера"
          className={`${inputCls} ${fieldErrors.name ? 'border-destructive ring-1 ring-destructive' : ''}`}
        />
        {fieldErrors.name && (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="provider-apiUrl" className={labelCls}>
          API URL <span className="text-destructive">*</span>
        </label>
        <input
          id="provider-apiUrl"
          type="url"
          name="apiUrl"
          value={formData.apiUrl}
          onChange={onChange}
          onBlur={onUrlBlur}
          placeholder="https://example.com/api/v2"
          required
          aria-label="API URL"
          className={`${inputCls} ${fieldErrors.apiUrl ? 'border-destructive ring-1 ring-destructive' : ''}`}
        />
        {fieldErrors.apiUrl && (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.apiUrl[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="provider-apiKey" className={labelCls}>
          API Ключ {isEditMode ? '(оставьте пустым, если не меняется)' : <span className="text-destructive">*</span>}
        </label>
        <input
          id="provider-apiKey"
          type="password"
          name="apiKey"
          value={formData.apiKey}
          onChange={onChange}
          onBlur={onKeyBlur}
          placeholder={isEditMode && hasApiKey ? '••••••••••••••••' : 'Вставьте API ключ'}
          required={!isEditMode}
          aria-label="API Ключ"
          autoComplete="new-password"
          className={`${inputCls} ${fieldErrors.apiKey ? 'border-destructive ring-1 ring-destructive' : ''}`}
        />
        {fieldErrors.apiKey && (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.apiKey[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="provider-ticketUrl" className={labelCls}>
          Ссылка на тикеты провайдера (необязательно)
        </label>
        <input
          id="provider-ticketUrl"
          type="url"
          name="ticketUrl"
          value={formData.ticketUrl}
          onChange={onChange}
          placeholder="https://example.com/tickets/new"
          aria-label="Ссылка на тикеты провайдера"
          className={inputCls}
        />
      </div>

      {/* Deep Probe Trigger Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onDeepProbe}
          disabled={checkLoading || !formData.apiUrl || (!formData.apiKey && !hasApiKey)}
          aria-label="Проверить соединение с провайдером"
          className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2 border border-border"
        >
          {checkLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span>Диагностика API...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-primary" />
              <span>⚡ Проверить соединение</span>
            </>
          )}
        </button>
      </div>

      {/* Probe Result Diagnosis Card */}
      {probeResult && (
        <div className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in duration-200 ${
          probeResult.success 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-destructive/10 border-destructive/30 text-destructive'
        }`}>
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              {probeResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {probeResult.success ? 'Соединение успешно установлено' : 'Сбой подключения к API'}
            </span>
            {probeResult.latencyMs > 0 && <span>Задержка: {probeResult.latencyMs} мс</span>}
          </div>
          {probeResult.balance !== undefined && (
            <div>Баланс: <b className="font-mono">{probeResult.balance} {probeResult.detectedCurrency}</b></div>
          )}
          {probeResult.errorMessage && (
            <p className="text-[11px] opacity-90">{probeResult.errorMessage}</p>
          )}
          {probeResult.suggestedUrl && (
            <div className="pt-2 flex items-center justify-between bg-background/40 p-2 rounded border border-border/50">
              <span className="flex items-center gap-1 text-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Предложен рабочий URL: <b className="font-mono">{probeResult.suggestedUrl}</b>
              </span>
              <button
                type="button"
                onClick={() => onApplySuggestedUrl(probeResult.suggestedUrl!)}
                className="px-2 py-1 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Применить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
