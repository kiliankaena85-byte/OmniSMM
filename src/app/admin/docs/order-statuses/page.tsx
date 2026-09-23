import * as React from 'react';
import Link from 'next/link';
import { 
  Package, 
  HelpCircle, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  XCircle, 
  PieChart, 
  RotateCcw, 
  Hourglass, 
  CreditCard, 
  RefreshCw, 
  ShieldAlert, 
  FileText, 
  Zap, 
  Info,
  Server,
  ArrowRight
} from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { ERROR_TAXONOMY } from '@/lib/order-error-classifier';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT', 'OPERATOR'];

interface StatusDoc {
  code: string;
  label: string;
  color: string;
  badgeBg: string;
  badgeDot: string;
  initiator: 'Клиент / Платежка' | 'Шлюз платформы' | 'Провайдер API' | 'Саппорт / Админ' | 'Саппорт / Админ / Клиент' | 'Автоматика / Демон';
  financeImpact: 'Списание' | 'Удержание' | 'Полный возврат' | 'Частичный возврат' | 'Без движения';
  description: string;
  supportAction: string;
  customerMessage: string;
}

const STATUS_DOCS: StatusDoc[] = [
  {
    code: 'AWAITING_PAYMENT',
    label: 'Ожидает оплаты',
    color: 'text-zinc-600 dark:text-zinc-400',
    badgeBg: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    badgeDot: 'bg-zinc-400',
    initiator: 'Клиент / Платежка',
    financeImpact: 'Без движения',
    description: 'Клиент создал заказ в корзине или чекауте, но еще не завершил оплату через шлюз (ЮKassa, Robokassa, CryptoBot).',
    supportAction: 'Никаких действий не требуется. Если клиент пишет, что оплатил, запросить квитанцию и проверить вкладку «Финансы».',
    customerMessage: 'Заказ ожидает поступления оплаты. После подтверждения шлюзом он автоматически будет запущен.',
  },
  {
    code: 'PENDING',
    label: 'В очереди',
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    badgeDot: 'bg-amber-500',
    initiator: 'Шлюз платформы',
    financeImpact: 'Списание',
    description: 'Оплата успешно списана с баланса. Заказ поставлен в очередь отправки BullMQ на передачу провайдеру.',
    supportAction: 'Обычно статус сменяется за несколько секунд. Если висит дольше 15 минут — проверить очередь заказов.',
    customerMessage: 'Оплата получена. Заказ находится в очереди на запуск у поставщика.',
  },
  {
    code: 'PENDING_CHECK',
    label: 'Проверка ссылки',
    color: 'text-sky-600 dark:text-sky-400',
    badgeBg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    badgeDot: 'bg-sky-500 animate-pulse',
    initiator: 'Автоматика / Демон',
    financeImpact: 'Удержание',
    description: 'Система проверяет валидность ссылки, доступность профиля соцсети (не закрыт ли аккаунт) и совместимость услуги.',
    supportAction: 'Если ссылка некорректна, система либо запросит исправление, либо переведет в CANCELED с возвратом.',
    customerMessage: 'Система проверяет корректность указанной ссылки и открытость аккаунта.',
  },
  {
    code: 'IN_PROGRESS',
    label: 'В работе',
    color: 'text-primary',
    badgeBg: 'bg-primary/10 text-primary border-primary/20',
    badgeDot: 'bg-primary animate-pulse',
    initiator: 'Провайдер API',
    financeImpact: 'Удержание',
    description: 'Заказ успешно принят внешним шлюзом провайдера, ему присвоен External ID, накрутка запущена.',
    supportAction: 'Контролировать время выполнения (ETA). Если заказ задерживается, сверить скорость провайдера.',
    customerMessage: 'Заказ успешно принят и выполняется. Скорость зависит от текущей нагрузки сети.',
  },
  {
    code: 'COMPLETED',
    label: 'Выполнен',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    badgeDot: 'bg-emerald-500',
    initiator: 'Провайдер API',
    financeImpact: 'Удержание',
    description: 'Заказ полностью и успешно выполнен в полном объеме (remains = 0).',
    supportAction: 'Услуга оказана в полном объеме. При жалобах на списания — проверить условия гарантии услуги.',
    customerMessage: 'Заказ успешно выполнен в полном объеме. Спасибо, что вы с нами!',
  },
  {
    code: 'PARTIAL',
    label: 'Частично выполнен',
    color: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
    badgeDot: 'bg-orange-500',
    initiator: 'Провайдер API',
    financeImpact: 'Частичный возврат',
    description: 'Провайдер выполнил только часть объема (например, 700 из 1000). За невыполненный остаток (300) средства мгновенно возвращены клиенту на баланс.',
    supportAction: 'Объяснить клиенту, что сумма за невыполненную часть уже автоматически зачислена обратно на его баланс.',
    customerMessage: 'Заказ выполнен частично. За невыполненный объем средства автоматически возвращены на ваш баланс.',
  },
  {
    code: 'CANCELED',
    label: 'Отменён (Штатно)',
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    badgeDot: 'bg-rose-500',
    initiator: 'Саппорт / Админ / Клиент',
    financeImpact: 'Полный возврат',
    description: 'Штатная бизнес-отмена. Заказ осознанно отменен человеком (клиентом, саппортом) или провайдером из-за некорректных входных данных (закрытый профиль, неверный формат ссылки).',
    supportAction: 'Указать клиенту причину (например: «Откройте профиль в настройках приватности и создайте заказ повторно»).',
    customerMessage: 'Заказ отменен. Все средства возвращены на ваш баланс. Проверьте ссылку и настройки профиля.',
  },
  {
    code: 'ERROR',
    label: 'Ошибка (Тех. сбой)',
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
    badgeDot: 'bg-red-500',
    initiator: 'Автоматика / Демон',
    financeImpact: 'Полный возврат',
    description: 'Авария на стороне шлюза или провайдера: у провайдера закончился баланс, отключена услуга, таймаут API 500/502. Средства возвращены клиенту, инженерам отправлен алерт.',
    supportAction: 'Проверить текст в поле «Комментарий провайдера». После пополнения баланса провайдера заказ можно перезапустить кнопкой «⟳ Перезапустить».',
    customerMessage: 'Произошел технический сбой на стороне шлюза. Средства возвращены на ваш баланс.',
  },
  {
    code: 'REFUNDING',
    label: 'В процессе возврата',
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    badgeDot: 'bg-purple-500',
    initiator: 'Шлюз платформы',
    financeImpact: 'Полный возврат',
    description: 'Транзитный статус финансового леджера во время проведения транзакции возврата средств на баланс пользователя.',
    supportAction: 'Никаких действий не требуется, статус завершается автоматически за миллисекунды.',
    customerMessage: 'Производится зачисление средств обратно на ваш баланс.',
  }
];

