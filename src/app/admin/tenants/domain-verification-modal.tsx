'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  X, 
  ExternalLink,
  ShieldCheck,
  Info
} from 'lucide-react';
import { 
  getDomainVerificationAction, 
  verifyCustomDomainAction, 
  regenerateDomainVerificationTokenAction 
} from '@/actions/admin/tenants';
import type { TenantDomainMeta } from '@/services/tenant/domain-verification.service';

interface DomainVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  customDomain: string;
}

export function DomainVerificationModal({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  customDomain,
}: DomainVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [meta, setMeta] = useState<TenantDomainMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDomainVerificationAction(tenantId);
      if (res.success && res.data) {
        setMeta(res.data);
      } else {
        // If meta not yet generated, trigger verification action to auto-generate
        const verifyRes = await verifyCustomDomainAction(tenantId);
        if ('data' in verifyRes && verifyRes.data) {
          setMeta(verifyRes.data);
        }
      }
    } catch {
      setError('Не удалось загрузить данные верификации домена');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, tenantId]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await verifyCustomDomainAction(tenantId);
      if ('data' in res && res.data) {
        setMeta(res.data);
      }
      if (!res.success && res.error) {
        setError(res.error);
      }
    } catch {
      setError('Сбой сети при проверке DNS');
    } finally {
      setVerifying(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Вы действительно хотите перевыпустить токен проверки? Старая TXT-запись станет недействительной.')) {
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const res = await regenerateDomainVerificationTokenAction(tenantId);
      if (res.success && res.data) {
        setMeta(res.data);
      } else {
        setError(res.error || 'Ошибка перевыпуска токена');
      }
    } catch {
      setError('Сбой сети при перевыпуске токена');
    } finally {
      setRegenerating(false);
    }
  };

  const status = meta?.status || 'PENDING';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
      <div 
        className="w-full max-w-xl bg-card border border-border/80 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="domain-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Globe className="w-5 h-5" />
            </span>
            <div>
              <h3 id="domain-modal-title" className="text-base font-bold text-foreground">
                Настройка DNS & Верификация
              </h3>
              <p className="text-xs text-muted-foreground">
                Бренд: <strong className="text-foreground">{tenantName}</strong> ({tenantId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Status Alert Banner */}
          {status === 'VERIFIED' ? (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-sm block">Домен успешно верифицирован</span>
                <p className="text-xs opacity-90">
                  Домен <strong>{customDomain}</strong> подтверждён и подключён к динамическому роутингу OmniSMM.
                </p>
                {meta?.verifiedAt && (
                  <span className="text-[11px] opacity-75 block mt-1">
                    Подтвержден: {new Date(meta.verifiedAt).toLocaleString('ru-RU')}
                  </span>
                )}
              </div>
            </div>
          ) : status === 'FAILED' ? (
            <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-sm block">Ошибка проверки DNS</span>
                <p className="text-xs opacity-90">
                  {meta?.lastError || error || 'DNS-записи не найдены или указывают на сторонний сервер.'}
                </p>
                <span className="text-[11px] opacity-75 block mt-1">
                  Обновление DNS у провайдеров может занимать от 5 минут до 24 часов.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-3">
              <Clock className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-sm block">Ожидает добавления DNS-записей</span>
                <p className="text-xs opacity-90">
                  Добавьте одну из записей ниже в панели управления DNS вашего доменного регистратора (Cloudflare, Reg.ru, Beget и др.).
                </p>
              </div>
            </div>
          )}

          {error && status !== 'FAILED' && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* DNS Records Guide */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Необходимые DNS-записи
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Достаточно любой одной
              </span>
            </div>

            {/* Record 1: CNAME */}
            <div className="bg-secondary/40 border border-border/70 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary font-mono">
                    Вариант 1 (Рекомендуемый)
                  </span>
                  <span className="font-bold text-xs">CNAME запись</span>
                </div>
                <button
                  onClick={() => handleCopy(meta?.cnameTarget || 'smmplan.pro', 'cname')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  {copiedKey === 'cname' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Скопировать цель</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-background border border-border/60">
                  <span className="text-[10px] text-muted-foreground block font-sans">Тип</span>
                  <strong className="text-foreground">CNAME</strong>
                </div>
                <div className="p-2 rounded bg-background border border-border/60">
                  <span className="text-[10px] text-muted-foreground block font-sans">Имя / Хост</span>
                  <strong className="text-foreground">@</strong> (или поддомен)
                </div>
                <div className="p-2 rounded bg-background border border-border/60 truncate">
                  <span className="text-[10px] text-muted-foreground block font-sans">Значение / Цель</span>
                  <strong className="text-foreground">{meta?.cnameTarget || 'smmplan.pro'}</strong>
                </div>
              </div>
            </div>

            {/* Record 2: TXT */}
            <div className="bg-secondary/40 border border-border/70 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground font-mono">
                    Вариант 2 (Без CNAME)
                  </span>
                  <span className="font-bold text-xs">TXT Challenge токен</span>
                </div>
                <button
                  onClick={() => handleCopy(meta?.txtValue || '', 'txt')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  {copiedKey === 'txt' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Скопировать токен</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-background border border-border/60">
                  <span className="text-[10px] text-muted-foreground block font-sans">Тип</span>
                  <strong className="text-foreground">TXT</strong>
                </div>
                <div className="p-2 rounded bg-background border border-border/60 truncate">
                  <span className="text-[10px] text-muted-foreground block font-sans">Имя / Хост</span>
                  <strong className="text-foreground">{meta?.txtHost || `_omnismm-challenge.${customDomain}`}</strong>
                </div>
                <div className="p-2 rounded bg-background border border-border/60 truncate">
                  <span className="text-[10px] text-muted-foreground block font-sans">Значение</span>
                  <strong className="text-foreground">{meta?.txtValue || '—'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-border/60 flex items-center justify-between gap-3 bg-secondary/10">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating || verifying || loading}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            <span>Перевыпустить токен</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors cursor-pointer"
            >
              Закрыть
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || loading}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all active:scale-[0.98] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className={`w-4 h-4 ${verifying ? 'animate-pulse' : ''}`} />
              <span>{verifying ? 'Проверяем DNS...' : 'Проверить DNS сейчас'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
