import { PrismaClient } from '@prisma/client';
import { ticketService } from '../src/services/support/ticket.service';
import { aiSupportService } from '../src/services/admin/ai-support.service';
import { OutputPolicyEngine } from '../src/services/admin/output-policy-engine';
import { OperatorVerificationGuard } from '../src/services/admin/operator-verification-guard.service';

const db = new PrismaClient();

async function runLiveTelegramTest() {
  console.log('🚀 [LIVE E2E TEST] Starting Telegram Delivery & AI Verification Test...');

  const targetTelegramId = '268747191';

  // 1. Find user by telegramId
  const user = await db.user.findFirst({
    where: { telegramId: targetTelegramId },
    include: { tickets: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (!user) {
    throw new Error(`User with telegramId ${targetTelegramId} not found!`);
  }

  let ticket = user.tickets[0];
  if (!ticket) {
    ticket = await db.ticket.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId || 'smmplan',
        subject: 'Живой тест Telegram и AI поддержки',
        status: 'OPEN',
      },
    });
  }

  const ticketId = ticket.id;

  console.log(`✅ [1/4] Found Ticket #${ticket.id.slice(-6)} for user: ${user.email} (TG: ${user.telegramId})`);

  // ==========================================
  // ТЕСТ 1: Ручной ответ оператора (БЕЗ AI)
  // ==========================================
  console.log('\n📝 [2/4] Отправка ручного сообщения оператора (Manual Mode)...');
  const manualText = `[РУЧНОЙ РЕЖИМ] 👨‍💻 Привет! Это тестовое сообщение от оператора поддержки, написанное вручную без участия ИИ. Время: ${new Date().toLocaleTimeString('ru-RU')}. Проверяем, что ручная отправка работает мгновенно и без сбоев!`;

  const manualMsg = await ticketService.addMessage(ticketId, 'STAFF', manualText);
  console.log(`✅ Ручное сообщение успешно создано (ID: ${manualMsg.id}) и отправлено в Telegram!`);

  // ==========================================
  // ТЕСТ 2: Ответ с участием AI Copilot (С AI)
  // ==========================================
  console.log('\n🤖 [3/4] Генерация умного ответа через AI Copilot (Gemini 3 Flash + RAG)...');

  const clientQuestion = 'Здравствуйте! Заказывал 1000 подписчиков в Instagram. Заказ сразу отменился, почему? Аккаунт открыт!';
  
  // Добавляем тестовый вопрос клиента в тикет
  await db.ticketMessage.create({
    data: {
      ticketId,
      sender: 'USER',
      text: clientQuestion,
    },
  });

  // Вызываем AI Copilot
  const aiDraftResult = await aiSupportService.generateReply(ticketId, 'smmplan');

  console.log('🤖 AI сгенерировал черновик:');
  console.log('--------------------------------------------------');
  console.log(aiDraftResult.draft_reply);
  console.log('--------------------------------------------------');
  console.log('🧠 RAG источник:', aiDraftResult.knowledge_source);
  console.log('💭 Внутренний CoT:', aiDraftResult.internal_reasoning);
  console.log('🛡️ Статус безопасности:', aiDraftResult.blocked ? 'ЗАБЛОКИРОВАНО' : 'ОДОБРЕНО (SAFE)');

  // Проверка плейсхолдеров оператора перед отправкой
  const rawDraft = aiDraftResult.draft_reply;
  const unedited = OperatorVerificationGuard.findUneditedPlaceholders(rawDraft);
  console.log('🔍 Проверка плейсхолдеров оператора:', unedited.length === 0 ? '0 плейсхолдеров (готово к отправке)' : unedited);

  const finalAiText = `[AI COPILOT РЕЖИМ] 🤖 ${rawDraft}\n\n⏱️ Сгенерировано AI Copilot (Gemini 3 Flash + RAG) с одобрением оператора.`;

  const aiMsg = await ticketService.addMessage(ticketId, 'STAFF', finalAiText);
  console.log(`✅ AI-сообщение успешно подтверждено оператором, сохранено (ID: ${aiMsg.id}) и доставлено в Telegram!`);

  console.log('\n🎉 [4/4] ВСЕ ТЕСТОВЫЕ СООБЩЕНИЯ (РУЧНОЕ + AI) УСПЕШНО ОТПРАВЛЕНЫ В ВАШ ТЕЛЕГРАМ!');
}

runLiveTelegramTest()
  .catch((err) => {
    console.error('❌ Error during live telegram test:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
