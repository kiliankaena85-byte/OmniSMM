import { ReactNode } from 'react';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { OperatorSidebar } from '@/components/operator/shell/operator-sidebar';
import { OperatorTopbar } from '@/components/operator/shell/operator-topbar';
import { OperatorContentShell } from '@/components/operator/shell/operator-content-shell';
import { OPERATOR_NAVIGATION } from '@/lib/operator/navigation';
import { Toaster } from '@/components/ui/sonner';

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  SUPPORT: 'Поддержка',
  OPERATOR: 'Оператор',
};

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  const { user } = await enforceOperatorAccess();
  const roleLabel = ROLE_LABELS[user.role] || 'Оператор';

  return (
    <div className="h-screen w-full overflow-hidden bg-muted/10 dark:bg-background flex flex-col md:flex-row relative selection:bg-primary/20 selection:text-foreground">
      {/* Soft Ambient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20 pointer-events-none z-0" />

      <OperatorSidebar 
        userEmail={user.email}
        roleLabel={roleLabel}
        navigation={OPERATOR_NAVIGATION}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <OperatorTopbar 
          userEmail={user.email}
          roleLabel={roleLabel}
          navigation={OPERATOR_NAVIGATION}
        />
        
        <OperatorContentShell>
          {children}
        </OperatorContentShell>
      </div>

      <Toaster position="top-right" richColors closeButton className="mt-4 mr-4" />
    </div>
  );
}
