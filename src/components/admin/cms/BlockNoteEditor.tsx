'use client';

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useState } from "react";

interface BlockNoteEditorProps {
  initialContent?: string | null;
  onChange?: (jsonString: string) => void;
  readOnly?: boolean;
}

export default function BlockNoteEditor({ initialContent, onChange, readOnly = false }: BlockNoteEditorProps) {
  // Инициализация редактора
  const editor = useCreateBlockNote();
  const [isReady, setIsReady] = useState(false);

  // Асинхронная загрузка начального контента
  useEffect(() => {
    async function loadInitialContent() {
      if (initialContent) {
        try {
          const blocks = JSON.parse(initialContent);
          editor.replaceBlocks(editor.document, blocks);
        } catch (e) {
          console.error("Failed to parse initial content for BlockNote", e);
        }
      }
      setIsReady(true);
    }
    loadInitialContent();
  }, [editor, initialContent]);

  if (!isReady) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground animate-pulse">Загрузка редактора...</div>;
  }

  return (
    <div className="border border-divider rounded-lg overflow-hidden bg-background">
      <div className="max-h-[600px] overflow-y-auto p-4 prose prose-neutral dark:prose-invert max-w-none">
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          onChange={() => {
            if (onChange) {
              const blocks = editor.document;
              onChange(JSON.stringify(blocks));
            }
          }}
          theme="light" // В SMMplan можно связать с текущей темой Next-Themes
        />
      </div>
    </div>
  );
}
