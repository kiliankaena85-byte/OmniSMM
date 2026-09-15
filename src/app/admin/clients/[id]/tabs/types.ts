export interface UserDTO {
  id: string;
  email: string;
  role: string;
  personalDiscount: number;
  discountEndsAt: string | null;
  adminNote: string;
  adminNoteUpdatedAt: string | null;
  adminNoteUpdatedBy: string | null;
  telegramId: string | null;
  referralCode: string | null;
  companyName: string;
  inn: string;
  kpp: string;
  legalAddress: string;
  apiConfig: {
    isApiEnabled: boolean;
    prioritySupport: boolean;
    webhookUrl: string;
  } | null;
  createdAt: string;
  ordersCount: number;
  ticketsCount: number;
  paymentsCount: number;
  balance?: number;
  quarantineBalance?: number;
  totalSpent?: number;
  referralBalance?: number;
}

export interface PaymentDTO {
  id: string;
  amountRub: number;
  amountCents: number;
  currency: string;
  status: string;
  gateway: string;
  gatewayId: string | null;
  receiptId: string | null;
  refundReceiptId: string | null;
  createdAt: string;
}

export interface OrderDTO {
  id: string;
  numericId: number;
  status: string;
  quantity: number;
  chargeRub: number;
  serviceName: string;
  createdAt: string;
}

export interface LoginLogDTO {
  id: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failReason: string | null;
  createdAt: string;
}

export interface ClientLedgerEntryDTO {
  id: string;
  amountRub: number;
  amountCents: number;
  direction: 'INCOME' | 'EXPENSE';
  reason: string;
  status: string;
  transactionType: string;
  idempotencyKey?: string | null;
  adminEmail: string | null;
  createdAt: string;
}

export interface ClientLedgerSummaryDTO {
  totalDepositedRub: number;
  totalSpentRub: number;
  totalRefundedRub: number;
  totalAdjustedRub: number;
}

export interface UserNoteDTO {
  id: string;
  userId: string;
  content: string;
  authorEmail: string | null;
  createdAt: string;
}

export function parseUserAgent(ua: string) {
  if (!ua) return 'Unknown Browser / OS';
  let browser = 'Other Browser';
  let os = 'Other OS';
  const lowerUA = ua.toLowerCase();
  
  if (lowerUA.includes('firefox')) browser = 'Firefox';
  else if (lowerUA.includes('chrome') && !lowerUA.includes('chromium')) browser = 'Chrome';
  else if (lowerUA.includes('safari') && !lowerUA.includes('chrome')) browser = 'Safari';
  else if (lowerUA.includes('edge') || lowerUA.includes('edg')) browser = 'Edge';
  else if (lowerUA.includes('opera') || lowerUA.includes('opr')) browser = 'Opera';
  
  if (lowerUA.includes('windows')) os = 'Windows';
  else if (lowerUA.includes('macintosh') || lowerUA.includes('mac os')) os = 'macOS';
  else if (lowerUA.includes('android')) os = 'Android';
  else if (lowerUA.includes('iphone') || lowerUA.includes('ipad')) os = 'iOS';
  else if (lowerUA.includes('linux')) os = 'Linux';
  
  return `${browser} on ${os}`;
}
