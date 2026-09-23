'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatArticleSuggestionProps {
  text: string;
  isStaff: boolean;
}

export function ChatArticleSuggestion({ text, isStaff }: ChatArticleSuggestionProps) {
  const [suggestedArticle, setSuggestedArticle] = useState<{ title: string; slug: string } | null>(null);

  useEffect(() => {
    if (isStaff) return;
    if (text.trim().length < 5) {
      setSuggestedArticle(null);
      return;
    }

    const timer = setTimeout(() => {
      const lower = text.toLowerCase();
      if (lower.includes('спис') || lower.includes('пропал') || lower.includes('упал') || lower.includes('улет')) {
        setSuggestedArticle({
          title: 'Как алгоритмы Telegram выявляют ботов и почему списываются подписчики в 2026 году',
          slug: 'how-telegram-detects-bots',
        });
      } else if (lower.includes('завис') || lower.includes('ошибк') || lower.includes('статус') || lower.includes('отмен')) {
        setSuggestedArticle({
          title: 'Лимиты подписок и лайков в Instagram: Безопасные лимиты для продвижения',
          slug: 'instagram-limits',
        });
      } else if (lower.includes('прокси') || lower.includes('proxy') || lower.includes('ip rep')) {
        setSuggestedArticle({
          title: 'IPv4, IPv6 и мобильные прокси: Как выбор прокси влияет на живучесть аккаунтов',
          slug: 'proxy-reputation',
        });
      } else if (lower.includes('рекоменд') || lower.includes('просмотр') || lower.includes('лайк') || lower.includes('реакц')) {
        setSuggestedArticle({
          title: 'Как раскрутить Telegram-канал с нуля до 10 000 подписчиков без огромных бюджетов',
          slug: 'telegram-grow-zero',
        });
      } else {
        setSuggestedArticle(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [text, isStaff]);

  return (
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
            className="p-1 text-muted-foreground hover:text-foreground font-bold ml-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg cursor-pointer"
            aria-label="Закрыть подсказку"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
