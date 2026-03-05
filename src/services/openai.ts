import OpenAI from 'openai';
import { z } from 'zod';
import { retryWithBackoff } from '../utils/retry.js';
import { validateJson, parseJsonSafely } from '../utils/validation.js';

/**
 * 从文本中提取第一个完整的 JSON 对象
 * 处理 JSON 之后可能有额外文本的情况
 */
function extractFirstJsonObject(text: string): string {
  text = text.trim();
  
  // 如果整个文本是有效的 JSON，直接返回
  try {
    JSON.parse(text);
    return text;
  } catch {
    // 继续处理
  }

  // 查找第一个 { 的位置
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('No JSON object found in response');
  }

  // 从第一个 { 开始，找到匹配的 }
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let jsonEnd = -1;

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        jsonEnd = i;
        break;
      }
    }
  }

  if (jsonEnd === -1) {
    throw new Error('Invalid JSON: unmatched braces');
  }

  // 提取 JSON 部分
  const jsonText = text.substring(firstBrace, jsonEnd + 1).trim();
  
  // 验证提取的 JSON 是否有效
  try {
    JSON.parse(jsonText);
    return jsonText;
  } catch (error) {
    throw new Error(`Failed to extract valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  /** Model for Responses API (web search). Defaults to gpt-4o if not set; use a model that supports web_search_preview. */
  responsesModel?: string;
}

export interface ChatCompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' };
}

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private responsesModel: string;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'gpt-5.2';
    this.responsesModel = config.responsesModel || 'gpt-4o';
  }

  /**
   * 使用 OpenAI Responses API 的 Web Search 进行搜索。
   * 仅将 searchQuery（如用户输入的公司信息）作为搜索关键词传入，不作为普通对话内容。
   * 返回搜索与整合后的文本（output_text）。
   */
  async webSearch(searchQuery: string, maxRetries: number = 3): Promise<string> {
    return retryWithBackoff(
      async () => {
        const input =
          `Use web search to find current, factual information. Search using exactly these terms and return a concise summary with key facts and sources:\n\n${searchQuery.trim()}`;
        const response = await this.client.responses.create({
          model: this.responsesModel as 'gpt-4o',
          input,
          tools: [{ type: 'web_search_preview' as const }],
          max_output_tokens: 2000,
        });
        const text = (response as { output_text?: string }).output_text;
        if (text == null || text === '') {
          throw new Error('Empty response from OpenAI Responses API (web search)');
        }
        return text;
      },
      {
        maxRetries,
        onRetry: (error, attempt) => {
          console.warn(`OpenAI web search failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
        },
      }
    );
  }

  /**
   * 调用 OpenAI API 并返回 JSON 响应
   * 使用 prompt 方式确保 JSON 格式，兼容所有模型
   */
  async generateJson<T>(
    options: ChatCompletionOptions,
    schema: z.ZodSchema<T>,
    maxRetries: number = 3,
    saveRawResponsePath?: string
  ): Promise<T> {
    return retryWithBackoff(
      async () => {
        // 构建请求参数 - 直接使用模板中的 prompt，不添加额外要求
        // 模板中已经包含了 JSON 格式要求
        const requestParams: any = {
          model: this.model,
          messages: [
            { role: 'system' as const, content: options.systemPrompt },
            { role: 'user' as const, content: options.userPrompt },
          ],
          temperature: options.temperature ?? 0.7,
        };
        
        // GPT-5.2 及新模型使用 max_completion_tokens，旧模型使用 max_tokens
        if (options.maxTokens) {
          if (this.model.includes('gpt-5') || this.model.includes('o1')) {
            requestParams.max_completion_tokens = options.maxTokens;
          } else {
            requestParams.max_tokens = options.maxTokens;
          }
        }

        // 调试：打印实际发送的完整 prompt（可通过环境变量 DEBUG=true 启用）
        if (process.env.DEBUG === 'true') {
          console.log('\n' + '='.repeat(80));
          console.log('📤 OpenAI API Request');
          console.log('='.repeat(80));
          console.log('\n【System Prompt】');
          console.log(requestParams.messages[0].content);
          console.log('\n【User Prompt】');
          console.log(requestParams.messages[1].content);
          console.log('\n【Parameters】');
          console.log(`Model: ${requestParams.model}`);
          console.log(`Temperature: ${requestParams.temperature}`);
          console.log(`Max Tokens: ${requestParams.max_completion_tokens || requestParams.max_tokens || 'unlimited'}`);
          console.log('='.repeat(80) + '\n');
        }

        const response = await this.client.chat.completions.create(requestParams);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        // 保存原始返回内容
        if (saveRawResponsePath) {
          const { writeFileSync } = await import('fs');
          writeFileSync(saveRawResponsePath, content, 'utf-8');
        }

        // 清理内容：移除可能的 markdown 代码块标记
        let cleanedContent = content.trim();
        
        // 移除 ```json 和 ``` 标记
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/\s*```\s*$/m, '');
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/i, '').replace(/\s*```\s*$/m, '');
        }

        // 提取第一个完整的 JSON 对象（忽略后面的文本）
        cleanedContent = extractFirstJsonObject(cleanedContent);

        // 解析 JSON
        let json: T;
        try {
          json = parseJsonSafely<T>(cleanedContent);
        } catch (error) {
          // 如果解析失败，保存清理后的内容以便调试
          if (saveRawResponsePath) {
            const { writeFileSync } = await import('fs');
            writeFileSync(saveRawResponsePath.replace('.raw.txt', '.cleaned.txt'), cleanedContent, 'utf-8');
          }
          throw error;
        }

        // 验证 schema
        return validateJson(schema, json);
      },
      {
        maxRetries,
        onRetry: (error, attempt) => {
          console.warn(`OpenAI API call failed (attempt ${attempt}): ${error.message}`);
        },
      }
    );
  }

  /**
   * 调用 OpenAI API 并返回文本响应（用于非 JSON 输出）
   */
  async generateText(
    options: ChatCompletionOptions,
    maxRetries: number = 3,
    savePromptPath?: string
  ): Promise<string> {
    return retryWithBackoff(
      async () => {
        const systemPrompt = options.systemPrompt;
        const userPrompt = options.userPrompt;
        
        // 保存最终发送的 prompt
        if (savePromptPath) {
          const { writeFileSync } = await import('fs');
          const fullPrompt = `=== System Prompt ===\n\n${systemPrompt}\n\n=== User Prompt ===\n\n${userPrompt}\n\n=== Parameters ===\nModel: ${this.model}\nTemperature: ${options.temperature ?? 0.7}\nMax Tokens: ${options.maxTokens ?? 'unlimited'}\n`;
          writeFileSync(savePromptPath, fullPrompt, 'utf-8');
        }

        const requestParams: any = {
          model: this.model,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
          ],
          temperature: options.temperature ?? 0.7,
        };
        
        // GPT-5.2 及新模型使用 max_completion_tokens，旧模型使用 max_tokens
        if (options.maxTokens) {
          if (this.model.includes('gpt-5') || this.model.includes('o1')) {
            requestParams.max_completion_tokens = options.maxTokens;
          } else {
            requestParams.max_tokens = options.maxTokens;
          }
        }
        
        const response = await this.client.chat.completions.create(requestParams);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return content;
      },
      {
        maxRetries,
        onRetry: (error, attempt) => {
          console.warn(`OpenAI API call failed (attempt ${attempt}): ${error.message}`);
        },
      }
    );
  }

  /**
   * 与 generateText 相同，但额外返回 finish_reason，用于判断是否因 max_tokens 被截断（finish_reason === 'length'）
   */
  async generateTextWithMeta(
    options: ChatCompletionOptions,
    maxRetries: number = 3,
    savePromptPath?: string
  ): Promise<{ text: string; finishReason: string | null }> {
    return retryWithBackoff(
      async () => {
        const systemPrompt = options.systemPrompt;
        const userPrompt = options.userPrompt;

        if (savePromptPath) {
          const { writeFileSync } = await import('fs');
          const fullPrompt = `=== System Prompt ===\n\n${systemPrompt}\n\n=== User Prompt ===\n\n${userPrompt}\n\n=== Parameters ===\nModel: ${this.model}\nTemperature: ${options.temperature ?? 0.7}\nMax Tokens: ${options.maxTokens ?? 'unlimited'}\n`;
          writeFileSync(savePromptPath, fullPrompt, 'utf-8');
        }

        const requestParams: any = {
          model: this.model,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
          ],
          temperature: options.temperature ?? 0.7,
        };

        if (options.maxTokens) {
          if (this.model.includes('gpt-5') || this.model.includes('o1')) {
            requestParams.max_completion_tokens = options.maxTokens;
          } else {
            requestParams.max_tokens = options.maxTokens;
          }
        }

        const response = await this.client.chat.completions.create(requestParams);
        const choice = response.choices[0];
        const content = choice?.message?.content;
        const finishReason = choice?.finish_reason ?? null;

        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return { text: content, finishReason };
      },
      {
        maxRetries,
        onRetry: (error, attempt) => {
          console.warn(`OpenAI API call failed (attempt ${attempt}): ${error.message}`);
        },
      }
    );
  }
}
