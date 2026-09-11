'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PromoCode, PromoCodeUsage } from '@prisma/client';
import { Trash2 } from 'lucide-react';
import { togglePromoCode, deletePromoCode } from '@/actions/admin/marketing';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { Switch, Modal as HeroUIModal, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { cn } from '@/lib/utils';
import { formatRubles } from '@/utils/format-price';

// Cast Modal with standard dot notation sub-components for HeroUI compliance
const Modal = Object.assign(HeroUIModal, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
}) as typeof HeroUIModal & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
};

export type PromoCodeWithUsages = PromoCode & {
  usages: Array<Omit<PromoCodeUsage, 'discountCents' | 'revenueCents' | 'profitCents'> & {
    discountCents: number;
    revenueCents: number;
    profitCents: number;
  }>;
};

// Isolated Status Toggle Client Component
function PromoCodeStatusToggle({ promo }: { promo: PromoCodeWithUsages }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const res = await togglePromoCode(promo.id, !promo.isActive);
      if (res.success) {
        toast.success(`Промокод ${!promo.isActive ? 'активирован' : 'деактивирован'}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Switch 
        isSelected={promo.isActive} 
        onChange={handleToggle}
        isDisabled={isPending}
        size="sm"
        aria-label={`Toggle status for ${promo.code}`}
      />
      <span className={`text-[10px] font-extrabold uppercase tracking-widest ${promo.isActive ? 'text-success' : 'text-muted-foreground/45'}`}>
        {promo.isActive ? 'Активен' : 'Выкл'}
      </span>
    </div>
  );
}

// Isolated Delete Promo Code Client Component
function DeletePromoButton({ promo }: { promo: PromoCodeWithUsages }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deletePromoCode(promo.id);
      if (res.success) {
        toast.success('Промокод успешно удален');
        setIsOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={isPending}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50"
        title="Удалить промокод"
      >
        <Trash2 className="w-4.5 h-4.5" />
      </button>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-card rounded-2xl shadow-xl border border-border text-foreground max-w-sm mx-auto mt-[20vh] relative z-50 p-6">
          <Modal.Header className="font-bold text-foreground text-base pb-2 border-b border-border p-0">Удаление промокода</Modal.Header>
          <Modal.Body className="text-sm text-muted-foreground py-4 px-0">
            Вы уверены, что хотите безвозвратно удалить промокод <strong>{promo.code}</strong>?
          </Modal.Body>
          <Modal.Footer className="flex items-center justify-end gap-2 pt-2 border-t border-border p-0">
            <Button intent="outline" onClick={() => setIsOpen(false)} className="h-[44px] rounded-xl border-border text-foreground hover:bg-muted">
              Отмена
            </Button>
            <Button 
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-primary-foreground hover:bg-destructive/90 h-[44px] rounded-xl font-bold"
            >
              {isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
}

export const columns: ColumnDef<PromoCodeWithUsages>[] = [
  {
    id: 'index',
    header: '#',
    cell: ({ row }) => (
      <span className="text-xs font-mono font-bold text-muted-foreground/45">
        {row.index + 1}
      </span>
    ),
  },
  {
    accessorKey: 'code',
    header: 'Код',
    cell: ({ row }) => {
      const p = row.original;
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-extrabold text-foreground tracking-widest text-xs bg-muted px-2 py-1 rounded-md border border-border/40">
              {p.code}
            </span>
            {p.isSuspicious && (
              <span className="bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider">
                Фрод
              </span>
            )}
          </div>
          {p.description && (
            <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[150px]">
              {p.description}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'type',
    header: 'Тип',
    cell: ({ row }) => {
      const type = row.original.type;
      return (
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md border",
          type === 'DISCOUNT' 
            ? 'bg-warning/10 text-warning border border-warning/20' 
            : 'bg-success/10 text-success border border-success/20'
        )}>
          {type === 'DISCOUNT' ? 'Скидка' : 'Ваучер'}
        </span>
      );
    },
  },
  {
    id: 'bonus',
    header: 'Бонус',
    cell: ({ row }) => {
      const p = row.original;
      return (
        <span className="tabular-nums font-extrabold text-foreground text-xs">
          {p.type === 'DISCOUNT' ? `${p.discountPercent}%` : formatRubles(p.amount)}
        </span>
      );
    },
  },
  {
    id: 'utm',
    accessorFn: (row) => !!(row.utmSource || row.utmMedium || row.utmCampaign),
    header: 'UTM метки',
    cell: ({ row }) => {
      const p = row.original;
      const hasUtm = p.utmSource || p.utmMedium || p.utmCampaign;
      if (!hasUtm) {
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-muted text-muted-foreground border border-border/30">
            Органический
          </span>
        );
      }
      return (
        <div className="flex flex-col gap-0.5 font-mono text-[9px] text-muted-foreground">
          {p.utmSource && <span className="line-clamp-1"><strong className="text-muted-foreground/50">src:</strong> {p.utmSource}</span>}
          {p.utmMedium && <span className="line-clamp-1"><strong className="text-muted-foreground/50">med:</strong> {p.utmMedium}</span>}
          {p.utmCampaign && <span className="line-clamp-1"><strong className="text-muted-foreground/50">cam:</strong> {p.utmCampaign}</span>}
        </div>
      );
    },
  },
  {
    id: 'budget',
    header: 'Бюджет',
    cell: ({ row }) => {
      const budgetRub = Number(row.original.budgetCents) / 100;
      return (
        <span className="tabular-nums font-mono font-bold text-foreground text-xs">
          {formatRubles(budgetRub)}
        </span>
      );
    },
  },
  {
    id: 'ltv',
    header: 'LTV',
    cell: ({ row }) => {
      const usages = row.original.usages || [];
      const ltvRub = usages.reduce((sum, u) => sum + (u.revenueCents || 0), 0) / 100;
      return (
        <span className="tabular-nums font-mono font-bold text-foreground text-xs">
          {formatRubles(ltvRub)}
        </span>
      );
    },
  },
  {
    id: 'profit',
    header: 'Прибыль',
    cell: ({ row }) => {
      const usages = row.original.usages || [];
      const profitRub = usages.reduce((sum, u) => sum + (u.profitCents || 0), 0) / 100;
      const isPositive = profitRub >= 0;
      return (
        <span className={cn(
          "inline-flex items-center justify-center min-w-[68px] h-[44px] px-3 font-mono font-bold text-xs rounded-xl border tabular-nums",
          isPositive 
            ? 'bg-success/10 text-success border border-success/20' 
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        )}>
          {isPositive ? '+' : ''}{formatRubles(profitRub)}
        </span>
      );
    },
  },
  {
    id: 'cac',
    header: 'CAC',
    cell: ({ row }) => {
      const p = row.original;
      const budgetRub = Number(p.budgetCents) / 100;
      const usages = p.usages || [];
      const count = usages.length;
      if (count === 0 || budgetRub === 0) {
        return <span className="text-muted-foreground/45 font-bold font-mono">—</span>;
      }
      const cacRub = budgetRub / count;
      return (
        <span className="tabular-nums font-mono font-bold text-foreground text-xs">
          {formatRubles(cacRub)}
        </span>
      );
    },
  },
  {
    id: 'romi',
    header: 'ROMI',
    cell: ({ row }) => {
      const p = row.original;
      const budgetRub = Number(p.budgetCents) / 100;
      const usages = p.usages || [];
      const profitRub = usages.reduce((sum, u) => sum + (u.profitCents || 0), 0) / 100;
      
      if (budgetRub === 0) {
        return <span className="text-muted-foreground/45 font-bold font-mono">—</span>;
      }

      const romiPercent = ((profitRub - budgetRub) / budgetRub) * 100;
      
      let badgeStyle = "bg-destructive/10 text-destructive border border-destructive/20";
      if (romiPercent >= 50) {
        badgeStyle = "bg-success/10 text-success border border-success/20";
      } else if (romiPercent >= 0) {
        badgeStyle = "bg-warning/10 text-warning border border-warning/20";
      }

      return (
        <span className={cn(
          "inline-flex items-center justify-center min-w-[68px] h-[44px] px-3 font-mono font-bold text-xs rounded-xl border tabular-nums",
          badgeStyle
        )}>
          {romiPercent.toFixed(1)}%
        </span>
      );
    },
  },
  {
    id: 'usage',
    header: 'Использование',
    cell: ({ row }) => {
      const p = row.original;
      const isUnlimited = p.maxUses === 0;
      if (isUnlimited) {
        return (
          <div className="flex flex-col gap-1 w-24">
            <span className="text-[10px] text-muted-foreground font-mono font-bold tabular-nums">
              Использовано: {p.uses}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-success/10 text-success border border-success/20 w-fit">
              Безлимитно
            </span>
          </div>
        );
      }

      const progressPercent = Math.min(100, (p.uses / p.maxUses) * 100);
      return (
        <div className="flex flex-col gap-1 w-24">
          <span className="text-[10px] text-muted-foreground font-mono font-bold tabular-nums">
            {p.uses} / {p.maxUses}
          </span>
          <div className="w-full h-1.5 rounded-full overflow-hidden border bg-muted border-border/40">
            <div 
              className="h-full bg-primary transition-all" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'isActive',
    header: 'Статус',
    cell: ({ row }) => <PromoCodeStatusToggle promo={row.original} />,
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <div className="flex justify-end pr-2">
        <DeletePromoButton promo={row.original} />
      </div>
    ),
  },
];
