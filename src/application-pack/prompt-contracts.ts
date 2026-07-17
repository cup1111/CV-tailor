import { loadTemplate, type Template } from '../services/template.js';
import { extractExperienceBullets } from './extract.js';

/**
 * Per-step Prompt Template contracts.
 * Required variables are the only inputs the step may pass; extras are dropped.
 * English-only templates — see ADR-0001.
 */
export const PROMPT_CONTRACTS = {
  'company-research': {
    required: ['webSearchResults', 'jd'] as const,
    mode: 'text-with-meta' as const,
  },
  'pain-points': {
    required: ['jd', 'companyProfile'] as const,
    mode: 'text-with-meta' as const,
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
  },
  'experience-bullets': {
    required: ['painPoints', 'companyProfile', 'mapping'] as const,
    mode: 'text' as const,
    parse: 'experience-bullets' as const,
  },
  summary: {
    required: ['jd', 'painPoints', 'companyProfile', 'mapping'] as const,
    mode: 'text' as const,
  },
  'cover-letter': {
    required: ['jd', 'summary', 'painPoints', 'experienceBullets', 'mapping'] as const,
    mode: 'text' as const,
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
  },
} as const;

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
 * - Placeholders in the file not supplied → throw
 * - Extra vars not in the template → dropped (no silent drift into prompts)
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

  const missingInFile = placeholders.filter((key) => !(key in variables));
  if (missingInFile.length > 0) {
    throw new Error(
      `Prompt Template "${step}" has unresolved placeholders: ${missingInFile.join(', ')}`
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
