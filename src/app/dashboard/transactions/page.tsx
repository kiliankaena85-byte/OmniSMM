export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((item) => [k, item]) : v !== undefined ? [[k, v]] : []
    )
  ).toString();

  redirect(`/dashboard/finance?tab=history${queryString ? `&${queryString}` : ''}`);
}
