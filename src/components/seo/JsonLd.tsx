/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * 
 * Reusable JSON-LD component for SEO/AEO.
 */

import React from 'react';

// Common Schema.org types for SMM platforms
export type JsonLdType = 'Organization' | 'Product' | 'FAQPage' | 'BreadcrumbList' | 'WebSite' | 'Service';

export interface JsonLdData {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

interface JsonLdProps {
  data: JsonLdData | JsonLdData[];
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
