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
  ShieldAlert,
  ShieldCheck,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  toggleRefillModuleAction,
  directRestartRefillAction,
  directUpdateRefillStatusAction,
} from '@/actions/admin/refills';

export type RefillItemDTO = {
  id: string;
  numericId: number;
  status: string;
  externalId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  order: {
    id: string;
    numericId: number;
    link: string;
    quantity: number;
    createdAt: string | Date;
    user: {
      id?: string;
      email: string;
    };
    service: {
      id: string;
      name: string;
      provider?: { id: string; name: string } | null;
      category?: {
        name: string;
        network?: { name: string; slug: string } | null;
      } | null;
    };
  };
};

export const STATUS_LABELS: Record<string, { label: string; intent: 'primary' | 'secondary' | 'destructive'; bg: string }> = {
  PENDING: { label: 'Ожидает', intent: 'secondary', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  IN_PROGRESS: { label: 'В работе', intent: 'primary', bg: 'bg-primary/10 text-primary border-primary/20' },
  COMPLETED: { label: 'Выполнен', intent: 'secondary', bg: 'bg-success/10 text-success border-success/20' },
  REJECTED: { label: 'Отклонён', intent: 'destructive', bg: 'bg-destructive/10 text-destructive border-destructive/20' },
  ERROR: { label: 'Ошибка API', intent: 'destructive', bg: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function formatAge(date: string | Date): { text: string; isOld: boolean } {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return { text: `${diffDays}д назад`, isOld: diffDays >= 2 };
  }
  if (diffHours > 0) {
    return { text: `${diffHours}ч назад`, isOld: false };
  }
  const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return { text: `${diffMins}м назад`, isOld: false };
}

export function RefillsTable({
  refills,
  isModuleEnabled: initialIsModuleEnabled,
}: {
  refills: RefillItemDTO[];
  isModuleEnabled: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ERROR_OR_REJECTED'>('all');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [pendingRefillIds, setPendingRefillIds] = useState<Set<string>>(new Set());
  const [isModuleEnabled, setIsModuleEnabled] = useState(initialIsModuleEnabled);
  const [isTogglePending, startToggleTransition] = useTransition();

  // Filter items
  const filtered = useMemo(() => {
    return refills.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        String(r.numericId).includes(q) ||
        String(r.order.numericId).includes(q) ||
        r.order.user.email.toLowerCase().includes(q) ||
        r.order.link.toLowerCase().includes(q) ||
        r.order.service.name.toLowerCase().includes(q) ||
        (r.externalId && r.externalId.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'PENDING') return r.status === 'PENDING';
      if (statusFilter === 'IN_PROGRESS') return r.status === 'IN_PROGRESS';
      if (statusFilter === 'COMPLETED') return r.status === 'COMPLETED';
      if (statusFilter === 'ERROR_OR_REJECTED') return r.status === 'ERROR' || r.status === 'REJECTED';
      return true;
    });
  }, [refills, search, statusFilter]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: refills.length,
      pending: refills.filter((r) => r.status === 'PENDING').length,
      inProgress: refills.filter((r) => r.status === 'IN_PROGRESS').length,
      completed: refills.filter((r) => r.status === 'COMPLETED').length,
      errorOrRejected: refills.filter((r) => r.status === 'ERROR' || r.status === 'REJECTED').length,
    };
  }, [refills]);

  // Copy helper
  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    toast.success('Ссылка скопирована');
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Toggle Global Module
  const handleToggleModule = () => {
    const nextState = !isModuleEnabled;
    startToggleTransition(async () => {
      const res = await toggleRefillModuleAction(nextState);
      if (res.success) {
        setIsModuleEnabled(nextState);
        toast.success(
          nextState
            ? 'Модуль докруток ВКЛЮЧЕН (клиенты могут запрашивать докрутки)'
            : 'Модуль докруток ОТКЛЮЧЕН (клиентские запросы временно заблокированы)'
        );
        router.refresh();
      } else {
        toast.error('Не удалось изменить статус модуля', { description: res.error });
      }
    });
  };

  // Restart Refill Action
  const handleRestartRefill = async (refill: RefillItemDTO) => {
    setPendingRefillIds((prev) => new Set(prev).add(refill.id));
    try {
      const res = await directRestartRefillAction(refill.id);
      if (res.success) {
        toast.success(`Докрутка #${refill.numericId} перезапущена и отправлена в очередь`);
        router.refresh();
      } else {
        toast.error('Не удалось перезапустить докрутку', { description: res.error });
      }
    } catch {
      toast.error('Ошибка сервера при перезапуске');
    } finally {
      setPendingRefillIds((prev) => {
        const next = new Set(prev);
        next.delete(refill.id);
        return next;
      });
    }
  };

  // Status Override Action
  const handleUpdateStatus = async (
    refill: RefillItemDTO,
    nextStatus: 'COMPLETED' | 'REJECTED'
  ) => {
    setPendingRefillIds((prev) => new Set(prev).add(refill.id));
    try {
      const res = await directUpdateRefillStatusAction(refill.id, nextStatus);
      if (res.success) {
        toast.success(
          nextStatus === 'COMPLETED'
            ? `Докрутка #${refill.numericId} помечена как выполненная`
            : `Докрутка #${refill.numericId} отклонена`
        );
        router.refresh();
      } else {
        toast.error('Не удалось изменить статус', { description: res.error });
      }
    } catch {
      toast.error('Ошибка сервера при изменении статуса');
    } finally {
      setPendingRefillIds((prev) => {
        const next = new Set(prev);
        next.delete(refill.id);
        return next;
      });
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* ── 1. Kill-Switch Banner & Status ── */}
      <div
        className={`p-4 rounded-lg border transition-all duration-300 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs ${
          isModuleEnabled
            ? 'bg-success/5 border-success/20'
            : 'bg-destructive/10 border-destructive/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isModuleEnabled ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
            }`}
          >
            {isModuleEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                {isModuleEnabled
                  ? 'Модуль Докруток: ВКЛЮЧЁН'
                  : 'Модуль Докруток: ОТКЛЮЧЁН (Kill-Switch)'}
              </span>
              <Badge
                intent={isModuleEnabled ? 'primary' : 'destructive'}
                className={`text-[9px] uppercase font-bold px-1.5 py-0.2 ${
                  isModuleEnabled
                    ? 'bg-success/20 text-success border-success/30'
                    : 'bg-destructive/20 text-destructive border-destructive/30'
                }`}
              >
                {isModuleEnabled ? 'Штатный режим' : 'Пауза'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isModuleEnabled
                ? 'Клиенты могут запрашивать бесплатную докрутку по гарантийным тарифам в ЛК.'
                : 'Кнопки докрутки заблокированы в клиентском интерфейсе. Все входящие запросы отклоняются.'}
            </p>
          </div>
        </div>

        <Button
          onClick={handleToggleModule}
          disabled={isTogglePending}
          intent={isModuleEnabled ? 'outline' : 'primary'}
          size="sm"
          className="shrink-0 text-xs font-bold"
        >
          <Power className="w-3.5 h-3.5 mr-1.5" />
          {isTogglePending
            ? 'Сохранение...'
            : isModuleEnabled
            ? 'Отключить модуль'
            : 'Включить модуль'}
        </Button>
      </div>

      {/* ── 2. Toolbar: Search & Filter Pills ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-2 rounded-lg border border-border/70 backdrop-blur-sm shadow-xs">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
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
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Ожидают
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 tabular-nums">
              {counts.pending}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            В работе
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 tabular-nums">
              {counts.inProgress}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'COMPLETED'
                ? 'bg-success text-success-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Выполнены
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 tabular-nums">
              {counts.completed}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('ERROR_OR_REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'ERROR_OR_REJECTED'
                ? 'bg-destructive text-destructive-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Сбои / Отказ
            {counts.errorOrRejected > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-destructive-foreground/20 text-destructive-foreground font-bold tabular-nums">
                {counts.errorOrRejected}
              </span>
            )}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px] sm:max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по № заказа, ссылке, email..."
            className="pl-8 pr-3 h-8.5 text-xs bg-background/80 rounded-lg"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground p-0.5"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Table Card ── */}
      <div className="bg-card/60 backdrop-blur-md border border-border/70 rounded-lg shadow-xs overflow-hidden p-0">
        <Table className="table-fixed w-full" aria-label="Таблица заявок на докрутку">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12%] bg-muted/50 py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Refill ID / Возраст
              </TableHead>
              <TableHead className="w-[24%] bg-muted/50 py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Заказ & Ссылка
              </TableHead>
              <TableHead className="w-[18%] bg-muted/50 py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Клиент
              </TableHead>
              <TableHead className="w-[22%] bg-muted/50 py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Услуга & Шлюз
              </TableHead>
              <TableHead className="w-[12%] bg-muted/50 py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Статус
              </TableHead>
              <TableHead className="w-[12%] bg-muted/50 py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">
                Действия
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 px-6">
                  <div className="py-10 text-center space-y-4 max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <SlidersHorizontal className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">
                        {refills.length === 0
                          ? 'Заявок на докрутку пока нет'
                          : 'Заявки по запросу не найдены'}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {refills.length === 0
                          ? 'Когда клиенты запрашивают гарантийное восстановление по заказам, они появятся в этом реестре.'
                          : 'Попробуйте сбросить строку поиска или фильтр статусов.'}
                      </p>
                    </div>
                    {refills.length > 0 && (
                      <Button
                        onClick={() => {
                          setSearch('');
                          setStatusFilter('all');
                        }}
                        intent="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Сбросить фильтры
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const isPending = pendingRefillIds.has(r.id);
                const age = formatAge(r.createdAt);
                const statusMeta = STATUS_LABELS[r.status] || {
                  label: r.status,
                  intent: 'secondary',
                  bg: 'bg-muted text-muted-foreground',
                };

                return (
                  <TableRow
                    key={r.id}
                    className="hover:bg-muted/50 transition-all duration-200 group"
                  >
                    {/* 1. Refill ID & Age */}
                    <TableCell className="py-4 px-6">
                      <div className="font-mono text-xs font-bold text-foreground">
                        #{r.numericId}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={`text-[10px] font-medium ${
                            age.isOld && r.status === 'IN_PROGRESS'
                              ? 'text-warning font-bold'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {age.text}
                        </span>
                      </div>
                    </TableCell>

                    {/* 2. Order & Link */}
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/orders?q=${r.order.numericId}`}
                          className="text-primary hover:underline text-xs font-mono font-bold"
                          title="Открыть заказ в админке"
                        >
                          Заказ #{r.order.numericId}
                        </Link>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({r.order.quantity.toLocaleString('ru-RU')} шт)
                        </span>
                      </div>

                      {/* Channel Link with External Link & Copy */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <a
                          href={r.order.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-foreground truncate max-w-[170px] inline-flex items-center gap-1"
                          title={r.order.link}
                        >
                          <ExternalLink className="w-3 h-3 shrink-0 text-primary" />
                          <span className="truncate">{r.order.link}</span>
                        </a>
                        <button
                          onClick={() => handleCopyLink(r.order.link)}
                          className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 cursor-pointer"
                          title="Скопировать ссылку"
                        >
                          {copiedLink === r.order.link ? (
                            <Check className="w-3 h-3 text-success" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </TableCell>

                    {/* 3. Client */}
                    <TableCell className="py-4 px-6">
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(r.order.user.email)}`}
                        className="text-xs font-mono text-foreground hover:text-primary transition-colors flex items-center gap-1.5 truncate max-w-[160px]"
                        title={r.order.user.email}
                      >
                        <User className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{r.order.user.email}</span>
                      </Link>
                    </TableCell>

                    {/* 4. Service & Gateway */}
                    <TableCell className="py-4 px-6">
                      <div className="flex flex-col gap-0.5 max-w-[220px]">
                        <div className="flex items-center gap-1 flex-wrap">
                          {r.order.service.category?.network && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-muted text-foreground border border-border/40 font-mono uppercase">
                              {r.order.service.category.network.name}
                            </span>
                          )}
                          {r.order.service.provider && (
                            <span className="text-[9px] text-primary font-bold px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20">
                              {r.order.service.provider.name}
                            </span>
                          )}
                        </div>
                        <span
                          className="text-xs font-semibold text-foreground truncate block mt-0.5"
                          title={r.order.service.name}
                        >
                          {r.order.service.name}
                        </span>
                        {r.externalId && (
                          <span className="text-[9px] font-mono text-muted-foreground">
                            Ext ID: {r.externalId}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* 5. Status Badge */}
                    <TableCell className="py-4 px-6">
                      <Badge
                        intent={statusMeta.intent}
                        className={`text-[9px] uppercase font-bold px-2 py-0.5 border ${statusMeta.bg}`}
                      >
                        {statusMeta.label}
                      </Badge>
                    </TableCell>

                    {/* 6. Support Actions */}
                    <TableCell className="py-4 px-6 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {r.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleRestartRefill(r)}
                            disabled={isPending}
                            title="Перезапустить отправку провайдеру"
                            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-border/60 bg-background/50 hover:bg-muted/80 text-foreground transition-all duration-200 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {isPending ? '...' : 'Повтор'}
                          </button>
                        )}
                        {['PENDING', 'IN_PROGRESS', 'ERROR'].includes(r.status) && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(r, 'COMPLETED')}
                              disabled={isPending}
                              title="Пометить как выполненный вручную"
                              className="px-2 py-1 text-[10px] font-bold rounded-lg border border-success/30 bg-success/10 text-success hover:bg-success/20 transition-all duration-200 cursor-pointer disabled:opacity-50"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(r, 'REJECTED')}
                              disabled={isPending}
                              title="Отклонить заявку"
                              className="px-2 py-1 text-[10px] font-bold rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all duration-200 cursor-pointer disabled:opacity-50"
                            >
                              🚫
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
