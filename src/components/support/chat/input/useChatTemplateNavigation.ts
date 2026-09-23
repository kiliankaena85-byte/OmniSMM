'use client';

import { useState } from 'react';
import type { SupportTemplateDTO } from '../ChatTemplateManager';
import { incrementTemplateUsage } from '@/actions/support/template';

interface UseChatTemplateNavOptions {
  text: string;
  setText: (val: string) => void;
  templatesList: SupportTemplateDTO[];
  isStaff: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  parseTemplateFn: (templateText: string) => string;
}

export function useChatTemplateNavigation({
  text,
  setText,
  templatesList,
  isStaff,
  textareaRef,
  parseTemplateFn,
}: UseChatTemplateNavOptions) {
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [filteredTemplates, setFilteredTemplates] = useState<SupportTemplateDTO[]>([]);

  const handleSelectTemplate = (t: SupportTemplateDTO) => {
    const parsedText = parseTemplateFn(t.text);
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
          if (!prefix) return true;
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

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    onSubmit: (e: React.FormEvent, shouldClose: boolean) => void
  ) => {
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
        onSubmit(e as unknown as React.FormEvent, true);
      } else {
        onSubmit(e as unknown as React.FormEvent, false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent, false);
    }
  };

  return {
    showTemplatesDropdown,
    setShowTemplatesDropdown,
    activeTemplateIndex,
    filteredTemplates,
    handleSelectTemplate,
    handleTextChange,
    handleKeyDown,
  };
}
