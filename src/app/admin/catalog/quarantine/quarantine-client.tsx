'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { 
  approveQuarantinedService, 
  rejectQuarantinedService, 
  approveAllQuarantined,
  archiveZombieService,
  liftApiBlock
} from '@/actions/admin/providers/sync-action';
import { toast } from 'sonner';
import { Table } from '@/components/admin/hero-ui';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPricePerUnit } from '@/utils/format-price';
import { QuarantineDiffModal, type QuarantineDiffTarget } from './quarantine-diff-modal';

interface QuarantineItem {
  id: string;
  numericId?: number | null;
  name: string;
  categoryName: string;
  networkSlug: string;
  providerId?: string | null;
  providerName: string;
  currentRate: number;
  pendingRate: number | null;
  quarantineReason: string;
  quarantinedAt: string;
  externalId: string;
  cooldownUntil: string | null;
}

interface AutoFixItem {
  id: string;
  serviceId: string;
  serviceNumericId?: number | null;
  serviceName: string;
  categoryName: string;
  networkSlug: string;
  providerId?: string | null;
  providerName: string;
  externalId?: string | null;
  oldValue: Record<string, string | number | null> | null;
  newValue: Record<string, string | number | null> | null;
  createdAt: string;
}

interface Props {
  initialPriceSpikes: QuarantineItem[];
  initialZombies: QuarantineItem[];
  initialApiErrors: QuarantineItem[];
  initialAutoFixes: AutoFixItem[];
}

const NETWORK_EMOJI: Record<string, string> = {
  instagram: '📸', telegram: '✈️', youtube: '▶️',
  tiktok: '🎵', vk: '🔵', twitter: '🐦', unknown: '🌐',
};

