'use client';

import { useActionState } from 'react';
import { createGuestTicketAction } from '@/actions/support/guest';
import { createOfflineTicketAction } from '@/actions/support/offline-ticket';
import { Send, Mail, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface GuestSupportOptionsProps {
  telegramBotUsername: string;
  supportEmail: string;
  defaultEmail?: string;
  defaultMessage?: string;
  defaultName?: string;
  isPaymentError?: boolean;
  serviceId?: string | null;
  errorText?: string | null;
  gateway?: string | null;
  quantity?: string | null;
  url?: string | null;
}

export function GuestSupportOptions({ 
  telegramBotUsername, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  supportEmail,
  defaultEmail,
  defaultMessage,
  defaultName,
  isPaymentError = false,
  serviceId = null,
  errorText = null,
  gateway = null,
  quantity = null,
  url = null
}: GuestSupportOptionsProps) {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const orderId = searchParams.get('orderId');
  const isFlux = searchParams.get('tenant') === 'flux' || searchParams.get('tenant') === 'smmflux';

  const [state, action, isPending] = useActionState(
        async (_prevState: unknown, formData: FormData) => {
      if (isPaymentError) {
        return await createOfflineTicketAction({
          serviceId,
          error: errorText || 'Неизвестная ошибка оплаты',
          gateway: gateway || 'yookassa',
          quantity,
          email: formData.get('email') as string,
          name: formData.get('name') as string,
          url,
          message: formData.get('message') as string,
          paymentId,
          orderId
        });
      }
      return await createGuestTicketAction(formData);
    },
    null
  );

  if (state?.success) {
    return (
      <Card className="max-w-2xl mx-auto p-12 flex flex-col items-center text-center gap-6 bg-card/80 backdrop-blur-xl border-border shadow-2xl rounded-[2.5rem]">
        <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center text-success shadow-inner">
          <Check size={48} strokeWidth={3} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-foreground">Запрос отправлен!</h2>
          <p className="text-muted-foreground font-medium max-w-sm">
            Мы получили ваше сообщение и ответим на указанный Email в ближайшее время.
          </p>
        </div>
        <Button 
          asChild 
          intent="secondary" 
          size="lg"
          className="mt-4 rounded-full px-12"
        >
          <Link href="/">Вернуться на главную</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl mx-auto items-start">
      {/* Telegram Option */}
      <Card className="p-8 bg-card border-border flex flex-col items-center text-center justify-center gap-8 transition-all hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 group rounded-[2.5rem] h-full">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center transition-transform group-hover:scale-110 duration-500">
          <Send size={48} className="text-primary" />
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-black text-foreground">Telegram Поддержка</h3>
          <p className="text-muted-foreground text-sm font-medium leading-relaxed">
            Самый быстрый способ получить помощь. Наш бот моментально перенаправит ваш вопрос живому оператору.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="flex h-2 w-2 rounded-full bg-success animate-pulse"></span>
            <span className="text-xs font-bold text-success uppercase tracking-widest">Операторы онлайн</span>
          </div>
        </div>
        <Button
          asChild
          intent="primary"
          size="lg"
          className={`w-full font-black shadow-md hover:-translate-y-0.5 h-14 text-base transition-all cursor-pointer ${
            isFlux
              ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_4px_20px_rgba(168,85,247,0.35)] rounded-full'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl'
          }`}
        >
          <a href={`https://t.me/${telegramBotUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2.5">
            <Send className="w-5 h-5" />
            <span>Написать в Telegram</span>
          </a>
        </Button>
      </Card>

      {/* Email Form Option */}
      <Card className="p-8 bg-card/90 backdrop-blur-2xl border-border/80 flex flex-col gap-8 rounded-[2.5rem] h-full shadow-[0_15px_40px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground">Email Запрос</h3>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Ответ в течение 24 часов</p>
          </div>
        </div>

        <form action={action} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="support-guest-name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Ваше Имя</label>
            <Input
              id="support-guest-name"
              name="name"
              placeholder="Иван Иванов"
              defaultValue={defaultName}
              required
              className="h-12 px-4 rounded-xl border-border bg-background focus:ring-primary/20 text-foreground"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="support-guest-email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Ваш Email</label>
            <Input
              id="support-guest-email"
              type="email"
              name="email"
              placeholder="name@example.com"
              defaultValue={defaultEmail}
              required
              className="h-12 px-4 rounded-xl border-border bg-background focus:ring-primary/20 text-foreground"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="support-guest-message" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Суть обращения</label>
            <Textarea
              id="support-guest-message"
              name="message"
              placeholder="Опишите вашу проблему, укажите ссылку на соцсеть или детали транзакции..."
              defaultValue={defaultMessage}
              required
              rows={4}
              className="p-4 rounded-xl border-border bg-background focus:ring-primary/20 text-foreground resize-none"
            />
          </div>

          {state?.error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-bold animate-shake">
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            intent="primary"
            size="lg"
            disabled={isPending}
            className={`w-full h-14 font-black shadow-md hover:-translate-y-0.5 text-base transition-all cursor-pointer ${
              isFlux
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_4px_20px_rgba(168,85,247,0.35)] rounded-full'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl'
            }`}
          >
            {isPending ? 'Отправка...' : 'Отправить сообщение'}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center px-4 mt-3">
            Отправляя форму, вы соглашаетесь с{' '}
            <Link href="/legal/privacy" className="text-primary hover:underline">
              Политикой конфиденциальности
            </Link>{' '}
            и{' '}
            <Link href="/legal/terms" className="text-primary hover:underline">
              Пользовательским соглашением
            </Link>
            .
          </p>
        </form>
      </Card>
    </div>
  );
}
