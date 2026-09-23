'use client';
interface SearchSuggestionItem {
  id: string;
  title: string;
  slug: string;
  category?: string;
  description?: string;
}


import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, Loader2 } from "lucide-react";
import { getArticles } from "@/actions/knowledge";

interface SearchAutocompleteProps {
  initialSearch?: string;
  activeCategory?: string;
  isFlux?: boolean;
}

export function SearchAutocomplete({ initialSearch = "", activeCategory = "Все", isFlux = false }: SearchAutocompleteProps) {
  const [query, setQuery] = useState(initialSearch);
    const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced autocomplete suggestions fetching
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await getArticles(activeCategory === "Все" ? undefined : activeCategory, query);
        if (res.success && res.articles) {
          setSuggestions(res.articles.slice(0, 5));
          setIsOpen(res.articles.length > 0);
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeCategory]);

  // Keyboard navigation logic
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        const item = suggestions[activeIndex];
        router.push(`/knowledge/${item.slug}`);
        setIsOpen(false);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    const queryParts: string[] = [];
    if (activeCategory !== "Все") {
      queryParts.push(`category=${encodeURIComponent(activeCategory)}`);
    }
    if (query.trim()) {
      queryParts.push(`search=${encodeURIComponent(query.trim())}`);
    }
    const url = `/knowledge${queryParts.length > 0 ? `?${queryParts.join("&")}` : ""}`;
    router.push(url);
  };

  // Close suggestions popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    const url = `/knowledge${activeCategory !== "Все" ? `?category=${encodeURIComponent(activeCategory)}` : ""}`;
    router.push(url);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-lg mx-auto select-none">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim().length >= 2 && suggestions.length > 0 && setIsOpen(true)}
            placeholder="Поиск по статьям..."
            className={`w-full h-12 pl-11 pr-10 rounded-full border transition-all text-sm font-semibold focus:outline-none shadow-sm ${
              isFlux
                ? "bg-card/90 border-border/80 text-foreground placeholder:text-muted-foreground focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15"
                : "border-border bg-card text-foreground focus:border-primary"
            }`}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls="autocomplete-suggestions"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {isPending ? (
              <Loader2 className={`w-4 h-4 animate-spin ${isFlux ? "text-purple-600" : "text-primary"}`} />
            ) : (
              <Search className={`w-4 h-4 ${isFlux ? "text-purple-600" : ""}`} />
            )}
          </div>
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm flex items-center justify-center min-h-[44px] min-w-[44px]"
              title="Очистить поиск"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className={`h-12 px-7 rounded-full font-black text-sm flex items-center justify-center transition-all active:scale-[0.98] min-w-[90px] cursor-pointer ${
            isFlux
              ? "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-[0_4px_16px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_22px_rgba(236,72,153,0.45)] hover:-translate-y-0.5"
              : "bg-primary text-primary-foreground hover:opacity-95 shadow-sm"
          }`}
        >
          Найти
        </button>
      </div>

      {/* Autocomplete Suggestions Popover */}
      {isOpen && suggestions.length > 0 && (
        <ul
          id="autocomplete-suggestions"
          role="listbox"
          className="absolute left-0 right-0 mt-2 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-border/50 bg-card border border-border max-h-[300px] overflow-y-auto"
        >
          {suggestions.map((item, index) => {
            const isHighlighted = index === activeIndex;
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={isHighlighted}
                className={`transition-colors ${
                  isHighlighted 
                    ? (isFlux ? "bg-purple-500/10 text-purple-700 dark:text-purple-300" : "bg-primary/10 text-primary") 
                    : (isFlux ? "hover:bg-purple-500/5 text-foreground" : "hover:bg-primary/5 text-foreground")
                }`}
              >
                <Link
                  href={`/knowledge/${item.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex flex-col gap-0.5 px-4 py-3 min-h-[44px] w-full text-left"
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${isFlux ? "text-purple-600" : "text-primary"}`}>
                    {item.category}
                  </span>
                  <span className="text-sm font-semibold leading-tight line-clamp-1">
                    {item.title}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {item.description}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
