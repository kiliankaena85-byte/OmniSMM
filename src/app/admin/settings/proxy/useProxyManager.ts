import { useState, useEffect, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import {
  listProviderProxiesAction,
  createProviderProxyAction,
  updateProviderProxyAction,
  deleteProviderProxyAction,
  testProviderProxyAction,
  assignProxyToProviderAction,
  getProxyHealthSummaryAction,
  syncSubscriptionAction,
  syncAllSubscriptionsAction,
  harvestFreeProxiesAction,
  importSubscriptionAction,
  importRawProxyListAction,
} from '@/actions/admin/provider-proxy';
import type { ProviderProxyWithUsage, ProxyHealthSummary } from '@/types/provider-proxy';
import { FormData, EMPTY_FORM, SubFormData, RawFormData } from './types';

export function useProxyManager() {
  const [proxies, setProxies] = useState<ProviderProxyWithUsage[]>([]);
  const [health, setHealth] = useState<ProxyHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProtocol, setFilterProtocol] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [expandedProxyId, setExpandedProxyId] = useState<string | null>(null);
  const [proxyToDelete, setProxyToDelete] = useState<{ id: string; label: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'routing' | 'proxies'>('routing');
  const [showImportSubModal, setShowImportSubModal] = useState(false);
  const [showImportRawModal, setShowImportRawModal] = useState(false);
  const [subForm, setSubForm] = useState<SubFormData>({
    subscriptionUrl: '', label: '', category: 'PAID_PREMIUM', protocol: 'socks5', inboundHost: '127.0.0.1', inboundPort: '7891', autoAssignToProviders: true
  });
  const [rawForm, setRawForm] = useState<RawFormData>({ rawListText: '', category: 'PAID_PREMIUM', defaultProtocol: 'socks5', tag: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [pRes, hRes] = await Promise.all([listProviderProxiesAction(), getProxyHealthSummaryAction()]);
    if (pRes.success && pRes.data) setProxies(pRes.data);
    if (hRes.success && hRes.data) setHealth(hRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => startTransition(async () => {
    const res = await createProviderProxyAction({ ...form, port: parseInt(form.port) || 1080 });
    if (res.success) { toast.success('Прокси добавлен'); setShowCreate(false); setForm(EMPTY_FORM); loadData(); }
    else toast.error(res.error || 'Ошибка добавления');
  });

  const handleUpdate = () => {
    if (!editingId) return;
    startTransition(async () => {
      const res = await updateProviderProxyAction({ id: editingId, ...form, port: parseInt(form.port) || 1080 });
      if (res.success) { toast.success('Прокси обновлен'); setEditingId(null); setForm(EMPTY_FORM); loadData(); }
      else toast.error(res.error || 'Ошибка обновления');
    });
  };

  const confirmDeleteProxy = () => {
    if (!proxyToDelete) return;
    startTransition(async () => {
      const res = await deleteProviderProxyAction(proxyToDelete.id);
      if (res.success) { toast.success('Прокси удален'); setProxyToDelete(null); loadData(); }
      else toast.error(res.error || 'Ошибка удаления');
    });
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    const res = await testProviderProxyAction({ proxyId: id });
    setTestingId(null);
    if (res.success && res.data?.success) toast.success(`Прокси активен (${res.data.latencyMs}ms)`);
    else toast.error((res.success ? res.data?.error : res.error) || 'Прокси недоступен');
    loadData();
  };

  const handleAssignProvider = (providerId: string, proxyId: string | null) => startTransition(async () => {
    const res = await assignProxyToProviderAction({ providerId, proxyId });
    if (res.success) { toast.success('Привязка обновлена'); loadData(); }
    else toast.error(res.error || 'Ошибка привязки');
  });

  const handleSyncSub = (id: string) => {
    setSyncingId(id);
    startTransition(async () => {
      const res = await syncSubscriptionAction(id);
      setSyncingId(null);
      if (res.success) { toast.success(res.message); loadData(); }
      else toast.error(res.error || 'Ошибка синхронизации');
    });
  };

  const handleSyncAllSubs = () => startTransition(async () => {
    const res = await syncAllSubscriptionsAction();
    if (res.success) { toast.success(res.message); loadData(); }
    else toast.error(res.error || 'Ошибка обновления');
  });

  const handleHarvest = async () => {
    setIsHarvesting(true);
    const res = await harvestFreeProxiesAction();
    setIsHarvesting(false);
    if (res.success) { toast.success(`Найдено ${res.data?.addedOrUpdated ?? 0} прокси`); loadData(); }
    else toast.error(res.error || 'Ошибка поиска');
  };

  const handleImportSub = () => startTransition(async () => {
    const res = await importSubscriptionAction(subForm as unknown as Record<string, unknown>);
    if (res.success) { toast.success('Импортировано'); setShowImportSubModal(false); loadData(); }
    else toast.error(res.error || 'Ошибка');
  });

  const handleImportRaw = () => startTransition(async () => {
    const res = await importRawProxyListAction(rawForm as unknown as Record<string, unknown>);
    if (res.success) { toast.success(res.message); setShowImportRawModal(false); loadData(); }
    else toast.error(res.error || 'Ошибка');
  });

  const filtered = proxies.filter((p) => {
    const mSearch = !searchQuery || p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.host.includes(searchQuery);
    return mSearch && (!filterProtocol || p.protocol === filterProtocol) && (!filterCategory || p.category === filterCategory);
  });

  return {
    proxies, health, loading, editingId, setEditingId, showCreate, setShowCreate,
    form, setForm, isPending, testingId, syncingId, isHarvesting, searchQuery, setSearchQuery,
    filterProtocol, setFilterProtocol, filterCategory, setFilterCategory,
    expandedProxyId, setExpandedProxyId, proxyToDelete, setProxyToDelete,
    activeSubTab, setActiveSubTab, showImportSubModal, setShowImportSubModal,
    showImportRawModal, setShowImportRawModal, subForm, setSubForm, rawForm, setRawForm,
    filtered, loadData, handleCreate, handleUpdate, confirmDeleteProxy, handleTest,
    handleAssignProvider, handleSyncSub, handleSyncAllSubs, handleHarvest,
    handleImportSub, handleImportRaw
  };
}
