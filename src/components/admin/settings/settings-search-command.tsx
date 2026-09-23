'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Store, 
  CreditCard, 
  TrendingUp, 
  Bot, 
  Server, 
  Users, 
  MessageSquare, 
  History, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  X 
} from 'lucide-react';
import Link from 'next/link';

export interface SettingsSearchItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tabHref: string;
  tags: string[];
  icon: React.ComponentType<{ className?: string }>;
}

// 🛡️ Zero-Secrets Search Registry: Contains only static metadata and UI descriptions
export const SETTINGS_SEARCH_INDEX: SettingsSearchItem[] = [
  // ── Группа: Магазин и Каталог ──
  {
    id: 'brand-name',
    title: 'Название магазина и логотип',
    category: 'Витрина',
    description: 'Название бренда, favicon, логотип и SEO-заголовок главной страницы',
    tabHref: '?tab=system',
    tags: ['бренд', 'логотип', 'фавикон', 'название', 'лого', 'seo', 'title', 'brand'],
    icon: Store,
  },
  {
    id: 'maintenance-mode',
    title: 'Режим технических работ',
    category: 'Витрина',
    description: 'Временное закрытие витрины для посетителей с отображением заглушки',
    tabHref: '?tab=system',
    tags: ['техработы', 'обслуживание', 'maintenance', 'закрыть магазин', 'пауза'],
    icon: ShieldCheck,
  },
  {
    id: 'legal-requisites',
    title: 'Юридические реквизиты (152-ФЗ)',
    category: 'Витрина',
    description: 'ИНН, ОГРНИП, юридическое лицо, email поддержки и контакты в футере',
    tabHref: '?tab=system',
    tags: ['инн', 'огрнип', '152-фз', 'реквизиты', 'оферта', 'контакты', 'юрист', 'налоги'],
    icon: Store,
  },
  {
    id: 'catalog-margin',
    title: 'Коэффициент наценки каталога',
    category: 'Каталог',
    description: 'Глобальный множитель наценки (x2.5, x3.0) и минимальный порог маржи',
    tabHref: '?tab=catalog',
    tags: ['наценка', 'маржа', 'множитель', 'прибыль', 'цена', 'каталог', 'margin', 'markup'],
    icon: TrendingUp,
  },
  {
    id: 'cbr-exchange-rate',
    title: 'Курс доллара ЦБ РФ (Live Sync)',
    category: 'Каталог',
    description: 'Синхронизация валютного курса доллара США для конвертации оптовых цен провайдеров',
    tabHref: '?tab=catalog',
    tags: ['курс', 'цб', 'доллар', 'usd', 'валюта', 'рубли', 'конвертация', 'cbr'],
    icon: TrendingUp,
  },
  {
    id: 'price-quarantine',
    title: 'Карантин скачков цен провайдеров',
    category: 'Каталог',
    description: 'Порог защиты от внезапного удорожания услуг у поставщиков (+20%, +50%)',
    tabHref: '?tab=catalog',
    tags: ['карантин', 'скачок цен', 'дрифт', 'защита', 'spike', 'удорожание'],
    icon: ShieldCheck,
  },

  // ── Группа: Платежи и Каналы ──
  {
    id: 'yookassa',
    title: 'ЮKassa (Банковские карты, СБП, Mir Pay)',
    category: 'Платежи',
    description: 'Shop ID, Секретный ключ API и фискализация чеков 54-ФЗ',
    tabHref: '?tab=integrations',
    tags: ['юкасса', 'yookassa', 'карты', 'сбп', 'эквайринг', 'касса', 'платежи', 'чеки'],
    icon: CreditCard,
  },
  {
    id: 'robokassa',
    title: 'Robokassa (Карты РФ, СНГ, Зарубежные)',
    category: 'Платежи',
    description: 'Логин мерчанта, пароли #1/#2 и фискализация с НДС 22%',
    tabHref: '?tab=integrations',
    tags: ['робокасса', 'robokassa', 'снг', 'зарубежные карты', 'эквайринг', 'платежи'],
    icon: CreditCard,
  },
  {
    id: 'cryptobot',
    title: 'CryptoBot (USDT, TON, BTC)',
    category: 'Платежи',
    description: 'Прием криптовалютных платежей в Telegram через @CryptoBot API',
    tabHref: '?tab=integrations',
    tags: ['крипта', 'crypto', 'usdt', 'ton', 'btc', 'cryptobot', 'криптовалюта'],
    icon: CreditCard,
  },
  {
    id: 'gemini-ai',
    title: 'Искусственный интеллект Gemini AI',
    category: 'Интеграции',
    description: 'API-ключи Google Gemini, Round-Robin пул и прокси-соединение для авто-ответов',
    tabHref: '?tab=integrations',
    tags: ['нейросеть', 'gemini', 'ии', 'ai', 'автоответы', 'ключи', 'прокси'],
    icon: Zap,
  },
  {
    id: 'email-smtp',
    title: 'Почтовый сервер (SMTP / Resend)',
    category: 'Интеграции',
    description: 'Настройки отправки квитанций, сброса паролей и уведомлений клиентам',
    tabHref: '?tab=integrations',
    tags: ['почта', 'email', 'smtp', 'resend', 'письма', 'уведомления'],
    icon: Bot,
  },
  {
    id: 'telegram-bot',
    title: 'Telegram Бот Поддержки',
    category: 'Каналы',
    description: 'Токен бота, вебхук, автоответчик тикетов и команды оператора',
    tabHref: '?tab=telegram',
    tags: ['телеграм', 'telegram', 'бот', 'bot', 'поддержка', 'тикеты', 'уведомления'],
    icon: Bot,
  },
  {
    id: 'provider-proxies',
    title: 'Прокси-серверы провайдеров API',
    category: 'Каналы',
    description: 'SOCKS5/HTTP прокси, пулы ротации и обход блокировок зарубежных поставщиков',
    tabHref: '?tab=proxy',
    tags: ['прокси', 'proxy', 'socks5', 'ротация', 'провайдеры', 'ip', 'подписки'],
    icon: Server,
  },

  // ── Группа: Команда и Безопасность ──
  {
    id: 'team-roles',
    title: 'Команда и Роли доступа (RBAC)',
    category: 'Безопасность',
    description: 'Назначение прав на просмотр и редактирование разделов для сотрудников',
    tabHref: '?tab=team',
    tags: ['сотрудники', 'роли', 'права', 'rbac', 'команда', 'доступ', 'персонал', 'admin'],
    icon: Users,
  },
  {
    id: 'support-limits',
    title: 'Дневные лимиты компенсаций саппорта',
    category: 'Безопасность',
    description: 'Максимальная сумма возвратов и бонусов (₽), которую саппорт может выдать за сутки',
    tabHref: '?tab=team',
    tags: ['лимиты', 'компенсации', 'возврат', 'саппорт', 'escrow', 'безопасность'],
    icon: ShieldCheck,
  },
  {
    id: 'support-templates',
    title: 'Шаблоны быстрых ответов поддержки',
    category: 'Поддержка',
    description: 'Заготовленные ответы по 152-ФЗ, задержкам, оплатам и шорткаты (/refill, /wait)',
    tabHref: '?tab=templates',
    tags: ['шаблоны', 'ответы', 'тикеты', 'шорткаты', 'саппорт', 'быстрый ответ'],
    icon: MessageSquare,
  },
  {
    id: 'audit-logs',
    title: 'Журнал аудита действий персонала',
    category: 'Безопасность',
    description: 'Неизменяемый реестр всех изменений цен, балансов, ролей и настроек системы',
    tabHref: '?tab=audit',
    tags: ['аудит', 'логи', 'журнал', 'история', 'кто изменил', 'безопасность', 'logs'],
    icon: History,
  },
];

export function SettingsSearchCommand() {
  const [query, setQuery] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return SETTINGS_SEARCH_INDEX.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }).slice(0, 6);
  }, [query]);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Поиск по настройкам (ЮKassa, НДС, Прокси...)"
          className="h-10 pl-9 pr-14 text-xs rounded-xl bg-card/80 border-border/80 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60 transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold text-muted-foreground bg-muted rounded border border-border/60">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-border/50 bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">
              Найдено параметров ({filteredItems.length})
            </span>
            <span className="text-[10px] text-muted-foreground font-medium px-2">
              Нажмите для перехода
            </span>
          </div>

          <div className="p-1.5 max-h-80 overflow-y-auto divide-y divide-border/30">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Ничего не найдено по запросу «{query}»
              </div>
            ) : (
              filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.tabHref}
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {item.title}
                        </span>
                        <Badge intent="outline" className="text-[9px] px-1.5 py-0 font-bold">
                          {item.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
