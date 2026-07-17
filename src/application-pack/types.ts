import type { z } from 'zod';
import type { ChatCompletionOptions } from '../services/openai.js';

/** User-provided company keywords for Web Search — not the generated company profile. */
export type JobInputs = {
  companyInfo: string;
  jd: string;
};

export type PackTruncation = {
  companyResearch: boolean;
  painPoints: boolean;
  mapping: boolean;
};

/**
 * Observable Application Pack materials for one job.
 * Filenames and on-disk layout are implementation details.
 */
export type ApplicationPack = {
  exists: boolean;
  hasCompanyInfo: boolean;
  /** Generated company research output (empty when no company info was provided). */
  companyProfile?: string;
  painPoints?: string;
  mapping?: string;
  /** Extracted Experience Bullets (display form). */
  experienceBullets?: string;
  summary?: string;
  coverLetter?: string;
  review?: string;
  regenerateFeedback?: string;
  truncation: PackTruncation;
};

export type ModelPort = {
  webSearch(searchQuery: string, maxRetries?: number): Promise<string>;
  generateText(
    options: ChatCompletionOptions,
    maxRetries?: number,
    savePromptPath?: string
  ): Promise<string>;
  generateTextWithMeta(
    options: ChatCompletionOptions,
    maxRetries?: number,
    savePromptPath?: string
  ): Promise<{ text: string; finishReason: string | null }>;
  generateJson<T>(
    options: ChatCompletionOptions,
    schema: z.ZodSchema<T>,
    maxRetries?: number,
    saveRawResponsePath?: string
  ): Promise<T>;
};

export type ApplicationPackModuleOptions = {
  /** Workspace root containing jobs/ and out/. Defaults to process.cwd(). */
  workspaceRoot?: string;
  /** Directory of English Prompt Templates. Defaults to workspaceRoot/templates. */
  templatesRoot?: string;
};
