/**
 * 指数退避重试函数
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      // 检查是否是 rate limit 错误
      const isRateLimit = 
        lastError.message.includes('rate limit') ||
        lastError.message.includes('429') ||
        (lastError as any).status === 429;

      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, delay));

      // 指数退避，但不超过最大延迟
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
}
