'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { ticketService } from '@/services/support/ticket.service';
import { z } from 'zod';

const testEmailSchema = z.object({
  fromEmail: z.string().email('Некорректный email отправителя'),
  toEmail: z.string().optional(),
  subject: z.string().min(1, 'Тема письма обязательна'),
  textBody: z.string().min(1, 'Текст письма обязателен'),
  tenantId: z.string().optional(),
});

export type TestInboundEmailInput = z.infer<typeof testEmailSchema>;

export async function testInboundEmailAction(input: TestInboundEmailInput) {
  return requireStaffPermission('tickets', 'edit', async () => {
    const validation = testEmailSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0]?.message || 'Некорректные параметры'
      };
    }

    const { fromEmail, toEmail, subject, textBody, tenantId } = validation.data;

    const ticket = await ticketService.createInboundEmailTicket({
      fromEmail,
      toEmail: toEmail || (tenantId === 'flux' ? 'support@smmflux.ru' : 'support@smmplan.pro'),
      subject,
      text: textBody,
      tenantId: tenantId || 'smmplan'
    });

    return {
      success: true,
      ticketId: ticket.id,
      message: `Обращение #${ticket.id} успешно создано из тестового письма`
    };
  });
}
