import React from 'react';
import { JsonLd } from './JsonLd';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  items: FAQItem[];
  title?: string;
}

export function FAQSection({ items, title = "Частые вопросы" }: FAQSectionProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };

  return (
    <div className="mt-16 pt-12 border-t border-border">
      <JsonLd data={faqSchema} />
      <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight mb-8">
        {title}
      </h2>
      <div className="space-y-6">
        {items.map((item, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-3">{item.question}</h3>
            <p className="text-sm text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
