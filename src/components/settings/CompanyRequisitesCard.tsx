'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateTaxRequisitesAction } from '@/actions/user/settings-extra';
import { Building2, Save, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';

export interface CompanyRequisitesCardProps {
  initialData?: {
    companyName?: string | null;
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    legalAddress?: string | null;
  };
}

export default function CompanyRequisitesCard({ initialData }: CompanyRequisitesCardProps) {
  const [isPending, startTransition] = useTransition();

  const [companyName, setCompanyName] = useState(initialData?.companyName || '');
  const [inn, setInn] = useState(initialData?.inn || '');
  const [kpp, setKpp] = useState(initialData?.kpp || '');
  const [ogrn, setOgrn] = useState(initialData?.ogrn || '');
  const [legalAddress, setLegalAddress] = useState(initialData?.legalAddress || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInn = inn.trim();
    if (trimmedInn && !/^\d{10}$|^\d{12}$/.test(trimmedInn)) {
      toast.error('ИНН должен состоять из 10 цифр (для организаций) или 12 цифр (для ИП)');
      return;
    }

    const trimmedKpp = kpp.trim();
    if (trimmedKpp && !/^\d{9}$/.test(trimmedKpp)) {
      toast.error('КПП должен состоять из 9 цифр');
      return;
    }

    const trimmedOgrn = ogrn.trim();
    if (trimmedOgrn && !/^\d{13}$|^\d{15}$/.test(trimmedOgrn)) {
      toast.error('ОГРН должен состоять из 13 цифр (для организаций) или 15 цифр ОГРНИП (для ИП)');
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateTaxRequisitesAction({
          companyName,
          inn,
          kpp,
          ogrn,
          legalAddress,
        });

        if (!res.success) {
          toast.error(res.error || 'Ошибка при сохранении реквизитов');
          return;
        }

        toast.success('Реквизиты компании успешно сохранены!');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
        toast.error(`Ошибка при сохранении: ${msg}`);
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 bg-muted/20">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-sm">
            Реквизиты организации и налоговые данные
          </h2>
          <p className="text-[10px] text-muted-foreground">
            Данные юрлица / ИП для автоматического формирования счетов, актов и УПД (152-ФЗ / 54-ФЗ)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-3 space-y-1">
            <label htmlFor="companyName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Название компании / ФИО ИП (companyName)
            </label>
            <input
              id="companyName"
              type="text"
              placeholder="ООО «Вектор» или ИП Иванов И.И."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="inn" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              ИНН (inn) — 10 или 12 цифр
            </label>
            <input
              id="inn"
              type="text"
              maxLength={12}
              placeholder="7701234567"
              value={inn}
              onChange={(e) => setInn(e.target.value.replace(/\D/g, ''))}
              className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="kpp" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              КПП (kpp) — 9 цифр
            </label>
            <input
              id="kpp"
              type="text"
              maxLength={9}
              placeholder="770101001"
              value={kpp}
              onChange={(e) => setKpp(e.target.value.replace(/\D/g, ''))}
              className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ogrn" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              ОГРН / ОГРНИП — 13 или 15 цифр
            </label>
            <input
              id="ogrn"
              type="text"
              maxLength={15}
              placeholder="1027700132195"
              value={ogrn}
              onChange={(e) => setOgrn(e.target.value.replace(/\D/g, ''))}
              className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200 font-mono"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 space-y-1">
            <label htmlFor="legalAddress" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Юридический адрес (legalAddress)
            </label>
            <textarea
              id="legalAddress"
              rows={2}
              placeholder="127000, г. Москва, ул. Тверская, д. 1, оф. 10"
              value={legalAddress}
              onChange={(e) => setLegalAddress(e.target.value)}
              className="w-full text-base sm:text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200 resize-none"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-3 border-t border-border/40 gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-success shrink-0" />
            <span>Автоматически используется при генерации безналичных счетов и закрывающих документов</span>
          </div>
          <Button
            type="submit"
            intent="primary"
            size="sm"
            isAnimated={true}
            disabled={isPending}
            className="rounded-xl shrink-0 font-semibold px-6 shadow-sm gap-2"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Сохранение...' : 'Сохранить реквизиты'}
          </Button>
        </div>
      </form>
    </div>
  );
}
