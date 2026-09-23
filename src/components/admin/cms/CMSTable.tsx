'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClientDate } from "@/components/ui/client-date";

export interface CMSItem {
  id: string;
  title: string;
  slug: string;
  type: string;
  isPublished: boolean;
  authorName: string | null;
  createdAt: Date | string;
}

export function CMSTable({ items }: { items: CMSItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Контент пока не создан
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table aria-label="CMS контент">
        <TableHeader>
          <TableRow>
            <TableHead>ЗАГОЛОВОК</TableHead>
            <TableHead>ТИП</TableHead>
            <TableHead>СТАТУС</TableHead>
            <TableHead>АВТОР</TableHead>
            <TableHead>ДАТА</TableHead>
            <TableHead className="text-right">ДЕЙСТВИЯ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item: CMSItem) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="text-xs text-muted-foreground">/{item.slug}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge intent={item.type === "ACADEMY_LESSON" ? "secondary" : "outline"}>
                  {item.type}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge intent={item.isPublished ? "primary" : "secondary"}>
                  {item.isPublished ? "Опубликовано" : "Черновик"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{item.authorName || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <ClientDate date={item.createdAt} format="date" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button asChild size="sm" intent="outline">
                    <Link href={`/admin/cms/${item.id}`}>Редактировать</Link>
                  </Button>
                  <Button asChild size="sm" intent="ghost">
                    <Link href={`/api/draft?slug=${item.slug}`} target="_blank">Preview</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
