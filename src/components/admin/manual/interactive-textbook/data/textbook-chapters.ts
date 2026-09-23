/**
 * Interactive Textbook Chapters: Master Index & Query Helpers
 */

import { TextbookChapter, TextbookDomainId } from '../types';
import { CHAPTERS_PART_1 } from './textbook-chapters-part1';
import { CHAPTERS_PART_2 } from './textbook-chapters-part2';
import { CHAPTERS_PART_3 } from './textbook-chapters-part3';

export const ALL_TEXTBOOK_CHAPTERS: TextbookChapter[] = [
  ...CHAPTERS_PART_1,
  ...CHAPTERS_PART_2,
  ...CHAPTERS_PART_3,
];

export function getChaptersByDomain(domainId: TextbookDomainId): TextbookChapter[] {
  return ALL_TEXTBOOK_CHAPTERS.filter((ch) => ch.domainId === domainId);
}

export function getChapterById(id: string): TextbookChapter | undefined {
  return ALL_TEXTBOOK_CHAPTERS.find((ch) => ch.id === id);
}

export function searchChapters(query: string): TextbookChapter[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_TEXTBOOK_CHAPTERS;

  return ALL_TEXTBOOK_CHAPTERS.filter((ch) => {
    return (
      ch.title.toLowerCase().includes(q) ||
      ch.subtitle.toLowerCase().includes(q) ||
      ch.tags.some((t) => t.toLowerCase().includes(q)) ||
      ch.section1Scope.toLowerCase().includes(q) ||
      ch.section2Terms.some(
        (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
      ) ||
      ch.callouts.some((c) => c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q))
    );
  });
}
