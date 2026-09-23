export interface GeneralFormState {
  success?: boolean;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface BotTestResult {
  success: boolean;
  username?: string;
  name?: string;
  botId?: string | number;
  bot?: unknown;
  pingMs?: number;
  error?: string;
}
