'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  batchToggleServicesAction,
  batchSetMarkupAction,
  batchReassignServicesCategoryAction,
  batchResetMarkupAction,
} from '@/actions/admin/catalog/batch';
import {
  TOTAL_MANDATORY_DEDUCTIONS,
  SAFETY_FLOOR_MARKUP,
} from '@/lib/financial-constants';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAFETY_MULTIPLIER = (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS);

function ReassignCategoryModal({
  selectedIds,
  categories,
  onSuccess,
  isPending,
  startTransition,
}: {
  selectedIds: string[];
  categories: Array<{ id: string; name: string }>;
  onSuccess: () => void;
  isPending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleConfirm() {
    if (!targetCategoryId) {
      toast.error("Выберите целевую категорию");
      return;
    }
    startTransition(async () => {
      const res = await batchReassignServicesCategoryAction(selectedIds, targetCategoryId);
      if (res.success) {
        toast.success(`Успешно перенесено ${res.count} услуг`);
        setOpen(false);
        onSuccess();
      } else {
        toast.error(res.error || "Произошла ошибка при переносе");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <button
          type="button"
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50 cursor-pointer"
        >
          📁 Перенести в категорию
        </button>
      } />
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto w-full p-6 bg-card border border-border rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">Перенос услуг ({selectedIds.length} шт.)</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Выберите категорию, в которую будут перенесены выбранные услуги.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <input
            type="text"
            placeholder="Поиск категории..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20"
          />

          <div className="space-y-1">
            <span className="block text-xs font-semibold text-muted-foreground uppercase">Категория</span>
            <Select value={targetCategoryId} onValueChange={(val) => setTargetCategoryId(val || '')}>
              <SelectTrigger className="w-full h-10 border border-border bg-background text-foreground cursor-pointer focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="-- Выберите категорию --">
                  {(value: string) => filteredCategories.find(c => c.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-full">
                {filteredCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id} label={cat.name} className="cursor-pointer">
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <DialogClose render={<Button intent="outline" size="sm" type="button">Отмена</Button>} />
          <Button
            intent="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending || !targetCategoryId}
            className="cursor-pointer"
          >
            Подтвердить перенос
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchActionBar({
  selectedIds,
  onClear,
  canEditFinance,
  categories,
  onDeleted,
}: {
  selectedIds: string[];
  onClear: () => void;
  canEditFinance: boolean;
  categories: Array<{ id: string; name: string }>;
  onDeleted?: (ids: string[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [markupPercentInput, setMarkupPercentInput] = useState('');

  const minPercent = ((SAFETY_MULTIPLIER - 1) * 100).toFixed(0);

  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

  function handleBulkDelete() {
    setConfirmBulkDeleteOpen(false);
    startTransition(async () => {
      const { bulkDeleteOrArchiveServicesAction } = await import('@/actions/admin/catalog/services');
      const r = await bulkDeleteOrArchiveServicesAction(selectedIds);
      if (r.success) {
        toast.success(r.message);
        if (onDeleted) {
          onDeleted(selectedIds);
        }
        onClear();
      } else {
        toast.error(r.error || 'Ошибка удаления');
      }
    });
  }

  function handleEnable() {
    startTransition(async () => {
      const r = await batchToggleServicesAction(selectedIds, true);
      if (r.success) { toast.success(`✅ Включено ${r.count} услуг`); onClear(); }
      else toast.error(r.error ?? 'Ошибка');
    });
  }

  function handleDisable() {
    startTransition(async () => {
      const r = await batchToggleServicesAction(selectedIds, false);
      if (r.success) { toast.success(`🚫 Отключено ${r.count} услуг`); onClear(); }
      else toast.error(r.error ?? 'Ошибка');
    });
  }

  function handleSetMarkup() {
    const percent = parseFloat(markupPercentInput);
    const m = (percent / 100) + 1;
    if (isNaN(m) || m < SAFETY_MULTIPLIER) {
      toast.error(`Минимальная наценка: +${minPercent}%`);
      return;
    }
    startTransition(async () => {
      const r = await batchSetMarkupAction(selectedIds, m);
      if (r.success) { toast.success(`💰 Наценка +${percent}% для ${r.count} услуг`); onClear(); }
      else toast.error(r.error ?? 'Ошибка');
    });
  }

  function handleResetMarkup() {
    startTransition(async () => {
      const r = await batchResetMarkupAction(selectedIds);
      if (r.success) { toast.success(`⚡ Сброшена наценка для ${r.count} услуг по лестнице цен`); onClear(); }
      else toast.error(r.error ?? 'Ошибка');
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl mb-4 animate-in slide-in-from-top-2 duration-300">
      <span className="text-sm font-semibold text-primary">{selectedIds.length} выбрано</span>
      <div className="flex-1 h-px bg-border" />
      <button
        onClick={handleEnable} disabled={isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success/15 text-success border border-emerald-500/30 hover:bg-success/25 transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >✅ Включить</button>
      <button
        onClick={handleDisable} disabled={isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border/40 hover:bg-muted/80 transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >🚫 Скрыть (Выкл)</button>
      <button
        onClick={() => setConfirmBulkDeleteOpen(true)} disabled={isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/15 text-destructive border border-rose-500/30 hover:bg-destructive/25 transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >🗑️ Удалить / В архив</button>
      <button
        onClick={handleResetMarkup} disabled={isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-warning/15 text-warning border border-amber-500/30 hover:bg-warning/25 transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >⚡ Сбросить наценку</button>

      <ReassignCategoryModal
        selectedIds={selectedIds}
        categories={categories}
        onSuccess={onClear}
        isPending={isPending}
        startTransition={startTransition}
      />

      {canEditFinance && (
        <div className="flex items-center gap-1 group relative">
          <span className="text-xs font-medium text-muted-foreground">+</span>
          <input
            type="number" step="1" placeholder={`Наценка в % (мин ${minPercent})`}
            value={markupPercentInput} onChange={e => setMarkupPercentInput(e.target.value)}
            className="w-44 px-2 py-1.5 text-xs font-mono rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-xs font-medium text-muted-foreground">%</span>
          
          {/* Preview Tooltip */}
          {parseFloat(markupPercentInput) > 0 && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-foreground text-background text-[10px] px-2 py-1 rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
              Пример: при закупе 100₽ клиент заплатит {(100 * ((parseFloat(markupPercentInput) / 100) + 1)).toFixed(0)}₽
            </div>
          )}

          <button
            onClick={handleSetMarkup} disabled={isPending}
            className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >Применить наценку</button>
        </div>
      )}
      <button
        onClick={onClear}
        className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
      >✕ Сбросить</button>

      {confirmBulkDeleteOpen && (
        <ConfirmModal
          isOpen={confirmBulkDeleteOpen}
          onClose={() => setConfirmBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
          title={`Удаление или архивация ${selectedIds.length} услуг`}
          isDanger={true}
          confirmText="Удалить / В архив"
          cancelText="Отмена"
        >
          Вы уверены, что хотите удалить {selectedIds.length} выбранных услуг? Услуги без заказов будут удалены навсегда, а услуги с историей заказов будут перенесены в архив.
        </ConfirmModal>
      )}
    </div>
  );
}
