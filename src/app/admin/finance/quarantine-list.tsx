'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { approveQuarantineAction, rejectQuarantineAction } from '@/actions/admin/users';
import { AlertTriangle, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTransition } from 'react';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export interface QuarantineEntry {
  [key: string]: unknown;
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  reason: string;
  adminId: string | null;
  createdAt: Date;
}

interface QuarantineListProps {
  entries: QuarantineEntry[];
}

export function QuarantineList({ entries }: QuarantineListProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [activeEntry, setActiveEntry] = React.useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    setActiveEntry({ id, action });
    setConfirmOpen(true);
  };

  const executeAction = () => {
    if (!activeEntry) return;
    const { id, action } = activeEntry;
    setConfirmOpen(false);

    startTransition(async () => {
      const fd = new FormData();
      fd.append('entryId', id);
      
      try {
        await (action === 'approve' ? approveQuarantineAction(fd) : rejectQuarantineAction(fd));
        toast.success(action === 'approve' ? 'Транзакция одобрена' : 'Транзакция отклонена');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        toast.error('Ошибка выполнения операции');
      }
    });
  };

  if (entries.length === 0) return null;

  return (
    <div className="border border-warning/30 bg-warning/10 rounded-2xl overflow-hidden shadow-xs animate-in slide-in-from-top duration-300">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-warning/20 bg-warning/15">
        <div className="p-2 bg-warning/20 text-warning rounded-xl border border-warning/30">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-foreground text-sm uppercase tracking-wider">
            {entries.length} транзакций в карантине Escrow
          </span>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
            Превышен лимит доверия. Требуется подтверждение Владельца платформы.
          </p>
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {entries.map(entry => (
          <div key={entry.id} className="px-6 py-4 flex items-center justify-between gap-6 hover:bg-warning/10 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-black font-mono text-foreground text-base tabular-nums">
                  {(entry.amount / 100).toLocaleString('ru-RU')} ₽
                </span>
                <Badge intent="outline" className="font-mono font-bold text-[10px] bg-card text-foreground border-border/80">
                  {entry.userEmail}
                </Badge>
              </div>
              <p className="text-xs text-foreground/90 font-medium">{entry.reason}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-tight">
                <span>Оператор: {entry.adminId || 'System'}</span>
                <span>•</span>
                <span>{entry.createdAt.toLocaleString('ru-RU')}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                intent="destructive"
                className="font-bold text-[10px] uppercase tracking-wider h-8 min-h-[32px]"
                disabled={isPending}
                onClick={() => handleAction(entry.id, 'reject')}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Отклонить
              </Button>
              <Button
                size="sm"
                className="font-bold text-[10px] uppercase tracking-wider h-8 min-h-[32px] shadow-xs text-primary-foreground bg-success hover:bg-success/90"
                disabled={isPending}
                onClick={() => handleAction(entry.id, 'approve')}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Одобрить
              </Button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeAction}
        title={activeEntry?.action === 'approve' ? 'Одобрение транзакции' : 'Отклонение транзакции'}
        isDanger={activeEntry?.action === 'reject'}
        confirmText={activeEntry?.action === 'approve' ? 'Одобрить' : 'Отклонить'}
      >
        Вы действительно хотите {activeEntry?.action === 'approve' ? 'одобрить' : 'отклонить'} эту транзакцию в карантине Escrow?
      </ConfirmModal>
    </div>
  );
}
