import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PackStore } from './store.js';
import type { ModelPort } from './types.js';
import type { ChatCompletionOptions } from '../services/openai.js';
import {
  preparePrompt,
  listRequiredVariables,
  runPromptStep,
  runJsonPromptStep,
  PROMPT_CONTRACTS,
} from './prompt-contracts.js';

const repoTemplates = join(
  import.meta.dirname,
  '../..',
  'tracks/software-engineering/templates'
);

describe('Prompt Template contracts', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'prompt-contract-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists required variables for experience-bullets without jd', () => {
    expect(listRequiredVariables('experience-bullets')).toEqual([
      'painPoints',
      'companyProfile',
      'mapping',
    ]);
  });

  it('lists required variables for summary without experienceBullets', () => {
    expect(listRequiredVariables('summary')).toEqual([
      'jd',
      'painPoints',
      'companyProfile',
      'mapping',
    ]);
  });

  it('throws when a required Prompt Template variable is missing', () => {
    expect(() =>
      preparePrompt('pain-points', { jd: 'Some JD' }, repoTemplates)
    ).toThrow(/companyProfile/);
  });

  it('renders only declared variables and drops extras', () => {
    const rendered = preparePrompt(
      'experience-bullets',
      {
        painPoints: 'Need APIs',
        companyProfile: '',
        mapping: 'Full mapping',
        jd: 'SHOULD_NOT_APPEAR',
      },
      repoTemplates
    );
    expect(rendered.userPrompt).toContain('Need APIs');
    expect(rendered.userPrompt).toContain('Full mapping');
    expect(rendered.userPrompt).not.toContain('SHOULD_NOT_APPEAR');
    expect(rendered.userPrompt).not.toMatch(/\{\{\w+\}\}/);
  });

  it('throws when template file has a placeholder not in the contract', () => {
    const dir = join(root, 'templates');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'pain-points.jsonprompt'),
      JSON.stringify({
        systemPrompt: 'sys',
        userPrompt: 'JD={{jd}} Profile={{companyProfile}} Extra={{unexpected}}',
      }),
      'utf-8'
    );
    expect(() =>
      preparePrompt('pain-points', { jd: 'x', companyProfile: 'y' }, dir)
    ).toThrow(/not in contract/);
  });

  it('repo Prompt Templates match their contracts', () => {
    for (const step of Object.keys(PROMPT_CONTRACTS) as Array<keyof typeof PROMPT_CONTRACTS>) {
      expect(() => {
        const vars: Record<string, string> = {};
        for (const key of PROMPT_CONTRACTS[step].required) {
          vars[key] = 'x';
        }
        preparePrompt(step, vars, repoTemplates);
      }).not.toThrow();
    }
  });

  it('runPromptStep writes artifacts and truncation via the contract', async () => {
    const store = new PackStore(root);
    store.saveJobInputs('j1', {
      companyInfo: '',
      jd: 'JD',
      applicationTrack: 'software-engineering',
    });

    const model: ModelPort = {
      webSearch: async () => '',
      generateText: async () => 'plain',
      generateTextWithMeta: async () => ({
        text: 'Pain truncated output',
        finishReason: 'length',
      }),
      generateJson: async () => {
        throw new Error('unused');
      },
    };

    const result = await runPromptStep({
      store,
      jobId: 'j1',
      step: 'pain-points',
      variables: { jd: 'JD', companyProfile: '' },
      model,
      templatesRoot: repoTemplates,
    });

    expect(result.skipped).toBe(false);
    expect(store.readOutFile('j1', 'pain-points.raw.txt')).toBe('Pain truncated output');
    expect(existsSync(join(root, 'out', 'j1', 'pain-points.truncated'))).toBe(true);
    expect(store.isStepCompleted('j1', 'painPoints')).toBe(true);

    const second = await runPromptStep({
      store,
      jobId: 'j1',
      step: 'pain-points',
      variables: { jd: 'JD', companyProfile: '' },
      model,
      templatesRoot: repoTemplates,
    });
    expect(second.skipped).toBe(true);
  });

  it('runPromptStep parses experience-bullets into extracted artifact', async () => {
    const store = new PackStore(root);
    store.saveJobInputs('j2', {
      companyInfo: '',
      jd: 'JD',
      applicationTrack: 'software-engineering',
    });
    const model: ModelPort = {
      webSearch: async () => '',
      generateTextWithMeta: async () => ({ text: '', finishReason: 'stop' }),
      generateText: async () => '||\nPastCo - Eng\n- Built APIs\n||',
      generateJson: async () => {
        throw new Error('unused');
      },
    };

    await runPromptStep({
      store,
      jobId: 'j2',
      step: 'experience-bullets',
      variables: {
        painPoints: 'p',
        companyProfile: '',
        mapping: 'm',
      },
      model,
      templatesRoot: repoTemplates,
    });

    expect(store.readOutFile('j2', 'experience-bullets.extracted.txt')).toContain(
      'PastCo - Eng'
    );
  });

  it('runJsonPromptStep writes regenerate raw via the contract', async () => {
    const store = new PackStore(root);
    store.saveJobInputs('j3', {
      companyInfo: '',
      jd: 'JD',
      applicationTrack: 'software-engineering',
    });
    const schema = z.object({
      summary: z.string(),
      experiences: z.array(
        z.object({
          company: z.string(),
          role: z.string(),
          bullets: z.array(z.string()),
        })
      ),
      coverLetter: z.string(),
      feedbackResponse: z.string(),
    });

    const model: ModelPort = {
      webSearch: async () => '',
      generateText: async () => '',
      generateTextWithMeta: async () => ({ text: '', finishReason: 'stop' }),
      async generateJson<T>(
        _o: ChatCompletionOptions,
        s: z.ZodSchema<T>,
        _r?: number,
        path?: string
      ) {
        const payload = {
          summary: 'S',
          experiences: [{ company: 'C', role: 'R', bullets: ['b'] }],
          coverLetter: 'CL',
          feedbackResponse: 'ok',
        };
        if (path) writeFileSync(path, JSON.stringify(payload), 'utf-8');
        return s.parse(payload);
      },
    };

    const result = await runJsonPromptStep({
      store,
      jobId: 'j3',
      step: 'regenerate',
      variables: {
        jd: 'JD',
        companyProfile: '(none)',
        painPoints: '(none)',
        mapping: 'm',
        currentSummary: 's',
        currentExperienceBullets: 'e',
        currentCoverLetter: 'c',
        feedback: 'f',
      },
      model,
      templatesRoot: repoTemplates,
      schema,
    });

    expect(result.summary).toBe('S');
    expect(
      readFileSync(join(root, 'out', 'j3', 'regenerate.raw.json'), 'utf-8')
    ).toContain('"summary":"S"');
  });
});
