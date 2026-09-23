'use client';

import React, { useState, useTransition, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  SlidersHorizontal,
  Power,
  Sparkles,
  LifeBuoy,
  Server,
  Activity,
  Layers,
  Trash2,
} from 'lucide-react';
import type { ProviderListDTO } from '@/services/admin/provider.service';
import { ProviderBalanceCell } from './components/provider-balance-cell';
import { SyncProviderButton } from './components/sync-provider-button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  toggleProviderActiveAction,
  resetProviderErrorsAction,
  createMockProviderPresetAction,
  deleteProviderAction,
  getProviderDeleteInfoAction,
} from '@/actions/admin/providers/crud';

type DeleteInfo = {
  provider: { id: string; name: string };
  counts: { services: number; routes: number; orders: number; shadowServices: number };
};

export function ProvidersTable({ providers }: { providers: ProviderListDTO[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'error' | 'disabled'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isPresetPending, startPresetTransition] = useTransition();
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  /**
   * AUD-01: Safe delete flow — fetch impact counts, show confirmation modal, then delete.
   */
  const handleDeleteRequest = async (providerId: string) => {
    setDeleteLoading(true);
    try {
      const res = await getProviderDeleteInfoAction(providerId);
      if (res.success && res.provider && res.counts) {
        setDeleteInfo({ provider: res.provider, counts: res.counts });
      } else {
        toast.error('Не удалось подготовить удаление', { description: res.error });
      }
    } catch {
      toast.error('Не удалось подготовить удаление провайдера');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteInfo) return;
    const targetId = deleteInfo.provider.id;
    const targetName = deleteInfo.provider.name;
    startDeleteTransition(async () => {
      const res = await deleteProviderAction(targetId);
      if (res.success) {
        toast.success(`Провайдер «${res.deletedName || targetName}» удалён`, {
          description: 'Услуги и заказы сохранены (отвязаны от провайдера). Теневой каталог очищен.',
        });
        setDeleteInfo(null);
        router.refresh();
      } else {
        toast.error('Не удалось удалить провайдера', { description: res.error });
      }
    });
  };

  // Filtered providers
  const filtered = useMemo(() => {
    return providers.filter((p) => {
      const matchesSearch =
        search.trim() === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.apiUrl.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'active') return p.isActive && p.errorCount5m === 0;
      if (statusFilter === 'error') return p.isActive && p.errorCount5m > 0;
      if (statusFilter === 'disabled') return !p.isActive;
      return true;
    });
  }, [providers, search, statusFilter]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: providers.length,
      active: providers.filter((p) => p.isActive && p.errorCount5m === 0).length,
      error: providers.filter((p) => p.isActive && p.errorCount5m > 0).length,
      disabled: providers.filter((p) => !p.isActive).length,
    };
  }, [providers]);

  // Copy API URL helper
  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('API URL скопирован в буфер обмена');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick Toggle Active State
  const handleToggleActive = async (provider: ProviderListDTO) => {
    const nextState = !provider.isActive;
    setPendingIds((prev) => new Set(prev).add(provider.id));

    try {
      const res = await toggleProviderActiveAction(provider.id, nextState);
      if (res.success) {
        toast.success(
          nextState
            ? `Шлюз "${provider.name}" активирован`
            : `Шлюз "${provider.name}" выключен`
        );
        router.refresh();
      } else {
        toast.error('Не удалось изменить статус провайдера', { description: res.error });
      }
    } catch {
      toast.error('Сетевая ошибка при переключении статуса');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(provider.id);
        return next;
      });
    }
  };

  // Reset Errors
  const handleResetErrors = async (provider: ProviderListDTO) => {
    setPendingIds((prev) => new Set(prev).add(provider.id));
    try {
      const res = await resetProviderErrorsAction(provider.id);
      if (res.success) {
        toast.success(`Счётчик ошибок для "${provider.name}" сброшен`);
        router.refresh();
      } else {
        toast.error('Не удалось сбросить ошибки', { description: res.error });
      }
    } catch {
      toast.error('Сетевая ошибка при сбросе ошибок');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(provider.id);
        return next;
      });
    }
  };

  // 1-Click Mock Preset Creation
  const handleCreateMockPreset = () => {
    startPresetTransition(async () => {
      const res = await createMockProviderPresetAction();
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error('Не удалось развернуть Mock Sandbox', { description: res.error });
      }
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* -- Toolbar: Search & Filter Tabs -- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-2.5 rounded-lg border border-border/70 backdrop-blur-xs shadow-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Все
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 tabular-nums">
              {counts.all}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'active'
                ? 'bg-success text-success-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Активные
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 tabular-nums">
              {counts.active}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'error'
                ? 'bg-destructive text-destructive-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Сбои API
            {counts.error > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-destructive-foreground/20 text-destructive-foreground font-bold tabular-nums">
                {counts.error}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('disabled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'disabled'
                ? 'bg-muted text-foreground shadow-xs border border-border/70'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Отключённые
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 tabular-nums">
              {counts.disabled}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] sm:max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию / URL..."
            className="pl-8 pr-8 h-8.5 text-xs bg-background/80"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* -- Main Container: Desktop Table + Mobile Cards -- */}
      <div className="bg-card/60 backdrop-blur-xs border border-border/70 rounded-lg shadow-xs overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                {providers.length === 0
                  ? 'Нет подключённых провайдеров'
                  : 'Провайдеры не найдены по фильтру'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {providers.length === 0
                  ? 'Подключите свой первый SMM-шлюз или используйте пресет для мгновенного старта.'
                  : 'Попробуйте сбросить фильтры или строку поиска.'}
              </p>
            </div>

            {providers.length === 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  onClick={handleCreateMockPreset}
                  disabled={isPresetPending}
                  intent="outline"
                  size="sm"
                  className="text-xs font-bold"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary mr-1.5" />
                  {isPresetPending ? 'Развёртывание...' : 'Развернуть Mock Sandbox'}
                </Button>
                <Link
                  href="/admin/providers/new"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-xs active:scale-95"
                >
                  + Добавить шлюз
                </Link>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
                intent="outline"
                size="sm"
                className="text-xs font-bold"
              >
                Сбросить фильтры
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* -- 1. Desktop Table View (100% Width Fit, No Horizontal Scroll) -- */}
            <div className="hidden lg:block w-full">
              <Table className="w-full text-left" aria-label="Список SMM-провайдеров">
                <TableHeader>
                  <TableRow className="border-b border-border/60 hover:bg-transparent">
                    <TableHead className="w-[30%] bg-muted/40 py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Провайдер / API
                    </TableHead>
                    <TableHead className="w-[10%] bg-muted/40 py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Услуги
                    </TableHead>
                    <TableHead className="w-[18%] bg-muted/40 py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Баланс (Sync)
                    </TableHead>
                    <TableHead className="w-[16%] bg-muted/40 py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      SLA & Пинг
                    </TableHead>
                    <TableHead className="w-[10%] bg-muted/40 py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Статус
                    </TableHead>
                    <TableHead className="w-[16%] bg-muted/40 py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">
                      Действия
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                  {filtered.map((provider) => {
                    const isPending = pendingIds.has(provider.id);
                    return (
                      <TableRow
                        key={provider.id}
                        className="hover:bg-muted/40 transition-colors duration-150 group"
                      >
                        {/* 1. Name & URL + Copy */}
                        <TableCell className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs truncate max-w-[220px]" title={provider.name}>
                              {provider.name}
                            </span>
                            {provider.ticketUrl && (
                              <a
                                href={provider.ticketUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Открыть панель поддержки у провайдера"
                                className="text-muted-foreground hover:text-primary transition-colors p-0.5 shrink-0"
                              >
                                <LifeBuoy className="w-3 h-3 text-primary" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className="text-muted-foreground/70 font-mono text-[10px] truncate max-w-[180px]"
                              title={provider.apiUrl}
                            >
                              {provider.apiUrl}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(provider.id, provider.apiUrl)}
                              title="Скопировать URL шлюза"
                              className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 cursor-pointer shrink-0"
                            >
                              {copiedId === provider.id ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* 2. Service count */}
                        <TableCell className="py-2.5 px-3">
                          <div className="font-bold text-foreground tabular-nums text-xs">
                            {provider.serviceCount.toLocaleString('ru-RU')}
                          </div>
                          <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                            услуг
                          </div>
                        </TableCell>

                        {/* 3. Balance & Health */}
                        <TableCell className="py-2.5 px-3">
                          {provider.isActive ? (
                            <ProviderBalanceCell providerId={provider.id} />
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/50 select-none">
                              Отключён
                            </span>
                          )}
                        </TableCell>

                        {/* 4. SLA & Ping */}
                        <TableCell className="py-2.5 px-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-muted-foreground/70">
                                Ping:
                              </span>
                              <span
                                className={`text-[11px] font-mono font-bold ${
                                  provider.avgResponseMs > 2000
                                    ? 'text-destructive'
                                    : provider.avgResponseMs > 500
                                    ? 'text-warning'
                                    : 'text-success'
                                }`}
                              >
                                {provider.avgResponseMs}ms
                              </span>
                            </div>

                            {provider.errorCount5m > 0 ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-destructive">
                                  ⚠️ {provider.errorCount5m} errs
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleResetErrors(provider)}
                                  disabled={isPending}
                                  title="Сбросить счётчик ошибок"
                                  className="text-[9px] text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  сброс
                                </button>
                              </div>
                            ) : provider.lastSuccessAt ? (
                              <div className="text-[9px] text-muted-foreground/70 font-medium font-mono">
                                Sync: {new Date(provider.lastSuccessAt).toLocaleTimeString('ru-RU')}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* 5. Status & Quick Toggle */}
                        <TableCell className="py-2.5 px-3">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(provider)}
                              disabled={isPending}
                              title={provider.isActive ? 'Отключить шлюз' : 'Включить шлюз'}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                provider.isActive ? 'bg-success' : 'bg-muted-foreground/30'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-xs ring-0 transition duration-200 ease-in-out ${
                                  provider.isActive ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>

                            <Badge
                              intent={
                                !provider.isActive
                                  ? 'secondary'
                                  : provider.errorCount5m > 0
                                  ? 'destructive'
                                  : 'primary'
                              }
                              className={`font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.2 whitespace-nowrap ${
                                !provider.isActive
                                  ? 'bg-muted text-muted-foreground border-border'
                                  : provider.errorCount5m > 0
                                  ? 'bg-destructive/20 text-destructive border-destructive/30'
                                  : 'bg-success/20 text-success border-success/30'
                              }`}
                            >
                              {!provider.isActive
                                ? 'ВЫКЛ'
                                : provider.errorCount5m > 0
                                ? 'СБОЙ'
                                : 'АКТИВ'}
                            </Badge>
                          </div>
                        </TableCell>

                        {/* 6. Actions */}
                        <TableCell className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <SyncProviderButton providerId={provider.id} />
                            <Link
                              href={`/admin/providers/${provider.id}`}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border/60 bg-background/50 hover:bg-muted text-foreground transition-all duration-200 shadow-xs inline-block active:scale-95 whitespace-nowrap"
                            >
                              Настроить
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(provider.id)}
                              disabled={deleteLoading || isDeleting}
                              title="Удалить провайдера"
                              aria-label={`Удалить провайдера ${provider.name}`}
                              className="p-1.5 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive transition-all duration-200 shadow-xs active:scale-95 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* -- 2. Mobile / Tablet Card View (< 1024px) -- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 lg:hidden">
              {filtered.map((provider) => {
                const isPending = pendingIds.has(provider.id);
                return (
                  <div
                    key={provider.id}
                    className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    {/* Header: Name + Badge + Switch */}
                    <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground text-sm truncate" title={provider.name}>
                            {provider.name}
                          </span>
                          {provider.ticketUrl && (
                            <a
                              href={provider.ticketUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Открыть панель поддержки у провайдера"
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5 shrink-0"
                            >
                              <LifeBuoy className="w-3.5 h-3.5 text-primary" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-muted-foreground/70 font-mono text-[10px] truncate max-w-[200px]" title={provider.apiUrl}>
                            {provider.apiUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(provider.id, provider.apiUrl)}
                            className="text-muted-foreground/60 hover:text-foreground p-0.5 shrink-0 cursor-pointer"
                          >
                            {copiedId === provider.id ? (
                              <Check className="w-3 h-3 text-success" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          intent={
                            !provider.isActive
                              ? 'secondary'
                              : provider.errorCount5m > 0
                              ? 'destructive'
                              : 'primary'
                          }
                          className="font-bold text-[9px] uppercase px-1.5 py-0.2"
                        >
                          {!provider.isActive ? 'ВЫКЛ' : provider.errorCount5m > 0 ? 'СБОЙ' : 'АКТИВ'}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(provider)}
                          disabled={isPending}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                            provider.isActive ? 'bg-success' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-xs ring-0 transition duration-200 ease-in-out ${
                              provider.isActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 py-1 text-xs">
                      {/* Services */}
                      <div className="bg-muted/40 p-2 rounded-xl border border-border/30">
                        <div className="text-[9px] font-bold uppercase text-muted-foreground">Услуги</div>
                        <div className="font-bold text-foreground mt-0.5 tabular-nums">
                          {provider.serviceCount.toLocaleString('ru-RU')}
                        </div>
                      </div>

                      {/* Balance */}
                      <div className="bg-muted/40 p-2 rounded-xl border border-border/30 col-span-2">
                        <div className="text-[9px] font-bold uppercase text-muted-foreground">Баланс</div>
                        <div className="mt-0.5">
                          {provider.isActive ? (
                            <ProviderBalanceCell providerId={provider.id} />
                          ) : (
                            <span className="text-[10px] font-mono text-muted-foreground">Отключён</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Latency & Sync status */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                      <div className="flex items-center gap-1 font-mono">
                        <span>Ping:</span>
                        <span
                          className={`font-bold ${
                            provider.avgResponseMs > 2000
                              ? 'text-destructive'
                              : provider.avgResponseMs > 500
                              ? 'text-warning'
                              : 'text-success'
                          }`}
                        >
                          {provider.avgResponseMs}ms
                        </span>
                      </div>

                      {provider.errorCount5m > 0 ? (
                        <div className="flex items-center gap-1 text-destructive font-bold">
                          <span>⚠️ {provider.errorCount5m} сбоев</span>
                          <button
                            type="button"
                            onClick={() => handleResetErrors(provider)}
                            disabled={isPending}
                            className="underline text-[9px] cursor-pointer"
                          >
                            Сбросить
                          </button>
                        </div>
                      ) : provider.lastSuccessAt ? (
                        <span className="text-[10px] font-mono">
                          Sync: {new Date(provider.lastSuccessAt).toLocaleTimeString('ru-RU')}
                        </span>
                      ) : null}
                    </div>

                    {/* Actions footer */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <div className="flex-1">
                        <SyncProviderButton providerId={provider.id} />
                      </div>
                      <Link
                        href={`/admin/providers/${provider.id}`}
                        className="flex-1 py-1.5 px-3 text-center text-xs font-bold rounded-xl border border-border/60 bg-background/50 hover:bg-muted text-foreground transition-all duration-200 shadow-xs active:scale-95"
                      >
                        Настроить
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(provider.id)}
                        disabled={deleteLoading || isDeleting}
                        aria-label={`Удалить провайдера ${provider.name}`}
                        className="p-2 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive transition-all duration-200 shadow-xs active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* AUD-01: Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteInfo !== null}
        onClose={() => setDeleteInfo(null)}
        onConfirm={handleConfirmDelete}
        title={`Удалить провайдера «${deleteInfo?.provider.name ?? ''}»?`}
        confirmText={isDeleting ? 'Удаление...' : 'Да, удалить'}
        cancelText="Отмена"
        isDanger
      >
        {deleteInfo && (
          <div className="space-y-3">
            <p>
              Провайдер будет удалён вместе с подключением (API-ключ, настройки маппинга, теневой каталог
              {' '}{deleteInfo.counts.shadowServices > 0 ? `: ${deleteInfo.counts.shadowServices} поз.` : ''}).
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border/50 bg-muted/40 px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Услуг</div>
                <div className="font-bold text-foreground tabular-nums">{deleteInfo.counts.services}</div>
                <div className="text-[9px] text-muted-foreground">сохранятся (отвяжутся)</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Заказов</div>
                <div className="font-bold text-foreground tabular-nums">{deleteInfo.counts.orders}</div>
                <div className="text-[9px] text-muted-foreground">сохранятся</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Маршрутов</div>
                <div className="font-bold text-foreground tabular-nums">{deleteInfo.counts.routes}</div>
                <div className="text-[9px] text-muted-foreground">будут удалены</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Услуги каталога и исторические заказы не удаляются — они лишь теряют привязку к этому провайдеру.
              Новые заказы на отвязанные услуги размещаться не будут, пока вы не переназначите им провайдера.
            </p>
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
