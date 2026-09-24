// audit-disable STR-002
import { useEffect, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateSmartReplyAction, prefetchSmartReplyAction, changeTicketStatus } from '@/actions/support/ticket';
import type { SupportTemplateDTO } from './ChatTemplateManager';
import { Message } from './useChatMessages';
import { OperatorVerificationGuard } from '@/services/admin/operator-verification-guard.service';

import { parseSmartTemplate } from './input/chat-template-parser';
import { useChatInputState } from './input/useChatInputState';
import { useChatTemplateNavigation } from './input/useChatTemplateNavigation';
import { ChatTemplatesDropdown } from './input/ChatTemplatesDropdown';
import { ChatOrdersDropdown } from './input/ChatOrdersDropdown';
import { ChatArticleSuggestion } from './input/ChatArticleSuggestion';
import { ChatTopToolbar } from './input/ChatTopToolbar';

export interface ChatInputOrder {
  id: string;
  numericId?: number;
  status: string;
  charge: number;
  serviceName?: string;
  link?: string;
  quantity?: number;
  createdAt?: string | Date;
  service?: {
    name: string;
  };
}

interface ChatInputProps {
  ticketId: string;
  isClosed: boolean;
  isStaff: boolean;
  clientEmail?: string;
  initialOrders: ChatInputOrder[];
  initialTemplates: SupportTemplateDTO[];
  messages: Message[];
  onSendMessage: (formData: FormData) => Promise<unknown>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
}

