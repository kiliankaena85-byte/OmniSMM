export const dynamic = 'force-static';

export async function GET() {
  const body = [
    'Contact: mailto:security@smmplan.pro',
    'Contact: https://t.me/artmspektr',
    'Expires: 2027-12-31T23:59:59.000Z',
    'Preferred-Languages: ru, en',
    'Policy: https://smmplan.pro/legal/terms',
    'Canonical: https://smmplan.pro/.well-known/security.txt'
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
