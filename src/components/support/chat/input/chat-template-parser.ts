import type { ChatInputOrder } from '../ChatInput';

export interface ParseTemplateOptions {
  ticketId: string;
  clientEmail?: string;
  selectedOrder?: ChatInputOrder | null;
  initialOrders?: ChatInputOrder[];
  domain?: string;
}

export function parseSmartTemplate(templateText: string, options: ParseTemplateOptions): string {
  let result = templateText;
  const userNameVal = options.clientEmail ? options.clientEmail.split('@')[0] : 'Клиент';
  const domainVal = options.domain || (typeof window !== 'undefined' ? window.location.host : 'smmplan.pro');

  // Support aliases: {name}, {user_name}, {email}, {user_email}
  result = result.replace(/{user_name}/g, userNameVal);
  result = result.replace(/{name}/g, userNameVal);
  result = result.replace(/{user_email}/g, options.clientEmail || 'Клиент');
  result = result.replace(/{email}/g, options.clientEmail || 'Клиент');
  result = result.replace(/{domain}/g, domainVal);
  result = result.replace(/{ticket_id}/g, options.ticketId);

  const activeOrFallbackOrder = options.selectedOrder || (options.initialOrders && options.initialOrders.length > 0 ? options.initialOrders[0] : null);

  if (activeOrFallbackOrder) {
    const orderNumStr = String(activeOrFallbackOrder.numericId || activeOrFallbackOrder.id.slice(0, 8));
    result = result.replace(/{order_id}/g, orderNumStr);
    result = result.replace(/{orderId}/g, orderNumStr);
    result = result.replace(/{service_name}/g, activeOrFallbackOrder.serviceName || activeOrFallbackOrder.service?.name || 'услуге');

    let statusRu = activeOrFallbackOrder.status;
    if (activeOrFallbackOrder.status === 'COMPLETED') statusRu = 'Выполнен';
    else if (activeOrFallbackOrder.status === 'PROCESSING') statusRu = 'В работе';
    else if (activeOrFallbackOrder.status === 'IN_PROGRESS') statusRu = 'Выполняется';
    else if (activeOrFallbackOrder.status === 'PENDING') statusRu = 'В очереди';
    else if (activeOrFallbackOrder.status === 'CANCELED') statusRu = 'Отменен';
    else if (activeOrFallbackOrder.status === 'ERROR') statusRu = 'Ошибка';
    result = result.replace(/{order_status}/g, statusRu);
    result = result.replace(/{status}/g, statusRu);
  } else {
    result = result.replace(/{order_id}/g, 'указанному заказу');
    result = result.replace(/{orderId}/g, 'указанному заказу');
    result = result.replace(/{service_name}/g, 'выбранной услуге');
    result = result.replace(/{order_status}/g, 'обрабатывается');
    result = result.replace(/{status}/g, 'обрабатывается');
  }
  result = result.replace(/{current_date}/g, new Date().toLocaleDateString('ru-RU'));
  return result;
}
