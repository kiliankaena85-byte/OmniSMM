'use client';

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createArticle, updateArticle } from "@/actions/knowledge";
import { ArrowLeft, Eye, Edit2, CheckCircle } from "lucide-react";
import { slugify } from "@/utils/slugify";
import Link from "next/link";

// Custom safe markdown renderer matching the detail page
function renderMarkdown(content: string): React.ReactNode[] {
  if (!content) return [];
  const lines = content.split("\n");
  let insideList = false;
  let listItems: React.ReactNode[] = [];
  const elements: React.ReactNode[] = [];

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    let match;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchStr = match[0];
      const matchIndex = match.index;

      if (matchIndex > currentIndex) {
        parts.push(text.substring(currentIndex, matchIndex));
      }

      if (matchStr.startsWith("**") && matchStr.endsWith("**")) {
        const boldText = matchStr.substring(2, matchStr.length - 2);
        parts.push(
          <strong key={`bold-${keyCounter++}`} className="font-extrabold text-foreground">
            {boldText}
          </strong>
        );
      } else if (matchStr.startsWith("[") && matchStr.includes("](")) {
        const closeBracket = matchStr.indexOf("]");
        const linkText = matchStr.substring(1, closeBracket);
        const linkUrl = matchStr.substring(closeBracket + 2, matchStr.length - 1);
        
        parts.push(
          <a
            key={`link-${keyCounter++}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-90 transition-opacity"
          >
            {linkText}
          </a>
        );
      }

      currentIndex = regex.lastIndex;
    }

    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.substring(2);
      listItems.push(
        <li key={`li-${index}`} className="mb-2 leading-relaxed pl-1 text-sm text-foreground/90">
          {renderInline(itemText)}
        </li>
      );
      insideList = true;
    } else {
      if (insideList) {
        elements.push(
          <ul key={`ul-${index}`} className="list-disc list-inside mb-6 pl-4 space-y-1 text-foreground/80">
            {listItems}
          </ul>
        );
        listItems = [];
        insideList = false;
      }

      if (trimmed === "") {
        return;
      }

      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${index}`} className="text-md md:text-lg font-bold mt-4 mb-2 text-foreground tracking-tight">
            {renderInline(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${index}`} className="text-lg md:text-xl font-extrabold mt-6 mb-3 text-foreground tracking-tight border-b border-border/40 pb-1">
            {renderInline(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${index}`} className="text-xl md:text-2xl font-black mt-6 mb-3 text-foreground tracking-tight">
            {renderInline(trimmed.substring(2))}
          </h1>
        );
      } else {
        elements.push(
          <p key={`p-${index}`} className="mb-4 text-sm text-foreground/90">
            {renderInline(trimmed)}
          </p>
        );
      }
    }
  });

  if (insideList) {
    elements.push(
      <ul key="ul-end" className="list-disc list-inside mb-6 pl-4 space-y-1 text-foreground/80">
        {listItems}
      </ul>
    );
  }

  return elements;
}

interface ArticleFormProps {
  initialData?: {
    id: string;
    title: string;
    slug: string;
    description: string;
    content: string;
    status: "DRAFT" | "PUBLISHED";
    category: string;
    authorName?: string;
    authorRole?: string;
  };
}

