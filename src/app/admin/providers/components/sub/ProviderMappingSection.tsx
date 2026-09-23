'use client';

import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { inputCls, labelCls, MappingState, IntegrationMode, InferredSchema } from '../types';

interface ProviderMappingSectionProps {
  integrationMode: IntegrationMode;
  mapping: MappingState;
  jsonText: string;
  inferLoading: boolean;
  inferredSchema: InferredSchema | null;
  onModeChange: (mode: IntegrationMode) => void;
  onMappingChange: (field: keyof MappingState, value: string) => void;
  onJsonChange: (text: string) => void;
  onInferSchema: () => void;
  onApplyCatalogKey: (field: keyof MappingState, key: string) => void;
}

export function ProviderMappingSection({
  integrationMode,
  mapping,
  jsonText,
  inferLoading,
  inferredSchema,
  onModeChange,
  onMappingChange,
  onJsonChange,
  onInferSchema,
  onApplyCatalogKey,
}: ProviderMappingSectionProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Интеграция и маппинг API</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Выберите стандартный протокол v2 или настройте сопоставление полей
          </p>
        </div>

        {/* Integration Mode Switcher */}
        <div className="flex bg-muted/40 p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => onModeChange('standard')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              integrationMode === 'standard' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Стандартный v2 API
          </button>
          <button
            type="button"
            onClick={() => onModeChange('visual')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              integrationMode === 'visual' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Визуальный конструктор
          </button>
          <button
            type="button"
            onClick={() => onModeChange('json')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              integrationMode === 'json' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Прямой JSON
          </button>
        </div>
      </div>

      {/* Visual Constructor Mode */}
      {integrationMode === 'visual' && (
        <div className="space-y-4 text-xs">
          {/* Auth Settings */}
          <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Параметры авторизации</span>
              <button
                type="button"
                onClick={onInferSchema}
                disabled={inferLoading}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5 border border-border"
              >
                {inferLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
                Определить структуру API
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Метод запроса</label>
                <select
                  value={mapping.httpMethod}
                  onChange={(e) => onMappingChange('httpMethod', e.target.value as any)}
                  className={inputCls}
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Content-Type</label>
                <select
                  value={mapping.contentType}
                  onChange={(e) => onMappingChange('contentType', e.target.value as any)}
                  className={inputCls}
                >
                  <option value="form">application/x-www-form-urlencoded</option>
                  <option value="json">application/json</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Тип передачи ключа</label>
                <select
                  value={mapping.authType}
                  onChange={(e) => onMappingChange('authType', e.target.value as any)}
                  className={inputCls}
                >
                  <option value="body">В теле запроса (Body)</option>
                  <option value="query">В строке URL (Query)</option>
                  <option value="header">В заголовке (Header)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inferred Schema Keys Helper */}
          {inferredSchema && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
              <span className="font-bold text-primary">Обнаруженные поля каталога (клик для быстрой подстановки):</span>
              <div className="flex flex-wrap gap-1.5">
                {inferredSchema.catalogKeys.map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onApplyCatalogKey('serviceIdField', k)}
                    className="px-2 py-0.5 bg-background border border-border rounded font-mono text-[11px] hover:border-primary text-muted-foreground hover:text-foreground"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Core Order & Response Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Поле услуги (service)</label>
              <input
                type="text"
                value={mapping.serviceField}
                onChange={(e) => onMappingChange('serviceField', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Поле ссылки (link)</label>
              <input
                type="text"
                value={mapping.linkField}
                onChange={(e) => onMappingChange('linkField', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Поле количества (quantity)</label>
              <input
                type="text"
                value={mapping.quantityField}
                onChange={(e) => onMappingChange('quantityField', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Поле ID заказа (order)</label>
              <input
                type="text"
                value={mapping.orderIdField}
                onChange={(e) => onMappingChange('orderIdField', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      )}

      {/* Direct JSON Mode */}
      {integrationMode === 'json' && (
        <div className="space-y-2">
          <label className={labelCls}>JSON конфигурация маппинга</label>
          <textarea
            value={jsonText}
            onChange={(e) => onJsonChange(e.target.value)}
            rows={10}
            placeholder="JSON конфигурация маппинга"
            className={`${inputCls} font-mono text-xs`}
          />
        </div>
      )}
    </div>
  );
}
