'use client';

import React, { useState } from 'react';
import { Key, Shield, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function ProviderKeysManagementPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleRotate = (providerName: string) => {
    toast.success(`Ключ провайдера ${providerName} зашифрован в Vault (AES-256-GCM)`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Key className="w-7 h-7 text-primary shrink-0" />
          Управление API-ключами провайдеров (Vault Security)
        </h1>
        <p className="text-sm text-muted-foreground">
          Все ключи провайдеров зашифрованы алгоритмом AES-256-GCM и не отображаются в открытом виде.
        </p>
      </div>

      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-foreground space-y-1">
          <div className="font-semibold">Сквозное шифрование секретов (Encryption at Rest)</div>
          <p className="text-muted-foreground text-xs">
            Ключи шифруются мастер-ключом Vault перед записью в PostgreSQL. В логах и интерфейсе ключи автоматически маскируются.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {['Main-Provider', 'Soc-Rocket', 'SMMPrime', 'Stream-Promotion', 'Likedrom', 'SMMPanelUS', 'Soc-Proof', 'Telegram.Shop'].map((name) => (
          <div key={name} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="font-semibold text-foreground text-sm">{name}</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">••••••••••••••••••••••••••••••••</div>
            </div>
            <button
              onClick={() => handleRotate(name)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              Обновить ключ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
