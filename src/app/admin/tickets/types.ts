import { OrderStatus, TicketStatus, TicketSource } from '@prisma/client';

export interface AdminTicketItem {
  id: string;
  subject: string;
  status: string;
  source: string;
  updatedAt: Date | string;
  createdAt: Date | string;
  user: {
    id: string;
    email: string;
    apiConfig?: { isApiEnabled?: boolean } | null;
  };
  _count: { messages: number };
  messages: { text: string; createdAt: Date; sender: string }[];
}

export interface TicketStatsDTO {
  total: number;
  open: number;
  pending: number;
  closed: number;
  criticalOpen: number;
  avgFRTMin: number;
  avgTTRMin: number;
}

export interface AttachedOrderDTO {
  id: string;
  numericId: number;
  status: OrderStatus;
  charge: number;
  remains: number;
  quantity: number;
  link: string;
  createdAt: string;
  serviceName: string;
  externalId?: string | null;
  provider?: { name: string; apiUrl?: string } | null;
}

export interface ActiveTicketUserOrder {
  id: string;
  numericId: number;
  status: OrderStatus;
  quantity: number;
  charge: number;
  createdAt: string;
  serviceName: string;
  service: { name: string };
}

export interface ActiveTicketUserPayment {
  id: string;
  amount: number | bigint;
  status: string;
  gateway: string;
  createdAt: string;
}

export interface ActiveTicketUser {
  id: string;
  email: string;
  balance: number | bigint;
  totalSpent: number | bigint;
  createdAt: string;
  apiConfig: {
    isApiEnabled: boolean;
    prioritySupport: boolean;
    webhookUrl: string | null;
  } | null;
  orders: ActiveTicketUserOrder[];
  payments: ActiveTicketUserPayment[];
}

export interface ActiveTicketDTO {
  id: string;
  subject: string;
  status: TicketStatus;
  source: TicketSource;
  orderId: string | null;
  order: {
    id: string;
    numericId: number;
    status: OrderStatus;
    charge: number;
    createdAt: string;
    serviceName: string;
    isCancelEnabled?: boolean;
    externalId?: string | null;
    provider?: { name: string; apiUrl?: string } | null;
  } | null;
  attachedOrders: AttachedOrderDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
  nextCursor?: string | null;
  user: ActiveTicketUser;
  messages: Array<{
    id: string;
    text: string;
    sender: string;
    createdAt: string;
    userEmail?: string;
    attachments?: Array<{
      id: string;
      url: string;
      type: string;
      mimeType?: string | null;
      name?: string | null;
      size?: number | null;
      createdAt: string;
    }>;
  }>;
}

export interface TicketTemplateDTO {
  id: string;
  shortcut: string | null;
  label: string;
  text: string;
  category: string;
  sort: number;
  isActive?: boolean;
  useCount?: number;
}
