'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { logManualCompensation } from '@/actions/support/compensation';
import { RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function ManualRefillModal({ 
  open, 
  onClose, 
  ticketId,
  supportLimitCents
}: { 
  open: boolean; 
  onClose: () => void; 
  ticketId: string;
  supportLimitCents?: number;
}) {
  const [costText, setCostText] = useState('');
  const [note, setNote] = useState('');
  const [topUpBalance, setTopUpBalance] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!costText || !note) return;

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('ticketId', ticketId);
        fd.set('costRub', costText);
        fd.set('note', note);
        fd.set('topUpBalance', topUpBalance ? 'true' : 'false');
        await logManualCompensation(fd);
        setCostText('');
        setNote('');
        setTopUpBalance(false);
        toast.success(topUpBalance ? 'Баланс пополнен и лимит списан' : 'Компенсация успешно списана с лимита');
        onClose();
      } catch (e: unknown) {
        toast.error((e instanceof Error ? e.message : String(e)) || 'Ошибка списания лимита');
      }
    });
  };

  const limitRub = supportLimitCents !== undefined ? Math.floor(supportLimitCents / 100) : null;
  const parsedCost = parseFloat(costText) || 0;
  const remaining = limitRub !== null ? limitRub - parsedCost : null;
  const isOverLimit = remaining !== null && remaining < 0 && limitRub !== null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/60 flex items-center justify-center p-4 backdrop-blur-sm shadow-2xl">
      <div className="bg-card rounded-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" /> Ручная компенсация
          </h2>
          <Button intent="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0 text-muted-foreground hover:text-foreground">✕</Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 bg-card">
          
          {limitRub !== null && (
            <div className={`mb-6 p-3 rounded-xl border flex gap-3 text-sm transition-colors ${isOverLimit ? 'bg-destructive/10 border-destructive/20 text-destructive-text' : 'bg-primary/10 border-primary/20 text-primary'}`}>
               <Info className={`w-5 h-5 shrink-0 ${isOverLimit ? 'text-destructive-text' : 'text-primary'}`} />
               <div>
                  Ваш лимит доверия на сегодня: <strong>{limitRub} ₽</strong>.<br/>
                  Это бюджет на спасение репутации <strong>за счет компании</strong>. Обязательно укажите где и на что сделан заказ!
               </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
               <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Фактические затраты (в рублях)</label>
               <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="Пример: 15.50" 
                  value={costText} 
                  onChange={e => setCostText(e.target.value)}
                  className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all bg-muted ${isOverLimit ? 'border-destructive/40 focus:ring-destructive/20' : 'border-border focus:border-primary/50 focus:ring-primary/20'}`}
                  autoFocus
                />
                {isOverLimit && <div className="text-xs text-destructive-text font-medium mt-1">Превышает доступный лимит!</div>}
            </div>
            
            <div>
               <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Где заказано и почему (Комментарий)</label>
               <textarea 
                  required
                  placeholder="Пример: VexBoost висит. Перезаказал 1000 подписчиков вручную на JAP, id #81923" 
                  value={note} 
                  onChange={e => setNote(e.target.value)}
                  className="w-full text-sm border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 min-h-[100px] resize-y bg-muted leading-relaxed"
                />
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 bg-success/5 rounded-xl border border-success/10 group transition-all hover:bg-success/10">
               <input 
                 type="checkbox" 
                 checked={topUpBalance}
                 onChange={e => setTopUpBalance(e.target.checked)}
                 className="w-4 h-4 rounded border-success-text/30 text-success focus:ring-success"
               />
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-success-text">Зачислить деньги клиенту на баланс</span>
                 <span className="text-[10px] text-success-text/80 font-medium leading-tight">Если выключено — просто списывается ваш лимит (на внешние заказы)</span>
               </div>
            </label>
            
            <div className="flex justify-end gap-3 mt-6 pt-2">
              <Button intent="outline" type="button" onClick={onClose} className="rounded-xl border-border">Отмена</Button>
              <Button type="submit" disabled={isPending || isOverLimit || !costText || !note} className={`rounded-xl text-primary-foreground ${isOverLimit ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary'}`}>
                {isPending ? 'Запись...' : 'Списать и логировать'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