export default async function OrderStatusesDocPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect('/dashboard');

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-12">
      {/* Header with Navigation */}
      <AdminTabbedHeader
        icon={HelpCircle}
        title="Справочник статусов заказов"
        description="Официальный технический регламент жизненного цикла заказов, финансовых списаний и регламента техподдержки"
        breadcrumbs={[
          { label: 'Заказы', href: '/admin/orders' },
          { label: 'Справочник статусов' }
        ]}
        action={
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-foreground bg-card border border-border/70 shadow-xs rounded-lg hover:bg-muted hover:text-primary transition-colors h-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Вернуться к заказам
          </Link>
        }
      />

      {/* Hero Comparative Block: CANCELED vs ERROR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CANCELED CARD */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500/5 via-card to-card border border-rose-500/20 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                <XCircle className="w-4 h-4 text-rose-500" />
                CANCELED (Отменён)
              </span>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Штатная бизнес-отмена
              </span>
            </div>

            <h3 className="text-base font-bold text-foreground">
              Когда заказ отменен осознанно человеком или валидацией
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Инициатором выступает <strong>человек</strong> (клиент через чат, оператор саппорта) либо поставщик из-за некорректных параметров: <em>закрытый профиль, неверная ссылка, достигнут лимит накрутки</em>.
            </p>

            <div className="p-3 rounded-xl bg-card border border-border/60 text-xs space-y-1.5 font-sans">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                <span>Финансы: 100% возврат средств клиенту</span>
              </div>
              <div className="text-muted-foreground text-[11px]">
                Штрафные санкции и алерты разработчикам <strong>НЕ отправляются</strong>, шлюз работает исправно.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
            👉 <strong>Действие саппорта:</strong> объяснить клиенту причину отмены и помочь правильно оформить заказ.
          </div>
        </div>

        {/* ERROR CARD */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-red-500/5 via-card to-card border border-red-500/20 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20">
                <AlertOctagon className="w-4 h-4 text-red-500" />
                ERROR (Ошибка)
              </span>
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                Техническая авария шлюза
              </span>
            </div>

            <h3 className="text-base font-bold text-foreground">
              Когда произошел сбой интеграции, API или баланса провайдера
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Инициатором выступает <strong>автоматика</strong> платформы: у поставщика кончился баланс (`Provider balance low`), таймаут API 502/504, провайдер удалил ID услуги из своего каталога.
            </p>

            <div className="p-3 rounded-xl bg-card border border-border/60 text-xs space-y-1.5 font-sans">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Финансы: 100% авто-возврат + Алерт инженерам</span>
              </div>
              <div className="text-muted-foreground text-[11px]">
                Система снижает рейтинг надежности шлюза и переключает на резервный провайдер (Circuit Breaker).
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
            👉 <strong>Действие саппорта:</strong> проверить детали провайдера и нажать <strong>«⟳ Перезапустить»</strong> после устранения аварии.
          </div>
        </div>
      </div>

      {/* Lifecycle Flow Visual Timeline */}
      <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span>Диаграмма жизненного цикла заказа</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col justify-between">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase font-bold">Шаг 1</div>
              <div className="font-bold text-foreground mt-0.5">Оплата</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                `AWAITING_PAYMENT`
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">Ожидание подтверждения шлюза</div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col justify-between">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase font-bold">Шаг 2</div>
              <div className="font-bold text-foreground mt-0.5">Очередь BullMQ</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                `PENDING` / `PENDING_CHECK`
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">Проверка ссылки и баланса</div>
          </div>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-between">
            <div>
              <div className="font-mono text-[10px] text-primary uppercase font-bold">Шаг 3</div>
              <div className="font-bold text-primary mt-0.5">Исполнение</div>
              <div className="text-[11px] text-primary/80 mt-1 font-semibold">
                `IN_PROGRESS`
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">Накрутка у поставщика (ETA)</div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
            <div>
              <div className="font-mono text-[10px] text-emerald-600 uppercase font-bold">Финал (Успех)</div>
              <div className="font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">Завершено</div>
              <div className="text-[11px] text-emerald-600/80 mt-1 font-semibold">
                `COMPLETED` / `PARTIAL`
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">100% или частичный возврат</div>
          </div>

          <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 flex flex-col justify-between">
            <div>
              <div className="font-mono text-[10px] text-rose-600 uppercase font-bold">Финал (Сброс)</div>
              <div className="font-bold text-rose-700 dark:text-rose-300 mt-0.5">Отмена / Сбой</div>
              <div className="text-[11px] text-rose-600/80 mt-1 font-semibold">
                `CANCELED` / `ERROR`
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">Полный возврат на баланс</div>
          </div>
        </div>
      </div>

      {/* Full Status Reference Table */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <h3 className="text-sm font-bold text-foreground">
            Полная таблица всех 9 статусов платформы
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Используйте эти регламенты при консультации клиентов в тикетах поддержки.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground select-none">
                <th className="py-3 px-4 w-[160px]">Статус</th>
                <th className="py-3 px-4 w-[140px]">Кто выставляет</th>
                <th className="py-3 px-4 w-[130px]">Баланс клиента</th>
                <th className="py-3 px-4 min-w-[240px]">Техническое описание</th>
                <th className="py-3 px-4 min-w-[260px]">Что отвечать клиенту</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {STATUS_DOCS.map((status) => (
                <tr key={status.code} className="hover:bg-muted/20 transition-colors">
                  {/* Status Badge */}
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${status.badgeBg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.badgeDot}`} />
                      {status.label}
                    </span>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1">
                      {status.code}
                    </div>
                  </td>

                  {/* Initiator */}
                  <td className="py-3.5 px-4 align-top text-foreground/80 font-medium whitespace-nowrap">
                    {status.initiator}
                  </td>

                  {/* Finance Impact */}
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      status.financeImpact === 'Списание' ? 'bg-primary/10 text-primary' :
                      status.financeImpact === 'Удержание' ? 'bg-amber-500/10 text-amber-600' :
                      status.financeImpact.includes('возврат') ? 'bg-emerald-500/10 text-emerald-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {status.financeImpact}
                    </span>
                  </td>

                  {/* Description & Support Action */}
                  <td className="py-3.5 px-4 align-top space-y-1.5">
                    <p className="text-foreground leading-snug">
                      {status.description}
                    </p>
                    <div className="text-[11px] text-primary/90 font-medium">
                      💡 {status.supportAction}
                    </div>
                  </td>

                  {/* Customer Message Template */}
                  <td className="py-3.5 px-4 align-top">
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-[11px] text-muted-foreground italic leading-relaxed">
                      «{status.customerMessage}»
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PROFESSIONAL ERROR TAXONOMY CATALOG ── */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Справочник кодов ошибок платформы и шлюзов (Error Codes Taxonomy)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Стандартизированные системные коды для быстрой классификации сбоев поставщиков, некорректных ссылок и сетевых таймаутов.
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground">
            {Object.keys(ERROR_TAXONOMY).length} системных кодов
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {Object.entries(ERROR_TAXONOMY).map(([code, item]) => (
            <div 
              key={code} 
              className="p-4 rounded-xl bg-muted/20 border border-border/60 hover:border-border transition-colors flex flex-col justify-between space-y-2.5"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${item.badgeBg} ${item.badgeText} ${item.badgeBorder}`}>
                    {code}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded bg-muted/60">
                    {item.category === 'LINK' ? '🔗 Ссылка / Клиент' :
                     item.category === 'PROVIDER' ? '🏢 Провайдер' :
                     item.category === 'GATEWAY' ? '🌐 Сеть / Шлюз' :
                     item.category === 'LIMIT' ? '📊 Лимит объема' :
                     item.category === 'PAYMENT' ? '💳 Платежи' : '⚙️ Система'}
                  </span>
                </div>

                <div className="text-xs font-bold text-foreground">
                  {item.titleRu}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {item.descriptionRu}
                </p>
              </div>

              <div className="pt-2 border-t border-border/40 text-[11px] text-primary font-medium">
                👉 <strong>Действие:</strong> {item.recommendedAction}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
