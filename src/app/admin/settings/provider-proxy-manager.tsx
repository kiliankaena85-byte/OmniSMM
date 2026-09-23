'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Globe, Loader2, RefreshCw, Search, Sparkles, Download, FileText, Route } from 'lucide-react';
import { NetworkRoutingTab } from './network-routing-tab';
import type { ProxyProtocol } from '@/types/provider-proxy';
import { PROXY_PROTOCOL_LABELS } from '@/types/provider-proxy';
import type { Provider } from '@prisma/client';
import { EMPTY_FORM } from './proxy/types';
import { ProxyHealthSummaryCard } from './proxy/ProxyHealthSummaryCard';
import { ProxyDeleteDialog } from './proxy/ProxyDeleteDialog';
import { ProxyImportSubscriptionModal } from './proxy/ProxyImportSubscriptionModal';
import { ProxyImportRawListModal } from './proxy/ProxyImportRawListModal';
import { ProxyFormCard } from './proxy/ProxyFormCard';
import { ProxyCardItem } from './proxy/ProxyCardItem';
import { useProxyManager } from './proxy/useProxyManager';

export function ProviderProxyManager({ providers = [] }: { providers?: Provider[] }) {
  const m = useProxyManager();

  return (
    <div className="space-y-6">
      <ProxyDeleteDialog proxyToDelete={m.proxyToDelete} onClose={() => m.setProxyToDelete(null)} onConfirm={m.confirmDeleteProxy} />

      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button type="button" variant={m.activeSubTab === 'routing' ? 'primary' : 'ghost'} size="sm" onClick={() => m.setActiveSubTab('routing')} className="h-8 text-xs font-semibold gap-2">
          <Route className="w-3.5 h-3.5 text-primary" /> Маршрутизация трафика (Clash Rules)
        </Button>
        <Button type="button" variant={m.activeSubTab === 'proxies' ? 'primary' : 'ghost'} size="sm" onClick={() => m.setActiveSubTab('proxies')} className="h-8 text-xs font-semibold gap-2">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Узлы & Прокси-серверы ({m.proxies.length})
        </Button>
      </div>

      {m.activeSubTab === 'routing' ? <NetworkRoutingTab proxies={m.proxies} /> : (
        <>
          {m.health && <ProxyHealthSummaryCard health={m.health} />}

          <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Пул прокси-серверов и подписок</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" variant="primary" size="sm" onClick={() => m.setShowImportSubModal(true)} className="text-xs h-8 gap-1.5 font-bold">
                  <Download className="w-3.5 h-3.5" /> Импорт подписки
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => m.setShowImportRawModal(true)} className="text-xs h-8 gap-1.5 font-bold">
                  <FileText className="w-3.5 h-3.5" /> Импорт списком
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={m.handleSyncAllSubs} disabled={m.isPending} className="text-xs h-8 gap-1.5 font-bold">
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${m.isPending ? 'animate-spin' : ''}`} /> Обновить подписки
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={m.handleHarvest} disabled={m.isHarvesting} className="text-xs h-8 gap-1.5 font-bold">
                  {m.isHarvesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />} Бесплатные SOCKS5
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => { m.setShowCreate(true); m.setForm(EMPTY_FORM); }} className="text-xs h-8 gap-1.5 font-bold">
                  <Plus className="w-3.5 h-3.5" /> Вручную
                </Button>
                <button type="button" onClick={m.loadData} className="p-2 rounded-lg hover:bg-muted" title="Обновить">
                  <RefreshCw className={`w-4 h-4 text-muted-foreground ${m.loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 border-b border-border/40 pb-3 flex-wrap">
              {[
                { id: '', label: `Все (${m.proxies.length})` },
                { id: 'PAID_PREMIUM', label: `💎 Платные (${m.proxies.filter(p => p.category === 'PAID_PREMIUM').length})` },
                { id: 'FREE_PUBLIC', label: `🌿 Бесплатные (${m.proxies.filter(p => p.category === 'FREE_PUBLIC').length})` },
                { id: 'BACKUP_RESERVE', label: `🛡️ Резерв (${m.proxies.filter(p => p.category === 'BACKUP_RESERVE').length})` },
              ].map((cat) => (
                <button key={cat.id} type="button" onClick={() => m.setFilterCategory(cat.id)} className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${m.filterCategory === cat.id ? 'bg-primary/10 text-primary border-primary/30' : 'border-border/60 text-muted-foreground'}`}>
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={m.searchQuery} onChange={(e) => m.setSearchQuery(e.target.value)} placeholder="Поиск по названию или хосту..." className="pl-9 text-xs" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['', 'socks5', 'http', 'https'].map((p) => (
                  <button key={p} type="button" onClick={() => m.setFilterProtocol(p)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${m.filterProtocol === p ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground'}`}>
                    {p ? PROXY_PROTOCOL_LABELS[p as ProxyProtocol] : 'Все'}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {(m.showCreate || m.editingId) && (
            <ProxyFormCard form={m.form} setForm={m.setForm} isEditing={!!m.editingId} isPending={m.isPending} onSave={m.editingId ? m.handleUpdate : m.handleCreate} onCancel={() => { m.setShowCreate(false); m.setEditingId(null); m.setForm(EMPTY_FORM); }} />
          )}

          {m.filtered.map((p) => (
            <ProxyCardItem key={p.id} proxy={p} isExpanded={m.expandedProxyId === p.id} onToggleExpand={() => m.setExpandedProxyId(m.expandedProxyId === p.id ? null : p.id)} onStartEdit={(item) => { m.setEditingId(item.id); m.setForm({ ...item, port: String(item.port), password: '', tags: item.tags || [] } as any); }} onDeleteRequest={m.setProxyToDelete} onTest={m.handleTest} onSyncSubscription={m.handleSyncSub} onAssignProvider={m.handleAssignProvider} testingId={m.testingId} syncingId={m.syncingId} providers={providers} />
          ))}

          <ProxyImportSubscriptionModal isOpen={m.showImportSubModal} onOpenChange={m.setShowImportSubModal} subForm={m.subForm} setSubForm={m.setSubForm} onImport={m.handleImportSub} isPending={m.isPending} />
          <ProxyImportRawListModal isOpen={m.showImportRawModal} onOpenChange={m.setShowImportRawModal} rawForm={m.rawForm} setRawForm={m.setRawForm} onImport={m.handleImportRaw} isPending={m.isPending} />
        </>
      )}
    </div>
  );
}
