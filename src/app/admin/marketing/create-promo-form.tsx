'use client';

import * as React from 'react';
import { useState, useRef, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createPromoCode } from '@/actions/admin/marketing';
import { toast } from 'sonner';
import { Plus, Shuffle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreatePromoFormProps {
  onSuccess: () => void;
}

export function CreatePromoForm({ onSuccess }: CreatePromoFormProps) {
  const generateRandomCodeString = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<string>("DISCOUNT");
  const [codeValue, setCodeValue] = useState<string>(() => generateRandomCodeString());
  const [isPending, startTransition] = useTransition();

  const generateRandomCode = () => {
    setCodeValue(generateRandomCodeString());
  };

  async function action(formData: FormData) {
    formData.set('code', codeValue);
    startTransition(async () => {
      const res = await createPromoCode(formData);
      if (res.success) {
        toast.success('Промокод успешно создан');
        setCodeValue("");
        formRef.current?.reset();
        onSuccess();
      } else {
        toast.error(res.error || 'Ошибка при создании промокода');
      }
    });
  }

  return (
    <form action={action} ref={formRef} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Код (до 12 символов)</Label>
        <div className="flex gap-2">
          <Input 
            name="code" 
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
            placeholder="WELCOME2026" 
            required 
            maxLength={12}
            disabled={isPending}
            className="uppercase font-mono tracking-widest text-foreground bg-muted/60 border-border flex-grow focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" 
          />
          <button 
            type="button" 
            onClick={generateRandomCode}
            disabled={isPending}
            className="w-[44px] h-[44px] flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95 disabled:opacity-50"
            title="Сгенерировать случайный код"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Тип бонуса</Label>
        <Select name="type" defaultValue="DISCOUNT" onValueChange={(v) => v && setType(v)} disabled={isPending}>
          <SelectTrigger className="w-full bg-muted/60 border-border text-foreground h-[44px]">
            <SelectValue placeholder="Выберите тип">
              {(value: string) => {
                const items = [
                  { value: "DISCOUNT", label: "Скидка (%)" },
                  { value: "VOUCHER", label: "Пополнение (₽)" },
                ];
                return items.find(i => i.value === value)?.label ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="DISCOUNT" label="Скидка (%)">Скидка (%)</SelectItem>
            <SelectItem value="VOUCHER" label="Пополнение (₽)">Пополнение (₽)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {type === 'DISCOUNT' && (
          <div className="animate-fade-in space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Процент (%)</Label>
            <Input name="discountPercent" type="number" placeholder="10" defaultValue="0" required disabled={isPending} className="bg-muted/60 font-mono tracking-widest border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
          </div>
        )}
        
        {type === 'VOUCHER' && (
          <div className="animate-fade-in space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Сумма (₽)</Label>
            <Input name="amount" type="number" placeholder="500" defaultValue="0" required disabled={isPending} className="bg-muted/60 font-mono tracking-widest border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Лимит активаций</Label>
        <Input name="maxUses" type="number" defaultValue="100" required disabled={isPending} className="bg-muted/60 font-mono tracking-widest border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Срок годности</Label>
        <Input name="expiresAt" type="datetime-local" disabled={isPending} className="bg-muted/60 text-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Описание (цель кампании)</Label>
        <Input name="description" placeholder="Рекламная интеграция у Блогера X" disabled={isPending} className="bg-muted/60 border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-extrabold">UTM Source</Label>
          <Input name="utmSource" placeholder="telegram" disabled={isPending} className="bg-muted/60 text-xs border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-extrabold">UTM Medium</Label>
          <Input name="utmMedium" placeholder="cpc" disabled={isPending} className="bg-muted/60 text-xs border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-extrabold">UTM Campaign</Label>
          <Input name="utmCampaign" placeholder="march_promo" disabled={isPending} className="bg-muted/60 text-xs border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Бюджет кампании (₽)</Label>
        <Input name="budget" type="number" step="0.01" placeholder="5000" defaultValue="0" required disabled={isPending} className="bg-muted/60 font-mono tracking-widest border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Фрод-изоляция (Подозрительный)</Label>
        <Select name="isSuspicious" defaultValue="false" disabled={isPending}>
          <SelectTrigger className="w-full bg-muted/60 border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]">
            <SelectValue placeholder="Выберите статус">
              {(value: string) => value === "true" ? "Да (Подозрительный)" : "Нет (Обычный)"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="false" label="Нет (Обычный)">Нет (Обычный)</SelectItem>
            <SelectItem value="true" label="Да (Подозрительный)">Да (Подозрительный)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={isPending} className="w-full shadow-md font-bold uppercase tracking-wider text-xs bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-95 h-[44px]">
        {isPending ? 'Создание...' : 'Создать промокод'}
      </Button>
    </form>
  );
}

export function CreatePromoModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex items-center gap-1.5 px-4 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all rounded-xl shadow-sm cursor-pointer h-[44px]">
        <Plus className="w-4 h-4" />
        Создать
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto bg-card border-border/80">
        <DialogHeader>
          <DialogTitle className="text-foreground font-bold text-lg">Новый промокод</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <CreatePromoForm onSuccess={handleSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
