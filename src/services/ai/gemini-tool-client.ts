import { ProxyAgent } from 'undici';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';
import {
  GeminiContent,
  GeminiFunctionDeclaration,
  GeminiToolDefinition,
  ReActExecutionResult,
  ToolExecutionStep,
  GeminiToolClientOptions,
  GeminiExecutionContext,
  GeminiPart,
} from './types';
import { zodToGeminiFunctionDeclaration } from './zod-to-gemini-schema';
import { z } from 'zod';
import { registerEconomicHarnesses } from './harness-bridge';

const FALLBACK_MODEL_CASCADES = [
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];

const keyCooldownMap = new Map<string, number>();
const KEY_COOLDOWN_MS = 5 * 60 * 1000;
let keyRotationIndex = 0;

export class GeminiToolClient {
  private tools: Map<string, GeminiToolDefinition<z.ZodTypeAny, unknown>> = new Map();
  private options: GeminiToolClientOptions;

  constructor(options: GeminiToolClientOptions = {}) {
    this.options = {
      maxTurns: 10,
      stepTimeoutMs: 20000,
      totalTimeoutMs: 90000,
      temperature: 0.1,
      ...options,
    };

    if (this.options.autoRegisterEconomicHarnesses) {
      this.registerEconomicHarnesses();
    }
  }

