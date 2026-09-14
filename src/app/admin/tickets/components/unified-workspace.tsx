'use client';
import type { OrderStatus } from '@prisma/client';
import type { AdminTicketItem, TicketStatsDTO, ActiveTicketDTO, TicketTemplateDTO, AttachedOrderDTO, ActiveTicketUserOrder, ActiveTicketUserPayment } from '../types';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  User, 
  ExternalLink, 
  Mail, 
  Wallet, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MessageSquare, 
  ChevronLeft,
  Info
} from 'lucide-react';
import { formatBalance } from '@/lib/utils';
import { 
  adminReplyTicket, 
  editTicketMessage,
  deleteTicketMessage
} from '@/actions/support/ticket';
import { cancelOrderAction, restartOrderAction } from '@/actions/admin/orders';
import ChatWindow from '@/components/support/ChatWindow';
import ClientProfileSidebar from '@/components/support/ClientProfileSidebar';
import TicketActionsDropdown from '@/components/support/TicketActionsDropdown';
import { Drawer } from '@heroui/react';
import { Button } from '@/components/ui/button';
import figmaStyles from '@/utils/figma-styles.json';
import { useTheme } from 'next-themes';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { OrderDetailsModal, type OrderModalColumn } from '@/components/admin/OrderDetailsModal';
import TemplateManagerModal from '@/components/support/TemplateManagerModal';



// Helper inline hook for responsive query matches
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

import { AttachedOrdersGrid } from './attached-orders-grid';


interface UnifiedTicketsWorkspaceProps {
    tickets: AdminTicketItem[];
  totalPages: number;
  currentPage: number;
    stats: TicketStatsDTO;
    activeTicket: ActiveTicketDTO | null;
    templates: TicketTemplateDTO[];
  supportLimitCents: number;
  supportSpentTodayCents?: number;
  currentStatus: string;
  currentSource: string;
  currentIsB2b: boolean;
  currentSearch: string;
  canSeeRates?: boolean;
  canSeeFinances?: boolean;
  userRole?: string;
}

import { TicketsSidebar } from './tickets-sidebar';

