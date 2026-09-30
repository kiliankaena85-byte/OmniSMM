/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * OmniDesign MCP Hub — Type Definitions.
 */

export interface McpToolProperty {
  type: string;
  description: string;
  items?: { type: string };
  enum?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: {
    protocolVersion?: string;
    capabilities?: Record<string, unknown>;
    serverInfo?: Record<string, string>;
    tools?: McpToolDefinition[];
    content?: Array<{ type: 'text'; text: string }>;
    data?: unknown;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface InspectJsxNodesParams {
  filePathOrCode?: string;
  filePath?: string;
  code?: string;
}

export interface TagComponentTreeParams {
  code?: string;
  filePath?: string;
  componentName?: string;
}

export interface MutateClassesParams {
  filePath?: string;
  code?: string;
  structuralPath: string;
  mutation: {
    addClasses?: string[];
    removeClasses?: string[];
  };
}

export interface TokenViolation {
  file?: string;
  line?: number;
  matched: string;
  reason: string;
  replacement: string;
  codeSnippet?: string;
}

export interface ValidateDesignTokensParams {
  path?: string;
  code?: string;
  brand?: 'smmplan' | 'smmflux' | 'all';
}

export interface ValidateDesignTokensResult {
  valid: boolean;
  violationsCount: number;
  scannedFilesCount: number;
  violations: TokenViolation[];
}

export interface GenerateDesignCandidateParams {
  componentName: string;
  brand?: 'smmflux' | 'smmplan';
  category?: 'card' | 'table' | 'wizard' | 'button' | 'badge' | 'hud' | 'custom';
  title?: string;
  description?: string;
}

export interface GenerateDesignCandidateResult {
  componentName: string;
  brand: 'smmflux' | 'smmplan';
  category: string;
  candidateCode: string;
  lineCount: number;
  adheresToMaxLines: boolean;
  tokenValidation: {
    valid: boolean;
    violationsCount: number;
  };
}
