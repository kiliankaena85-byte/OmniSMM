'use client';

/**
 * Lightweight, Safe Markdown Renderer for Admin AI Assistant Chat
 * Formats headings, lists, bold text, inline code, and links into rich UI elements.
 * Complies with Clean Architecture Level 3 Presentation (<= 200 lines).
 */

import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface ChatMarkdownRendererProps {
  content: string;
}

export const renderInlineTokens = (text: string): React.ReactNode[] => {
  if (!text) return [];

  // Regex to split by markdown links, inline code, or bold tags
  const tokenRegex = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // 1. Link: [label](href)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith('/');
      if (isInternal) {
        return (
          <Link
            key={idx}
            href={href}
            className="inline-flex items-center gap-0.5 text-primary hover:underline font-semibold"
          >
            <span>{label}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
          </Link>
        );
      }
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-mono text-[11px]"
        >
          {label}
        </a>
      );
    }

    // 2. Inline Code: `code`
    const codeMatch = part.match(/^`([^`]+)`$/);
    if (codeMatch) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 mx-0.5 rounded bg-background/90 dark:bg-muted font-mono text-[10.5px] text-primary border border-border/70 font-medium"
        >
          {codeMatch[1]}
        </code>
      );
    }

    // 3. Bold: **text** (allows nested inline code/links)
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {renderInlineTokens(boldMatch[1])}
        </strong>
      );
    }

    // Plain text
    return <span key={idx}>{part}</span>;
  });
};

export const ChatMarkdownRenderer: React.FC<ChatMarkdownRendererProps> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <div className="space-y-1 leading-relaxed text-xs">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} className="h-1" />;
        }

        // Heading 3: ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={lIdx}
              className="font-semibold text-[12.5px] text-foreground mt-2 mb-1 flex items-center gap-1.5 border-b border-border/40 pb-1"
            >
              {renderInlineTokens(trimmed.slice(4))}
            </h4>
          );
        }

        // Heading 2: ##
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={lIdx}
              className="font-bold text-[13px] text-foreground mt-2.5 mb-1 flex items-center gap-1.5 border-b border-border/60 pb-1"
            >
              {renderInlineTokens(trimmed.slice(3))}
            </h3>
          );
        }

        // Bullet list item: * or -
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={lIdx} className="flex items-start gap-1.5 my-0.5 ml-1">
              <span className="text-primary mt-1 text-[8px] shrink-0 select-none">•</span>
              <div className="flex-1 text-foreground/90 leading-relaxed">
                {renderInlineTokens(trimmed.slice(2))}
              </div>
            </div>
          );
        }

        // Standard paragraph line
        return (
          <p key={lIdx} className="text-foreground/90 my-0.5">
            {renderInlineTokens(line)}
          </p>
        );
      })}
    </div>
  );
};
