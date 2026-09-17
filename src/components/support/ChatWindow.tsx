'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Message, useChatMessages } from './chat/useChatMessages';
import { useChatSSE } from './chat/useChatSSE';
import { ChatMessageList } from './chat/ChatMessageList';
import { ChatInput, type ChatInputOrder } from './chat/ChatInput';
import type { SupportTemplateDTO } from './chat/ChatTemplateManager';

interface ChatWindowProps {
  ticketId: string;
  initialMessages: Message[];
  isStaff?: boolean;
  initialTemplates?: SupportTemplateDTO[];
  onSendMessage: (formData: FormData) => Promise<{ success: boolean; error?: string; warning?: string } | void>;
  editTicketMessage?: (formData: FormData) => Promise<{ success: boolean; error?: string } | void>;
  deleteTicketMessage?: (formData: FormData) => Promise<{ success: boolean; error?: string } | void>;
  initialNextCursor?: string | null;
  isClosed?: boolean;
  initialOrders?: ChatInputOrder[];
  onSelectOrder?: (order: ChatInputOrder) => void;
  clientEmail?: string;
}

const EMPTY_TEMPLATES: SupportTemplateDTO[] = [];

export default function ChatWindow({
  ticketId,
  initialMessages,
  isStaff = false,
  initialTemplates = EMPTY_TEMPLATES,
  onSendMessage,
  editTicketMessage,
  deleteTicketMessage,
  initialNextCursor = null,
  isClosed = false,
  initialOrders = [],
  onSelectOrder,
  clientEmail,
}: ChatWindowProps) {
  const { theme } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isDark = theme?.includes('dark') || theme === 'dark';

  const {
    messages,
    setMessages,
    messageKeysRef,
    nextCursor,
    loadingOlder,
    handleLoadOlder,
    addNewMessages,
    lastCheckedRef,
  } = useChatMessages({
    ticketId,
    initialMessages,
    initialNextCursor,
  });

  useChatSSE({
    ticketId,
    isClosed,
    addNewMessages,
    lastCheckedRef,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  // ChatInput uses the window 'drop' event handler directly for dropping files,
  // but we can also manage visual state here.
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-info/10 backdrop-blur-sm border-2 border-dashed border-info/40 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-card/90 px-8 py-6 rounded-2xl shadow-xl flex flex-col items-center">
            <div className="w-16 h-16 bg-info/20 text-primary rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
            <p className="text-xl font-bold text-foreground">Перетащите файл сюда</p>
            <p className="text-sm text-muted-foreground mt-1">Изображение или PDF (до 5 МБ)</p>
          </div>
        </div>
      )}

      <ChatMessageList
        messages={messages}
        messageKeysRef={messageKeysRef}
        clientEmail={clientEmail}
        nextCursor={nextCursor}
        loadingOlder={loadingOlder}
        onLoadOlder={handleLoadOlder}
        onSetReplyingTo={setReplyingTo}
        editTicketMessage={editTicketMessage}
        deleteTicketMessage={deleteTicketMessage}
        setMessages={setMessages}
        isStaff={isStaff}
        onSelectOrder={onSelectOrder}
      />

      <ChatInput
        ticketId={ticketId}
        isClosed={isClosed}
        isStaff={isStaff}
        clientEmail={clientEmail}
        initialOrders={initialOrders}
        initialTemplates={initialTemplates}
        messages={messages}
        onSendMessage={onSendMessage}
        setMessages={setMessages}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
      />
    </div>
  );
}
