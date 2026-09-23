'use client';

import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Sparkles, 
  HelpCircle, 
  ShieldCheck, 
  Clock, 
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';
import { TextbookDomainId } from './types';
import { TEXTBOOK_DOMAINS } from './data/textbook-domains';
import { ALL_TEXTBOOK_CHAPTERS, searchChapters } from './data/textbook-chapters';
import { TextbookChapterViewer } from './TextbookChapterViewer';
import { InteractiveRegexLookup } from './InteractiveRegexLookup';
import { InteractiveErrorCodeLookup } from './InteractiveErrorCodeLookup';

export function InteractiveTextbook() {
  const [activeDomain, setActiveDomain] = useState<TextbookDomainId | 'ALL'>('ALL');
  const [selectedChapterId, setSelectedChapterId] = useState<string>(ALL_TEXTBOOK_CHAPTERS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [toolView, setToolView] = useState<'TEXTBOOK' | 'REGEX' | 'ERRORS'>('TEXTBOOK');

  const filteredChapters = useMemo(() => {
    let list = ALL_TEXTBOOK_CHAPTERS;
    if (activeDomain !== 'ALL') {
      list = list.filter((ch) => ch.domainId === activeDomain);
    }
    if (searchQuery.trim()) {
      list = searchChapters(searchQuery).filter((ch) =>
        activeDomain === 'ALL' ? true : ch.domainId === activeDomain
      );
    }
    return list;
  }, [activeDomain, searchQuery]);

  const handleDomainChange = (domainId: TextbookDomainId | 'ALL') => {
    setActiveDomain(domainId);
    let list = ALL_TEXTBOOK_CHAPTERS;
    if (domainId !== 'ALL') {
      list = list.filter((ch) => ch.domainId === domainId);
    }
    if (searchQuery.trim()) {
      list = searchChapters(searchQuery).filter((ch) =>
        domainId === 'ALL' ? true : ch.domainId === domainId
      );
    }
    if (list.length > 0 && !list.some((ch) => ch.id === selectedChapterId)) {
      setSelectedChapterId(list[0].id);
    }
  };

  const currentChapter = useMemo(() => {
    return (
      filteredChapters.find((ch) => ch.id === selectedChapterId) ||
      filteredChapters[0] ||
      ALL_TEXTBOOK_CHAPTERS[0]
    );
  }, [filteredChapters, selectedChapterId]);

  const currentIndex = filteredChapters.findIndex((c) => c.id === currentChapter?.id);
  const hasNext = currentIndex < filteredChapters.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNext = () => {
    if (hasNext) {
      setSelectedChapterId(filteredChapters[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setSelectedChapterId(filteredChapters[currentIndex - 1].id);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Bar: Mode Switcher & Tools */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-foreground">
              Интерактивный иллюстрированный учебник OmniBook 2026
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Стандарт ГОСТ ЕСПД 19.505-79 • 14 томов • 9 операционных доменов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/manual/OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx"
            download="OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx"
            className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Скачать полную настольную книгу администратора в формате Microsoft Word (DOCX) для распечатки"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📄 Книга в DOCX для печати</span>
          </a>

          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setToolView('TEXTBOOK')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              toolView === 'TEXTBOOK'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📖 Главы учебника
          </button>
          <button
            type="button"
            onClick={() => setToolView('REGEX')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              toolView === 'REGEX'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> RegEx Стенд
            </span>
          </button>
          <button
            type="button"
            onClick={() => setToolView('ERRORS')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              toolView === 'ERRORS'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Коды API (50+)
            </span>
          </button>
        </div>
      </div>
    </div>

      {toolView === 'REGEX' && <InteractiveRegexLookup />}
      {toolView === 'ERRORS' && <InteractiveErrorCodeLookup />}

      {toolView === 'TEXTBOOK' && (
        <div className="space-y-6">
          {/* Domain Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => handleDomainChange('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer ${
                activeDomain === 'ALL'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              Все домены ({ALL_TEXTBOOK_CHAPTERS.length})
            </button>
            {TEXTBOOK_DOMAINS.map((dom) => (
              <button
                key={dom.id}
                type="button"
                onClick={() => handleDomainChange(dom.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shrink-0 cursor-pointer ${
                  activeDomain === dom.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {dom.shortTitle}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по учебнику: термин, номер тома, правило, код ошибки..."
                className="w-full h-10 pl-10 pr-10 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <div className="text-[11px] text-muted-foreground px-1">
                Найдено глав: <strong className="text-foreground">{filteredChapters.length}</strong>
              </div>
            )}
          </div>

          {/* Two-column layout: Sidebar chapters list & Chapter Reader */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Sidebar list */}
            <aside className="lg:col-span-4 space-y-3">
              <div className="p-3 bg-card border border-border/80 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Оглавление ({filteredChapters.length})
                  </span>
                  <span className="text-[10px] text-muted-foreground">ГОСТ ЕСПД 19.505</span>
                </div>

                <div className="space-y-1.5 max-h-[720px] overflow-y-auto pr-1">
                  {filteredChapters.map((ch) => {
                    const isSelected = ch.id === currentChapter?.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setSelectedChapterId(ch.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/30 shadow-2xs'
                            : 'bg-background/40 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[10px] font-black uppercase text-primary">
                              Том {ch.volumeNumber} • Гл. {ch.chapterNumber}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {ch.readTimeMinutes}м
                            </span>
                          </div>
                          <div className="text-xs font-bold text-foreground truncate">{ch.title}</div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{ch.subtitle}</p>
                        </div>
                        <ChevronRight className={`w-4 h-4 mt-2 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground/50'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Chapter Reader Canvas */}
            <main className="lg:col-span-8">
              {currentChapter ? (
                <TextbookChapterViewer
                  chapter={currentChapter}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  hasNext={hasNext}
                  hasPrev={hasPrev}
                />
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border border-border">
                  Главы не найдены по заданному фильтру.
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
