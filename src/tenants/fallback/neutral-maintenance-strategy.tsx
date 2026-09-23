'use client';

import React from 'react';
import { ITenantDashboardStrategy, BaseUserProps } from '../types';
import { ShieldAlert } from 'lucide-react';

function NeutralMaintenanceShell({ children }: { user: BaseUserProps; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Техническое обслуживание</h1>
        <p className="text-sm text-muted-foreground">
          Данный сервис временно находится на техническом обслуживании. Пожалуйста, зайдите позже.
        </p>
      </div>
      <div className="w-full max-w-5xl mt-8">{children}</div>
    </div>
  );
}

function NeutralMaintenanceHome() {
  return (
    <div className="p-8 text-center bg-card rounded-2xl border border-border/40 my-6">
      <p className="text-muted-foreground font-medium">Модуль системы обновляется.</p>
    </div>
  );
}

const NeutralMaintenanceStrategy: ITenantDashboardStrategy = {
  ShellLayout: NeutralMaintenanceShell,
  HomeView: NeutralMaintenanceHome,
};

export default NeutralMaintenanceStrategy;