export function QuarantineClient({ initialPriceSpikes, initialZombies, initialApiErrors, initialAutoFixes }: Props) {
  const [priceSpikes, setPriceSpikes] = useState(initialPriceSpikes);
  const [zombies, setZombies] = useState(initialZombies);
  const [apiErrors, setApiErrors] = useState(initialApiErrors);
  const [autoFixes] = useState(initialAutoFixes);
  const [activeTab, setActiveTab] = useState<'price' | 'zombies' | 'api' | 'autofix'>('price');
  const [diffItem, setDiffItem] = useState<QuarantineDiffTarget | null>(null);
  
  const [isPending, startTransition] = useTransition();

  // Price Spikes Actions
  function removePriceSpike(id: string) { setPriceSpikes(prev => prev.filter(i => i.id !== id)); }
  function handleApprove(item: QuarantineItem) {
    startTransition(async () => {
      const result = await approveQuarantinedService(item.id);
      if (result.success) {
        toast.success(`✅ Принято: ${item.name}`);
        removePriceSpike(item.id);
      } else {
        toast.error(result.error ?? 'Ошибка');
      }
    });
  }
  function handleReject(item: QuarantineItem) {
    startTransition(async () => {
      const result = await rejectQuarantinedService(item.id);
      if (result.success) {
        toast.success(`🔄 Отклонено, цена сохранена: ${item.name}`);
        removePriceSpike(item.id);
      } else {
        toast.error('Ошибка');
      }
    });
  }
  function handleApproveAll() {
    startTransition(async () => {
      const result = await approveAllQuarantined();
      if (result.success) {
        toast.success(`✅ Принято ${result.count} услуг`);
        setPriceSpikes([]);
      } else {
        toast.error('Ошибка массового одобрения');
      }
    });
  }

  // Zombies Actions
  function handleArchiveZombie(item: QuarantineItem) {
    startTransition(async () => {
      const result = await archiveZombieService(item.id);
      if (result.success) {
        toast.success(`🧟 Архивировано: ${item.name}`);
        setZombies(prev => prev.filter(i => i.id !== item.id));
      } else {
        toast.error(result.error ?? 'Ошибка архивации');
      }
    });
  }

  // API Block Actions
  function handleLiftApiBlock(item: QuarantineItem) {
    startTransition(async () => {
      const result = await liftApiBlock(item.id);
      if (result.success) {
        toast.success(`🔓 Блокировка снята: ${item.name}`);
        setApiErrors(prev => prev.filter(i => i.id !== item.id));
      } else {
        toast.error(result.error ?? 'Ошибка снятия блокировки');
      }
    });
  }

  // Render Helpers
  function ServiceInfoCell({
    item,
    isZombie = false
  }: {
    item: QuarantineItem | {
      id: string;
      name: string;
      numericId?: number | null;
      categoryName: string;
      providerName: string;
      externalId?: string | null;
      networkSlug: string;
    };
    isZombie?: boolean;
  }) {
    const emoji = NETWORK_EMOJI[item.networkSlug] ?? '🌐';
    return (
      <div className="flex items-start gap-2.5 max-w-[340px]">
        <span className="text-base shrink-0 mt-0.5">{emoji}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/admin/catalog/${item.id}`}
              className={`text-xs font-bold transition-colors inline-flex items-center gap-1.5 hover:text-primary ${
                isZombie ? 'text-foreground/60 line-through' : 'text-foreground'
              }`}
              title="Открыть карточку услуги"
            >
              <span className="hover:underline underline-offset-2">{item.name}</span>
              {item.numericId ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-bold border border-border/50">
                  #{item.numericId}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground mt-1">
            <span>{item.categoryName}</span>
            <span>·</span>
            <span className="font-semibold text-foreground/80">{item.providerName}</span>
            {item.externalId ? (
              <>
                <span>·</span>
                <span
                  className="inline-flex items-center gap-1 font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 text-[10px]"
                  title="ID услуги в API провайдера"
                >
                  <span>ID провайдера: {item.externalId}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(item.externalId || '');
                      toast.success(`ID ${item.externalId} скопирован в буфер`);
                    }}
                    className="hover:text-primary/70 transition-colors cursor-pointer p-0.5"
                    title="Скопировать ID в буфер обмена"
                  >
                    📋
                  </button>
                </span>
              </>
            ) : (
              <>
                <span>·</span>
                <span className="text-[10px] text-muted-foreground/60 italic">нет ID провайдера</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderEmptyState(title: string, desc: string) {
    return (
      <div className="bg-card border border-border/70 rounded-lg p-16 text-center shadow-xs">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-foreground font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="mb-6">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'price' | 'zombies' | 'api' | 'autofix')}>
          <TabsList variant="line" className="gap-6 border-b border-divider w-full justify-start rounded-none h-auto p-0">
            <TabsTrigger value="price" className="h-12 px-0 bg-transparent border-none shadow-none data-active:bg-transparent data-active:shadow-none font-bold uppercase tracking-widest text-[11px] flex items-center gap-2">
              <span>Ценовые скачки</span>
              {priceSpikes.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning text-[10px]">
                  {priceSpikes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="zombies" className="h-12 px-0 bg-transparent border-none shadow-none data-active:bg-transparent data-active:shadow-none font-bold uppercase tracking-widest text-[11px] flex items-center gap-2">
              <span>Зомби-услуги</span>
              {zombies.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-destructive/20 text-destructive text-[10px]">
                  {zombies.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="api" className="h-12 px-0 bg-transparent border-none shadow-none data-active:bg-transparent data-active:shadow-none font-bold uppercase tracking-widest text-[11px] flex items-center gap-2">
              <span>Сбои API</span>
              {apiErrors.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning text-[10px]">
                  {apiErrors.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="autofix" className="h-12 px-0 bg-transparent border-none shadow-none data-active:bg-transparent data-active:shadow-none font-bold uppercase tracking-widest text-[11px] flex items-center gap-2">
              <span>История автоисправлений</span>
              {autoFixes.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-success/20 text-success text-[10px]">
                  {autoFixes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* PRICE SPIKES TAB */}
      {activeTab === 'price' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{priceSpikes.length} услуг ожидают решения</p>
            {priceSpikes.length > 0 && (
              <button onClick={handleApproveAll} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-success text-primary-foreground hover:bg-success/90 transition-all duration-200 disabled:opacity-50">
                ✅ Принять все
              </button>
            )}
          </div>
          {priceSpikes.length === 0 ? renderEmptyState('Карантин цен пуст', 'Все ценовые изменения в норме') : (
            <div className="bg-card border border-border/70 rounded-lg overflow-hidden w-full shadow-xs">
              <Table aria-label="Ценовые скачки">
                <Table.ScrollContainer>
                  <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader>УСЛУГА</Table.Column>
                      <Table.Column>ПРИЧИНА</Table.Column>
                      <Table.Column className="text-right">ТЕКУЩАЯ</Table.Column>
                      <Table.Column className="text-right">НОВАЯ</Table.Column>
                      <Table.Column className="text-right">ДЕЙСТВИЕ</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {priceSpikes.map(item => {
                        const priceDiff = item.pendingRate !== null ? ((item.pendingRate - item.currentRate) / item.currentRate * 100).toFixed(1) : '—';
                        const isRise = item.pendingRate !== null && item.pendingRate > item.currentRate;
                        return (
                          <Table.Row key={item.id}>
                            <Table.Cell>
                              <ServiceInfoCell item={item} />
                            </Table.Cell>
                            <Table.Cell><span className="text-xs px-2 py-1 rounded-md bg-warning/10 text-warning border border-warning/20">{item.quarantineReason}</span></Table.Cell>
                            <Table.Cell className="text-right"><span className="text-sm font-mono text-muted-foreground">{formatPricePerUnit(item.currentRate)} ₽</span></Table.Cell>
                            <Table.Cell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`text-sm font-mono font-semibold ${isRise ? 'text-destructive' : 'text-success'}`}>{item.pendingRate !== null ? formatPricePerUnit(item.pendingRate) : '—'} ₽</span>
                                <span className={`text-xs ${isRise ? 'text-destructive' : 'text-success'}`}>{isRise ? '▲' : '▼'} {priceDiff}%</span>
                              </div>
                            </Table.Cell>
                            <Table.Cell className="text-right">
                              <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setDiffItem(item)}
                                  disabled={isPending}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                  title="Сверить услугу с API поставщика (Side-by-Side Diff)"
                                >
                                  <span>🔍 Сверить API</span>
                                </button>
                                <button onClick={() => handleApprove(item)} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-all duration-200 disabled:opacity-50 cursor-pointer">✅ Принять</button>
                                <button onClick={() => handleReject(item)} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border hover:bg-muted-foreground/10 transition-all duration-200 disabled:opacity-50 cursor-pointer">✕ Отклонить</button>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ZOMBIES TAB */}
      {activeTab === 'zombies' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <p className="text-sm text-muted-foreground">{zombies.length} зомби-услуг обнаружено (провайдер удалил их из API)</p>
          {zombies.length === 0 ? renderEmptyState('Зомби нет', 'Все услуги активно поддерживаются провайдерами') : (
            <div className="bg-card border border-border/70 rounded-lg overflow-hidden w-full shadow-xs">
              <Table aria-label="Зомби услуги">
                <Table.ScrollContainer>
                  <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader>УСЛУГА</Table.Column>
                      <Table.Column>ПРИЧИНА</Table.Column>
                      <Table.Column className="text-right">ДЕЙСТВИЕ</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {zombies.map(item => {
                        return (
                          <Table.Row key={item.id}>
                            <Table.Cell>
                              <ServiceInfoCell item={item} isZombie />
                            </Table.Cell>
                            <Table.Cell><span className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20">{item.quarantineReason}</span></Table.Cell>
                            <Table.Cell className="text-right">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setDiffItem(item)}
                                  disabled={isPending}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                  title="Сверить услугу с API поставщика"
                                >
                                  <span>🔍 Сверить API</span>
                                </button>
                                <button onClick={() => handleArchiveZombie(item)} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border hover:bg-muted-foreground/10 transition-all duration-200 disabled:opacity-50 cursor-pointer">📦 Скрыть навсегда</button>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* API ERRORS TAB */}
      {activeTab === 'api' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <p className="text-sm text-muted-foreground">{apiErrors.length} услуг заблокировано из-за сбоев API</p>
          {apiErrors.length === 0 ? renderEmptyState('Сбоев нет', 'Провайдеры работают в штатном режиме') : (
            <div className="bg-card border border-border/70 rounded-lg overflow-hidden w-full shadow-xs">
              <Table aria-label="Сбои API">
                <Table.ScrollContainer>
                  <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader>УСЛУГА</Table.Column>
                      <Table.Column>ПРИЧИНА</Table.Column>
                      <Table.Column>БЛОКИРОВКА ДО</Table.Column>
                      <Table.Column className="text-right">ДЕЙСТВИЕ</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {apiErrors.map(item => {
                        const untilDate = item.cooldownUntil ? new Date(item.cooldownUntil).toLocaleString('ru-RU') : '—';
                        return (
                          <Table.Row key={item.id}>
                            <Table.Cell>
                              <ServiceInfoCell item={item} />
                            </Table.Cell>
                            <Table.Cell><span className="text-xs px-2 py-1 rounded-md bg-warning/10 text-warning border border-warning/20">{item.quarantineReason}</span></Table.Cell>
                            <Table.Cell><span className="text-sm font-mono text-muted-foreground">{untilDate}</span></Table.Cell>
                            <Table.Cell className="text-right">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setDiffItem(item)}
                                  disabled={isPending}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                  title="Сверить услугу с API поставщика"
                                >
                                  <span>🔍 Сверить API</span>
                                </button>
                                <button onClick={() => handleLiftApiBlock(item)} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-all duration-200 disabled:opacity-50 cursor-pointer">🔓 Снять блок</button>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* AUTOFIX LOGS TAB */}
      {activeTab === 'autofix' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <p className="text-sm text-muted-foreground">{autoFixes.length} последних автоисправлений (очистка текста, автокоррекция наценки)</p>
          {autoFixes.length === 0 ? renderEmptyState('История пуста', 'Никаких автоисправлений еще не производилось') : (
            <div className="bg-card border border-border/70 rounded-lg overflow-hidden w-full shadow-xs">
              <Table aria-label="История автоисправлений">
                <Table.ScrollContainer>
                  <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader>УСЛУГА</Table.Column>
                      <Table.Column>ДАТА</Table.Column>
                      <Table.Column>ИЗМЕНЕНИЯ</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {autoFixes.map(item => {
                        const emoji = NETWORK_EMOJI[item.networkSlug] ?? '🌐';
                        const dateFormatted = new Date(item.createdAt).toLocaleString('ru-RU');

                        const changesList: React.ReactNode[] = [];
                        type AuditVal = { name?: string; description?: string; markup?: number; pricePer1000Cents?: number };
                        const oldVal = (item.oldValue || {}) as AuditVal;
                        const newVal = (item.newValue || {}) as AuditVal;

                        if (oldVal.name !== undefined && newVal.name !== undefined && oldVal.name !== newVal.name) {
                          changesList.push(
                            <div key="name" className="text-xs">
                              <span className="font-semibold text-muted-foreground">Название:</span>{" "}
                              <span className="line-through text-destructive/80 mr-1">{String(oldVal.name)}</span>
                              <span className="text-success font-medium">→ {String(newVal.name)}</span>
                            </div>
                          );
                        }
                        if (oldVal.description !== undefined && newVal.description !== undefined && oldVal.description !== newVal.description) {
                          const descOld = String(oldVal.description || "—");
                          const descNew = String(newVal.description || "—");
                          changesList.push(
                            <div key="desc" className="text-xs mt-1">
                              <span className="font-semibold text-muted-foreground">Описание:</span>{" "}
                              <span className="text-xs text-muted-foreground line-through block" title={descOld}>Было: {descOld}</span>
                              <span className="text-xs text-success font-medium block" title={descNew}>Стало: {descNew}</span>
                            </div>
                          );
                        }
                        if (oldVal.markup !== undefined && newVal.markup !== undefined && oldVal.markup !== newVal.markup) {
                          const mOld = Number(oldVal.markup || 0);
                          const mNew = Number(newVal.markup || 0);
                          changesList.push(
                            <div key="markup" className="text-xs mt-1">
                              <span className="font-semibold text-muted-foreground">Наценка:</span>{" "}
                              <span className="text-destructive/80 font-mono mr-1">{formatPricePerUnit(mOld)}x</span>
                              <span className="text-success font-mono font-medium">→ {formatPricePerUnit(mNew)}x</span>
                            </div>
                          );
                        }
                        if (oldVal.pricePer1000Cents !== undefined && newVal.pricePer1000Cents !== undefined && oldVal.pricePer1000Cents !== newVal.pricePer1000Cents) {
                          const pOld = Number(oldVal.pricePer1000Cents || 0);
                          const pNew = Number(newVal.pricePer1000Cents || 0);
                          changesList.push(
                            <div key="price" className="text-xs mt-1">
                              <span className="font-semibold text-muted-foreground">Цена/1k:</span>{" "}
                              <span className="text-destructive/80 font-mono mr-1">{formatPricePerUnit(pOld / 100)} ₽</span>
                              <span className="text-success font-mono font-medium">→ {formatPricePerUnit(pNew / 100)} ₽</span>
                            </div>
                          );
                        }

                        if (changesList.length === 0) {
                          changesList.push(
                            <div key="no-change" className="text-xs text-muted-foreground italic">
                              Параметры без изменений (повторный запуск аудита)
                            </div>
                          );
                        }

                        return (
                          <Table.Row key={item.id}>
                            <Table.Cell>
                              <ServiceInfoCell 
                                item={{
                                  id: item.serviceId,
                                  numericId: item.serviceNumericId,
                                  name: item.serviceName,
                                  categoryName: item.categoryName,
                                  providerName: item.providerName,
                                  externalId: item.externalId,
                                  networkSlug: item.networkSlug,
                                }} 
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">{dateFormatted}</span>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="space-y-1.5 py-1">
                                {changesList}
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Side-by-Side Diff Modal */}
      <QuarantineDiffModal
        item={diffItem}
        onClose={() => setDiffItem(null)}
        onResolved={(serviceId) => {
          removePriceSpike(serviceId);
          setZombies(prev => prev.filter(i => i.id !== serviceId));
          setApiErrors(prev => prev.filter(i => i.id !== serviceId));
        }}
      />
    </div>
  );
}
