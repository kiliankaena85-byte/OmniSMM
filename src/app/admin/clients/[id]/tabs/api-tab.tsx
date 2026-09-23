'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateUserApiAction } from '@/actions/admin/users';
import { Building2 } from 'lucide-react';
import { UserDTO } from './types';

interface ApiTabProps {
  user: UserDTO;
}

export function ApiTab({ user }: ApiTabProps) {
  // API fields
  const [isApiEnabled, setIsApi] = useState(user.apiConfig?.isApiEnabled ?? Boolean(user.inn));
  const [prioritySupport, setPrioritySupport] = useState(
    user.apiConfig?.prioritySupport ?? false
  );
  const [companyName, setCompanyName] = useState(user.companyName ?? '');
  const [inn, setInn] = useState(user.inn ?? '');
  const [kpp, setKpp] = useState(user.kpp ?? '');
  const [legalAddress, setLegalAddress] = useState(user.legalAddress ?? '');
  const [webhookUrl, setWebhookUrl] = useState(user.apiConfig?.webhookUrl ?? '');
  const [isPendingApi, startApiTransition] = useTransition();

  // Helper for API save
  const handleApiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startApiTransition(async () => {
      const fd = new FormData();
      fd.append('userId', user.id);
      fd.append('isApiEnabled', isApiEnabled ? 'true' : 'false');
      fd.append('prioritySupport', prioritySupport ? 'true' : 'false');
      fd.append('companyName', companyName);
      fd.append('inn', inn);
      fd.append('kpp', kpp);
      fd.append('legalAddress', legalAddress);
      fd.append('webhookUrl', webhookUrl);

      const res = await updateUserApiAction(fd);
      if (res.success) {
        toast.success(res.message || 'API реквизиты обновлены');
      } else {
        toast.error(res.error || 'Ошибка при сохранении API данных');
      }
    });
  };

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
          <span className="bg-primary/10 text-primary p-1 rounded-md">
            <Building2 className="w-3.5 h-3.5" />
          </span>
          API-Конфигурация & Юридические реквизиты
        </h3>
        {isApiEnabled && (
          <span className="px-2.5 py-0.5 bg-warning/15 text-warning-text border border-warning/30 rounded-full text-xs font-black uppercase">
            API Партнер
          </span>
        )}
      </div>

      <form onSubmit={handleApiSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 p-3 bg-background/60 border border-border/60 rounded-xl">
            <input
              type="checkbox"
              id="isApiEnabledToggle"
              checked={isApiEnabled}
              onChange={e => setIsApi(e.target.checked)}
              className="w-4 h-4 text-primary rounded cursor-pointer"
            />
            <label
              htmlFor="isApiEnabledToggle"
              className="text-xs font-bold text-foreground cursor-pointer select-none"
            >
              Активировать API-профиль
            </label>
          </div>

          <div className="flex items-center gap-2.5 p-3 bg-background/60 border border-border/60 rounded-xl">
            <input
              type="checkbox"
              id="prioritySupportToggle"
              checked={prioritySupport}
              onChange={e => setPrioritySupport(e.target.checked)}
              className="w-4 h-4 text-primary rounded cursor-pointer"
            />
            <label
              htmlFor="prioritySupportToggle"
              className="text-xs font-bold text-foreground cursor-pointer select-none"
            >
              Приоритетная линия (Priority Support)
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              Название организации / ИП
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="ООO «Компания» или ИП Иванов И.И."
              className="w-full h-9 text-xs px-3 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              ИНН (10 или 12 цифр)
            </label>
            <input
              type="text"
              value={inn}
              onChange={e => setInn(e.target.value)}
              placeholder="7701234567"
              className="w-full h-9 text-xs font-mono px-3 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              КПП (для юрлиц)
            </label>
            <input
              type="text"
              value={kpp}
              onChange={e => setKpp(e.target.value)}
              placeholder="770101001"
              className="w-full h-9 text-xs font-mono px-3 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              Webhook URL для уведомлений
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://api.domain.ru/webhook"
              className="w-full h-9 text-xs font-mono px-3 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
            Юридический адрес
          </label>
          <input
            type="text"
            value={legalAddress}
            onChange={e => setLegalAddress(e.target.value)}
            placeholder="119021, г. Москва, ул. Льва Толстого, д. 16"
            className="w-full h-9 text-xs px-3 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isPendingApi}
          className="px-5 h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isPendingApi ? 'Сохранение...' : 'Сохранить API-реквизиты'}
        </button>
      </form>
    </div>
  );
}
