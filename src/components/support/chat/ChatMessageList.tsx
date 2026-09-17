import type { ChatInputOrder } from './ChatInput';
// audit-disable STR-002
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, MessageSquare } from 'lucide-react';
import { ClientDate } from '@/components/ui/client-date';
import { Message } from './useChatMessages';
import { ImageZoomModal } from './ImageZoomModal';
import { toast } from 'sonner';

// Deterministic gradient picker for avatars based on string hash
const getAvatarGradient = (str: string) => {
  const gradients = [
    'from-destructive to-warning',
    'from-success to-info',
    'from-primary to-info',
    'from-info to-primary',
    'from-destructive to-primary',
    'from-info to-success',
    'from-warning to-primary',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

const getInitials = (sender: string, email?: string) => {
  if (sender === 'USER') {
    if (email) {
      const parts = email.split('@')[0];
      return parts.substring(0, 2).toUpperCase();
    }
    return 'CL';
  }
  if (sender === 'INTERNAL') return '🔒';
  return 'OP';
};

const formatChatDateDivider = (dateStr: string | Date) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Сегодня';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

const isDifferentChatDay = (d1Str?: string | Date, d2Str?: string | Date) => {
  if (!d1Str || !d2Str) return true;
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return d1.toDateString() !== d2.toDateString();
};

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

  // Auto-scroll on new messages
  useEffect(() => {
    // U1.3 Fix: Delay scrollIntoView for iOS keyboard layout recalc
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
              className="px-4 h-11 text-xs font-bold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/25 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
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
                {/* ── Telegram-style Sticky Date Divider ── */}
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
                <div
                  className={`flex ${
                    isMyMessage ? 'justify-end' : 'justify-start'
                  } items-end mb-4 gap-3`}
                >
                  {showAvatar && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground font-extrabold text-[11px] tracking-wider shadow-sm bg-gradient-to-br ${avatarGradient} shrink-0`}
                      title={avatarTitle}
                    >
                      {avatarInitial}
                    </div>
                  )}
                  <div
                    className={`group relative max-w-[75%] p-3.5 shadow-xs transition-all duration-300 ${
                      msg.isDeleted
                        ? 'bg-default-100 text-default-400 opacity-80 rounded-[14px]'
                        : isMyMessage
                        ? 'bg-primary text-primary-foreground rounded-tl-[16px] rounded-tr-[16px] rounded-bl-[16px] rounded-br-[3px]'
                        : msg.sender === 'INTERNAL'
                        ? 'bg-warning/10 text-warning-text border border-warning/30 rounded-tl-[16px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[3px]'
                        : 'bg-card text-foreground border border-border/80 rounded-tl-[16px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[3px]'
                    } ${
                      msg.id.startsWith('temp-')
                        ? 'opacity-60 saturate-50 animate-pulse'
                        : ''
                    }`}
                  >
                    {/* Telegram Bubble Tail */}
                    {!msg.isDeleted &&
                      (!isMyMessage ? (
                        <div className="absolute left-[-5px] bottom-0 w-[5px] h-3.5 pointer-events-none select-none">
                          <svg
                            width="5"
                            height="14"
                            viewBox="0 0 5 14"
                            className={msg.sender === 'INTERNAL' ? 'text-warning/10' : 'text-card'}
                          >
                            <path
                              d="M5 14 L0 14 C1.5 13 3.5 9 5 0 Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="absolute right-[-5px] bottom-0 w-[5px] h-3.5 pointer-events-none select-none">
                          <svg
                            width="5"
                            height="14"
                            viewBox="0 0 5 14"
                            className="text-primary"
                          >
                            <path
                              d="M0 14 L5 14 C3.5 13 1.5 9 0 0 Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      ))}

                    {/* Actions hover */}
                    {!msg.isDeleted && editingMessageId !== msg.id && (
                      <div
                        className={`absolute ${
                          isMyMessage ? '-left-10' : '-right-10'
                        } top-1/2 -translate-y-1/2 hidden lg:flex opacity-0 lg:group-hover:opacity-100 gap-1 transition-opacity z-10`}
                      >
                        <button
                          onClick={() => onSetReplyingTo(msg)}
                          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary rounded-full bg-card/90 backdrop-blur-xs shadow-xs border border-border/80 cursor-pointer transition-colors"
                          title="Ответить"
                          aria-label="Ответить"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="9 17 4 12 9 7"></polyline>
                            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                          </svg>
                        </button>

                        {editTicketMessage && msg.sender !== 'USER' && (
                          isExpired ? (
                            <div
                              className="w-7 h-7 flex items-center justify-center text-muted-foreground/50 rounded-full bg-card/90 backdrop-blur-xs shadow-xs border border-border/80 cursor-not-allowed"
                              title="Заблокировано Telegram API (>48ч)"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                              </svg>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditingText(msg.text);
                              }}
                              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-warning-text rounded-full bg-card/90 backdrop-blur-xs shadow-xs border border-border/80 cursor-pointer transition-colors"
                              title="Редактировать"
                              aria-label="Редактировать"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                              </svg>
                            </button>
                          )
                        )}

                        {deleteTicketMessage && msg.sender !== 'USER' && (
                          <button
                            onClick={() => {
                              if (window.confirm('Удалить это сообщение из чата и Telegram?')) {
                                handleDeleteSubmit(msg.id);
                              }
                            }}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-full bg-card/90 backdrop-blur-xs shadow-xs border border-border/80 cursor-pointer transition-colors"
                            title="Удалить сообщение"
                            aria-label="Удалить сообщение"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reply Quote */}
                    {!msg.isDeleted && msg.replyTo && (
                      <div
                        className={`mb-2 p-2 rounded-lg border-l-2 text-xs ${
                          msg.sender === 'STAFF'
                            ? 'bg-foreground/10 border-primary-foreground/40 text-primary-foreground'
                            : 'bg-default-100 border-primary/50 text-foreground'
                        }`}
                      >
                        <div className="font-bold opacity-70 mb-0.5">
                          {msg.replyTo.sender}
                        </div>
                        <div className="opacity-80 line-clamp-2">
                          {msg.replyTo.text || 'Медиа сообщение'}
                        </div>
                      </div>
                    )}

                    {/* Order Context Attachment Card */}
                    {!msg.isDeleted && msg.order && (
                      <div
                        className={`mb-3 rounded-xl p-3 flex flex-col gap-2 max-w-sm border-0 shadow-xs transition-all duration-200 ${
                          msg.sender === 'USER'
                            ? 'bg-default-100 text-foreground'
                            : msg.sender === 'INTERNAL'
                            ? 'bg-warning/10 text-warning-text'
                            : 'bg-info/10 text-foreground'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${
                              msg.sender === 'USER'
                                ? 'bg-primary/10 text-primary'
                                : msg.sender === 'INTERNAL'
                                ? 'bg-warning/25 text-warning-text'
                                : 'bg-secondary-foreground/10 text-secondary-foreground'
                            }`}
                          >
                            📦
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-[11px] leading-none">
                                Заказ #{msg.order.numericId}
                              </span>
                              <span
                                className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  msg.order.status === 'COMPLETED'
                                    ? 'bg-success/15 text-success-text'
                                    : msg.order.status === 'IN_PROGRESS'
                                    ? 'bg-primary/15 text-primary'
                                    : msg.order.status === 'PENDING'
                                    ? 'bg-warning/15 text-warning-text'
                                    : msg.order.status === 'AWAITING_PAYMENT'
                                    ? 'bg-warning/15 text-warning-text'
                                    : 'bg-default-200/50 text-muted-foreground'
                                }`}
                              >
                                {msg.order.status === 'COMPLETED'
                                  ? 'Выполнен'
                                  : msg.order.status === 'IN_PROGRESS'
                                  ? 'Выполняется'
                                  : msg.order.status === 'PENDING'
                                  ? 'В очереди'
                                  : msg.order.status === 'AWAITING_PAYMENT'
                                  ? 'Ожидает оплаты'
                                  : msg.order.status}
                              </span>
                            </div>
                            <p className="text-[10px] opacity-80 mt-1 truncate leading-tight font-medium">
                              {msg.order.serviceName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-dashed border-current/10 pt-2.5 mt-1.5 gap-4">
                          <div className="text-xs font-bold opacity-90 leading-none">
                            {(Number(msg.order.charge) / 100).toFixed(2)} ₽
                          </div>

                          {isStaff && onSelectOrder ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (msg.order) onSelectOrder(msg.order as unknown as ChatInputOrder);
                              }}
                              className={`text-[11px] font-black px-3 h-11 rounded-xl transition-all duration-200 flex items-center justify-center gap-0.5 shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98] border-0 ${
                                msg.sender === 'USER'
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                  : msg.sender === 'INTERNAL'
                                  ? 'bg-warning-text text-primary-foreground hover:bg-warning-text/90'
                                  : 'bg-card text-foreground hover:bg-card/90'
                              }`}
                            >
                              Перейти к заказу ➔
                            </button>
                          ) : isStaff ? (
                            <a
                              href={`/admin/orders?edit_order_id=${msg.order.id}`}
                              className={`text-[11px] font-black px-3 h-11 rounded-xl transition-all duration-200 flex items-center justify-center gap-0.5 shadow-xs hover:scale-[1.02] active:scale-[0.98] border-0 ${
                                msg.sender === 'USER'
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                  : msg.sender === 'INTERNAL'
                                  ? 'bg-warning-text text-primary-foreground hover:bg-warning-text/90'
                                  : 'bg-card text-foreground hover:bg-card/90'
                              }`}
                            >
                              Перейти к заказу ➔
                            </a>
                          ) : (
                            <a
                              href={`/dashboard/orders/${msg.order.id}`}
                              className={`text-[11px] font-black px-3 h-11 rounded-xl transition-all duration-200 flex items-center justify-center gap-0.5 shadow-xs hover:scale-[1.02] active:scale-[0.98] border-0 ${
                                msg.sender === 'USER'
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                  : 'bg-card text-foreground hover:bg-card/90'
                              }`}
                            >
                              Перейти к заказу ➔
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Media preview */}
                    {!msg.isDeleted && msg.mediaUrl === 'uploading...' && (
                      <div className="w-full h-32 bg-primary/10 animate-pulse rounded-xl mb-2 flex items-center justify-center border border-primary/20">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    )}

                    {!msg.isDeleted &&
                      msg.mediaUrl !== 'uploading...' &&
                      (() => {
                        const filesToRender =
                          msg.attachments && msg.attachments.length > 0
                            ? msg.attachments
                            : msg.mediaUrl
                            ? [
                                {
                                  id: msg.id,
                                  url: msg.mediaUrl,
                                  type: msg.mediaType || 'document',
                                  name: 'Вложение',
                                  mimeType: '',
                                  createdAt: msg.createdAt,
                                },
                              ]
                            : [];

                        if (filesToRender.length === 0) return null;

                        if (filesToRender.length === 1) {
                          const file = filesToRender[0];
                          if (file.type === 'image') {
                            return (
                              <div className="relative group/att mb-2 inline-block max-w-full">
                                <img
                                  src={`/api/media/${encodeURIComponent(file.url)}`}
                                  alt={file.name || "Файл"}
                                  onClick={() => setZoomedImage(file.url)}
                                  className="rounded-xl max-h-60 cursor-zoom-in border border-default-200 hover:opacity-90 transition-all duration-200 object-cover"
                                />
                                <div
                                  className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-sm text-foreground text-[10px] px-2 py-1 rounded-md opacity-0 group-hover/att:opacity-100 transition-opacity duration-200 truncate"
                                  title={file.name || "Файл"}
                                >
                                  {file.name || "Файл"}
                                </div>
                              </div>
                            );
                          }
                          if (file.type === 'video') {
                            return (
                              <div className="relative group/att mb-2 w-full max-w-[320px]">
                                <video
                                  src={`/api/media/${encodeURIComponent(file.url)}`}
                                  controls
                                  className="rounded-xl max-h-60 border border-default-200 w-full object-cover"
                                />
                                <div
                                  className="text-[10px] text-muted-foreground mt-1 truncate"
                                  title={file.name || "Файл"}
                                >
                                  {file.name || "Файл"}
                                </div>
                              </div>
                            );
                          }
                          if (file.type === 'audio') {
                            return (
                              <div className="relative group/att mb-2 w-full max-w-[280px]">
                                <audio
                                  src={`/api/media/${encodeURIComponent(file.url)}`}
                                  controls
                                  className="w-full opacity-90 hover:opacity-100 transition-all"
                                />
                                <div
                                  className="text-[10px] text-muted-foreground mt-1 truncate"
                                  title={file.name || "Файл"}
                                >
                                  {file.name || "Файл"}
                                </div>
                              </div>
                            );
                          }
                          // Document
                          return (
                            <div className="flex items-center gap-2 bg-foreground/5 p-2.5 rounded-xl border border-border mb-2 max-w-sm">
                              <div className="text-2xl drop-shadow-sm shrink-0">📄</div>
                              <div
                                className="text-sm font-semibold truncate flex-1 leading-tight text-foreground/90 min-w-0"
                                title={file.name || "Файл"}
                              >
                                {file.name || "Файл"}
                              </div>
                              <a
                                href={`/api/media/${encodeURIComponent(file.url)}`}
                                download={file.name || "Файл"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary text-[10px] font-bold px-2.5 py-1.5 bg-background shadow-sm border border-default-200 rounded-md hover:bg-default-50 transition-colors shrink-0"
                              >
                                Скачать
                              </a>
                            </div>
                          );
                        }

                        // Multiple attachments (Grid)
                        return (
                          <div className="grid grid-cols-2 gap-2 mb-2 w-full max-w-[480px]">
                            {filesToRender.map((file) => {
                              if (file.type === 'image') {
                                return (
                                  <div
                                    key={file.id}
                                    className="relative aspect-video rounded-xl overflow-hidden border border-default-200 group/att cursor-zoom-in"
                                    onClick={() => setZoomedImage(file.url)}
                                  >
                                    <img
                                      src={`/api/media/${encodeURIComponent(file.url)}`}
                                      alt={file.name || "Файл"}
                                      className="w-full h-full object-cover group-hover/att:scale-105 transition-transform duration-200"
                                    />
                                    <div
                                      className="absolute inset-x-0 bottom-0 bg-background/90 backdrop-blur-sm text-foreground text-[10px] px-2 py-1 opacity-0 group-hover/att:opacity-100 transition-opacity duration-200 truncate"
                                      title={file.name || "Файл"}
                                    >
                                      {file.name || "Файл"}
                                    </div>
                                  </div>
                                );
                              }
                              if (file.type === 'video') {
                                return (
                                  <div
                                    key={file.id}
                                    className="relative aspect-video rounded-xl overflow-hidden border border-default-200 w-full group/att"
                                  >
                                    <video
                                      src={`/api/media/${encodeURIComponent(file.url)}`}
                                      controls
                                      className="w-full h-full object-cover"
                                    />
                                    <div
                                      className="absolute inset-x-0 bottom-0 bg-background/90 backdrop-blur-sm text-foreground text-[10px] px-2 py-1 opacity-0 group-hover/att:opacity-100 transition-opacity duration-200 truncate"
                                      title={file.name || "Файл"}
                                    >
                                      {file.name || "Файл"}
                                    </div>
                                  </div>
                                );
                              }
                              if (file.type === 'audio') {
                                return (
                                  <div
                                    key={file.id}
                                    className="bg-foreground/5 p-2 rounded-xl border border-border flex flex-col justify-between h-full group/att min-w-0"
                                  >
                                    <audio
                                      src={`/api/media/${encodeURIComponent(file.url)}`}
                                      controls
                                      className="w-full opacity-90 hover:opacity-100 transition-all max-h-8 scale-90 origin-left"
                                    />
                                    <div
                                      className="text-[9px] text-muted-foreground truncate mt-1 min-w-0"
                                      title={file.name || "Файл"}
                                    >
                                      {file.name || "Файл"}
                                    </div>
                                  </div>
                                );
                              }
                              // Document
                              return (
                                <div
                                  key={file.id}
                                  className="flex items-center gap-2 bg-foreground/5 p-2 rounded-xl border border-border group/att min-w-0"
                                >
                                  <div className="text-xl drop-shadow-sm shrink-0">📄</div>
                                  <div
                                    className="text-[11px] font-semibold truncate flex-1 leading-tight text-foreground/90 min-w-0"
                                    title={file.name || "Файл"}
                                  >
                                    {file.name || "Файл"}
                                  </div>
                                  <a
                                    href={`/api/media/${encodeURIComponent(file.url)}`}
                                    download={file.name || "Файл"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary text-[9px] font-bold px-2.5 py-1 bg-background shadow-sm border border-default-200 rounded-md hover:bg-default-50 transition-colors shrink-0"
                                  >
                                    Скачать
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                    {msg.isDeleted ? (
                      <div className="italic text-sm">Удалено (Видно только стаффу)</div>
                    ) : editingMessageId === msg.id ? (
                      <div className="mt-2 animate-in fade-in zoom-in-95 duration-200">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full text-sm text-foreground bg-background border border-border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 min-h-[80px] leading-relaxed"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end mt-2">
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="text-[11px] font-bold uppercase bg-muted/50 text-muted-foreground px-4 h-11 rounded-xl border border-border hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditSubmit(msg.id)}
                            className="text-[11px] font-bold uppercase bg-primary text-primary-foreground px-4 h-11 rounded-xl hover:bg-primary/95 shadow-sm border border-primary flex items-center justify-center cursor-pointer transition-colors"
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap text-sm leading-[1.6] pr-14 pb-1 relative min-w-[50px] min-h-[1.25rem] text-inherit">
                          {msg.text}
                          <span className="absolute bottom-0 right-0 text-[10px] opacity-40 select-none flex items-center gap-1 font-medium text-inherit/80">
                            {msg.sender === 'INTERNAL' && (
                              <span title="Внутренняя заметка">🔒</span>
                            )}
                            {msg.isEdited && (
                              <span
                                title={msg.originalText || ''}
                                className="text-[8px] opacity-75"
                              >
                                изм.
                              </span>
                            )}
                            <span 
                              title={new Date(msg.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              className="cursor-default"
                            >
                              <ClientDate date={msg.createdAt} format="time" />
                            </span>
                            {msg.isHistorical && (
                              <span className="text-[8px] opacity-75">(Архив)</span>
                            )}
                            {isStaff && msg.telegramMsgId && !msg.telegramMsgId.startsWith('FAILED:') && (
                              <span 
                                title={`Доставлено в Telegram (ID: ${msg.telegramMsgId})`}
                                className="text-emerald-500 font-bold ml-0.5 cursor-help"
                              >
                                ✓✓
                              </span>
                            )}
                            {isStaff && msg.telegramMsgId?.startsWith('FAILED:') && (
                              <span 
                                title={`Сбой доставки в Telegram: ${msg.telegramMsgId.replace('FAILED:', '').trim()}`}
                                className="text-danger font-bold ml-0.5 cursor-help"
                              >
                                ⚠️
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Explicit visual alert for operators when Telegram delivery failed */}
                        {isStaff && msg.telegramMsgId?.startsWith('FAILED:') && (
                          <div className="mt-1.5 pt-1.5 border-t border-danger/25 flex items-start gap-1.5 text-[11px] text-danger font-medium leading-tight">
                            <span className="shrink-0 text-xs">⚠️</span>
                            <span>Не доставлено в Telegram: {msg.telegramMsgId.replace('FAILED:', '').trim()}</span>
                          </div>
                        )}

                        {/* Mobile Chat Actions Inline (under message text) */}
                        {!msg.isDeleted && editingMessageId !== msg.id && (
                          <div className="flex lg:hidden items-center gap-2 mt-2 pt-1 border-t border-current/10 text-[10px] font-bold opacity-60">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSetReplyingTo(msg);
                              }}
                              className="hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1 text-inherit"
                            >
                              Ответить
                            </button>
                            {editTicketMessage && msg.sender !== 'USER' && (
                              isExpired ? null : (
                                <>
                                  <span className="opacity-30">•</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditingMessageId(msg.id);
                                      setEditingText(msg.text);
                                    }}
                                    className="hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1 text-inherit"
                                  >
                                    Изменить
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
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
