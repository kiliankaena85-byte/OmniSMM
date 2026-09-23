'use client';

import { Loader2 } from 'lucide-react';
import type { Message } from '../useChatMessages';

interface ChatMediaViewerProps {
  msg: Message;
  onZoomImage: (url: string) => void;
}

export function ChatMediaViewer({ msg, onZoomImage }: ChatMediaViewerProps) {
  if (msg.isDeleted) return null;

  if (msg.mediaUrl === 'uploading...') {
    return (
      <div className="w-full h-32 bg-primary/10 animate-pulse rounded-xl mb-2 flex items-center justify-center border border-primary/20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const filesToRender = msg.attachments && msg.attachments.length > 0
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
            alt={file.name || 'Файл'}
            onClick={() => onZoomImage(file.url)}
            className="rounded-xl max-h-60 cursor-zoom-in border border-default-200 hover:opacity-90 transition-all duration-200 object-cover"
          />
          <div
            className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-sm text-foreground text-[10px] px-2 py-1 rounded-md opacity-0 group-hover/att:opacity-100 transition-opacity duration-200 truncate"
            title={file.name || 'Файл'}
          >
            {file.name || 'Файл'}
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
          <div className="text-[10px] text-muted-foreground mt-1 truncate" title={file.name || 'Файл'}>
            {file.name || 'Файл'}
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
          <div className="text-[10px] text-muted-foreground mt-1 truncate" title={file.name || 'Файл'}>
            {file.name || 'Файл'}
          </div>
        </div>
      );
    }
    // Single Document
    return (
      <div className="flex items-center gap-2 bg-foreground/5 p-2.5 rounded-xl border border-border mb-2 max-w-sm">
        <div className="text-2xl drop-shadow-sm shrink-0">📄</div>
        <div
          className="text-sm font-semibold truncate flex-1 leading-tight text-foreground/90 min-w-0"
          title={file.name || 'Файл'}
        >
          {file.name || 'Файл'}
        </div>
        <a
          href={`/api/media/${encodeURIComponent(file.url)}`}
          download={file.name || 'Файл'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-[10px] font-bold px-2.5 py-1.5 bg-background shadow-sm border border-default-200 rounded-md hover:bg-default-50 transition-colors shrink-0"
        >
          Скачать
        </a>
      </div>
    );
  }

  // Multiple attachments Grid
  return (
    <div className="grid grid-cols-2 gap-2 mb-2 w-full max-w-[480px]">
      {filesToRender.map((file) => {
        if (file.type === 'image') {
          return (
            <div
              key={file.id}
              className="relative aspect-video rounded-xl overflow-hidden border border-default-200 group/att cursor-zoom-in"
              onClick={() => onZoomImage(file.url)}
            >
              <img
                src={`/api/media/${encodeURIComponent(file.url)}`}
                alt={file.name || 'Файл'}
                className="w-full h-full object-cover group-hover/att:scale-105 transition-transform duration-200"
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-background/90 backdrop-blur-sm text-foreground text-[10px] px-2 py-1 opacity-0 group-hover/att:opacity-100 transition-opacity duration-200 truncate"
                title={file.name || 'Файл'}
              >
                {file.name || 'Файл'}
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
                title={file.name || 'Файл'}
              >
                {file.name || 'Файл'}
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
              <div className="text-[9px] text-muted-foreground truncate mt-1 min-w-0" title={file.name || 'Файл'}>
                {file.name || 'Файл'}
              </div>
            </div>
          );
        }
        return (
          <div
            key={file.id}
            className="flex items-center gap-2 bg-foreground/5 p-2 rounded-xl border border-border group/att min-w-0"
          >
            <div className="text-xl drop-shadow-sm shrink-0">📄</div>
            <div
              className="text-[11px] font-semibold truncate flex-1 leading-tight text-foreground/90 min-w-0"
              title={file.name || 'Файл'}
            >
              {file.name || 'Файл'}
            </div>
            <a
              href={`/api/media/${encodeURIComponent(file.url)}`}
              download={file.name || 'Файл'}
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
}