export function UnifiedTicketsWorkspace({
  tickets,
  totalPages,
  currentPage,
  stats,
  activeTicket,
  templates,
  supportLimitCents,
  supportSpentTodayCents = 0,
  currentStatus,
  currentSource,
  currentIsB2b,
  currentSearch,
  canSeeRates = true,
  canSeeFinances = canSeeRates,
  userRole = 'SUPPORT'
}: UnifiedTicketsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [showProfile, setShowProfile] = useState(true);
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<OrderModalColumn | null>(null);
  const [searchVal, setSearchVal] = useState(currentSearch);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'restart' | null>(null);
  const [isPending, startTransition] = useTransition();
  // Modal states — hoisted here so modals survive dropdown unmount (fixes crash on open)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted ? (theme?.includes('dark') || theme === 'dark') : true;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const headerBg = isDark
    ? figmaStyles.colors.miniAppHeaderBackground.dark
    : figmaStyles.colors.miniAppHeaderBackground.light;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const headerTextColor = figmaStyles.colors.miniAppHeaderTextColor;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const inputBg = isDark
    ? figmaStyles.colors.miniAppInputBackground.dark
    : figmaStyles.colors.miniAppInputBackground.light;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cardBg = isDark
    ? figmaStyles.colors.miniAppCardBackground.dark
    : figmaStyles.colors.miniAppCardBackground.light;


  // Sync selectedOrder when activeTicket changes
  useEffect(() => {
    if (activeTicket) {
      setSelectedOrder(activeTicket.order);
    } else {
      setSelectedOrder(null);
    }
  }, [activeTicket]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 1. Sync searchVal with prop update
  useEffect(() => {
    setSearchVal(currentSearch);
  }, [currentSearch]);

  // 2. Keyboard / visual viewport adjustments for mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  // 3. Navigation / filter helpers
  const handleSelectTicket = (ticketId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('ticketId', ticketId);
    router.push(`/admin/tickets?${params.toString()}`);
  };

  const handleClearActiveTicket = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('ticketId');
    router.push(`/admin/tickets?${params.toString()}`);
  };

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.delete('page'); // Reset pagination on filter change
    router.push(`/admin/tickets?${params.toString()}`);
  };

  const handleSourceFilter = (source: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (source === 'ALL') {
      params.delete('source');
    } else {
      params.set('source', source);
    }
    params.delete('page'); // Reset pagination on filter change
    router.push(`/admin/tickets?${params.toString()}`);
  };

  const handleB2bToggle = (isB2b: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (isB2b) {
      params.set('isB2b', 'true');
    } else {
      params.delete('isB2b');
    }
    params.delete('page'); // Reset pagination on filter change
    router.push(`/admin/tickets?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchVal) {
      params.set('q', searchVal);
    } else {
      params.delete('q');
    }
    params.delete('page');
    router.push(`/admin/tickets?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/admin/tickets?${params.toString()}`);
  };

  // 4. Support bridge handler
  const handleProviderSupportBridge = (e: React.MouseEvent) => {
    e.stopPropagation();
    const order = selectedOrder as unknown as AttachedOrderDTO;
    if (!order || !order.externalId) return;

    navigator.clipboard.writeText(order.externalId);
    toast.success(`Внешний ID ${order.externalId} скопирован в буфер обмена`);

    let providerUrl = 'https://smmprovider.com/tickets';
    if (order.provider?.apiUrl) {
      try {
        const url = new URL(order.provider.apiUrl);
        providerUrl = `${url.protocol}//${url.hostname}/tickets`;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        // use fallback
      }
    }
    window.open(providerUrl, '_blank');
  };

  // 5. Order Action Handlers
  const handleCancelOrder = () => {
    if (!activeTicket?.order) return;
    setConfirmAction('cancel');
    setConfirmOpen(true);
  };

  const handleRestartOrder = () => {
    if (!activeTicket?.order) return;
    setConfirmAction('restart');
    setConfirmOpen(true);
  };

  const executeConfirm = () => {
    if (!activeTicket?.order || !confirmAction) return;
    setConfirmOpen(false);
    
    startTransition(async () => {
      const fd = new FormData();
      fd.set('orderId', activeTicket.order?.id || '');
      
      if (confirmAction === 'cancel') {
        const res = await cancelOrderAction(fd);
        if (res.success) {
          toast.success('Заказ отменен успешно');
          router.refresh();
        } else {
          toast.error(res.error || 'Ошибка отмены заказа');
        }
      } else if (confirmAction === 'restart') {
        const res = await restartOrderAction(fd);
        if (res.success) {
          toast.success('Заказ перезапущен успешно');
          router.refresh();
        } else {
          toast.error(res.error || 'Ошибка перезапуска заказа');
        }
      }
    });
  };

  // 6. Open Order Drawer Helper
    const handleOpenOrderDrawer = (order: OrderModalColumn) => {
    setSelectedOrder(order);
    setIsOrderDrawerOpen(true);
  };

  return (
    <>
    <div className="tickets-workspace flex flex-1 overflow-hidden h-full max-h-full bg-background text-foreground min-w-0 min-h-0">
      {/* ── LEFT PANEL: Tickets List (Hide on mobile if ticket is active) ── */}
      <TicketsSidebar
        isMobile={isMobile}
        activeTicket={activeTicket}
        stats={stats}
        searchVal={searchVal}
        setSearchVal={setSearchVal}
        handleSearchSubmit={handleSearchSubmit}
        currentStatus={currentStatus}
        handleStatusFilter={handleStatusFilter}
        currentSource={currentSource}
        handleSourceFilter={handleSourceFilter}
        currentIsB2b={currentIsB2b}
        handleB2bToggle={handleB2bToggle}
        tickets={tickets}
        handleSelectTicket={handleSelectTicket}
        totalPages={totalPages}
        currentPage={currentPage}
        handlePageChange={handlePageChange}
      />

      {/* ── RIGHT PANEL: Active Ticket Details (Hide on mobile if no ticket is active) ── */}
      {(!isMobile || activeTicket) && (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden min-w-0 min-h-0">
          {activeTicket ? (
            <div className="flex flex-1 overflow-hidden h-full min-w-0 min-h-0">
              {/* Main Chat Panel Container */}
              <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 min-h-0">
                {/* Header block */}
                <div className="p-3 border-b border-border/50 flex justify-between items-center gap-2.5 shrink-0 bg-card/60 backdrop-blur-md text-card-foreground min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isMobile && (
                      <Button
                        intent="ghost"
                        size="sm"
                        onClick={handleClearActiveTicket}
                        className="mr-1 min-h-[44px] min-w-[44px] touch-target-expand rounded-full p-0 flex items-center justify-center cursor-pointer text-foreground hover:bg-muted"
                      >
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                      </Button>
                    )}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-black text-xs border border-border text-foreground bg-muted shadow-xs">
                      {activeTicket.user.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-black text-xs leading-tight truncate max-w-[180px] sm:max-w-xs text-foreground" title={activeTicket.subject}>
                          {activeTicket.subject}
                        </h2>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0 ${
                          activeTicket.status === 'OPEN' ? 'bg-destructive/15 text-destructive-text border border-destructive/25' :
                          activeTicket.status === 'PENDING' ? 'bg-warning/15 text-warning-text border border-warning/25' :
                          'bg-success/15 text-success-text border border-success/25'
                        }`}>
                          {activeTicket.status === 'OPEN' ? 'В работе' : activeTicket.status === 'PENDING' ? 'Ожидание' : 'Закрыт'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold overflow-hidden flex-nowrap">
                        <span className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-[160px] text-muted-foreground shrink-0" title={activeTicket.user.email}>
                          <Mail className="w-3 h-3 shrink-0 text-muted-foreground" /> <span className="truncate text-muted-foreground">{activeTicket.user.email}</span>
                        </span>
                        <span className="hidden sm:inline w-1 h-1 rounded-full bg-border shrink-0" />
                        <span className="text-foreground flex items-center gap-1 px-1.5 py-0.5 bg-muted border border-border rounded-md shrink-0">
                          <Wallet className="w-3 h-3 shrink-0 text-muted-foreground" /> {canSeeFinances ? formatBalance(activeTicket.user.balance) : '🔒 *** ₽'}
                        </span>
                        {canSeeRates && activeTicket.user.totalSpent !== undefined && (
                          <span className="hidden 3xl:inline-flex text-foreground items-center gap-1 px-1.5 py-0.5 bg-muted border border-border rounded-md shrink-0" title="Общий объем покупок клиента (LTV)">
                            LTV: {formatBalance(Number(activeTicket.user.totalSpent))}
                          </span>
                        )}
                        <a
                          href={`/admin/orders?userId=${activeTicket.user.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hidden 3xl:inline-flex text-foreground hover:bg-muted items-center gap-1 px-1.5 py-0.5 bg-muted border border-border rounded-md shrink-0 transition-all duration-200"
                          title="Открыть все заказы клиента"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span>Все заказы</span>
                        </a>
                        {activeTicket.user.b2bConfig?.isB2b && (
                          <span className="px-1.5 py-0.5 bg-warning/10 text-warning-text border border-warning/20 rounded text-[9px] font-black uppercase shrink-0 animate-pulse select-none" title="Приоритетный B2B клиент">
                            B2B
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center associated order widget */}
                  {activeTicket.order && (
                    <div className="hidden md:flex items-center justify-center flex-1 px-4">
                      <button
                        type="button"
                        onClick={() => activeTicket.order && handleOpenOrderDrawer({ ...activeTicket.order, remains: 0, quantity: 1, link: '' } as unknown as OrderModalColumn)}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 cursor-pointer shadow-xs text-xs font-bold"
                        title="Управление прикрепленным заказом"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>📦 Связанный заказ #{activeTicket.order.numericId}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            activeTicket.order.status === 'COMPLETED' ? 'bg-success/15 text-success-text border border-success/20' :
                            activeTicket.order.status === 'IN_PROGRESS' ? 'bg-primary/15 text-primary border border-primary/20' :
                            activeTicket.order.status === 'PENDING' ? 'bg-warning/15 text-warning-text border border-warning/20' :
                            'bg-muted text-foreground border border-border'
                          }`}>
                            {activeTicket.order.status === 'COMPLETED' ? 'Выполнен' :
                             activeTicket.order.status === 'IN_PROGRESS' ? 'В работе' :
                             activeTicket.order.status === 'PENDING' ? 'В очереди' : activeTicket.order.status}
                          </span>
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TicketActionsDropdown
                      ticketId={activeTicket.id}
                      currentStatus={activeTicket.status}
                    />
                    <Button
                      intent="ghost"
                      onClick={() => setShowProfile(!showProfile)}
                      className="min-h-[44px] min-w-[44px] touch-target-expand rounded-lg p-0 flex items-center justify-center cursor-pointer text-foreground hover:bg-muted border border-border"
                      title="Профиль клиента"
                    >
                      <Info className="w-5 h-5 text-foreground" />
                    </Button>
                  </div>
                </div>

                {/* Attached Order Banner */}
                {activeTicket.order && (
                  <div className="p-3 border-b border-border/50 bg-card/60 backdrop-blur-md shrink-0 select-none">
                    <div 
                      onClick={() => activeTicket.order && handleOpenOrderDrawer({ ...activeTicket.order, remains: 0, quantity: 1, link: '' } as unknown as OrderModalColumn)}
                      className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                          📦
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">Заказ #{activeTicket.order.numericId}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              activeTicket.order.status === 'COMPLETED' ? 'bg-success/10 text-success-text' :
                              activeTicket.order.status === 'IN_PROGRESS' ? 'bg-primary/10 text-primary' :
                              activeTicket.order.status === 'PENDING' ? 'bg-warning/10 text-warning-text' :
                              'bg-muted text-foreground'
                            }`}>
                              {activeTicket.order.status === 'COMPLETED' ? 'Выполнен' :
                               activeTicket.order.status === 'IN_PROGRESS' ? 'В работе' :
                               activeTicket.order.status === 'PENDING' ? 'В очереди' : activeTicket.order.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate max-w-sm sm:max-w-md">{activeTicket.order.serviceName}</p>
                        </div>
                      </div>
                      
                      {/* Desktop Order Actions */}
                      {!isMobile && (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-[10px] text-muted-foreground text-right">
                            <div>Дата: {new Date(activeTicket.order.createdAt).toLocaleDateString('ru-RU')}</div>
                            <div className="font-bold text-foreground mt-0.5">{(Number(activeTicket.order.charge) / 100).toFixed(2)} ₽</div>
                          </div>
                          <div className="flex gap-2">
                            {(() => {
                              const isPendingState = ['PENDING', 'PENDING_CHECK', 'AWAITING_PAYMENT'].includes(activeTicket.order.status);
                              const canCancelOrder = userRole !== 'SUPPORT' || isPendingState || activeTicket.order.isCancelEnabled === true;
                              const isStatusCancelable = ['PENDING', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'ERROR'].includes(activeTicket.order.status);
                              
                              if (!canCancelOrder || !isStatusCancelable) return null;
                              return (
                                <Button
                                  intent="destructive"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }}
                                  disabled={isPending}
                                  className="min-h-[44px] touch-target-expand px-3 py-1 cursor-pointer bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  style={{
                                    borderRadius: figmaStyles.layout.miniAppButtonRadius,
                                    padding: figmaStyles.layout.miniAppButtonPadding
                                  }}
                                >
                                  Отменить
                                </Button>
                              );
                            })()}
                            {['CANCELED', 'ERROR'].includes(activeTicket.order.status) && (
                              <Button
                                intent="primary"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleRestartOrder(); }}
                                disabled={isPending}
                                className="min-h-[44px] touch-target-expand px-3 py-1 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                                style={{
                                  borderRadius: figmaStyles.layout.miniAppButtonRadius,
                                  padding: figmaStyles.layout.miniAppButtonPadding
                                }}
                              >
                                Перезапустить
                              </Button>
                            )}
                            {activeTicket.order.externalId && (
                              <Button
                                intent="outline"
                                size="sm"
                                onClick={handleProviderSupportBridge}
                                className="min-h-[44px] touch-target-expand px-3 py-1 flex items-center gap-1 cursor-pointer border-border text-foreground hover:bg-muted"
                                style={{
                                  borderRadius: figmaStyles.layout.miniAppButtonRadius,
                                  padding: figmaStyles.layout.miniAppButtonPadding
                                }}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>В тикеты</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* B2B Attached Orders Grid (Multiple parsed orders) */}
                {activeTicket.attachedOrders && activeTicket.attachedOrders.length > 0 && (
                  <AttachedOrdersGrid 
                    orders={activeTicket.attachedOrders}
                    ticketId={activeTicket.id}
                    isB2bClient={!!activeTicket.user.b2bConfig?.isB2b}
                  />
                )}

                {/* Chat window body */}
                <div ref={messagesContainerRef} className="flex-1 min-h-0 bg-muted/15 relative overflow-hidden flex flex-col min-w-0">
                  <ChatWindow
                    ticketId={activeTicket.id}
                    initialMessages={activeTicket.messages}
                    isStaff={true}
                    initialTemplates={templates}
                    onSendMessage={adminReplyTicket}
                    editTicketMessage={editTicketMessage}
                    deleteTicketMessage={deleteTicketMessage}
                    initialNextCursor={activeTicket.nextCursor}
                    onSelectOrder={(order) => {
                      const full = activeTicket.user.orders.find((o: ActiveTicketUserOrder) => o.id === order.id);
                      handleOpenOrderDrawer((full ? { ...full, remains: 0, link: '' } : { id: order.id, numericId: order.numericId || 0, status: order.status as OrderStatus, charge: 0, remains: 0, quantity: 1, link: '', createdAt: new Date().toISOString(), serviceName: order.serviceName || '' }) as unknown as OrderModalColumn);
                    }}
                    clientEmail={activeTicket.user.email}
                    initialOrders={activeTicket.user.orders}
                  />
                </div>
              </div>

              {/* ── RIGHT PANEL: Collapsible Client Profile (Desktop side display) ── */}
              {!isMobile && showProfile && (
                <div className="w-[280px] xl:w-[320px] shrink-0 border-l border-border/50 h-full min-h-0 bg-card/60 backdrop-blur-md overflow-hidden animate-in slide-in-from-right duration-300 min-w-0">
                  <ClientProfileSidebar 
                    ticketId={activeTicket.id}
                    supportLimitCents={supportLimitCents}
                    supportSpentTodayCents={supportSpentTodayCents}
                    onClose={() => setShowProfile(false)}
                    isMobile={false}
                    canSeeFinances={canSeeFinances}
                    user={{
                      ...activeTicket.user,
                      balance: Number(activeTicket.user.balance),
                      totalSpent: Number(activeTicket.user.totalSpent),
                                            orders: activeTicket.user.orders.map((o: ActiveTicketUserOrder) => ({ ...o, charge: Number(o.charge) })),
                                            payments: activeTicket.user.payments.map((p: ActiveTicketUserPayment) => ({ ...p, amount: Number(p.amount) }))
                    }}
                  />
                </div>
              )}

              {/* ── RIGHT PANEL: Collapsible Client Profile (Mobile slide-over Drawer) ── */}
              {isMobile && (
                <Drawer isOpen={showProfile} onOpenChange={setShowProfile}>
                  <Drawer.Content placement="right" className="max-w-[340px] w-full h-full bg-card/90 backdrop-blur-xl p-0">
                    {() => (
                      <Drawer.Body className="p-0 overflow-y-auto bg-transparent">
                        <ClientProfileSidebar 
                          ticketId={activeTicket.id}
                          supportLimitCents={supportLimitCents}
                          supportSpentTodayCents={supportSpentTodayCents}
                          onClose={() => setShowProfile(false)}
                          isMobile={true}
                          canSeeFinances={canSeeFinances}
                          user={{
                            ...activeTicket.user,
                            balance: Number(activeTicket.user.balance),
                            totalSpent: Number(activeTicket.user.totalSpent),
                                                        orders: activeTicket.user.orders.map((o: ActiveTicketUserOrder) => ({ ...o, charge: Number(o.charge) })),
                                                        payments: activeTicket.user.payments.map((p: ActiveTicketUserPayment) => ({ ...p, amount: Number(p.amount) }))
                          }}
                        />
                      </Drawer.Body>
                    )}
                  </Drawer.Content>
                </Drawer>
              )}

              {/* ── ORDER DETAILS & ACTIONS MODAL (Wide Bento Window) ── */}
              <OrderDetailsModal
                order={isOrderDrawerOpen ? selectedOrder : null}
                onClose={() => {
                  setIsOrderDrawerOpen(false);
                  setSelectedOrder(null);
                }}
                canSeeRates={canSeeRates}
                onSuccess={() => {
                  router.refresh();
                }}
              />

              <ConfirmModal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={executeConfirm}
                title={confirmAction === 'cancel' ? 'Отмена заказа' : 'Перезапуск заказа'}
                isDanger={confirmAction === 'cancel'}
                confirmText={confirmAction === 'cancel' ? 'Отменить заказ' : 'Перезапустить'}
              >
                {confirmAction === 'cancel' ? (
                  <>Вы действительно хотите отменить заказ <strong>#{activeTicket?.order?.numericId}</strong>? При наличии остатка клиент получит возврат.</>
                ) : (
                  <>Вы действительно хотите перезапустить заказ <strong>#{activeTicket?.order?.numericId}</strong>? Будет повторно списано <strong>{activeTicket?.order?.charge ? (Number(activeTicket.order.charge) / 100).toFixed(2) : '—'} ₽</strong>.</>
                )}
              </ConfirmModal>
            </div>
          ) : (
            // ── PREMIUM EMPTY STATE ──
            <div className="hidden lg:flex flex-col flex-grow items-center justify-center text-center p-8 bg-background select-none">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 animate-bounce">
                🎧
              </div>
              <h3 className="font-bold text-foreground text-sm">Выберите диалог</h3>
              <p className="text-muted-foreground text-xs max-w-xs mt-1 leading-normal">
                Выберите обращение в левом меню для просмотра подробностей и начала общения с пользователем.
              </p>
            </div>
          )}
        </div>
      )}
    </div>

    {/* ── GLOBAL MODALS (hoisted above dropdown to survive unmount) ── */}
    {activeTicket && (
      <TemplateManagerModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={templates}
      />
    )}
    </>
  );
}
