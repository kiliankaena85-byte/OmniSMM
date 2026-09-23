import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FormData } from './types';
import type { ProxyCategory, ProxyProtocol } from '@/types/provider-proxy';
import { GEO_OPTIONS } from '@/types/provider-proxy';

interface ProxyFormCardProps {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  isEditing: boolean;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function ProxyFormCard({
  form,
  setForm,
  isEditing,
  isPending,
  onSave,
  onCancel,
}: ProxyFormCardProps) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || form.tags.includes(t)) return;
    if (form.tags.length >= 10) {
      toast.error('Максимум 10 тегов');
      return;
    }
    setForm((prev) => ({ ...prev, tags: [...prev.tags, t] }));
    setTagInput('');
  };

  return (
    <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          {isEditing ? 'Редактировать прокси-сервер' : 'Добавить прокси вручную'}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название *</Label>
          <Input value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Quattro SOCKS5 #1" className="text-xs" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Категория</Label>
          <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ProxyCategory }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium">
            <option value="PAID_PREMIUM">💎 Платный Premium</option>
            <option value="FREE_PUBLIC">🌿 Бесплатный пул</option>
            <option value="BACKUP_RESERVE">🛡️ Резервный канал</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Протокол</Label>
          <select value={form.protocol} onChange={(e) => setForm((prev) => ({ ...prev, protocol: e.target.value as ProxyProtocol }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium">
            <option value="socks5">SOCKS5</option>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Гео</Label>
          <select value={form.geoCountry} onChange={(e) => setForm((prev) => ({ ...prev, geoCountry: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium">
            <option value="">Не указано</option>
            {GEO_OPTIONS.map((g) => (<option key={g.value} value={g.value}>{g.label}</option>))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Хост / IP *</Label>
          <Input value={form.host} onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))} placeholder="127.0.0.1" className="font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Порт *</Label>
          <Input value={form.port} onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value }))} className="font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Срок действия</Label>
          <Input type="date" value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} className="text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Логин (опц.)</Label>
          <Input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} className="text-xs" autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль (опц.)</Label>
          <Input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder={isEditing ? 'Оставьте пустым для сохранения' : ''} className="text-xs" autoComplete="new-password" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Теги</Label>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Новый тег и Enter" className="text-xs flex-1" maxLength={32} />
          <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()} className="text-xs">+</Button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[10px] font-mono bg-muted/60 text-foreground px-2 py-1 rounded-lg border border-border">
                #{t}
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, tags: prev.tags.filter((x) => x !== t) }))} className="text-rose-500 hover:text-rose-400 cursor-pointer">x</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-xs">Отмена</Button>
        <Button type="button" onClick={onSave} disabled={isPending || !form.label || !form.host} className="font-bold text-xs gap-1.5 cursor-pointer">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isEditing ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </Card>
  );
}
