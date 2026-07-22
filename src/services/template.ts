import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { DEFAULT_APPLICATION_TRACK, resolveTrackPaths } from './track.js';

const TemplateSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
});

export type Template = z.infer<typeof TemplateSchema>;

/**
 * Load a Prompt Template by name from {templatesRoot}/{name}.jsonprompt.
 * Callers should pass the Job's Track templatesRoot (ADR-0003). English-only (ADR-0001).
 */
export function loadTemplate(
  templateName: string,
  templatesRoot: string = resolveTrackPaths(
    process.cwd(),
    DEFAULT_APPLICATION_TRACK
  ).templatesRoot
): Template {
  const templatePath = join(templatesRoot, `${templateName}.jsonprompt`);
  try {
    const content = readFileSync(templatePath, 'utf-8');
    const json = JSON.parse(content);
    return TemplateSchema.parse(json);
  } catch (error) {
    throw new Error(
      `Failed to load template ${templateName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 替换模板中的变量
 * 支持 {{variable}} 格式的变量替换
 */
export function renderTemplate(
  template: Template,
  variables: Record<string, string>
): Template {
  const replaceVariables = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in variables) {
        return variables[key];
      }
      console.warn(`Template variable ${key} not found, keeping placeholder`);
      return match;
    });
  };

  return {
    systemPrompt: replaceVariables(template.systemPrompt),
    userPrompt: replaceVariables(template.userPrompt),
    temperature: template.temperature,
    maxTokens: template.maxTokens,
  };
}