export function ChatInput({
  ticketId,
  isClosed,
  isStaff,
  clientEmail,
  initialOrders,
  initialTemplates,
  onSendMessage,
  setMessages,
  replyingTo,
  setReplyingTo,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [templatesList, setTemplatesList] = useState(initialTemplates);
  const [selectedOrder, setSelectedOrder] = useState<ChatInputOrder | null>(null);
  const [showOrdersDropdown, setShowOrdersDropdown] = useState(false);
  const [isAiPending, startAiTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial templates
  useEffect(() => {
    setTemplatesList(prev => {
      if (prev.length === initialTemplates.length &&
          prev.every((t, i) => t.id === initialTemplates[i]?.id && t.text === initialTemplates[i]?.text && t.label === initialTemplates[i]?.label)) {
        return prev;
      }
      return initialTemplates;
    });
  }, [initialTemplates]);

  // Hook for draft auto-saving, online/offline tracking & visualViewport
  const {
    isOnline,
    draftSavedAt,
    kbOffset,
    textareaRef,
    clearDraft,
  } = useChatInputState({
    ticketId,
    text,
    setText,
    sending,
  });

  // Pure template parsing with macro substitution
  const parseTemplate = (tmplText: string) => parseSmartTemplate(tmplText, {
    ticketId,
    clientEmail,
    selectedOrder,
    initialOrders,
  });

  // Hook for slash '/' autocomplete & keyboard navigation
  const {
    showTemplatesDropdown,
    setShowTemplatesDropdown,
    activeTemplateIndex,
    filteredTemplates,
    handleSelectTemplate,
    handleTextChange,
    handleKeyDown,
  } = useChatTemplateNavigation({
    text,
    setText,
    templatesList,
    isStaff,
    textareaRef,
    parseTemplateFn: parseTemplate,
  });

  // Background predictive prefetch for staff operators
  useEffect(() => {
    if (isStaff && ticketId) {
      prefetchSmartReplyAction(ticketId).catch(() => {});
    }
  }, [isStaff, ticketId]);

  // Drag and drop attachment handler
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        setFile(e.dataTransfer.files[0]);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, []);

  const handleAiReply = () => {
    startAiTransition(async () => {
      const res = await generateSmartReplyAction(ticketId);
      if (res.success && res.reply) {
        setText(res.reply);
        if (res.fromCache) {
          toast.success('AI ответ мгновенно загружен из кэша');
        } else {
          toast.success('AI ответ сгенерирован');
        }
      } else {
        toast.error('Ошибка AI: ' + res.error);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent, shouldCloseAfterSubmit: boolean = false) => {
    e.preventDefault();
    if (!isOnline) {
      toast.error('Отсутствует интернет-соединение. Черновик сохранен в браузере.');
      return;
    }
    if ((!text.trim() && !file) || sending) return;

    // Anti-Automation Bias: Block unedited placeholders
    if (isStaff) {
      const placeholders = OperatorVerificationGuard.findUneditedPlaceholders(text);
      if (placeholders.length > 0) {
        toast.error(`⛔ В тексте ответа остался блок для оператора: ${placeholders.join(', ')}. Отредактируйте текст перед отправкой!`);
        return;
      }
    }

    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      sender: isStaff ? (isInternal ? 'INTERNAL' : 'STAFF') : 'USER',
      text: text.trim(),
      createdAt: new Date().toISOString(),
      replyTo: replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        sender: replyingTo.sender,
      } : null,
      orderId: selectedOrder?.id || null,
      order: selectedOrder ? {
        id: selectedOrder.id,
        numericId: selectedOrder.numericId ?? 0,
        status: selectedOrder.status,
        charge: Number(selectedOrder.charge),
        createdAt: String(selectedOrder.createdAt || new Date().toISOString()),
        serviceName: selectedOrder.serviceName || selectedOrder.service?.name || '',
      } : null,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    if (file) {
      const uploadForm = new FormData();
      uploadForm.set('file', file);
      uploadForm.set('ticketId', ticketId);

      try {
        const res = await fetch('/api/support/upload', {
          method: 'POST',
          body: uploadForm,
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const data = await res.json();
          mediaUrl = data.mediaUrl;
          mediaType = data.mediaType;
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, mediaUrl, mediaType } : m));
        } else {
          toast.error('Ошибка загрузки файла');
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setSending(false);
          return;
        }
      } catch {
        toast.error('Ошибка загрузки файла');
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setSending(false);
        return;
      }
    }

    const formData = new FormData();
    formData.set('ticketId', ticketId);
    formData.set('message', text.trim());
    if (mediaUrl) formData.set('mediaUrl', mediaUrl);
    if (mediaType) formData.set('mediaType', mediaType);

    if (isStaff && isInternal) {
      formData.set('isInternal', 'true');
    }

    if (replyingTo) formData.set('replyToId', replyingTo.id);
    if (selectedOrder) formData.set('orderId', selectedOrder.id);

    clearDraft();
    setText('');
    setFile(null);
    setReplyingTo(null);
    setSelectedOrder(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await onSendMessage(formData);
      if (res && typeof res === 'object') {
        const resObj = res as { success?: boolean; error?: string; warning?: string };
        if (resObj.success === false) {
          throw new Error(resObj.error || 'Ошибка отправки сообщения');
        }
        if (resObj.warning) {
          toast.warning(resObj.warning, { duration: 8000 });
        }
      }

      if (shouldCloseAfterSubmit) {
        const statusFd = new FormData();
        statusFd.set('ticketId', ticketId);
        statusFd.set('status', 'CLOSED');
        await changeTicketStatus(statusFd);
        toast.success('Ответ отправлен, тикет решен и закрыт');
      }
    } catch (err: unknown) {
      console.error('[ChatInput] Send message failed:', err);
      const errMsg = (err as Error)?.message || 'Ошибка отправки сообщения';
      toast.error(errMsg);
      const failedText = formData.get('message') as string;
      if (failedText) {
        setText(failedText);
      }
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
    setSending(false);
  };

  if (isClosed) {
    return (
      <div className="p-6 bg-muted/20 border-t border-border flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground select-none shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground/60"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span>Тикет закрыт. Создайте новое обращение если нужна помощь.</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 border-t border-border transition-[bottom] duration-150 bg-card text-card-foreground relative shrink-0"
      style={{
        paddingBottom: kbOffset > 0 ? '0.5rem' : 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <ChatTemplatesDropdown
        show={showTemplatesDropdown}
        templates={filteredTemplates}
        activeIndex={activeTemplateIndex}
        onSelect={handleSelectTemplate}
      />

      <ChatTopToolbar
        isStaff={isStaff}
        templatesList={templatesList}
        setTemplatesList={setTemplatesList}
        onSelectTemplate={handleSelectTemplate}
        onAiReply={handleAiReply}
        isAiPending={isAiPending}
        isInternal={isInternal}
        setIsInternal={setIsInternal}
        onOpenStateChange={(isOpen) => {
          if (isOpen) setShowOrdersDropdown(false);
        }}
      />

      <div className="flex flex-col gap-2 w-full">
        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              key="reply-preview"
              initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="flex items-center justify-between bg-primary/10 border-l-4 border-primary px-3 py-1.5 rounded-lg mb-1"
            >
              <div>
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Ответ для {replyingTo.sender}</div>
                <div className="text-xs text-foreground/80 line-clamp-1">{replyingTo.text || 'Медиа сообщение'}</div>
              </div>
              <button type="button" onClick={() => setReplyingTo(null)} className="w-11 h-11 flex items-center justify-center text-primary/70 hover:text-primary font-bold ml-2 transition-colors cursor-pointer" aria-label="Отменить ответ">✕</button>
            </motion.div>
          )}
          {selectedOrder && (
            <motion.div 
              key="order-preview"
              initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="flex items-center justify-between bg-primary/10 border-l-4 border-primary px-3 py-1.5 rounded-lg mb-1 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold text-xs shrink-0">📦 Заказ #{selectedOrder.numericId}</span>
                <span className="text-xs text-foreground/80 line-clamp-1">— {selectedOrder.serviceName} ({selectedOrder.charge} ₽)</span>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="h-11 w-11 flex items-center justify-center p-1 text-primary/70 hover:text-primary font-bold ml-2 transition-colors cursor-pointer" aria-label="Удалить привязку заказа">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        <ChatArticleSuggestion text={text} isStaff={isStaff} />

        {/* Live Draft & Network Status Bar */}
        <div className="flex items-center justify-between px-1 text-[11px]">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <span className="flex items-center gap-1 text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                ⚠️ Оффлайн (нет сети) • Текст сохранен локально
              </span>
            ) : draftSavedAt ? (
              <span className="flex items-center gap-1 text-muted-foreground font-medium bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                💾 Черновик сохранен {draftSavedAt !== 'восстановлен' ? `в ${draftSavedAt}` : '(восстановлен)'}
              </span>
            ) : null}
          </div>
          {isStaff && (
            <span className="text-muted-foreground/60 text-[10px] hidden sm:inline">
              Ctrl+Enter — отправить • Ctrl+Shift+Enter — закрыть
            </span>
          )}
        </div>

        {/* Unified Input Card */}
        <div className="w-full bg-default-50 border border-border rounded-2xl flex flex-col focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm overflow-hidden">
          {file && (
            <div className="relative group shrink-0 ml-3 mt-2.5 mb-1 w-fit">
              <div className="w-14 h-14 rounded-xl bg-default-200 flex items-center justify-center overflow-hidden border border-border shadow-xs">
                {file.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">📄</span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setFile(null); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                aria-label="Удалить файл"
              >
                ✕
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={(e) => handleKeyDown(e, handleSubmit)}
            placeholder={isStaff ? "Введите ответ или выберите шаблон (напишите /)..." : "Опишите вашу проблему..."}
            className="w-full bg-transparent px-4 pt-3 pb-2 max-h-[280px] min-h-[56px] resize-none outline-none text-base md:text-sm text-foreground placeholder:text-muted-foreground/70 leading-relaxed font-sans scrollbar-thin"
            rows={1}
          />

          <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-default-100/40">
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-2.5 bg-background/80 hover:bg-background border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium cursor-pointer shadow-xs"
                title="Прикрепить файл (скриншот или PDF чек)"
                aria-label="Прикрепить файл (скриншот или PDF чек)"
              >
                <span className="text-sm">📎</span>
                <span className="hidden sm:inline text-[11px]">Файл</span>
              </button>

              <ChatOrdersDropdown
                show={showOrdersDropdown}
                orders={initialOrders}
                onSelectOrder={(order) => {
                  setSelectedOrder(order);
                  setShowOrdersDropdown(false);
                }}
                onToggle={() => setShowOrdersDropdown(!showOrdersDropdown)}
              />
            </div>

            <div className="flex items-center gap-2">
              {isStaff && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={(!text.trim() && !file) || sending}
                  className="h-9 px-3 bg-success/15 hover:bg-success/25 text-success-text border border-success/30 rounded-xl flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm font-bold text-xs cursor-pointer"
                  title="Отправить ответ и сразу закрыть тикет (Ctrl+Shift+Enter)"
                >
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="hidden sm:inline">Ответить и закрыть</span>
                </button>
              )}

              <button
                type="submit"
                disabled={(!text.trim() && !file) || sending}
                className="h-9 px-3.5 bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-sm font-bold text-xs cursor-pointer"
                title="Отправить сообщение (Ctrl+Enter)"
                aria-label="Отправить сообщение"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span className="hidden sm:inline">Отправить</span>
                    <Send className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
