import { z } from 'zod';
import { GeminiFunctionDeclaration, GeminiOpenApiSchema } from './types';

export function zodToGeminiProperty(schema: z.ZodTypeAny): GeminiOpenApiSchema {
  let current: z.ZodTypeAny = schema;
  let description: string | undefined = undefined;

  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodEffects
  ) {
    if (current.description) description = current.description;
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = current.unwrap();
    } else if (current instanceof z.ZodDefault) {
      current = current._def.innerType;
    } else if (current instanceof z.ZodEffects) {
      current = current._def.schema;
    }
  }

  if (current.description && !description) {
    description = current.description;
  }

  if (current instanceof z.ZodString) {
    return { type: 'STRING', ...(description ? { description } : {}) };
  }

  if (current instanceof z.ZodNumber) {
    const isInt = current._def.checks.some((c) => c.kind === 'int');
    return {
      type: isInt ? 'INTEGER' : 'NUMBER',
      ...(description ? { description } : {}),
    };
  }

  if (current instanceof z.ZodBoolean) {
    return { type: 'BOOLEAN', ...(description ? { description } : {}) };
  }

  if (current instanceof z.ZodEnum) {
    return {
      type: 'STRING',
      enum: current._def.values,
      ...(description ? { description } : {}),
    };
  }

  if (current instanceof z.ZodNativeEnum) {
    const values = Object.values(current._def.values).filter((v) => typeof v === 'string') as string[];
    return {
      type: 'STRING',
      enum: values,
      ...(description ? { description } : {}),
    };
  }

  if (current instanceof z.ZodArray) {
    return {
      type: 'ARRAY',
      items: zodToGeminiProperty(current.element),
      ...(description ? { description } : {}),
    };
  }

  if (current instanceof z.ZodObject) {
    const shape = current.shape;
    const properties: Record<string, GeminiOpenApiSchema> = {};
    const required: string[] = [];

    for (const [key, propSchema] of Object.entries(shape)) {
      const fieldSchema = propSchema as z.ZodTypeAny;
      properties[key] = zodToGeminiProperty(fieldSchema);

      const isOptional =
        fieldSchema instanceof z.ZodOptional ||
        fieldSchema instanceof z.ZodDefault ||
        (fieldSchema instanceof z.ZodNullable && !(fieldSchema instanceof z.ZodEffects));

      if (!isOptional) {
        required.push(key);
      }
    }

    return {
      type: 'OBJECT',
      properties,
      ...(required.length > 0 ? { required } : {}),
      ...(description ? { description } : {}),
    };
  }

  if (current instanceof z.ZodRecord) {
    return {
      type: 'OBJECT',
      ...(description ? { description } : {}),
    };
  }

  return {
    type: 'STRING',
    ...(description ? { description } : {}),
  };
}

export function zodToGeminiFunctionDeclaration<TSchema extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  schema: TSchema
): GeminiFunctionDeclaration {
  const openApiSchema = zodToGeminiProperty(schema);
  return {
    name,
    description,
    parameters: openApiSchema,
  };
}
