import React from "react";

/**
 * Custom safe markdown renderer converting basic markdown tokens to secure React nodes
 * prevents any unsafe raw HTML rendering.
 */
export function renderMarkdown(content: string): React.ReactNode[] {
  if (!content) return [];
  const lines = content.split("\n");
  let insideList = false;
  let listItems: React.ReactNode[] = [];
  const elements: React.ReactNode[] = [];

  // Parse inline structures (bold and links) safely
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
        <li key={`li-${index}`} className="mb-2 leading-relaxed pl-1 text-sm md:text-base text-foreground/90">
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
          <h3 key={`h3-${index}`} className="text-lg md:text-xl font-bold mt-6 mb-3 text-foreground tracking-tight">
            {renderInline(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${index}`} className="text-xl md:text-2xl font-extrabold mt-8 mb-4 text-foreground tracking-tight border-b border-border/40 pb-2">
            {renderInline(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${index}`} className="text-2xl md:text-3xl font-black mt-8 mb-4 text-foreground tracking-tight">
            {renderInline(trimmed.substring(2))}
          </h1>
        );
      } else {
        elements.push(
          <p key={`p-${index}`} className="mb-5 text-sm md:text-base leading-relaxed text-foreground/90">
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