  public registerTool<TSchema extends z.ZodTypeAny, TOutput>(
    tool: GeminiToolDefinition<TSchema, TOutput>
  ): this {
    if (this.tools.has(tool.name)) {
      console.warn(`[GeminiToolClient] Overwriting existing tool registration: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as unknown as GeminiToolDefinition<z.ZodTypeAny, unknown>);
    return this;
  }

  public getTool(name: string): GeminiToolDefinition<z.ZodTypeAny, unknown> | undefined {
    return this.tools.get(name);
  }

  public getRegisteredToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  public registerEconomicHarnesses(): this {
    registerEconomicHarnesses(this);
    return this;
  }

  public async executeToolDirectly(
    name: string,
    args: Record<string, unknown>,
    context?: Partial<GeminiExecutionContext>
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(
        `Tool '${name}' is not registered in GeminiToolClient. Available tools: ${this.getRegisteredToolNames().join(', ')}`
      );
    }
    const validatedArgs = tool.schema.parse(args || {});
    const execContext: GeminiExecutionContext = {
      turnIndex: 0,
      totalTokensUsed: 0,
      traceId: `direct-${Date.now()}`,
      staffUserId: this.options.staffUserId,
      tenantId: this.options.tenantId,
      ...context,
    };
    return await tool.handler(validatedArgs, execContext);
  }

  public getFunctionDeclarations(): GeminiFunctionDeclaration[] {
    const declarations: GeminiFunctionDeclaration[] = [];
    for (const tool of this.tools.values()) {
      if (tool.schema instanceof z.ZodObject) {
        declarations.push(zodToGeminiFunctionDeclaration(tool.name, tool.description, tool.schema));
      } else {
        declarations.push({
          name: tool.name,
          description: tool.description,
          parameters: { type: 'OBJECT', properties: {} },
        });
      }
    }
    return declarations;
  }

  public static async getDispatchers(): Promise<Array<ProxyAgent | undefined>> {
    let proxyRaw =
      process.env.GEMINI_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.ALL_PROXY ||
      '';

    try {
      const settings = await db.systemSettings.findFirst({ select: { geminiProxy: true } });
      if (settings?.geminiProxy && settings.geminiProxy.trim()) {
        proxyRaw = settings.geminiProxy.trim();
      }
    } catch {
      // Ignore DB access failure in headless test environments
    }

    const proxyUrls = proxyRaw
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter((p) => p.startsWith('http://') || p.startsWith('https://') || p.startsWith('socks5://'));

    if (proxyUrls.length === 0) {
      return [new ProxyAgent('http://127.0.0.1:7897'), new ProxyAgent('http://127.0.0.1:7890'), undefined];
    }

    return proxyUrls.map((url) => new ProxyAgent(url));
  }

  public static async getActiveKeyPool(staffUserId?: string, customApiKey?: string): Promise<string[]> {
    const candidateKeys: string[] = [];

    if (customApiKey && customApiKey.trim().length > 5) {
      candidateKeys.push(customApiKey.trim());
    }

    if (staffUserId) {
      try {
        const user = await db.user.findUnique({
          where: { id: staffUserId },
          select: { geminiApiKey: true },
        });
        if (user?.geminiApiKey) {
          const decrypted = VaultService.decrypt(user.geminiApiKey);
          if (decrypted && decrypted.trim().length > 5) {
            candidateKeys.push(decrypted.trim());
          }
        }
      } catch (err) {
        console.warn(`[GeminiToolClient] Failed to read staff key for ${staffUserId}:`, err);
      }
    }

    try {
      const settings = await db.systemSettings.findFirst({ select: { geminiApiKeys: true } });
      if (settings?.geminiApiKeys) {
        const decrypted = VaultService.decrypt(settings.geminiApiKeys);
        if (decrypted) {
          const dbKeys = decrypted
            .split(/[,\n]/)
            .map((k) => k.trim())
            .filter((k) => k.length > 5);
          candidateKeys.push(...dbKeys);
        }
      }
    } catch {
      // Ignore DB connection errors during bootstrap
    }

    const envKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 5);
    candidateKeys.push(...envKeys);

    const uniqueKeys = Array.from(new Set(candidateKeys));
    if (uniqueKeys.length === 0) return [];

    const now = Date.now();
    for (const [key, expiresAt] of keyCooldownMap.entries()) {
      if (now >= expiresAt) {
        keyCooldownMap.delete(key);
      }
    }

    const available = uniqueKeys.filter((k) => !keyCooldownMap.has(k));
    return available.length > 0 ? available : uniqueKeys;
  }

  public static markKeyCooldown(key: string, reason: string): void {
    const expiresAt = Date.now() + KEY_COOLDOWN_MS;
    keyCooldownMap.set(key, expiresAt);
    console.warn(`[GeminiToolClient] Key ...${key.slice(-6)} placed on cooldown for 5m. Reason: ${reason}`);
  }

  public async executeReActLoop(userPrompt: string): Promise<ReActExecutionResult<string>> {
    const startTime = Date.now();
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const steps: ToolExecutionStep[] = [];
    const contents: GeminiContent[] = [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ];

    const declarations = this.getFunctionDeclarations();
    const maxTurns = this.options.maxTurns || 10;
    let turnCount = 0;
    let finalModelUsed = '';

    while (turnCount < maxTurns) {
      turnCount++;
      const timeRemainingMs = (this.options.totalTimeoutMs || 90000) - (Date.now() - startTime);
      if (timeRemainingMs <= 0) {
        throw new Error(`[GeminiToolClient] Global execution timeout exceeded (${this.options.totalTimeoutMs}ms)`);
      }

      const activeKeys = await GeminiToolClient.getActiveKeyPool(
        this.options.staffUserId,
        this.options.customApiKey
      );
      if (activeKeys.length === 0) {
        throw new Error('GEMINI_API_KEY / GEMINI_API_KEYS is not configured in environment or database');
      }

      const startIndex = keyRotationIndex % activeKeys.length;
      keyRotationIndex = (keyRotationIndex + 1) % 100000;
      const keysToTry = [...activeKeys.slice(startIndex), ...activeKeys.slice(0, startIndex)];

      let responsePayload: Record<string, unknown> | null = null;
      let lastError: Error | null = null;
      const dispatchers = await GeminiToolClient.getDispatchers();

      keyLoop: for (const apiKey of keysToTry) {
        const candidateModels = Array.from(
          new Set([this.options.model || FALLBACK_MODEL_CASCADES[0], ...FALLBACK_MODEL_CASCADES])
        );

        for (const model of candidateModels) {
          for (const dispatcher of dispatchers) {
            try {
              const baseUrl = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(
                /\/$/,
                ''
              );
              const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

              const requestBody: Record<string, unknown> = {
                contents,
                ...(this.options.systemInstruction
                  ? { system_instruction: { parts: [{ text: this.options.systemInstruction }] } }
                  : {}),
                ...(declarations.length > 0
                  ? { tools: [{ function_declarations: declarations }] }
                  : {}),
                generationConfig: {
                  temperature: this.options.temperature ?? 0.1,
                  ...(this.options.maxOutputTokens ? { maxOutputTokens: this.options.maxOutputTokens } : {}),
                },
              };

              const stepTimeout = Math.min(this.options.stepTimeoutMs || 20000, timeRemainingMs);
              const res = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey,
                },
                body: JSON.stringify(requestBody),
                dispatcher,
                signal: AbortSignal.timeout(stepTimeout),
              } as unknown as RequestInit);

              if (res.status === 429 || res.status === 403) {
                const errText = await res.text();
                GeminiToolClient.markKeyCooldown(apiKey, `HTTP ${res.status}: ${errText.slice(0, 100)}`);
                continue keyLoop;
              }

              if (res.status === 404 || res.status === 400) {
                console.warn(`[GeminiToolClient] Model ${model} returned HTTP ${res.status}. Falling back...`);
                break;
              }

              if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
              }

              responsePayload = await res.json();
              finalModelUsed = model;
              break keyLoop;
            } catch (err: unknown) {
              lastError = err instanceof Error ? err : new Error(String(err));
              continue;
            }
          }
        }
      }

      if (!responsePayload) {
        throw lastError || new Error('All Gemini API keys, proxies, and models exhausted');
      }

      const candidate = (responsePayload?.candidates as Array<{ content?: { parts?: GeminiPart[] } }>)?.[0];
      const modelParts: GeminiPart[] = candidate?.content?.parts || [];

      const functionCalls = modelParts.filter((p) => p.functionCall);

      if (functionCalls.length === 0) {
        const textParts = modelParts.map((p) => p.text || '').join('');
        return {
          finalResponse: textParts,
          steps,
          totalTurns: turnCount,
          totalDurationMs: Date.now() - startTime,
          resolvedModel: finalModelUsed,
        };
      }

      contents.push({
        role: 'model',
        parts: modelParts,
      });

      const responseParts: GeminiPart[] = [];
      for (const fc of functionCalls) {
        if (!fc.functionCall) continue;
        const { name, args } = fc.functionCall;
        const tool = this.tools.get(name);
        const stepStart = Date.now();

        const usage = responsePayload?.usageMetadata as { totalTokenCount?: number } | undefined;
        const execContext: GeminiExecutionContext = {
          turnIndex: turnCount,
          totalTokensUsed: usage?.totalTokenCount || 0,
          traceId,
          staffUserId: this.options.staffUserId,
          tenantId: this.options.tenantId,
        };

        let resultPayload: Record<string, unknown>;
        let isError = false;

        if (!tool) {
          isError = true;
          resultPayload = {
            error: `Tool '${name}' is not registered in GeminiToolClient. Available tools: ${Array.from(
              this.tools.keys()
            ).join(', ')}`,
          };
        } else {
          try {
            const validatedArgs = tool.schema.parse(args || {});
            const rawOutput = await tool.handler(validatedArgs, execContext);
            resultPayload = typeof rawOutput === 'object' && rawOutput !== null
              ? (rawOutput as Record<string, unknown>)
              : { result: rawOutput };
          } catch (execErr: unknown) {
            isError = true;
            resultPayload = {
              error: execErr instanceof Error ? execErr.message : String(execErr),
            };
          }
        }

        const stepDuration = Date.now() - stepStart;
        steps.push({
          step: steps.length + 1,
          toolName: name,
          inputArgs: args,
          outputResult: resultPayload,
          durationMs: stepDuration,
          isError,
        });

        responseParts.push({
          functionResponse: {
            name,
            response: {
              name,
              content: resultPayload,
            },
          },
        });
      }

      contents.push({
        role: 'user',
        parts: responseParts,
      });
    }

    throw new Error(
      `[GeminiToolClient] Maximum ReAct execution iterations reached (${maxTurns}) without final convergence`
    );
  }
}
