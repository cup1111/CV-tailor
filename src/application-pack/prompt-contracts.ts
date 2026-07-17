import { join } from 'path';
import type { z } from 'zod';
import { loadTemplate, type Template } from '../services/template.js';
import type { Status } from '../types/outputs.js';
import { extractExperienceBullets } from './extract.js';
import type { PackStore } from './store.js';
import type { ModelPort } from './types.js';

type StatusStep = keyof Status['steps'];

type TextArtifacts = {
  /** Saved rendered prompt path (text modes). */
  prompt?: string;
  /** Primary model output file. */
  raw: string;
  /** Written when finish_reason === 'length'. */
  truncated?: string;
  /** Parsed Experience Bullets display form. */
  extracted?: string;
};

type PromptContract = {
  required: readonly string[];
  mode: 'text' | 'text-with-meta' | 'json';
  /** Status step updated around the model call; omit for steps without status (e.g. regenerate). */
  statusStep?: StatusStep;
  artifacts: TextArtifacts;
  parse?: 'experience-bullets';
};

/**
 * Per-step Prompt Template contracts: inputs, model mode, artifacts, parsing.
 * English-only templates — see ADR-0001.
 */
export const PROMPT_CONTRACTS = {
  'company-research': {
    required: ['webSearchResults', 'jd'] as const,
    mode: 'text-with-meta' as const,
    statusStep: 'companyResearch' as const,
    artifacts: {
      prompt: 'company-research.prompt.txt',
      raw: 'company-profile.raw.txt',
      truncated: 'company-profile.truncated',
    },
  },
  'pain-points': {
    required: ['jd', 'companyProfile'] as const,
    mode: 'text-with-meta' as const,
    statusStep: 'painPoints' as const,
    artifacts: {
      prompt: 'pain-points.prompt.txt',
      raw: 'pain-points.raw.txt',
      truncated: 'pain-points.truncated',
    },
  },
  mapping: {
    required: [
      'companyProfile',
      'jd',
      'painPoints',
      'candidateExperience',
      'bulletRequirementsSection',
      'experienceList',
    ] as const,
    mode: 'text-with-meta' as const,
    statusStep: 'mapping' as const,
    artifacts: {
      prompt: 'mapping.prompt.txt',
      raw: 'mapping.raw.txt',
      truncated: 'mapping.truncated',
    },
  },
  'experience-bullets': {
    required: ['painPoints', 'companyProfile', 'mapping'] as const,
    mode: 'text' as const,
    statusStep: 'experienceBullets' as const,
    artifacts: {
      prompt: 'experience-bullets.prompt.txt',
      raw: 'experience-bullets.raw.txt',
      extracted: 'experience-bullets.extracted.txt',
    },
    parse: 'experience-bullets' as const,
  },
  summary: {
    required: ['jd', 'painPoints', 'companyProfile', 'mapping'] as const,
    mode: 'text' as const,
    statusStep: 'summary' as const,
    artifacts: {
      prompt: 'summary.prompt.txt',
      raw: 'summary.raw.txt',
    },
  },
  'cover-letter': {
    required: ['jd', 'summary', 'painPoints', 'experienceBullets', 'mapping'] as const,
    mode: 'text' as const,
    statusStep: 'coverLetter' as const,
    artifacts: {
      prompt: 'cover-letter.prompt.txt',
      raw: 'cover-letter.raw.txt',
    },
  },
  review: {
    required: [
      'companyProfile',
      'painPoints',
      'mapping',
      'experienceBullets',
      'summary',
      'coverLetter',
      'jd',
    ] as const,
    mode: 'text' as const,
    statusStep: 'review' as const,
    artifacts: {
      prompt: 'review.prompt.txt',
      raw: 'review.raw.txt',
    },
  },
  regenerate: {
    required: [
      'jd',
      'companyProfile',
      'painPoints',
      'mapping',
      'currentSummary',
      'currentExperienceBullets',
      'currentCoverLetter',
      'feedback',
    ] as const,
    mode: 'json' as const,
    artifacts: {
      raw: 'regenerate.raw.json',
    },
  },
} as const satisfies Record<string, PromptContract>;

export type PromptStepName = keyof typeof PROMPT_CONTRACTS;

export function listRequiredVariables(step: PromptStepName): readonly string[] {
  return PROMPT_CONTRACTS[step].required;
}

function extractPlaceholders(template: Template): string[] {
  const text = `${template.systemPrompt}\n${template.userPrompt}`;
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
    found.add(match[1]!);
  }
  return [...found];
}

/**
 * Load a Prompt Template and render with the step's contract.
 * - Missing required vars → throw
 * - Placeholders in the file not in required / not supplied → throw
 * - Required vars unused by the file → throw (contract drift)
 * - Extra vars not in the template → dropped
 */
