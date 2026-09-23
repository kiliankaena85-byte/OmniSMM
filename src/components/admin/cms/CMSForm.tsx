'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createContent, updateContent, publishContent, unpublishContent } from "@/actions/admin/content";
import DynamicEditor from "./DynamicEditor";

type ContentType = "PAGE" | "ACADEMY_LESSON" | "GLOSSARY_TERM" | "NEWS_POST";

// Встроенный тип для обхода ошибки кэширования TS Server (Prisma)
type ContentItemData = {
  id: string;
  title: string;
  slug: string;
  type: string;
  contentJson: string | null;
  excerpt: string | null;
  isPublished: boolean;
};

interface CMSFormProps {
  initialData?: ContentItemData | null;
}

export default function CMSForm({ initialData }: CMSFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Локальный стейт формы
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [type, setType] = useState<ContentType>((initialData?.type as ContentType) || "PAGE");
  const [excerpt, setExcerpt] = useState<string>(initialData?.excerpt || "");
  const [contentJson, setContentJson] = useState(initialData?.contentJson || "");

  const isEditing = !!initialData;

  const handleSaveDraft = () => {
    startTransition(async () => {
      setError(null);
      if (isEditing) {
        // Просто сохраняем JSON в базу без тяжелой HTML-генерации
        const res = await updateContent(initialData.id, {
          title, slug, type, excerpt, contentJson
        });
        if (!res.success) setError(res.error || "Ошибка сохранения черновика");
      } else {
        // Создание новой статьи через FormData
        const formData = new FormData();
        formData.append("title", title);
        formData.append("slug", slug);
        formData.append("type", type);
        // При создании сразу пушим JSON
        const res = await createContent(formData);
        if (res.success && res.item) {
          // После создания черновика обновляем его JSON контентом
          await updateContent(res.item.id, { contentJson });
          router.push(`/admin/cms/${res.item.id}`);
        } else {
          setError(res.error || "Ошибка создания");
        }
      }
    });
  };

  const handlePublish = () => {
    startTransition(async () => {
      setError(null);
      if (!isEditing) return;

      // Сначала сохраняем последние изменения черновика
      await updateContent(initialData.id, {
        title, slug, type, excerpt, contentJson
      });

      // Запускаем тяжелую конвертацию HTML (blocksToHTMLLossy)
      const res = await publishContent(initialData.id);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error || "Ошибка публикации");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Левая колонка - Редактор */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Заголовок</Label>
          <Input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required
          />
        </div>
        <div className="min-h-[500px]">
          <DynamicEditor 
            initialContent={contentJson} 
            onChange={(json) => setContentJson(json)} 
          />
        </div>
      </div>

      {/* Правая колонка - Настройки и SEO */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 mt-4">
            <h3 className="font-semibold text-foreground">Настройки статьи</h3>
            
            <div className="flex flex-col gap-2">
              <Label>Тип контента</Label>
              <Select value={type} onValueChange={(val) => setType(val || "PAGE")}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип">
                    {(value: string) => {
                      const items = [
                        { value: "PAGE", label: "Статическая страница" },
                        { value: "ACADEMY_LESSON", label: "Урок Академии" },
                        { value: "GLOSSARY_TERM", label: "Термин Глоссария" },
                        { value: "NEWS_POST", label: "Новость" },
                      ];
                      return items.find(i => i.value === value)?.label ?? value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAGE" label="Статическая страница">Статическая страница</SelectItem>
                  <SelectItem value="ACADEMY_LESSON" label="Урок Академии">Урок Академии</SelectItem>
                  <SelectItem value="GLOSSARY_TERM" label="Термин Глоссария">Термин Глоссария</SelectItem>
                  <SelectItem value="NEWS_POST" label="Новость">Новость</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Slug (URL)</Label>
              <Input 
                value={slug} 
                onChange={(e) => setSlug(e.target.value)} 
                required
              />
              <span className="text-xs text-muted-foreground">/p/{slug || "..."}</span>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Краткое описание (Excerpt)</Label>
              <Textarea 
                value={excerpt} 
                onChange={(e) => setExcerpt(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Панель публикации */}
        <Card>
          <CardContent className="flex flex-col gap-4 mt-4">
            <h3 className="font-semibold text-foreground">Статус</h3>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${initialData?.isPublished ? 'bg-success' : 'bg-warning'}`}></span>
              <span>{initialData?.isPublished ? "Опубликовано" : "Черновик"}</span>
            </div>

            {error && <div className="text-danger text-sm">{error}</div>}

            <div className="flex flex-col gap-2 mt-4">
              <Button 
                intent="outline"
                onClick={handleSaveDraft} 
                disabled={isPending}
              >
                {isEditing ? "Сохранить черновик" : "Создать статью"}
              </Button>

              {isEditing && (
                <Button 
                  onClick={handlePublish} 
                  disabled={isPending}
                >
                  {initialData?.isPublished ? "Обновить публикацию" : "Опубликовать"}
                </Button>
              )}

              {isEditing && initialData?.isPublished && (
                 <Button 
                 intent="destructive"
                 onClick={() => startTransition(async () => { await unpublishContent(initialData.id); })} 
                 disabled={isPending}
               >
                 Снять с публикации
               </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
