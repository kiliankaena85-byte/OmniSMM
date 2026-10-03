import * as React from 'react';

interface RootJsonLdProps {
  siteName: string;
  siteBaseUrl: string;
  supportEmail: string;
  nonce?: string;
}

export function RootJsonLd({
  siteName,
  siteBaseUrl,
  supportEmail,
  nonce,
}: RootJsonLdProps) {
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteName,
      url: siteBaseUrl,
      logo: `${siteBaseUrl}/images/logo.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: supportEmail,
        availableLanguage: 'Russian',
      },
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'RU',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: siteBaseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteBaseUrl}/services?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  );
}
