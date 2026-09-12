'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, Plus, ShieldCheck, Globe, Code2, AlertCircle } from 'lucide-react';
import { StorefrontKeyRow } from './storefront-key-row';
import { StorefrontKeyCreateModal } from './storefront-key-create-modal';
import { generateStorefrontKeyAction, revokeStorefrontKeyAction } from '@/actions/admin/storefront-keys';
import { toast } from 'sonner';

export interface StorefrontKeyItem {
  id: string;
  tenantId: string;
  type: 'PUBLISHABLE' | 'SECRET';
  keyPrefix: string;
  name: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface StorefrontKeysSettingsProps {
  initialKeys: StorefrontKeyItem[];
  tenantId: string;
}

export function StorefrontKeysSettings({
  initialKeys,
  tenantId,
}: StorefrontKeysSettingsProps) {
  const [keys, setKeys] = React.useState<StorefrontKeyItem[]>(initialKeys);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const handleCreate = async ({ type, name }: { type: 'PUBLISHABLE' | 'SECRET'; name: string }) => {
    try {
      const res = await generateStorefrontKeyAction({ tenantId, type, name });
      if (!res.success || !res.data) {
        toast.error(res.error || 'Не удалось выпустить ключ');
        return null;
      }

      const { token, key } = res.data;
      setKeys((prev) => [
        {
          id: key.id,
          tenantId: key.tenantId,
          type: key.type,
          keyPrefix: key.keyPrefix,
          name: key.name,
          isActive: key.isActive,
          lastUsedAt: null,
          createdAt: key.createdAt,
        },
        ...prev,
      ]);

      toast.success('Ключ успешно выпущен');
      return token;
    } catch {
      toast.error('Произошла ошибка при создании ключа');
      return null;
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Вы уверены, что хотите отозвать этот ключ? Все интеграции, использующие его, перестанут работать.')) {
      return;
    }

    setRevokingId(id);
    try {
      const res = await revokeStorefrontKeyAction({ id, tenantId });
      if (!res.success) {
        toast.error(res.error || 'Не удалось отозвать ключ');
        return;
      }

      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, isActive: false } : k))
      );
      toast.success('Ключ успешно отозван');
    } catch {
      toast.error('Ошибка отзыва ключа');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <Card className="p-6 border-border/70 bg-card/60 backdrop-blur-sm shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">
                Ключи витрин (Storefront API v1)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Управление доступом к изолированному REST API для кастомных витрин инвесторов, ботов и мобильных приложений.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Выпустить ключ
          </Button>
        </div>

        {/* ── Информационный блок ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-medium text-blue-500">
              <Globe className="w-4 h-4" />
              <span>Публичные ключи (`pk_live_*`)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Предназначены для фронтенд-клиентов и мобильных приложений. Разрешают чтение каталога (`GET /catalog`), конфигурации и проверку статуса заказа по email.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-medium text-amber-500">
              <Code2 className="w-4 h-4" />
              <span>Секретные ключи (`sk_live_*`)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Для серверных бэкендов инвесторов. Разрешают создание заказов (`POST /orders`), работу с балансом и настройку вебхуков. Храните в секрете!
            </p>
          </div>
        </div>

        {/* ── Список ключей ── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Выпущенные ключи ({keys.length})
            </h4>
            <span className="text-[11px] text-muted-foreground">Тенант: {tenantId}</span>
          </div>

          {keys.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl space-y-2">
              <KeyRound className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">
                Для этого бренда еще не выпущено ни одного ключа витрины.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs gap-1.5 mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Создать первый ключ
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {keys.map((k) => (
                <StorefrontKeyRow
                  key={k.id}
                  id={k.id}
                  type={k.type}
                  keyPrefix={k.keyPrefix}
                  name={k.name}
                  isActive={k.isActive}
                  lastUsedAt={k.lastUsedAt}
                  createdAt={k.createdAt}
                  onRevoke={handleRevoke}
                  isRevoking={revokingId === k.id}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <StorefrontKeyCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
