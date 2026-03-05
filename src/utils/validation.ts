import { z } from 'zod';

/**
 * 验证并解析 JSON，如果失败则抛出错误
 */
export function validateJson<T>(schema: z.ZodSchema<T>, json: unknown): T {
  try {
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
}

/**
 * 尝试解析 JSON 字符串
 */
export function parseJsonSafely<T>(jsonString: string): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
