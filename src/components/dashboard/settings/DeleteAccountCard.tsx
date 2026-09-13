'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { deleteAccountAction } from '@/actions/auth/delete-account';
import { ShieldAlert, Trash2, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteAccountCardProps {
  hasPassword: boolean;
}

export default function DeleteAccountCard({ hasPassword }: DeleteAccountCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  
  // Modal Form Fields
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => setShowPassword(!showPassword);

  const openModal = () => {
    setConfirmText('');
    setPassword('');
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();

    if (confirmText !== 'УДАЛИТЬ') {
      toast.error('Необходимо ввести слово "УДАЛИТЬ"');
      return;
    }

    if (hasPassword && !password) {
      toast.error('Пожалуйста, введите ваш пароль');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('confirmText', confirmText);
        if (password) {
          formData.append('password', password);
        }

        const res = await deleteAccountAction(null, formData);
        if (!res.success) {
          toast.error(res.error || 'Ошибка при удалении аккаунта');
          return;
        }

        toast.success('Аккаунт успешно удален. Прощайте!');
        // Redirect to homepage after a brief moment
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        toast.error('Произошла ошибка при отправке запроса');
      }
    });
  };

  return (
    <div className="bg-card border border-destructive/20 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md hover:border-destructive/40">
      <div className="px-5 py-4 border-b border-destructive/10 flex items-center gap-2.5 bg-destructive/5">
        <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
          <Trash2 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-semibold text-destructive text-sm">
            Опасная зона
          </h2>
          <p className="text-[10px] text-muted-foreground font-semibold">
            Действия по безвозвратному удалению вашего личного кабинета
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4 flex gap-3 text-xs text-destructive/85">
          <ShieldAlert className="w-5 h-5 shrink-0 text-destructive/90" />
          <div className="space-y-1.5">
            <p className="font-bold text-foreground">Внимание при удалении:</p>
            <p className="leading-relaxed">
              Удаление аккаунта приведет к мгновенному выходу со всех ваших устройств. 
              Вы больше не сможете войти, пополнить баланс или создавать новые заказы.
              Ваши исторические данные и транзакции сохраняются для бухгалтерии и аудита в соответствии с законодательством РФ.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground font-semibold max-w-[70%] leading-relaxed">
            Мы очень сожалеем, что вы уходите. Подтвердите удаление вашего аккаунта.
          </div>
          <Button
            type="button"
            intent="destructive"
            size="sm"
            isAnimated={true}
            onClick={openModal}
            className="rounded-xl shrink-0 w-full sm:w-auto font-black px-6 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150"
          >
            Удалить аккаунт
          </Button>
        </div>
      </div>

      {/* Premium Verification Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-content1 border border-border/80 rounded-[2rem] w-full max-w-md p-6 shadow-2xl space-y-5 animate-in scale-in duration-300 relative mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeModal}
              disabled={isPending}
              className="absolute right-5 top-5 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Подтвердите удаление</h3>
                <p className="text-[10px] text-muted-foreground font-semibold">Это действие необратимо</p>
              </div>
            </div>

            <form onSubmit={handleDelete} className="space-y-4">
              {/* Type confirmation block */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Введите слово <span className="text-destructive font-black">УДАЛИТЬ</span> для подтверждения
                </label>
                <input
                  type="text"
                  required
                  disabled={isPending}
                  placeholder="УДАЛИТЬ"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 bg-background/50 hover:bg-background/80 transition-all duration-200 font-bold tracking-wider"
                />
              </div>

              {/* Password verify block (if user has set a password) */}
              {hasPassword && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Введите ваш пароль
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={isPending}
                      placeholder="Ваш текущий пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-sm border border-border/80 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="flex-1 h-11 rounded-xl bg-content2 hover:bg-content3 text-foreground font-bold text-xs transition-all duration-200 border border-border/50 disabled:opacity-50"
                >
                  Отмена
                </button>
                
                <Button
                  type="submit"
                  intent="destructive"
                  size="sm"
                  disabled={isPending || confirmText !== 'УДАЛИТЬ' || (hasPassword && !password)}
                  className="flex-1 h-11 rounded-xl font-black text-xs hover:shadow-lg transition-all duration-200 shadow-sm"
                >
                  {isPending ? 'Удаление...' : 'Удалить аккаунт'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
