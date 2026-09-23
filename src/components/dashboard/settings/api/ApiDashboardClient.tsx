'use client';

import React, { useState } from 'react';
import { Key, BookOpen } from 'lucide-react';
import ApiKeyManager from '@/app/dashboard/settings/api/ApiKeyManager';
import { ApiReferenceDocs } from './ApiReferenceDocs';

interface ApiDashboardClientProps {
  hasKey: boolean;
}

export function ApiDashboardClient({ hasKey }: ApiDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'key' | 'docs'>('key');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Determine if user has key currently active (either from DB or newly generated)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isKeyActive = hasKey || !!generatedKey;

  return (
    <div className="space-y-6">
      
      {/* ── Tabs selector ── */}
      <div className="flex bg-muted p-1 rounded-2xl border border-border/40 select-none max-w-xs">
        <button
          onClick={() => setActiveTab('key')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'key' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Key className="w-4 h-4 text-primary shrink-0" />
          <span>API-Ключ</span>
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'docs' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <span>Документация</span>
        </button>
      </div>

      {/* ── Active Tab View ── */}
      {activeTab === 'key' ? (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border/40">
            <h2 className="font-extrabold text-foreground text-sm">Персональный API-ключ</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Используйте API-ключ для автоматического заказа услуг SMMplan из ваших скриптов и систем.
            </p>
          </div>
          <div className="p-5">
            <ApiKeyManager 
              hasKey={hasKey} 
              onKeyGenerated={(key: string | null) => setGeneratedKey(key)} 
            />
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="font-extrabold text-foreground text-sm">Интеграционная документация API v2</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Спецификации, параметры запросов и примеры интеграции с реселлер-платформой SMMplan.
            </p>
          </div>
          <div className="p-5">
            <ApiReferenceDocs userApiKey={generatedKey} />
          </div>
        </div>
      )}

    </div>
  );
}
