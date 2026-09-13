// audit-disable STR-002
import { useEffect, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateSmartReplyAction, prefetchSmartReplyAction, changeTicketStatus } from '@/actions/support/ticket';

import { Message } from './useChatMessages';
import { ChatTemplateManager, type SupportTemplateDTO } from './ChatTemplateManager';
import { incrementTemplateUsage } from '@/actions/support/template';
import { OperatorVerificationGuard } from '@/services/admin/operator-verification-guard.service';


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

  const [suggestedArticle, setSuggestedArticle] = useState<{ title: string; slug: string } | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
    const [filteredTemplates, setFilteredTemplates] = useState<SupportTemplateDTO[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [kbOffset, setKbOffset] = useState(0);

  // 1. Initial draft restore for this specific ticket
  useEffect(() => {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
      const saved = localStorage.getItem(`smmplan_draft_ticket_${ticketId}`);
      if (saved && saved.trim()) {
        setText(saved);
        setDraftSavedAt('восстановлен');
      }
    } catch (err) {
      void err;
    }
  }, [ticketId]);

  // 2. Draft auto-save on text change (isolated per ticketId)
  useEffect(() => {
    if (typeof window === 'undefined' || !ticketId) return;
    const timer = setTimeout(() => {
      try {
        if (text.trim().length > 0) {
          localStorage.setItem(`smmplan_draft_ticket_${ticketId}`, text);
          const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          setDraftSavedAt(timeStr);
        } else {
          localStorage.removeItem(`smmplan_draft_ticket_${ticketId}`);
          setDraftSavedAt(null);
        }
      } catch (err) {
        void err;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [text, ticketId]);

  // 2.1 Dynamic auto-resize of textarea for multi-line AI replies & templates
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const targetHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 44), 280);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [text]);

  // 3. Online/Offline network connection tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 4. Protection against accidental tab closure when drafting response
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (text.trim().length > 15 && !sending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [text, sending]);

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

  useEffect(() => {
    if (!window.visualViewport) return;
    const vp = window.visualViewport;
    const update = () => {
      const diff = window.innerHeight - vp.height;
      setKbOffset(diff > 0 ? diff : 0);
    };
    vp.addEventListener('resize', update);
    vp.addEventListener('scroll', update);
    update();
    return () => {
      vp.removeEventListener('resize', update);
      vp.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (isStaff) return;
    if (text.trim().length < 5) {
      setSuggestedArticle(null);
      return;
    }

    const timer = setTimeout(() => {
      const lower = text.toLowerCase();
      if (lower.includes("спис") || lower.includes("пропал") || lower.includes("упал") || lower.includes("улет")) {
        setSuggestedArticle({
          title: "Как алгоритмы Telegram выявляют ботов и почему списываются подписчики в 2026 году",
          slug: "how-telegram-detects-bots"
        });
      } else if (lower.includes("завис") || lower.includes("ошибк") || lower.includes("статус") || lower.includes("отмен")) {
        setSuggestedArticle({
          title: "Лимиты подписок и лайков в Instagram: Безопасные лимиты для продвижения",
          slug: "instagram-limits"
        });
      } else if (lower.includes("прокси") || lower.includes("proxy") || lower.includes("ip rep")) {
        setSuggestedArticle({
          title: "IPv4, IPv6 и мобильные прокси: Как выбор прокси влияет на живучесть аккаунтов",
          slug: "proxy-reputation"
        });
      } else if (lower.includes("рекоменд") || lower.includes("просмотр") || lower.includes("лайк") || lower.includes("реакц")) {
        setSuggestedArticle({
          title: "Как раскрутить Telegram-канал с нуля до 10 000 подписчиков без огромных бюджетов",
          slug: "telegram-grow-zero"
        });
      } else {
        setSuggestedArticle(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [text, isStaff]);



  useEffect(() => {
    setTemplatesList(prev => {
      if (prev.length === initialTemplates.length &&
          prev.every((t, i) => t.id === initialTemplates[i]?.id && t.text === initialTemplates[i]?.text && t.label === initialTemplates[i]?.label)) {
        return prev;
      }
      return initialTemplates;
    });
  }, [initialTemplates]);

  const parseSmartTemplate = (templateText: string) => {
    let result = templateText;
    const userNameVal = clientEmail ? clientEmail.split('@')[0] : 'Клиент';
    const domainVal = typeof window !== 'undefined' ? window.location.host : 'smmplan.pro';
    
    // Support aliases: {name}, {user_name}, {email}, {user_email}
    result = result.replace(/{user_name}/g, userNameVal);
    result = result.replace(/{name}/g, userNameVal);
    result = result.replace(/{user_email}/g, clientEmail || 'Клиент');
    result = result.replace(/{email}/g, clientEmail || 'Клиент');
    result = result.replace(/{domain}/g, domainVal);
    result = result.replace(/{ticket_id}/g, ticketId);
    
    const activeOrFallbackOrder = selectedOrder || (initialOrders && initialOrders.length > 0 ? initialOrders[0] : null);

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
  };

  const handleSelectTemplate = (t: { id: string; label: string; text: string }) => {
    const parsedText = parseSmartTemplate(t.text);
    const words = text.split(/\s+/);
    const lastWordIdx = words.findIndex((w, idx) => idx === words.length - 1 && w.startsWith('/'));
    
    if (lastWordIdx !== -1) {
      words[lastWordIdx] = parsedText;
      const newText = words.join(' ');
      setText(newText);
    } else {
      setText(parsedText);
    }
    
    setShowTemplatesDropdown(false);
    incrementTemplateUsage(t.id).catch(console.error);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      }
    }, 50);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }

    if (isStaff) {
      const words = val.split(/\s+/);
      const lastWord = words[words.length - 1];
      
      if (lastWord && lastWord.startsWith('/')) {
        const prefix = lastWord.slice(1).toLowerCase().trim();
        const filtered = templatesList.filter((t: SupportTemplateDTO) => {
          if (!prefix) return true; // show all on standalone "/"
          const matchShortcut = t.shortcut && t.shortcut.toLowerCase().includes(prefix);
          const matchLabel = t.label && t.label.toLowerCase().includes(prefix);
          const matchText = t.text && t.text.toLowerCase().includes(prefix);
          return matchShortcut || matchLabel || matchText;
        });
        
        if (filtered.length > 0) {
          setFilteredTemplates(filtered);
          setShowTemplatesDropdown(true);
          setActiveTemplateIndex(0);
        } else {
          setShowTemplatesDropdown(false);
        }
      } else {
        setShowTemplatesDropdown(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showTemplatesDropdown && filteredTemplates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveTemplateIndex((prev) => (prev + 1) % filteredTemplates.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveTemplateIndex((prev) => (prev - 1 + filteredTemplates.length) % filteredTemplates.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectTemplate(filteredTemplates[activeTemplateIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowTemplatesDropdown(false);
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey && isStaff) {
        handleSubmit(e as unknown as React.FormEvent, true);
      } else {
        handleSubmit(e as unknown as React.FormEvent, false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent, false);
    }
  };

  // Background predictive prefetch for staff operators
  useEffect(() => {
    if (isStaff && ticketId) {
      prefetchSmartReplyAction(ticketId).catch(() => {});
    }
  }, [isStaff, ticketId]);

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
        sender: replyingTo.sender
      } : null,
      orderId: selectedOrder?.id || null,
      order: selectedOrder ? {
        id: selectedOrder.id,
        numericId: selectedOrder.numericId ?? 0,
        status: selectedOrder.status,
        charge: Number(selectedOrder.charge),
        createdAt: String(selectedOrder.createdAt || new Date().toISOString()),
        serviceName: selectedOrder.serviceName || selectedOrder.service?.name || ''
      } : null
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
          body: uploadForm
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
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

    // Clear draft on successful initiation
    try {
      localStorage.removeItem(`smmplan_draft_ticket_${ticketId}`);
      setDraftSavedAt(null);
    } catch (err) {
      void err;
    }

    setText('');
    setFile(null);
    setReplyingTo(null);
    setSelectedOrder(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
            const res = await onSendMessage(formData);
      if (res && typeof res === 'object' && 'success' in res && (res as { success?: boolean }).success === false) {
        throw new Error((res as { error?: string }).error || 'Ошибка отправки сообщения');
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
      // Restore message text to input on failure so user doesn't lose what they typed
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
      <AnimatePresence>
        {showTemplatesDropdown && filteredTemplates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-3 mb-2 w-[calc(100%-1.5rem)] md:w-96 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-[90] overflow-hidden py-1.5 ring-1 ring-border/10"
          >
            <div className="px-3.5 py-1.5 border-b border-border/60 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
              <span>⚡ Быстрые шаблоны ответов ({filteredTemplates.length})</span>
              <span className="text-[9px] font-normal normal-case opacity-70">↑↓ навигация, Enter выбор</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-border/30">
              {filteredTemplates.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTemplate(t)}
                  className={`w-full text-left px-3.5 py-2.5 flex flex-col transition-all cursor-pointer ${
                    idx === activeTemplateIndex ? 'bg-primary/10 text-primary border-l-2 border-primary font-medium pl-3' : 'hover:bg-muted/40 text-foreground'
                  }`}
                >
                  <div className="flex justify-between items-center w-full gap-2">
                    <span className="text-xs font-bold truncate">{t.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.category && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground uppercase">
                          {t.category === 'LEGAL' ? '⚖️ 152-ФЗ' :
                           t.category === 'PAYMENT' ? '💳 Оплата' :
                           t.category === 'ORDER' ? '📦 Заказ' : '📋 Общие'}
                        </span>
                      )}
                      {t.shortcut && (
                        <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          /{t.shortcut}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate w-full mt-0.5 opacity-90">{t.text}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isStaff && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            <ChatTemplateManager 
              templatesList={templatesList}
              setTemplatesList={setTemplatesList}
              onSelectTemplate={handleSelectTemplate}
              onOpenStateChange={(isOpen) => {
                if (isOpen) setShowOrdersDropdown(false);
              }}
            />

            <button
              type="button"
              onClick={handleAiReply}
              disabled={isAiPending}
              className="flex items-center justify-center gap-1 px-3 h-11 text-xs font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all rounded-xl disabled:opacity-50 cursor-pointer"
              title="Автоматический ответ ИИ"
              aria-label="Автоматический ответ ИИ"
            >
              {isAiPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>AI Ответ</span>
            </button>
          </div>

          <label 
            aria-label="Внутренняя скрытая заметка"
            className="flex items-center gap-2 text-xs text-warning-text font-semibold cursor-pointer bg-warning/5 hover:bg-warning/15 px-3 h-11 rounded-xl border border-warning/20 transition-colors shrink-0"
          >
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-warning/35 text-warning focus:ring-warning w-4 h-4 cursor-pointer" 
              aria-label="Включить скрытую заметку"
            />
            <span>🔒 Заметка</span>
          </label>
        </div>
      )}

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
              <button type="button" onClick={() => setSelectedOrder(null)} className="h-11 w-11 flex items-center justify-center p-1 text-primary/70 hover:text-primary font-bold ml-2 transition-colors" aria-label="Удалить привязку заказа">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isStaff && suggestedArticle && (
            <motion.div
              key="nlp-article-suggestion"
              initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="bg-primary/10 border-l-4 border-primary px-3 py-2 rounded-xl mb-1 flex items-center justify-between shadow-xs select-none"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-sm">💡</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    Часто помогает при этой проблеме:
                  </div>
                  <a
                    href={`/knowledge/${suggestedArticle.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-foreground hover:text-primary transition-colors hover:underline line-clamp-1 mt-0.5"
                  >
                    {suggestedArticle.title}
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuggestedArticle(null)}
                className="p-1 text-muted-foreground hover:text-foreground font-bold ml-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
                aria-label="Закрыть подсказку"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LIVE DRAFT & NETWORK STATUS BAR ── */}
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

        {/* ── UNIFIED INPUT CARD (Full-Width Textarea + Bottom Action Bar) ── */}
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

          {/* Full-width Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={isStaff ? "Введите ответ или выберите шаблон (напишите /)..." : "Опишите вашу проблему..."}
            className="w-full bg-transparent px-4 pt-3 pb-2 max-h-[280px] min-h-[56px] resize-none outline-none text-base md:text-sm text-foreground placeholder:text-muted-foreground/70 leading-relaxed font-sans scrollbar-thin"
            rows={1}
          />

          {/* Bottom Toolbar inside the unified card */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-default-100/40">
            {/* Left toolbar tools: Attach file & Link order */}
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

              {initialOrders && initialOrders.length > 0 && (
                <div className="relative shrink-0 flex">
                  <button 
                    type="button"
                    onClick={() => setShowOrdersDropdown(!showOrdersDropdown)}
                    className={`h-9 px-2.5 border text-xs transition-all flex items-center justify-center gap-1.5 rounded-lg font-medium cursor-pointer shadow-xs ${
                      showOrdersDropdown 
                        ? 'bg-primary/10 border-primary/30 text-primary shadow-inner' 
                        : 'bg-background/80 border-border text-muted-foreground hover:bg-background hover:text-foreground'
                    }`}
                    title="Прикрепить заказ"
                    aria-label="Прикрепить заказ"
                  >
                    <span className="text-sm">📦</span>
                    <span className="hidden sm:inline text-[11px]">Заказ</span>
                  </button>

                  <AnimatePresence>
                    {showOrdersDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-11 left-0 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden py-2"
                      >
                        <div className="px-3 py-1.5 border-b border-divider text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Выберите заказ для привязки:
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {initialOrders.map((order: ChatInputOrder) => (
                            <button
                              key={order.id}
                              type="button"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowOrdersDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-default-50 flex flex-col gap-0.5 border-b border-divider last:border-0 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-foreground">Заказ #{order.numericId || order.id.slice(0, 8)}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  order.status === 'COMPLETED' ? 'bg-success/15 text-success-text' :
                                  order.status === 'IN_PROGRESS' ? 'bg-primary/15 text-primary' :
                                  order.status === 'PENDING' ? 'bg-warning/15 text-warning-text' :
                                  'bg-default-200/50 text-muted-foreground'
                                }`}>
                                  {order.status === 'COMPLETED' ? 'Выполнен' :
                                   order.status === 'IN_PROGRESS' ? 'В процессе' :
                                   order.status === 'PENDING' ? 'Ожидание' : order.status}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground truncate w-full">{order.serviceName}</span>
                              <span className="text-[10px] font-medium text-foreground opacity-80">{order.charge} ₽</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Right action buttons: Answer & Close + Send */}
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
