import type { ChatInputOrder } from './ChatInput';
// audit-disable STR-002
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, MessageSquare } from 'lucide-react';
import { Message } from './useChatMessages';
import { ImageZoomModal } from './ImageZoomModal';
import { toast } from 'sonner';

import {
  getAvatarGradient,
  getInitials,
  formatChatDateDivider,
  isDifferentChatDay,
} from './messages/chat-message-utils';
import { ChatMessageBubble } from './messages/ChatMessageBubble';

interface ChatMessageListProps {
  messages: Message[];
  messageKeysRef: React.MutableRefObject<Record<string, string>>;
  clientEmail?: string;
  nextCursor: string | null;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onSetReplyingTo: (msg: Message) => void;
  editTicketMessage?: (formData: FormData) => Promise<{ success: boolean; error?: string } | void>;
  deleteTicketMessage?: (formData: FormData) => Promise<{ success: boolean; error?: string } | void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isStaff?: boolean;
  onSelectOrder?: (order: ChatInputOrder) => void;
}

export function ChatMessageList({
  messages,
  messageKeysRef,
  clientEmail,
  nextCursor,
  loadingOlder,
  onLoadOlder,
  onSetReplyingTo,
  editTicketMessage,
  deleteTicketMessage,
  setMessages,
  isStaff,
  onSelectOrder,
}: ChatMessageListProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Auto-scroll on new messages with iOS keyboard safe delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isFirstRender.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        isFirstRender.current = false;
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const handleEditSubmit = async (msgId: string) => {
    if (!editingText.trim() || !editTicketMessage) {
      return setEditingMessageId(null);
    }

    const originalText = messages.find(m => m.id === msgId)?.text || '';

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, text: editingText.trim() } : m))
    );
    setEditingMessageId(null);

    const fd = new FormData();
    fd.set('messageId', msgId);
    fd.set('newText', editingText);

    try {
      const res = (await editTicketMessage(fd)) as { success?: boolean; error?: string } | null | undefined;
      if (res && res.success === false) {
        throw new Error(res.error || 'Ошибка при сохранении сообщения на сервере');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Не удалось изменить сообщение';
      toast.error(errMsg);
      // Rollback to original text
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, text: originalText } : m))
      );
    }
  };

  const handleDeleteSubmit = async (msgId: string) => {
    if (!deleteTicketMessage) return;

    const originalMsg = messages.find(m => m.id === msgId);
    if (!originalMsg) return;

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isDeleted: true, text: '[Сообщение удалено]' } : m))
    );

    const fd = new FormData();
    fd.set('messageId', msgId);

    try {
      const res = (await deleteTicketMessage(fd)) as { success?: boolean; error?: string } | null | undefined;
      if (res && res.success === false) {
        throw new Error(res.error || 'Ошибка при удалении сообщения');
      }
      toast.success('Сообщение удалено из чата и Telegram');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Не удалось удалить сообщение';
      toast.error(errMsg);
      // Rollback
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? originalMsg : m))
      );
    }
  };

  return (
    <>
      <div className="telegram-chat-bg flex-1 min-h-0 overflow-y-auto p-4 space-y-4 relative">
        {nextCursor && (
          <div className="flex justify-center py-2 shrink-0">
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              aria-label="Загрузить предыдущие сообщения"
              className="px-4 h-11 text-xs font-bold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/25 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loadingOlder ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Загрузка...</span>
                </>
              ) : (
                <span>Загрузить предыдущие сообщения</span>
              )}
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const showSeparator =
              index > 0 && messages[index - 1].isHistorical && !msg.isHistorical;
            const isExpired =
              Date.now() - new Date(msg.createdAt).getTime() > 48 * 60 * 60 * 1000;

            const isMyMessage = isStaff ? msg.sender !== 'USER' : msg.sender === 'USER';
            const showAvatar = !isMyMessage;
            const avatarInitial = isStaff ? getInitials(msg.sender, clientEmail) : 'OP';
            const avatarGradient = isStaff ? getAvatarGradient(clientEmail || 'client') : 'from-blue-600 to-indigo-600';
            const avatarTitle = isStaff ? 'Клиент' : 'Поддержка';
            const isNewDay = index === 0 || isDifferentChatDay(messages[index - 1]?.createdAt, msg.createdAt);

            return (
              <motion.div
                key={messageKeysRef.current[msg.id] || msg.id}
                className="flex flex-col"
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {/* Telegram-style Sticky Date Divider */}
                {isNewDay && (
                  <div className="flex justify-center my-3 pointer-events-none select-none sticky top-2 z-10">
                    <span className="bg-card/90 backdrop-blur-md text-foreground/85 dark:text-foreground/95 text-[11px] font-bold px-3.5 py-1 rounded-full shadow-xs border border-border/70 tracking-wide">
                      {formatChatDateDivider(msg.createdAt)}
                    </span>
                  </div>
                )}

                {showSeparator && (
                  <div className="flex items-center justify-center my-6 opacity-50">
                    <div className="h-px bg-divider flex-1 max-w-[50px] mx-4"></div>
                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">
                      --- Диалог завершен ---
                    </span>
                    <div className="h-px bg-divider flex-1 max-w-[50px] mx-4"></div>
                  </div>
                )}

                {msg.isHistorical &&
                  (index === 0 ||
                    messages[index - 1].historicalTicketId !== msg.historicalTicketId) && (
                    <div className="text-center text-[10px] uppercase font-bold text-muted-foreground my-4 bg-default-100 rounded-full px-3 py-1 w-max mx-auto border border-default-200">
                      История: {msg.historicalSubject || 'Предыдущий тикет'}
                    </div>
                  )}

                <ChatMessageBubble
                  msg={msg}
                  isMyMessage={isMyMessage}
                  showAvatar={showAvatar}
                  avatarInitial={avatarInitial}
                  avatarGradient={avatarGradient}
                  avatarTitle={avatarTitle}
                  isExpired={isExpired}
                  editingMessageId={editingMessageId}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  onCancelEdit={() => setEditingMessageId(null)}
                  onSubmitEdit={handleEditSubmit}
                  onStartEdit={(m) => {
                    setEditingMessageId(m.id);
                    setEditingText(m.text);
                  }}
                  onDelete={handleDeleteSubmit}
                  onSetReplyingTo={onSetReplyingTo}
                  onSelectOrder={onSelectOrder}
                  onZoomImage={(url) => setZoomedImage(url)}
                  isStaff={isStaff}
                  canEdit={Boolean(editTicketMessage && msg.sender !== 'USER')}
                  canDelete={Boolean(deleteTicketMessage && msg.sender !== 'USER')}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full max-h-[400px]"
          >
            <div className="w-20 h-20 mb-6 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
              <MessageSquare className="w-10 h-10 text-primary opacity-80" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">
              Нет сообщений
            </h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
              Напишите ваш вопрос ниже. Мы отвечаем быстро и по делу.
            </p>
          </motion.div>
        )}
        <div ref={bottomRef} className="h-3 shrink-0" />
      </div>

      {zoomedImage && (
        <ImageZoomModal url={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </>
  );
}