export function preparePrompt(
  step: PromptStepName,
  variables: Record<string, string>,
  templatesRoot: string
): Template {
  const contract = PROMPT_CONTRACTS[step];
  const missingRequired = contract.required.filter((key) => !(key in variables));
  if (missingRequired.length > 0) {
    throw new Error(
      `Prompt Template "${step}" missing required variables: ${missingRequired.join(', ')}`
    );
  }

  const template = loadTemplate(step, templatesRoot);
  const placeholders = extractPlaceholders(template);
  const requiredSet = new Set<string>(contract.required);

  const undeclaredInFile = placeholders.filter((key) => !requiredSet.has(key));
  if (undeclaredInFile.length > 0) {
    throw new Error(
      `Prompt Template "${step}" has placeholders not in contract: ${undeclaredInFile.join(', ')}`
    );
  }

  const unusedRequired = contract.required.filter((key) => !placeholders.includes(key));
  if (unusedRequired.length > 0) {
    throw new Error(
      `Prompt Template "${step}" contract requires unused variables: ${unusedRequired.join(', ')}`
    );
  }

  const filtered: Record<string, string> = {};
  for (const key of placeholders) {
    filtered[key] = variables[key]!;
  }

  const replace = (text: string): string =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => filtered[key]!);

  return {
    systemPrompt: replace(template.systemPrompt),
    userPrompt: replace(template.userPrompt),
    temperature: template.temperature,
    maxTokens: template.maxTokens,
  };
}

export function parseStepOutput(
  step: PromptStepName,
  rawText: string
): { raw: string; extracted?: string } {
  const contract = PROMPT_CONTRACTS[step];
  if ('parse' in contract && contract.parse === 'experience-bullets') {
    return { raw: rawText, extracted: extractExperienceBullets(rawText) };
  }
  return { raw: rawText };
}

export type RunPromptStepResult = { skipped: boolean; text?: string };

/**
 * Execute one Prompt Template step: validate → call model (per mode) → write artifacts → update status.
 * Disk filenames and model mode stay inside the contract — callers only supply variables.
 */
export async function runPromptStep(args: {
  store: PackStore;
  jobId: string;
  step: PromptStepName;
  variables: Record<string, string>;
  model: ModelPort;
  templatesRoot: string;
  force?: boolean;
}): Promise<RunPromptStepResult> {
  const { store, jobId, step, variables, model, templatesRoot, force } = args;
  const contract = PROMPT_CONTRACTS[step];

  if (contract.mode === 'json') {
    throw new Error(`Prompt step "${step}" is json mode — use runJsonPromptStep`);
  }

  if (
    !force &&
    contract.statusStep &&
    store.isStepCompleted(jobId, contract.statusStep)
  ) {
    return { skipped: true };
  }

  if (contract.statusStep) {
    store.updateStepStatus(jobId, contract.statusStep, 'in_progress');
  }

  try {
    const rendered = preparePrompt(step, variables, templatesRoot);
    store.ensureOutDir(jobId);
    const promptPath = contract.artifacts.prompt
      ? join(store.outDir(jobId), contract.artifacts.prompt)
      : undefined;

    let text: string;
    if (contract.mode === 'text-with-meta') {
      const result = await model.generateTextWithMeta(rendered, 3, promptPath);
      text = result.text;
      store.writeOutFile(jobId, contract.artifacts.raw, text);
      if (result.finishReason === 'length' && contract.artifacts.truncated) {
        store.writeOutFile(jobId, contract.artifacts.truncated, '1');
      }
    } else {
      text = await model.generateText(rendered, 3, promptPath);
      const parsed = parseStepOutput(step, text);
      store.writeOutFile(jobId, contract.artifacts.raw, parsed.raw);
      const extractedPath =
        'extracted' in contract.artifacts ? contract.artifacts.extracted : undefined;
      if (extractedPath && parsed.extracted !== undefined) {
        store.writeOutFile(jobId, extractedPath, parsed.extracted);
      }
    }

    if (contract.statusStep) {
      store.updateStepStatus(jobId, contract.statusStep, 'completed');
    }
    return { skipped: false, text };
  } catch (error) {
    if (contract.statusStep) {
      store.updateStepStatus(jobId, contract.statusStep, 'failed');
    }
    throw error;
  }
}

/**
 * Execute a json-mode Prompt Template step (regenerate). Returns parsed JSON; writes raw file.
 */
export async function runJsonPromptStep<T>(args: {
  store: PackStore;
  jobId: string;
  step: PromptStepName;
  variables: Record<string, string>;
  model: ModelPort;
  templatesRoot: string;
  schema: z.ZodSchema<T>;
}): Promise<T> {
  const { store, jobId, step, variables, model, templatesRoot, schema } = args;
  const contract = PROMPT_CONTRACTS[step];
  if (contract.mode !== 'json') {
    throw new Error(`Prompt step "${step}" is not json mode`);
  }

  const rendered = preparePrompt(step, variables, templatesRoot);
  store.ensureOutDir(jobId);
  const rawPath = join(store.outDir(jobId), contract.artifacts.raw);
  return model.generateJson(rendered, schema, 3, rawPath);
}
