'use client';

import React, { useState } from 'react';
import { ShieldCheck, Check, AlertCircle, Copy, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface SocialPattern {
  platform: string;
  icon: string;
  targetType: 'CHANNEL' | 'POST' | 'USER' | 'POLL';
  patternStr: string;
  regex: RegExp;
  exampleUrl: string;
}

const REGEX_DIRECTORY: SocialPattern[] = [
  {
    platform: 'Telegram (Канал/Группа)',
    icon: '✈️',
    targetType: 'CHANNEL',
    patternStr: '^(?:https?:\\/\\/)?(?:t\\.me|telegram\\.me)\\/(?!joinchat|\\+)([a-zA-Z0-9_]{4,32})\\/?$',
    regex: /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?!joinchat|\+)([a-zA-Z0-9_]{4,32})\/?$/,
    exampleUrl: 'https://t.me/durov',
  },
  {
    platform: 'Telegram (Пост)',
    icon: '💬',
    targetType: 'POST',
    patternStr: '^(?:https?:\\/\\/)?(?:t\\.me|telegram\\.me)\\/([a-zA-Z0-9_]{4,32})\\/(\\d+)\\/?$',
    regex: /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,32})\/(\d+)\/?$/,
    exampleUrl: 'https://t.me/durov/123',
  },
  {
    platform: 'VK (Стена / Пост)',
    icon: '🔵',
    targetType: 'POST',
    patternStr: '^(?:https?:\\/\\/)?(?:vk\\.com|vkontakte\\.ru)\\/wall(-?\\d+_\\d+)\\/?$',
    regex: /^(?:https?:\/\/)?(?:vk\.com|vkontakte\.ru)\/wall(-?\d+_\d+)\/?$/,
    exampleUrl: 'https://vk.com/wall-123456_789',
  },
  {
    platform: 'YouTube (Видео)',
    icon: '▶️',
    targetType: 'POST',
    patternStr: '^(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([a-zA-Z0-9_-]{11})',
    regex: /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    exampleUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    platform: 'Instagram (Профиль)',
    icon: '📷',
    targetType: 'USER',
    patternStr: '^(?:https?:\\/\\/)?(?:www\\.)?instagram\\.com\\/([a-zA-Z0-9_.]{1,30})\\/?$',
    regex: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{1,30})\/?$/,
    exampleUrl: 'https://instagram.com/smmplan',
  },
  {
    platform: 'Rutube (Видео)',
    icon: '🇷🇺',
    targetType: 'POST',
    patternStr: '^(?:https?:\\/\\/)?rutube\\.ru\\/video\\/([a-f0-9]{32})\\/?$',
    regex: /^(?:https?:\/\/)?rutube\.ru\/video\/([a-f0-9]{32})\/?$/,
    exampleUrl: 'https://rutube.ru/video/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d/',
  },
  {
    platform: 'TikTok (Видео)',
    icon: '🎵',
    targetType: 'POST',
    patternStr: '^(?:https?:\\/\\/)?(?:www\\.)?tiktok\\.com\\/@([a-zA-Z0-9_.-]+)\\/video\\/(\\d+)\\/?$',
    regex: /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)\/video\/(\d+)\/?$/,
    exampleUrl: 'https://www.tiktok.com/@tiktok/video/7123456789012345678',
  },
  {
    platform: 'Twitter / X (Пост)',
    icon: '✖️',
    targetType: 'POST',
    patternStr: '^(?:https?:\\/\\/)?(?:twitter\\.com|x\\.com)\\/([a-zA-Z0-9_]{1,15})\\/status\\/(\\d+)\\/?$',
    regex: /^(?:https?:\/\/)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})\/status\/(\d+)\/?$/,
    exampleUrl: 'https://x.com/elonmusk/status/1234567890123456789',
  },
  {
    platform: 'Дзен (Канал)',
    icon: '📑',
    targetType: 'CHANNEL',
    patternStr: '^(?:https?:\\/\\/)?dzen\\.ru\\/([a-zA-Z0-9_.-]{3,32})\\/?$',
    regex: /^(?:https?:\/\/)?dzen\.ru\/([a-zA-Z0-9_.-]{3,32})\/?$/,
    exampleUrl: 'https://dzen.ru/yandex',
  },
  {
    platform: 'Threads (Профиль)',
    icon: '🧵',
    targetType: 'USER',
    patternStr: '^(?:https?:\\/\\/)?(?:www\\.)?threads\\.net\\/@([a-zA-Z0-9_.-]{1,30})\\/?$',
    regex: /^(?:https?:\/\/)?(?:www\.)?threads\.net\/@([a-zA-Z0-9_.-]{1,30})\/?$/,
    exampleUrl: 'https://threads.net/@zuck',
  },
];

export function InteractiveRegexLookup() {
  const [testUrl, setTestUrl] = useState('');
  const [copiedPattern, setCopiedPattern] = useState<string | null>(null);

  const matchedPattern = testUrl.trim()
    ? REGEX_DIRECTORY.find((p) => p.regex.test(testUrl.trim()))
    : null;

  const handleCopy = async (patternStr: string) => {
    try {
      await navigator.clipboard.writeText(patternStr);
      setCopiedPattern(patternStr);
      toast.success('RegEx скопирован');
      setTimeout(() => setCopiedPattern(null), 2000);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <div className="my-6 p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h3 className="text-sm font-bold text-foreground">
            Интерактивный тестовый стенд RegEx (Защита от ReDoS)
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          Том VII • 10 Соцсетей
        </span>
      </div>

      {/* Input Link Tester */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground block">
          Проверьте целевую ссылку клиента:
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="Вставьте ссылку (например, https://t.me/durov или https://vk.com/wall-123_45)..."
            className="w-full h-10 pl-10 pr-24 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {testUrl && (
            <button
              type="button"
              onClick={() => setTestUrl('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-bold"
            >
              Сброс
            </button>
          )}
        </div>
      </div>

      {/* Live Match Card */}
      {testUrl.trim() && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            matchedPattern
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {matchedPattern ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <div>
              {matchedPattern ? (
                <>
                  <span className="font-bold block">
                    {matchedPattern.icon} {matchedPattern.platform}
                  </span>
                  <span className="text-[11px] opacity-80">
                    Целевой тип: <strong>{matchedPattern.targetType}</strong> • Валидация успешна!
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold block">Формат ссылки не распознан</span>
                  <span className="text-[11px] opacity-80">
                    Ссылка не соответствует эталонным паттернам ReDoS-Safe.
                  </span>
                </>
              )}
            </div>
          </div>

          {matchedPattern && (
            <span className="px-2 py-0.5 rounded bg-background/80 border border-border/50 text-[10px] font-mono font-bold">
              TargetType: {matchedPattern.targetType}
            </span>
          )}
        </div>
      )}

      {/* Pattern directory cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
        {REGEX_DIRECTORY.map((pat, idx) => (
          <div key={idx} className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>{pat.icon}</span> {pat.platform}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(pat.patternStr)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                title="Копировать RegEx"
              >
                {copiedPattern === pat.patternStr ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <code className="text-[10px] font-mono text-muted-foreground block truncate bg-background/60 p-1 rounded border border-border/40">
              {pat.patternStr}
            </code>
            <button
              type="button"
              onClick={() => setTestUrl(pat.exampleUrl)}
              className="text-[10px] text-primary hover:underline font-semibold block"
            >
              Пример: {pat.exampleUrl}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
