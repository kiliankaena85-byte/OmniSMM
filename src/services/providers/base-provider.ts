export interface ProviderServiceDto {
  service: string | number;
  name: string;
  category: string;
  rate: string; // Float as string
  min: string;
  max: string;
  type: string;
  desc?: string;
  dripfeed?: number | boolean;
  refill?: boolean | number;
  cancel?: boolean | number;
}

export interface ProviderBalanceDto {
  balance: string;
  currency: string;
}

export interface ProviderOrderResponseDto {
  status?: string;
  order?: number | string;
  error?: string;
}

export interface ProviderOrderStatusDto {
  order: string;
  status: string; // 'pending' | 'processing' | 'in progress' | 'completed' | 'partial' | 'canceled' | 'error'
  charge: string;
  start_count: string;
  remains: string;
  error?: string;
}

// "2": "Incorrect order ID" logic
export type ProviderMultiStatusResponse = Record<string, ProviderOrderStatusDto | string>;

export interface OrderCreationParams {
  service: number | string;
  link: string;
  quantity?: number;
  comments?: string;
  answers_number?: string;
  username?: string;
  runs?: number;
  interval?: number;
  ref?: string;
  custom_id?: string;
  [key: string]: unknown;
}

export interface ProviderCancelResultDto {
  success: boolean;
  error?: string;
  raw?: unknown;
}

export interface BaseProvider {
  getBalance(): Promise<ProviderBalanceDto>;
  getServices(): Promise<ProviderServiceDto[]>;
  createOrder(params: OrderCreationParams): Promise<ProviderOrderResponseDto>;
  getOrderStatus(orderId: string | number): Promise<ProviderOrderStatusDto>;
  getMultiOrderStatus(orderIds: (string | number)[]): Promise<ProviderMultiStatusResponse>;
  cancelOrder?(orderId: string | number): Promise<ProviderCancelResultDto>;
  refill(orderId: string | number): Promise<{ refill?: string | number; error?: string }>;
  getRefillStatus(refillId: string | number): Promise<{ status?: string; error?: string }>;
}

