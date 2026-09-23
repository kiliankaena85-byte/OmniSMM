'use client';

import React, { useState } from 'react';
import { LogOut, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LogoutCard({ tenantId = 'smmplan' }: { tenantId?: string }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // Fallback
    }
    const isFlux = tenantId === 'flux' || tenantId === 'smmflux';
    window.location.href = isFlux ? '/login?tenant=flux' : '/login';
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">
              Сессия и безопасность
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Завершение текущей сессии и выход из личного кабинета
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Активная сессия защищена шифрованием JWT HS256</span>
          </div>
          <p className="text-xs text-muted-foreground">
            При выходе данные сессии удаляются на сервере и в браузере.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoading}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all duration-200 flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Выход...</span>
            </>
          ) : (
            <>
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти из аккаунта</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
