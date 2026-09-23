'use client';

import { ClientDate } from '@/components/ui/client-date';
import type { Message } from '../useChatMessages';
import type { ChatInputOrder } from '../ChatInput';
import { ChatMediaViewer } from './ChatMediaViewer';
import { ChatAttachedOrderCard } from './ChatAttachedOrderCard';
import { ChatMessageActions } from './ChatMessageActions';

interface ChatMessageBubbleProps {
  msg: Message;
  isMyMessage: boolean;
  showAvatar: boolean;
  avatarInitial: string;
  avatarGradient: string;
  avatarTitle: string;
  isExpired: boolean;
  editingMessageId: string | null;
  editingText: string;
  setEditingText: (text: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (msgId: string) => void;
  onStartEdit: (msg: Message) => void;
  onDelete: (msgId: string) => void;
  onSetReplyingTo: (msg: Message) => void;
  onSelectOrder?: (order: ChatInputOrder) => void;
  onZoomImage: (url: string) => void;
  isStaff?: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function ChatMessageBubble({
  msg,
  isMyMessage,
  showAvatar,
  avatarInitial,
  avatarGradient,
  avatarTitle,
  isExpired,
  editingMessageId,
  editingText,
  setEditingText,
  onCancelEdit,
  onSubmitEdit,
  onStartEdit,
  onDelete,
  onSetReplyingTo,
  onSelectOrder,
  onZoomImage,
  isStaff,
  canEdit,
  canDelete,
}: ChatMessageBubbleProps) {
  return (
    <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} items-end mb-4 gap-3`}>
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
        } ${msg.id.startsWith('temp-') ? 'opacity-60 saturate-50 animate-pulse' : ''}`}
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
                <path d="M5 14 L0 14 C1.5 13 3.5 9 5 0 Z" fill="currentColor" />
              </svg>
            </div>
          ) : (
            <div className="absolute right-[-5px] bottom-0 w-[5px] h-3.5 pointer-events-none select-none">
              <svg width="5" height="14" viewBox="0 0 5 14" className="text-primary">
                <path d="M0 14 L5 14 C3.5 13 1.5 9 0 0 Z" fill="currentColor" />
              </svg>
            </div>
          ))}

        {/* Desktop Hover Actions */}
        {!msg.isDeleted && editingMessageId !== msg.id && (
          <ChatMessageActions
            msg={msg}
            isMyMessage={isMyMessage}
            isExpired={isExpired}
            onSetReplyingTo={onSetReplyingTo}
            onStartEdit={onStartEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {/* Reply Quote Preview */}
        {!msg.isDeleted && msg.replyTo && (
          <div
            className={`mb-2 p-2 rounded-lg border-l-2 text-xs ${
              msg.sender === 'STAFF'
                ? 'bg-foreground/10 border-primary-foreground/40 text-primary-foreground'
                : 'bg-default-100 border-primary/50 text-foreground'
            }`}
          >
            <div className="font-bold opacity-70 mb-0.5">{msg.replyTo.sender}</div>
            <div className="opacity-80 line-clamp-2">{msg.replyTo.text || 'Медиа сообщение'}</div>
          </div>
        )}

        {/* Attached Order Card */}
        {!msg.isDeleted && msg.order && (
          <ChatAttachedOrderCard
            order={msg.order}
            sender={msg.sender}
            isStaff={Boolean(isStaff)}
            onSelectOrder={onSelectOrder}
          />
        )}

        {/* Media Preview */}
        <ChatMediaViewer msg={msg} onZoomImage={onZoomImage} />

        {/* Content: Deleted / Editing / View */}
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
                onClick={onCancelEdit}
                className="text-[11px] font-bold uppercase bg-muted/50 text-muted-foreground px-4 h-11 rounded-xl border border-border hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => onSubmitEdit(msg.id)}
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
                {msg.sender === 'INTERNAL' && <span title="Внутренняя заметка">🔒</span>}
                {msg.isEdited && (
                  <span title={msg.originalText || ''} className="text-[8px] opacity-75">
                    изм.
                  </span>
                )}
                <span
                  title={new Date(msg.createdAt).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  className="cursor-default"
                >
                  <ClientDate date={msg.createdAt} format="time" />
                </span>
                {msg.isHistorical && <span className="text-[8px] opacity-75">(Архив)</span>}
                {isStaff && msg.telegramMsgId && !msg.telegramMsgId.startsWith('FAILED:') && (
                  <span title={`Доставлено в Telegram (ID: ${msg.telegramMsgId})`} className="text-emerald-500 font-bold ml-0.5 cursor-help">
                    ✓✓
                  </span>
                )}
                {isStaff && msg.telegramMsgId?.startsWith('FAILED:') && (
                  <span title={`Сбой доставки в Telegram: ${msg.telegramMsgId.replace('FAILED:', '').trim()}`} className="text-danger font-bold ml-0.5 cursor-help">
                    ⚠️
                  </span>
                )}
              </span>
            </div>

            {isStaff && msg.telegramMsgId?.startsWith('FAILED:') && (
              <div className="mt-1.5 pt-1.5 border-t border-danger/25 flex items-start gap-1.5 text-[11px] text-danger font-medium leading-tight">
                <span className="shrink-0 text-xs">⚠️</span>
                <span>Не доставлено в Telegram: {msg.telegramMsgId.replace('FAILED:', '').trim()}</span>
              </div>
            )}

            {/* Mobile Inline Actions */}
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
                {canEdit && !isExpired && (
                  <>
                    <span className="opacity-30">•</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onStartEdit(msg);
                      }}
                      className="hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1 text-inherit"
                    >
                      Изменить
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
