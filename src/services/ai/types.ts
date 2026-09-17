import { z } from 'zod';

export type GeminiRole = 'user' | 'model' | 'function';

export interface GeminiFunctionCallPart {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiFunctionResponsePart {
  name: string;
  response: {
    name: string;
    content: Record<string, unknown>;
  };
}

export interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCallPart;
  functionResponse?: GeminiFunctionResponsePart;
}

export interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

export interface GeminiOpenApiSchema {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  description?: string;
  properties?: Record<string, GeminiOpenApiSchema>;
  required?: string[];
  items?: GeminiOpenApiSchema;
  enum?: string[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: GeminiOpenApiSchema;
}

export interface GeminiToolDeclaration {
  function_declarations: GeminiFunctionDeclaration[];
}

export interface GeminiToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny, TOutput = unknown> {
  name: string;
  description: string;
  schema: TSchema;
  handler: (args: z.infer<TSchema>, context: GeminiExecutionContext) => Promise<TOutput> | TOutput;
}

export interface GeminiExecutionContext {
  turnIndex: number;
  totalTokensUsed: number;
  traceId: string;
  staffUserId?: string;
  tenantId?: string;
}

export interface ToolExecutionStep {
  step: number;
  toolName: string;
  inputArgs: Record<string, unknown>;
  outputResult: unknown;
  durationMs: number;
  isError: boolean;
}

export interface ReActExecutionResult<TFinal = string> {
  finalResponse: TFinal;
  steps: ToolExecutionStep[];
  totalTurns: number;
  totalDurationMs: number;
  resolvedModel: string;
}

export interface GeminiToolClientOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxTurns?: number;
  stepTimeoutMs?: number;
  totalTimeoutMs?: number;
  staffUserId?: string;
  customApiKey?: string;
  tenantId?: string;
  autoRegisterEconomicHarnesses?: boolean;
}
