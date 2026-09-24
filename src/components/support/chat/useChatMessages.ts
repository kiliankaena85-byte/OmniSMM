import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface Message {
  id: string;
  sender: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string;
  isDeleted?: boolean;
  isEdited?: boolean;
  originalText?: string | null;
  replyTo?: { id: string, text: string, sender: string } | null;
  isHistorical?: boolean;
  historicalTicketId?: string;
  historicalSubject?: string;
  attachments?: Array<{
    id: string;
    url: string;
    type: string;
    mimeType?: string | null;
    name?: string | null;
    size?: number | null;
    createdAt: string;
  }>;
  orderId?: string | null;
  telegramMsgId?: string | null;
  order?: {
    id: string;
    numericId?: number;
    status: string;
    charge: number;
    createdAt?: string;
    serviceName?: string;
  } | null;
}

export function useChatMessages({
  ticketId,
  initialMessages,
  initialNextCursor,
}: {
  ticketId: string;
  initialMessages: Message[];
  initialNextCursor: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const messageKeysRef = useRef<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const lastCheckedRef = useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : new Date(0).toISOString()
  );

  // Sync initialMessages prop to state (preserving temp optimistic messages, but avoiding duplicates and mapping keys)
  useEffect(() => {
    const normalizeText = (s?: string | null) => (s || '').trim().replace(/\r\n/g, '\n');
    const now = Date.now();

    setMessages((prev) => {
      // Filter out stale temp messages (> 12 seconds old) to prevent ghost duplicates
      const temps = prev.filter((m) => {
        if (!m.id.startsWith('temp-')) return false;
        const createdAtTime = new Date(m.createdAt).getTime();
        return !isNaN(createdAtTime) && (now - createdAtTime < 12000);
      });

      // Register stable keys for any temp messages being replaced by initialMessages
      initialMessages.forEach((realMsg) => {
        if (!messageKeysRef.current[realMsg.id]) {
          const matchingTemp = temps.find(
            (temp) => normalizeText(temp.text) === normalizeText(realMsg.text)
          );
          if (matchingTemp) {
            messageKeysRef.current[realMsg.id] = matchingTemp.id;
          }
        }
      });

      // Filter out any temp message that matches an existing message in initialMessages
      const uniqueTemps = temps.filter(
        (temp) =>
          !initialMessages.some((m) => normalizeText(m.text) === normalizeText(temp.text))
      );

      return [...initialMessages, ...uniqueTemps];
    });
  }, [initialMessages]);

  const handleLoadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/support/messages?ticketId=${ticketId}&cursor=${nextCursor}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = data.messages.filter((m: Message) => !existingIds.has(m.id));
          return [...newMsgs, ...prev];
        });
      }
      setNextCursor(data.nextCursor);
    } catch {
      toast.error('Не удалось загрузить историю сообщений');
    } finally {
      setLoadingOlder(false);
    }
  };

  const addNewMessages = useCallback((newMsgs: Message[]) => {
    const normalizeText = (s?: string | null) => (s || '').trim().replace(/\r\n/g, '\n');

    setMessages((prev) => {
      const updated = [...prev];
      newMsgs.forEach((newMsg) => {
        // Find an optimistic message matching this message to replace in-place
        const optIdx = updated.findIndex(
          (m) =>
            m.id.startsWith('temp-') &&
            normalizeText(m.text) === normalizeText(newMsg.text)
        );
        if (optIdx !== -1) {
          // Register stable key mapping
          messageKeysRef.current[newMsg.id] = updated[optIdx].id;
          updated[optIdx] = newMsg;
        } else {
          if (!updated.some((m) => m.id === newMsg.id)) {
            updated.push(newMsg);
          }
        }
      });
      return updated;
    });
  }, []);

  return {
    messages,
    setMessages,
    messageKeysRef,
    nextCursor,
    loadingOlder,
    handleLoadOlder,
    addNewMessages,
    lastCheckedRef,
  };
}
