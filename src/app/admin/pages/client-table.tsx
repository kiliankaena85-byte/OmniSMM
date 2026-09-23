'use client';

import { Table } from '@/components/admin/hero-ui';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type PageType = {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  updatedAt: Date;
};

export function PagesTable({ pages }: { pages: PageType[] }) {
  return (
    <>
      <Table aria-label="Таблица страниц">
        <Table.ScrollContainer>
          <Table.Content aria-label="CMS Pages">
            <Table.Header>
              <Table.Column isRowHeader>Заголовок</Table.Column>
              <Table.Column>Ссылка (Slug)</Table.Column>
              <Table.Column>Статус</Table.Column>
              <Table.Column>Последнее изменение</Table.Column>
              <Table.Column className="text-right">Действия</Table.Column>
            </Table.Header>
            <Table.Body renderEmptyState={() => "Страницы не найдены. Нажмите 'Создать Страницу'."}>
              {pages.map((page) => {
                // Determine preview path (legal pages vs static pages)
                const isLegalPage = ['privacy', 'terms', 'refund', 'rules', 'cookie'].includes(page.slug);
                const previewPath = isLegalPage ? `/legal/${page.slug}` : `/p/${page.slug}`;

                return (
                  <Table.Row key={page.id}>
                    <Table.Cell>
                      <span className="font-bold text-foreground">{page.title}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-muted-foreground text-xs">{previewPath}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge intent={page.isPublished ? 'primary' : 'secondary'}>
                        {page.isPublished ? 'Опубликовано' : 'Черновик'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-muted-foreground tabular-nums text-xs">
                        {new Date(page.updatedAt).toLocaleDateString('ru-RU')} в {new Date(page.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-4">
                        <Link
                          href={previewPath}
                          target="_blank"
                          className="text-muted-foreground hover:text-foreground transition-colors text-xs font-bold"
                        >
                          Предпросмотр
                        </Link>
                        <Link
                          href={`/admin/cms/${page.id}`}
                          className="text-primary hover:underline transition-colors font-bold text-xs"
                        >
                          Редактировать
                        </Link>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </>
  );
}
