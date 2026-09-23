'use client';

import React from 'react';
import { inputCls, labelCls, ProviderFormData } from '../types';

interface ProviderPricingSectionProps {
  formData: ProviderFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

export function ProviderPricingSection({
  formData,
  onChange,
}: ProviderPricingSectionProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
      <h2 className="text-base font-bold text-foreground">Параметры баланса и активность</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="provider-balanceCurrency" className={labelCls}>
            Валюта баланса провайдера
          </label>
          <select
            id="provider-balanceCurrency"
            name="balanceCurrency"
            value={formData.balanceCurrency}
            onChange={onChange}
            aria-label="Валюта баланса провайдера"
            className={inputCls}
          >
            <option value="USD">USD ($)</option>
            <option value="RUB">RUB (₽)</option>
            <option value="EUR">EUR (€)</option>
            <option value="USDT">USDT (₮)</option>
            <option value="KZT">KZT (₸)</option>
            <option value="BYN">BYN (Br)</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Валюта, в которой поставщик ведет расчеты через API.
          </p>
        </div>

        <div className="flex items-center pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={onChange}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
            />
            <span className="text-sm font-medium text-foreground">
              Провайдер активен (доступен для синхронизации и отправки заказов)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
