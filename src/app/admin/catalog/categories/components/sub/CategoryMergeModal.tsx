'use client';

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergeCategoriesAction } from "@/actions/admin/catalog/categories";
import { toast } from "sonner";
import { GitMerge, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { CategoryItem } from './types';

interface CategoryMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
}

export function CategoryMergeModal({
  isOpen,
  onClose,
  categories,
}: CategoryMergeModalProps) {
  const router = useRouter();

  const [sourceCatId, setSourceCatId] = useState("");
  const [targetCatId, setTargetCatId] = useState("");
  const [isMergePending, startMergeTransition] = useTransition();

  const sourceCat = useMemo(() => categories.find(c => c.id === sourceCatId), [categories, sourceCatId]);
  const targetCat = useMemo(() => categories.find(c => c.id === targetCatId), [categories, targetCatId]);

  const resetForm = () => {
    setSourceCatId("");
    setTargetCatId("");
  };

  const executeMerge = () => {
    if (!sourceCatId || !targetCatId) {
      toast.error("Выберите обе категории");
      return;
    }
    if (sourceCatId === targetCatId) {
      toast.error("Категории не могут совпадать");
      return;
    }

    startMergeTransition(async () => {
      const res = await mergeCategoriesAction(sourceCatId, targetCatId);
      if (res.success) {
        toast.success("Категории успешно объединены");
        resetForm();
        onClose();
        router.refresh();
      } else {
        toast.error(res.error || "Ошибка при объединении");
      }
    });
  };

  const isCrossNetwork = Boolean(sourceCat && targetCat && sourceCat.networkId !== targetCat.networkId);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary" />
            Объединение категорий
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Перемещение всех услуг из одной категории в другую с последующим удалением источника.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-muted-foreground">Категория-источник (будет удалена)</label>
            <Select value={sourceCatId} onValueChange={val => setSourceCatId(val || '')}>
              <SelectTrigger className="w-full h-9 border border-border bg-background text-foreground text-xs rounded-xl cursor-pointer px-3">
                <SelectValue placeholder="-- Выберите источник --">
                  {(value: string) => categories.find(c => c.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id} label={`${c.network?.name || ''}: ${c.name}`} className="text-xs cursor-pointer">
                    {c.network?.name}: {c.name} ({c._count.services} услуг)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-muted-foreground">Категория-приёмник (куда перенести услуги)</label>
            <Select value={targetCatId} onValueChange={val => setTargetCatId(val || '')}>
              <SelectTrigger className="w-full h-9 border border-border bg-background text-foreground text-xs rounded-xl cursor-pointer px-3">
                <SelectValue placeholder="-- Выберите приёмник --">
                  {(value: string) => categories.find(c => c.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.filter(c => c.id !== sourceCatId).map(c => {
                  const isSameNetwork = sourceCat ? c.networkId === sourceCat.networkId : true;
                  return (
                    <SelectItem key={c.id} value={c.id} label={`${c.network?.name || ''}: ${c.name}`} className="text-xs cursor-pointer">
                      <span className="flex items-center justify-between w-full gap-2">
                        <span>{c.network?.name}: {c.name}</span>
                        {!isSameNetwork && (
                          <span className="text-[10px] text-destructive font-bold bg-destructive/10 px-1 py-0.5 rounded">Другая соцсеть</span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {sourceCat && targetCat && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-muted-foreground">Перенос услуг:</span>
                <span className="font-mono font-bold text-primary">{sourceCat._count?.services || 0} тарифов</span>
              </div>
              {isCrossNetwork ? (
                <div className="flex items-center gap-1.5 text-destructive text-[11px] font-bold bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Ошибка: нельзя объединять категории разных соцсетей ({sourceCat.network?.name} → {targetCat.network?.name})</span>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">
                  Все тарифы из «{sourceCat.name}» будут безопасно перенесены в «{targetCat.name}». Категория «{sourceCat.name}» будет удалена.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <Button type="button" intent="outline" size="sm" onClick={onClose} className="cursor-pointer">
              Отмена
            </Button>
            <Button 
              type="button" 
              intent="primary" 
              size="sm" 
              disabled={isMergePending || !sourceCatId || !targetCatId || isCrossNetwork} 
              onClick={executeMerge} 
              className="cursor-pointer"
            >
              {isMergePending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Объединить услуги
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
