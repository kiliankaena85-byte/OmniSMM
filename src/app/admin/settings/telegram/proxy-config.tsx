'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Save, X, Globe, Zap, CheckCircle, XCircle, Loader2, ShieldCheck, Server,
} from 'lucide-react';
import {
  listTelegramProxiesAction,
  createTelegramProxyAction,
  updateTelegramProxyAction,
  deleteTelegramProxyAction,
  testTelegramProxyAction,
  setActiveTelegramProxyAction,
} from '@/actions/admin/telegram-bot';
import type { TelegramProxy, TelegramBotDiagnostics, ProxyProtocol } from '@/types/telegram';

interface Props {
  diagnostics: TelegramBotDiagnostics | null;
  onRefresh: () => void;
}

interface ProxyFormData {
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
}

const EMPTY_FORM: ProxyFormData = { label: '', protocol: 'socks5', host: '', port: '1080', username: '', password: '' };

export function ProxyConfig({ diagnostics, onRefresh }: Props) {
  const [proxies, setProxies] = useState<TelegramProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ProxyFormData>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadProxies = useCallback(async () => {
    setLoading(true);
    try { 
      const res = await listTelegramProxiesAction();
      if (Array.isArray(res)) setProxies(res);
      else if (res && !res.success) toast.error(res.error || 'Ошибка загрузки прокси');
    }
    catch (err) { toast.error(String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProxies(); }, [loadProxies]);

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createTelegramProxyAction({ ...form, port: Number(form.port) || 1080, password: form.password || null, username: form.username || null });
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { setForm(EMPTY_FORM); setShowCreate(false); loadProxies(); }
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    startTransition(async () => {
      const res = await updateTelegramProxyAction({ id: editingId, ...form, port: Number(form.port) || 1080, password: form.password || null, username: form.username || null });
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { setEditingId(null); loadProxies(); }
    });
  };

  const handleDelete = (id: string, label: string) => {
    if (!confirm(`Удалить прокси "${label}"?`)) return;
    startTransition(async () => {
      const res = await deleteTelegramProxyAction(id);
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { loadProxies(); onRefresh(); }
    });
  };

  const handleTest = (id: string) => {
    setTestingId(id);
    startTransition(async () => {
      const res = await testTelegramProxyAction(id);
      if (res.success && res.data) {
        toast.success(res.data.success ? `Подключение OK: ${res.data.latencyMs}ms` : `Ошибка: ${res.data.error}`);
      } else {
        toast.error(res.error || 'Тест не удался');
      }
      setTestingId(null);
      loadProxies();
    });
  };

  const handleSetActive = (id: string | null) => {
    startTransition(async () => {
      const res = await setActiveTelegramProxyAction(id);
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { loadProxies(); onRefresh(); }
    });
  };

  const startEdit = (p: TelegramProxy) => {
    setEditingId(p.id);
    setForm({ label: p.label, protocol: p.protocol, host: p.host, port: String(p.port), username: p.username || '', password: '' });
  };

  const isEditing = editingId !== null;

  return (
    <div className="space-y-6">
      {/* Connection Info */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
          <span className="p-1 px-2.5 bg-indigo-500/10 text-indigo-400 rounded-md text-[10px] font-bold">PROXY</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Прокси-соединения</h3>
          <div className="ml-auto">
            <Button type="button" intent="secondary" size="sm" onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); }} className="font-bold text-xs h-8 gap-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Добавить
            </Button>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-muted/20 border border-border/60">
          <div className="flex items-center gap-2">
            {diagnostics?.proxy?.isActive ? (
              <><ShieldCheck className="w-4 h-4 text-emerald-400" /><span className="text-xs font-bold text-emerald-400">Прокси активен: {diagnostics.proxy.label}</span></>
            ) : (
              <><Server className="w-4 h-4 text-zinc-400" /><span className="text-xs font-bold text-zinc-400">Прямое подключение (без прокси)</span></>
            )}
          </div>
        </div>
      </Card>

      {/* Proxy List */}
      {proxies.length === 0 && !loading && (
        <Card className="rounded-2xl p-8 text-center">
          <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Прокси не настроены. Добавьте первый прокси-сервер.</p>
        </Card>
      )}

      {proxies.map(p => (
        <Card key={p.id} className={`rounded-2xl border overflow-hidden transition-colors ${p.isActive ? 'border-emerald-500/40' : 'border-border/80'}`}>
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground">{p.label}</h4>
                {p.isActive && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">ACTIVE</span>}
                <span className="text-[9px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{p.protocol}</span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground mt-1">{p.host}:{p.port}</p>
              <div className="flex items-center gap-3 mt-1.5">
                {p.lastTestAt && (
                  <span className={`text-[10px] font-mono ${p.lastTestSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {p.lastTestSuccess ? <><CheckCircle className="w-3 h-3 inline" /> {p.lastTestLatencyMs}ms</> : <><XCircle className="w-3 h-3 inline" /> Failed</>}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => handleTest(p.id)} disabled={testingId === p.id} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Тест">
                {testingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
              </button>
              {!p.isActive && (
                <button type="button" onClick={() => handleSetActive(p.id)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 cursor-pointer" title="Активировать">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              )}
              {p.isActive && (
                <button type="button" onClick={() => handleSetActive(null)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Деактивировать">
                  <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              )}
              <button type="button" onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Редактировать"><Edit3 className="w-3.5 h-3.5 text-blue-400" /></button>
              <button type="button" onClick={() => handleDelete(p.id, p.label)} className="p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer" title="Удалить"><Trash2 className="w-3.5 h-3.5 text-rose-400" /></button>
            </div>
          </div>
        </Card>
      ))}

      {/* Create / Edit Form */}
      {(showCreate || isEditing) && (
        <Card className="rounded-3xl border border-primary/30 shadow-lg bg-card p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{isEditing ? 'Редактировать прокси' : 'Новый прокси'}</h3>
            <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); setForm(EMPTY_FORM); }} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название *</Label>
              <Input value={form.label} onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))} placeholder="EU Proxy 1" maxLength={64} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Протокол</Label>
              <select value={form.protocol} onChange={(e) => setForm(p => ({ ...p, protocol: e.target.value as ProxyProtocol }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none">
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Хост *</Label>
              <Input value={form.host} onChange={(e) => setForm(p => ({ ...p, host: e.target.value }))} placeholder="proxy.example.com" className="font-mono text-xs" maxLength={253} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Порт *</Label>
              <Input type="number" min={1} max={65535} value={form.port} onChange={(e) => setForm(p => ({ ...p, port: e.target.value }))} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Имя пользователя</Label>
              <Input value={form.username} onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} placeholder="(опционально)" className="text-xs" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} placeholder={isEditing ? 'Оставьте пустым для сохранения текущего' : '(опционально)'} className="text-xs" autoComplete="new-password" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] text-amber-400/80 leading-relaxed">
              <b>Безопасность:</b> Пароли прокси шифруются AES-256-GCM через VaultService. Пароли никогда не возвращаются в API-ответах.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setEditingId(null); setForm(EMPTY_FORM); }} className="text-xs">Отмена</Button>
            <Button type="button" onClick={isEditing ? handleUpdate : handleCreate} disabled={isPending || !form.label || !form.host} className="font-bold text-xs gap-1.5 cursor-pointer">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isEditing ? 'Обновить' : 'Создать'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}