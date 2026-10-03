import { ActionArbiter, ActionIntentProposal } from './action-arbiter';

const arbiter = new ActionArbiter();

// 1. Предложение по навигации
const navProposal: ActionIntentProposal = {
  actionId: 'SETTINGS-NAV-ARCHITECTURE-2026',
  intent: 'Устранение дублирования навигации и визуального шума в панели /admin/settings',
  category: 'REFACTOR',
  context: {
    targetEnvironment: 'LOCAL',
    userIntentExplicit: true,
    hasBackup: true,
    activeGitDiffLines: 50,
  },
  options: [
    {
      id: 'OPT-NAV-FLAT',
      title: 'Вариант 1: Плоская навигация (Только AdminTabbedHeader)',
      description: 'Удалить SettingsClusterTabs, оставить плоскую полосу 9 табов в ряд из AdminTabbedHeader.',
      riskLevel: 'LOW',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 2,
    },
    {
      id: 'OPT-NAV-CLUSTER-ONLY',
      title: 'Вариант 2: Кластерная трехуровневая модель (Stripe/Shopify)',
      description: 'Удалить дублирующий SYSTEM_TABS из AdminTabbedHeader, сделать SettingsClusterTabs основным навигатором.',
      riskLevel: 'LOW',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 2,
    },
    {
      id: 'OPT-NAV-HYBRID-LINEAR',
      title: 'Вариант 3: Гибридная адаптивная навигация (Linear/Calm Design)',
      description: 'В AdminTabbedHeader оставить 3 корневых домена (Витрина, Интеграции, Команда), а подтабы показывать компактным контекстным Segmented Control внутри страницы.',
      riskLevel: 'LOW',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 3,
    },
  ],
};

// 2. Предложение по блокам онбординга и пульса (First Screen Estate)
const foldProposal: ActionIntentProposal = {
  actionId: 'SETTINGS-ABOVE-THE-FOLD-ESTATE-2026',
  intent: 'Освобождение полезной площади первого экрана от тяжелых виджетов онбординга и пульса',
  category: 'OPTIMIZATION',
  context: {
    targetEnvironment: 'LOCAL',
    userIntentExplicit: true,
    hasBackup: true,
    activeGitDiffLines: 30,
  },
  options: [
    {
      id: 'OPT-FOLD-SYSTEM-ONLY',
      title: 'Вариант 1: Изоляция виджетов только на вкладке ?tab=system',
      description: 'OnboardingReadinessBar и SystemHealthOverview отображаются строго на стартовой вкладке «Бренд и Витрина». На рабочих вкладках (Telegram, Прокси, Команда) сразу открывается рабочая форма.',
      riskLevel: 'LOW',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 1,
    },
    {
      id: 'OPT-FOLD-COLLAPSIBLE',
      title: 'Вариант 2: Компактный авто-схлопываемый статус-бар (h-9) с памятью',
      description: 'Блоки уменьшаются до 1 строки с возможностью разворачивания по клику, состояние свернутости сохраняется в localStorage.',
      riskLevel: 'LOW',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 2,
    },
    {
      id: 'OPT-FOLD-DRAWER',
      title: 'Вариант 3: Вынос пульса интеграций в выезжающий Drawer',
      description: 'Полное удаление SystemHealthOverview со страницы настроек с выносом в модальный Drawer/Command Palette.',
      riskLevel: 'MEDIUM',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 3,
    },
  ],
};

// 3. Предложение по асинхронности и гидратации
const asyncProposal: ActionIntentProposal = {
  actionId: 'SETTINGS-ASYNC-HEALTH-HYDRATION-2026',
  intent: 'Ликвидация гонки TypeError: Failed to fetch и React Hydration error #418',
  category: 'BUGFIX',
  context: {
    targetEnvironment: 'LOCAL',
    userIntentExplicit: true,
    hasBackup: true,
    activeGitDiffLines: 20,
  },
  options: [
    {
      id: 'OPT-ASYNC-RSC-PROPS',
      title: 'Вариант 1: Server Component Pre-fetch + AbortController',
      description: 'Начальные данные здоровья пингуются на сервере при SSR и передаются через пропсы, исключая скелетоны, а клиентский поллер снабжается AbortController.',
      riskLevel: 'LOW',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 2,
    },
    {
      id: 'OPT-ASYNC-CLIENT-GUARD',
      title: 'Вариант 2: Изолированный AbortController на клиенте',
      description: 'Добавить AbortController в useEffect и suppressHydrationWarning для даты без изменения SSR слоя.',
      riskLevel: 'LOW',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 1,
    },
  ],
};

const res1 = arbiter.decide(navProposal);
const res2 = arbiter.decide(foldProposal);
const res3 = arbiter.decide(asyncProposal);

console.log(JSON.stringify({ nav: res1, fold: res2, async: res3 }, null, 2));
