'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  createNetworkAction, 
  updateNetworkAction, 
  deleteNetworkAction 
} from "@/actions/admin/catalog/categories";
import { toast } from "sonner";
import { Globe, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { UniversalIcon } from '@/components/ui/UniversalIcon';
import { IconPicker } from '@/components/admin/icon-picker/IconPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { NetworkItem } from './types';

interface NetworkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  networks: NetworkItem[];
}

export function NetworkEditModal({
  isOpen,
  onClose,
  networks,
}: NetworkEditModalProps) {
  const router = useRouter();

  const [editingNetworkId, setEditingNetworkId] = useState<string | null>(null);
  const [netName, setNetName] = useState("");
  const [netSlug, setNetSlug] = useState("");
  const [netIcon, setNetIcon] = useState<string | null>(null);
  const [netSort, setNetSort] = useState("0");
  const [netError, setNetError] = useState<string | null>(null);
  const [isNetPending, startNetTransition] = useTransition();

  const resetForm = () => {
    setEditingNetworkId(null);
    setNetName("");
    setNetSlug("");
    setNetIcon(null);
    setNetSort("0");
    setNetError(null);
  };

  const handleSaveNetwork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!netName.trim() || !netSlug.trim()) {
      setNetError("Название и Slug обязательны");
      return;
    }

    startNetTransition(async () => {
      const payload = {
        name: netName.trim(),
        slug: netSlug.trim().toLowerCase(),
        sort: parseInt(netSort, 10) || 0,
        icon: netIcon
      };

      const res = editingNetworkId 
        ? await updateNetworkAction(editingNetworkId, payload)
        : await createNetworkAction(payload);

      if (res.success) {
        toast.success(editingNetworkId ? "Соцсеть обновлена" : "Соцсеть создана");
        resetForm();
        router.refresh();
      } else {
        setNetError(res.error || "Ошибка сохранения");
      }
    });
  };

  const handleDeleteNetwork = (netId: string) => {
    startNetTransition(async () => {
      const res = await deleteNetworkAction(netId);
      if (res.success) {
        toast.success("Соцсеть удалена");
        router.refresh();
      } else {
        toast.error(res.error || "Ошибка удаления");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Управление соцсетями
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Добавляйте и редактируйте поддерживаемые соцсети каталога.
          </DialogDescription>
        </DialogHeader>

        {netError && (
          <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-xl border border-destructive/20">
            {netError}
          </div>
        )}

        <form onSubmit={handleSaveNetwork} className="space-y-3 p-3 bg-muted/30 rounded-xl border border-border/50">
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-muted-foreground uppercase">Название соцсети</label>
            <input
              type="text"
              required
              placeholder="Например: Rutube"
              value={netName}
              onChange={e => {
                setNetName(e.target.value);
                if (!editingNetworkId) {
                  setNetSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="pt-0.5 pb-0.5">
            <IconPicker
              label="Логотип / Иконка соцсети"
              context="network"
              value={netIcon}
              onChange={setNetIcon}
              suggestName={netName}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase">Slug (строчные)</label>
              <input
                type="text"
                required
                placeholder="rutube"
                value={netSlug}
                onChange={e => setNetSlug(e.target.value.toLowerCase())}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase">Сортировка</label>
              <input
                type="number"
                required
                value={netSort}
                onChange={e => setNetSort(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {editingNetworkId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Отмена
              </button>
            )}
            <Button type="submit" intent="primary" size="sm" disabled={isNetPending} className="cursor-pointer">
              {isNetPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {editingNetworkId ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </form>

        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {networks.map(n => (
            <div key={n.id} className="flex items-center justify-between p-2 rounded-xl bg-background border border-border/60 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2">
                <UniversalIcon icon={n.icon || `brand:${n.slug}`} size={16} />
                <span className="text-xs font-bold text-foreground">{n.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {n.slug}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingNetworkId(n.id);
                    setNetName(n.name);
                    setNetSlug(n.slug);
                    setNetIcon(n.icon || null);
                    setNetSort(String(n.sort));
                  }}
                  className="p-1 text-muted-foreground hover:text-primary cursor-pointer"
                  aria-label={`Редактировать соцсеть ${n.name}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteNetwork(n.id)}
                  className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                  aria-label={`Удалить соцсеть ${n.name}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
