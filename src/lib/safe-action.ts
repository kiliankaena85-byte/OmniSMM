import { z } from 'zod';
import { handleServerError } from '@/utils/error-handler';

export type ServerActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; issues?: string[]; code?: string; email?: string };

/**
 * A highly secured wrapper for Server Actions.
 * It validates input using Zod and catches any internal throws
 * (including Prisma errors) so that stack traces never leak to the client.
 */
export async function createSafeAction<TInput, TOutput>(
  schema: z.Schema<TInput> | null,
  input: unknown,
  handler: (validatedInput: TInput) => Promise<TOutput>
): Promise<ServerActionResponse<TOutput>> {
  try {
    let parsedInput = input as TInput;

    if (schema) {
      const validation = schema.safeParse(input);
      if (!validation.success) {
        const formattedIssues = validation.error.issues.map((i) => i.message);
        return {
          success: false,
          error: formattedIssues.length > 0 ? formattedIssues[0] : 'Ошибка заполнения формы',
          issues: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
      }
      parsedInput = validation.data;
    }

    const data = await handler(parsedInput);
    return { success: true, data };
  } catch (error: unknown) {
    // 1. Log the full detailed error securely on the server
    console.error('[SAFE_ACTION_ERROR]', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // 2. Standardize and localize the error for the client (Task 1.2)
    const localized = handleServerError(error);
    return {
      success: false,
      error: localized.message,
      code: localized.code,
      email: localized.email || (error as { email?: string })?.email
    };
  }
}
