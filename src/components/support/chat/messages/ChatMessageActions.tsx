'use client';

import type { Message } from '../useChatMessages';

interface ChatMessageActionsProps {
  msg: Message;
  isMyMessage: boolean;
  isExpired: boolean;
  onSetReplyingTo: (msg: Message) => void;
  onStartEdit?: (msg: Message) => void;
  onDelete?: (msgId: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function ChatMessageActions({
  msg,
  isMyMessage,
  isExpired,
  onSetReplyingTo,
  onStartEdit,
  onDelete,
  canEdit,
  canDelete,
}: ChatMessageActionsProps) {
  if (msg.isDeleted) return null;

  return (
    <div
      className={`absolute ${
        isMyMessage ? '-left-10' : '-right-10'
      } top-1/2 -translate-y-1/2 hidden lg:flex opacity-0 lg:group-hover:opacity-100 gap-1 transition-opacity z-10`}
    >
      <button
        type="button"
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

      {canEdit && (
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
            type="button"
            onClick={() => onStartEdit?.(msg)}
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

      {canDelete && onDelete && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Удалить это сообщение из чата и Telegram?')) {
              onDelete(msg.id);
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
  );
}
