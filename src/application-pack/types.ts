import type { z } from 'zod';
import type { ChatCompletionOptions } from '../services/openai.js';
import type { TrackId } from '../services/track.js';
import type { Status } from '../types/outputs.js';

/** User-provided company keywords for Web Search — not the generated company profile. */
export type JobInputs = {
  companyInfo: string;
  jd: string;
  /** Immutable Application Track binding for this Job. */
  applicationTrack: TrackId;
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
  /** Directory of English Prompt Templates. Overrides the Job's Track templates (tests). */
  templatesRoot?: string;
};

/**
 * Read-only list/workspace view for one job.
 * Adapters use this instead of reading status.json / .progress themselves.
 */
export type JobView = {
  id: string;
  title: string;
  /** Cleaned JD text for display in the workspace list. */
  content: string;
  hasCompanyInfo: boolean;
  /** Generation step status, or null if never started. */
  status: Status | null;
  /** In-flight regenerate phase, when any. */
  progress?: string;
  /** True when the review step is completed. */
  packComplete: boolean;
  /**
   * Bound Application Track for this Job (sole authority for generation).
   */
  applicationTrack: string;
};
