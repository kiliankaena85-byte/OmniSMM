/**
 * Generates contextual quick-prompt chips based on active admin pathname
 */
export function getRoutePromptChips(pathname: string): string[] {
  if (pathname.startsWith('/admin/providers')) {
    return [
      'Что такое зомби-услуги и как работает карантин цен?',
      'Как работает Cherry-Pick импорт?',
      'Что такое теневой каталог?',
      'Как настроить наценку?',
    ];
  }
  if (pathname.startsWith('/admin/finance')) {
    return [
      'Как настроить НДС 22% по 54-ФЗ?',
      'Как работает расчет в копейках BigInt?',
      'Как сверить баланс?',
    ];
  }
  if (pathname.startsWith('/admin/orders')) {
    return [
      'Как безопасно отменить заказ?',
      'Почему заказ в статусе ERROR?',
      'Что такое Drip-Feed Floor?',
    ];
  }
  if (pathname.startsWith('/admin/settings')) {
    return [
      'Как добавить сотрудника в команду?',
      'Где ввести персональный ключ Gemini?',
      'Как включить режим Sandbox?',
    ];
  }
  return [
    'Как устроен движок OmniSMM 1.0?',
    'Какие 4 режима окружения поддерживаются?',
    'Как устроена чистая архитектура?',
  ];
}