export function ArticleForm({ initialData }: ArticleFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  // Form states
  const [title, setTitle] = React.useState(initialData?.title || "");
  const [slug, setSlug] = React.useState(initialData?.slug || "");
  const [description, setDescription] = React.useState(initialData?.description || "");
  const [content, setContent] = React.useState(initialData?.content || "");
  const [category, setCategory] = React.useState(initialData?.category || "Подписчики");
  const [isPublished, setIsPublished] = React.useState(initialData?.status === "PUBLISHED");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(isEdit);

  const COMMON_AUTHORS = React.useMemo(() => [
    { name: "Михаил", role: "Системный архитектор прокси-сетей SMMplan" },
    { name: "Ольга", role: "Контент-стратег и SEO-специалист SMMplan" },
    { name: "Дмитрий", role: "Руководитель SMM-отдела SMMplan" }
  ], []);

  const [authorName, setAuthorName] = React.useState(initialData?.authorName || "Михаил");
  const [authorRole, setAuthorRole] = React.useState(initialData?.authorRole || "Системный архитектор прокси-сетей SMMplan");
  
  const [selectedAuthorType, setSelectedAuthorType] = React.useState(() => {
    const name = initialData?.authorName || "Михаил";
    const role = initialData?.authorRole || "Системный архитектор прокси-сетей SMMplan";
    const matched = COMMON_AUTHORS.find(a => a.name === name && a.role === role);
    return matched ? name : "CUSTOM";
  });

  // Validation errors from server
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"editor" | "preview">("editor");

  // Handle auto-generation of slug
  React.useEffect(() => {
    if (!isSlugManuallyEdited && !isEdit) {
      setSlug(slugify(title));
    }
  }, [title, isSlugManuallyEdited, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    const payload = {
      title,
      slug,
      description,
      content,
      category,
      status: (isPublished ? "PUBLISHED" : "DRAFT") as "DRAFT" | "PUBLISHED",
      authorName,
      authorRole,
    };

    try {
      const res = isEdit 
        ? await updateArticle(initialData!.id, payload)
        : await createArticle(payload);

      if (res.success) {
        toast.success(isEdit ? "Статья успешно обновлена!" : "Статья успешно создана!");
        router.push("/admin/knowledge");
        router.refresh();
      } else {
        toast.error(res.error || "Не удалось сохранить статью");
        if ('errors' in res && res.errors) {
          setErrors(res.errors as Record<string, string[]>);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Произошла ошибка при отправке формы";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full max-w-5xl mx-auto">
      {/* Top back & actions wrapper */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/knowledge"
            className="text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">
              {isEdit ? "Редактирование статьи" : "Создание новой статьи"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Заполните поля формы. Все изменения вступают в силу немедленно.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] px-6 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer shadow-sm"
          >
            {isSubmitting ? "Сохранение..." : isEdit ? "Сохранить изменения" : "Опубликовать статью"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left main form controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm space-y-5">
            {/* Title field */}
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Заголовок статьи
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Как продвинуть подписчиков в Telegram безопасно"
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-colors"
                required
              />
              {errors.title && (
                <p className="text-xs text-destructive pl-1 font-semibold">{errors.title[0]}</p>
              )}
            </div>

            {/* Slug field */}
            <div className="space-y-1.5">
              <label htmlFor="slug" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Адрес статьи (URL Slug)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1.5 rounded-lg border border-border select-none">
                  /knowledge/
                </span>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setIsSlugManuallyEdited(true);
                  }}
                  placeholder="kak-nakrutit-podpischikov"
                  className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
              {errors.slug && (
                <p className="text-xs text-destructive pl-1 font-semibold">{errors.slug[0]}</p>
              )}
            </div>

            {/* Description field */}
            <div className="space-y-1.5">
              <label htmlFor="description" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Краткое описание (SEO Snippet)
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое содержание статьи для списка статей и поисковых роботов (минимум 10 символов)..."
                className="w-full p-4 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
                required
              />
              {errors.description && (
                <p className="text-xs text-destructive pl-1 font-semibold">{errors.description[0]}</p>
              )}
            </div>
          </div>

          {/* Markdown Content Editor with Live Preview tabs */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4 bg-muted/20">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Содержимое статьи (Markdown)
              </span>
              
              <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border/30">
                <button
                  type="button"
                  onClick={() => setActiveTab("editor")}
                  className={`min-h-[36px] px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "editor"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Редактор
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`min-h-[36px] px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "preview"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Предпросмотр
                </button>
              </div>
            </div>

            {activeTab === "editor" ? (
              <div className="p-6">
                <textarea
                  id="content"
                  rows={15}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Поддерживается Markdown разметка:&#10;# Заголовок H1&#10;## Заголовок H2&#10;### Заголовок H3&#10;- Маркированный список&#10;**Жирный текст**&#10;[Текст ссылки](https://smmplan.ru)"
                  className="w-full p-4 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary transition-colors resize-y leading-relaxed"
                  required
                />
                {errors.content && (
                  <p className="text-xs text-destructive pt-2 pl-1 font-semibold">{errors.content[0]}</p>
                )}
              </div>
            ) : (
              <div className="p-6 min-h-[320px] bg-background/30 prose max-w-none font-sans overflow-y-auto">
                {content.trim() === "" ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    Напишите что-нибудь в редакторе, чтобы увидеть живой предпросмотр!
                  </p>
                ) : (
                  renderMarkdown(content)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side settings panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm space-y-6">
            <h2 className="text-sm font-black text-foreground uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-primary" />
              Параметры публикации
            </h2>

            {/* Category selection */}
            <div className="space-y-2">
              <label htmlFor="category" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Категория
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-colors"
              >
                <option value="Подписчики">Подписчики (CHANNEL)</option>
                <option value="Лайки">Лайки (POST)</option>
                <option value="Просмотры">Просмотры (POST)</option>
                <option value="Реакции">Реакции (POST)</option>
                <option value="Комментарии">Комментарии (POST)</option>
                <option value="Бусты">Бусты (CHANNEL)</option>
                <option value="Stories">Stories (STORY)</option>
                <option value="Новости">Новости</option>
                <option value="Инструкции">Инструкции</option>
              </select>
              <p className="text-[10px] text-muted-foreground leading-snug px-1 pt-1">
                Категория используется для фильтрации статей и автоподбора рекомендуемых услуг продвижения.
              </p>
              {errors.category && (
                <p className="text-xs text-destructive pl-1 font-semibold">{errors.category[0]}</p>
              )}
            </div>

            {/* Publish state toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer min-h-[44px] select-none">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-5 h-5 rounded-lg border-border text-primary focus:ring-primary focus:ring-offset-0 accent-primary cursor-pointer shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-foreground">
                    Опубликовать статью
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Если выключено, статья останется в черновиках и будет видна только вам.
                  </p>
                </div>
              </label>
              {errors.status && (
                <p className="text-xs text-destructive pl-1 font-semibold">{errors.status[0]}</p>
              )}
            </div>
          </div>

          {/* Автор публикации */}
          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm space-y-6">
            <h2 className="text-sm font-black text-foreground uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
              <span className="text-primary font-bold text-base">👤</span>
              Автор статьи
            </h2>

            {/* Выбор автора */}
            <div className="space-y-2">
              <label htmlFor="authorSelect" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Выберите автора
              </label>
              <select
                id="authorSelect"
                value={selectedAuthorType}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedAuthorType(val);
                  if (val !== "CUSTOM") {
                    const matched = COMMON_AUTHORS.find(a => a.name === val);
                    if (matched) {
                      setAuthorName(matched.name);
                      setAuthorRole(matched.role);
                    }
                  }
                }}
                className="w-full h-11 min-h-[44px] px-3 rounded-[10px] border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all duration-200 cursor-pointer"
              >
                <option value="Михаил">Михаил (Архитектор)</option>
                <option value="Ольга">Ольга (SEO-специалист)</option>
                <option value="Дмитрий">Дмитрий (SMM-отдел)</option>
                <option value="CUSTOM">Другой автор (Указать вручную)</option>
              </select>
            </div>

            {/* Имя автора */}
            <div className="space-y-2">
              <label htmlFor="authorName" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Имя автора
              </label>
              <input
                id="authorName"
                type="text"
                value={authorName}
                onChange={(e) => {
                  setAuthorName(e.target.value);
                  setSelectedAuthorType("CUSTOM");
                }}
                placeholder="Имя автора"
                className="w-full h-11 min-h-[44px] px-4 rounded-[10px] border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all duration-200"
                required
              />
              {errors.authorName && (
                <p className="text-xs text-destructive pl-1 font-semibold">{errors.authorName[0]}</p>
              )}
            </div>

            {/* Роль автора */}
            <div className="space-y-2">
              <label htmlFor="authorRole" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Роль автора
              </label>
              <input
                id="authorRole"
                type="text"
                value={authorRole}
                onChange={(e) => {
                  setAuthorRole(e.target.value);
                  setSelectedAuthorType("CUSTOM");
                }}
                placeholder="Роль автора"
                className="w-full h-11 min-h-[44px] px-4 rounded-[10px] border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all duration-200"
                required
              />
              {errors.authorRole && (
                <p className="text-xs text-destructive pl-1 font-semibold">{errors.authorRole[0]}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
