'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateClientDiscountAction } from '@/actions/admin/clients';
import { Percent, FileText } from 'lucide-react';
import { UserDTO, UserNoteDTO } from './types';
import { ClientNotesManager } from '../components/client-notes-manager';

interface NotesTabProps {
  user: UserDTO;
  canSeeFinances: boolean;
  initialNotes?: UserNoteDTO[];
}

export function NotesTab({ user, canSeeFinances, initialNotes = [] }: NotesTabProps) {
  const [discount, setDiscount] = useState(user.personalDiscount);
  const [discountEndsAt, setDiscountEndsAt] = useState(
    user.discountEndsAt ? new Date(user.discountEndsAt).toISOString().slice(0, 16) : ''
  );

  const [isPendingDiscount, startDiscountTransition] = useTransition();

  function saveDiscount() {
    if (discount < 0 || discount > 50) {
      toast.error('Скидка должна быть в диапазоне от 0% до 50%');
      return;
    }
    startDiscountTransition(async () => {
      const r = await updateClientDiscountAction(
        user.id,
        discount,
        discountEndsAt ? new Date(discountEndsAt).toISOString() : undefined
      );
      if (r.success) toast.success(`✅ Скидка ${discount}% применена`);
      else toast.error(r.error ?? 'Ошибка');
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
      {/* Card: Personal Discount */}
      {canSeeFinances && (
        <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 space-y-3.5">
          <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-1 rounded-md">
              <Percent className="w-3.5 h-3.5" />
            </span>
            Управление персональной скидкой
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
                Скидка % (0 = выключена, макс 50%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 h-9 px-2.5 text-xs font-mono rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary"
                />
                <span className="text-xs font-medium text-muted-foreground">%</span>
                {discount > 0 && (
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 bg-success/15 text-emerald-700 border border-success/20 rounded-full">
                    Клиент платит {(100 - discount).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
                Действует до (необязательно)
              </label>
              <input
                type="datetime-local"
                value={discountEndsAt}
                onChange={e => setDiscountEndsAt(e.target.value)}
                className="w-full h-9 px-2.5 text-xs rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={saveDiscount}
              disabled={isPendingDiscount}
              className="w-full h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPendingDiscount ? 'Применяется...' : 'Сохранить скидку'}
            </button>
          </div>
        </div>
      )}

      {/* Card: Operator Notes Feed & Management */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 flex flex-col justify-between space-y-3.5">
        <ClientNotesManager
          userId={user.id}
          initialNotes={initialNotes}
          compact={false}
        />
      </div>
    </div>
  );
}
