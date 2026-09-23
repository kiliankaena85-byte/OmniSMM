import type { Order, User, Service, Category, Network } from '@prisma/client';

export type AdminOrderRow = Order & {
  user: Pick<User, 'id' | 'email'>;
  service: Pick<Service, 'id' | 'name' | 'numericId' | 'etaP50Seconds' | 'etaP90Seconds' | 'etaSampleCount' | 'etaSpeedClass' | 'etaUpdatedAt'> & {
    category: Pick<Category, 'name'> & {
      network: Pick<Network, 'name'> | null;
    };
  };
  provider: { name: string; ticketUrl: string | null } | null;
  payment: { id: string; gatewayId: string | null; gateway: string } | null;
};

export type OrderSearchParams = {
  query?: string;
  status?: string;
  activityType?: string;
  datePreset?: string;
  cursor?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
  clientEmail?: string;
  orderId?: number;
  externalId?: string;
  serviceName?: string;
  networkSlug?: string;
  link?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  maxQuantity?: number;
  tenantId?: string;
  isDripFeed?: boolean;
  hasError?: boolean;
  errorCategory?: 'BALANCE' | 'LINK' | 'SERVICE' | 'ALL' | string;
  noProvider?: boolean;
  staleMinutes?: number;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  providerId?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  environmentMode?: string;
};

export const ACTIVITY_TYPE_KEYWORDS: Record<string, string[]> = {
  subscribers: ['подписчик', 'участник', 'фолловер', 'subscriber', 'follower', 'member', 'sub'],
  likes: ['лайк', 'реакци', 'like', 'reaction', 'heart'],
  views: ['просмотр', 'охват', 'view', 'impression', 'reach'],
  comments: ['комментар', 'отзыв', 'comment', 'review'],
  reposts: ['репост', 'поделиться', 'share', 'retweet'],
  polls: ['опрос', 'голосов', 'vote', 'poll'],
  watchtime: ['час', 'удержан', 'длительн', 'watch time', 'hour', 'duration'],
};

export function resolveOrderOrderBy(
  sortField?: string,
  sortOrder?: 'asc' | 'desc'
): Record<string, any> {
  const defaultOrderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
  if (!sortField) return defaultOrderBy;

  const dir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

  if (['numericId', 'status', 'quantity', 'remains', 'charge', 'providerCost', 'createdAt', 'updatedAt'].includes(sortField)) {
    return { [sortField]: dir };
  }

  if (sortField === 'client' || sortField === 'user' || sortField === 'email') {
    return { user: { email: dir } };
  }

  return defaultOrderBy;
}
