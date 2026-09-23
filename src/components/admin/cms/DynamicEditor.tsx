'use client';

import dynamic from "next/dynamic";
import { Skeleton } from "@heroui/react";

// Ленивая загрузка редактора без Server-Side Rendering
// Это критически важно для предотвращения ошибки "window is not defined"
const BlockNoteEditor = dynamic(() => import("./BlockNoteEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 border border-divider rounded-lg p-4 flex flex-col gap-4">
      <Skeleton className="h-6 w-3/4 rounded-lg" />
      <Skeleton className="h-4 w-full rounded-lg" />
      <Skeleton className="h-4 w-5/6 rounded-lg" />
      <Skeleton className="h-4 w-1/2 rounded-lg" />
    </div>
  ),
});

export default BlockNoteEditor;
