import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Profile } from '../types/profile.js';
import { createApplicationPackModule } from './index.js';
import type { ModelPort } from './types.js';
import type { ChatCompletionOptions } from '../services/openai.js';

const repoRoot = join(import.meta.dirname, '../..');
const templatesRoot = join(repoRoot, 'tracks/software-engineering/templates');

const sampleProfile: Profile = {
  personal: {
    name: 'Test User',
    email: 'test@example.com',
  },
  experiences: [
    {
      company: 'PastCo',
      role: 'Engineer',
      startDate: '2020-01',
      endDate: 'Present',
      description: 'Built APIs',
      bulletCount: 2,
    },
  ],
};

function createFakeModel(overrides?: {
  reviewText?: string;
  callCounts?: { webSearch: number; text: number; json: number };
}): ModelPort {
  const counts = overrides?.callCounts ?? { webSearch: 0, text: 0, json: 0 };
  const reviewText =
    overrides?.reviewText ??
    'PASS\nRole Title: Software Engineer\nEmployer Name: Acme\nLooks good.';

  return {
    async webSearch(query: string) {
      counts.webSearch += 1;
      return `Web facts for: ${query}`;
    },
    async generateText(options: ChatCompletionOptions) {
      counts.text += 1;
      const blob = `${options.systemPrompt}\n${options.userPrompt}`;
      if (blob.includes('review') || /PASS|FAIL/.test(blob) === false && blob.toLowerCase().includes('verdict')) {
        // fall through — templates vary; detect by later call order instead
      }
      // Heuristic: last materials steps
      if (blob.includes('cover letter') || blob.includes('Cover Letter')) {
        return 'Dear Hiring Manager,\nI am interested.';
      }
      if (blob.includes('summary') || blob.includes('Summary')) {
        return 'Engineer with API experience.';
      }
      if (blob.includes('||') || blob.toLowerCase().includes('bullet')) {
        return '||\nPastCo - Engineer\n- Built scalable APIs\n- Shipped features\n||';
      }
      return 'generic text output';
    },
    async generateTextWithMeta(options: ChatCompletionOptions) {
      counts.text += 1;
      const blob = `${options.systemPrompt}\n${options.userPrompt}`;
      let text = 'generic meta text';
      if (blob.toLowerCase().includes('pain')) text = 'Pain: need reliable APIs';
      if (blob.toLowerCase().includes('mapping') || blob.includes('PER-EXPERIENCE')) {
        text = 'CANDIDATE SUMMARY\n...\nPER-EXPERIENCE BULLET REQUIREMENTS\nExperience 1: Write EXACTLY 2 bullet point(s)';
      }
      if (blob.toLowerCase().includes('company') || blob.toLowerCase().includes('web search')) {
        text = 'Company profile: Acme builds robots';
      }
      return { text, finishReason: 'stop' };
    },
    async generateJson<T>(_options: ChatCompletionOptions, schema: z.ZodSchema<T>) {
      counts.json += 1;
      const payload = {
        summary: 'Updated summary after feedback',
        experiences: [
          {
            company: 'PastCo',
            role: 'Engineer',
            bullets: ['Improved APIs for the JD'],
          },
        ],
        coverLetter: 'Updated cover letter after feedback',
        feedbackResponse: 'Tightened API alignment.',
      };
      return schema.parse(payload);
    },
  };
}

/** Deterministic fake that returns fixed strings per sequential text call. */
function createSequencedModel(sequence: {
  webSearch?: string;
  withMeta: string[];
  text: string[];
  json?: unknown;
}): ModelPort & { getTextCalls: () => number; getMetaCalls: () => number } {
  let metaIdx = 0;
  let textIdx = 0;
  let textCalls = 0;
  let metaCalls = 0;
  return {
    getTextCalls: () => textCalls,
    getMetaCalls: () => metaCalls,
    async webSearch() {
      return sequence.webSearch ?? 'web results';
    },
    async generateTextWithMeta() {
      metaCalls += 1;
      const text =
        sequence.withMeta[metaIdx] ?? sequence.withMeta[sequence.withMeta.length - 1]!;
      metaIdx += 1;
      return { text, finishReason: 'stop' };
    },
    async generateText() {
      textCalls += 1;
      const text = sequence.text[textIdx] ?? sequence.text[sequence.text.length - 1]!;
      textIdx += 1;
      return text;
    },
    async generateJson<T>(_o: ChatCompletionOptions, schema: z.ZodSchema<T>) {
      return schema.parse(sequence.json);
    },
  };
}

describe('Application Pack lifecycle', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'app-pack-life-'));
    // Ensure regenerate template exists in templatesRoot (repo templates)
    expect(existsSync(join(templatesRoot, 'mapping.jsonprompt'))).toBe(true);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('generatePack produces a readable Application Pack', async () => {
    const pack = createApplicationPackModule({
      workspaceRoot: root,
      templatesRoot,
    });
    pack.saveJobInputs('j1', {
      companyInfo: 'Acme Corp',
      jd: 'We need a backend engineer for robotics APIs.',
      applicationTrack: 'software-engineering',
    });

    const model = createSequencedModel({
      webSearch: 'Acme robots facts',
      withMeta: [
        'Company profile: Acme',
        'Pain points: reliability',
        'Mapping with PER-EXPERIENCE BULLET REQUIREMENTS',
      ],
      text: [
        '||\nPastCo - Engineer\n- Shipped APIs\n||',
        'Summary text',
        'Cover letter text',
        'PASS\nRole Title: Backend Engineer\nEmployer Name: Acme\nGood fit.',
      ],
    });

    await pack.generatePack('j1', { profile: sampleProfile, model });

    const read = pack.readPack('j1');
    expect(read.exists).toBe(true);
    expect(read.hasCompanyInfo).toBe(true);
    expect(read.companyProfile).toBe('Company profile: Acme');
    expect(read.painPoints).toBe('Pain points: reliability');
    expect(read.mapping).toContain('Mapping');
    expect(read.experienceBullets).toContain('PastCo - Engineer');
    expect(read.summary).toBe('Summary text');
    expect(read.coverLetter).toBe('Cover letter text');
    expect(read.review).toContain('PASS');
  });

  it('skips completed steps on a second generatePack', async () => {
    const pack = createApplicationPackModule({
      workspaceRoot: root,
      templatesRoot,
    });
    pack.saveJobInputs('j2', { companyInfo: '', jd: 'JD only role' , applicationTrack: 'software-engineering' });

    const model1 = createSequencedModel({
      withMeta: [
        'Company from JD',
        'Pain',
        'Mapping block',
      ],
      text: [
        '||\nPastCo - Engineer\n- Bullet\n||',
        'Summary',
        'Cover',
        'PASS\nRole Title: Engineer\nEmployer Name: ExampleCo\nOk',
      ],
    });
    await pack.generatePack('j2', { profile: sampleProfile, model: model1 });

    const model2 = createSequencedModel({
      withMeta: ['SHOULD_NOT_RUN'],
      text: ['SHOULD_NOT_RUN'],
    });
    await pack.generatePack('j2', { profile: sampleProfile, model: model2 });
    expect(model2.getMetaCalls()).toBe(0);
    expect(model2.getTextCalls()).toBe(0);
    expect(pack.readPack('j2').summary).toBe('Summary');
  });

  it('does not auto-regenerate when review returns FAIL', async () => {
    const pack = createApplicationPackModule({
      workspaceRoot: root,
      templatesRoot,
    });
    pack.saveJobInputs('j3', { companyInfo: '', jd: 'Some JD' , applicationTrack: 'software-engineering' });

    let jsonCalls = 0;
    const model = createSequencedModel({
      withMeta: ['c', 'p', 'm'],
      text: [
        '||\nPastCo - Engineer\n- B\n||',
        'Summary original',
        'Cover original',
        'FAIL\nRole Title: Role\nEmployer Name: Company\nNeeds better JD fit.',
      ],
      json: {
        summary: 'Should not appear',
        experiences: [{ company: 'PastCo', role: 'Engineer', bullets: ['x'] }],
        coverLetter: 'Should not appear',
        feedbackResponse: 'nope',
      },
    });
    const wrapped: ModelPort = {
      webSearch: model.webSearch.bind(model),
      generateText: model.generateText.bind(model),
      generateTextWithMeta: model.generateTextWithMeta.bind(model),
      async generateJson(options, schema, maxRetries, path) {
        jsonCalls += 1;
        return model.generateJson(options, schema, maxRetries, path);
      },
    };

    await pack.generatePack('j3', { profile: sampleProfile, model: wrapped });
    expect(jsonCalls).toBe(0);
    expect(pack.readPack('j3').summary).toBe('Summary original');
    const job = pack.listJobs().find((j) => j.id === 'j3')!;
    expect(job.packComplete).toBe(true);
    expect(job.reviewVerdictFail).toBe(true);
  });

  it('omits company profile from readPack when company info was not provided', async () => {
    const pack = createApplicationPackModule({
      workspaceRoot: root,
      templatesRoot,
    });
    pack.saveJobInputs('j5', { companyInfo: '', jd: 'JD only' , applicationTrack: 'software-engineering' });
    pack.writeArtifacts('j5', {
      companyProfile: 'Should not surface',
      summary: 'S',
      experienceBullets: 'E',
      coverLetter: 'C',
    });
    const read = pack.readPack('j5');
    expect(read.hasCompanyInfo).toBe(false);
    expect(read.companyProfile).toBeUndefined();
  });

  it('regeneratePack updates materials and re-runs review', async () => {
    const pack = createApplicationPackModule({
      workspaceRoot: root,
      templatesRoot,
    });
    pack.saveJobInputs('j4', {
      companyInfo: 'Acme',
      jd: 'Backend robotics',
      applicationTrack: 'software-engineering',
    });
    pack.writeArtifacts('j4', {
      companyProfile: 'Generated Acme profile',
      painPoints: 'Need reliability',
      mapping: 'Full mapping',
      experienceBullets: 'PastCo - Engineer\n- Old bullet',
      summary: 'Old summary',
      coverLetter: 'Old cover',
      review: 'FAIL\nFix bullets',
    });

    const model = createFakeModel();
    let textPhase = 0;
    const sequenced: ModelPort = {
      webSearch: async () => 'unused',
      generateTextWithMeta: async () => ({ text: 'unused', finishReason: 'stop' }),
      generateJson: model.generateJson.bind(model),
      async generateText() {
        textPhase += 1;
        return 'PASS\nRole Title: Backend Engineer\nEmployer Name: Acme\nAfter regenerate.';
      },
    };

    await pack.regeneratePack('j4', 'Make bullets stronger', { model: sequenced });

    const read = pack.readPack('j4');
    expect(read.summary).toBe('Updated summary after feedback');
    expect(read.coverLetter).toBe('Updated cover letter after feedback');
    expect(read.experienceBullets).toContain('Improved APIs for the JD');
    expect(read.regenerateFeedback).toBe('Tightened API alignment.');
    expect(read.review).toContain('PASS');
    expect(read.companyProfile).toBe('Generated Acme profile');
    expect(pack.loadJobInputs('j4').companyInfo).toBe('Acme');
    expect(pack.listJobs().find((j) => j.id === 'j4')?.progress).toBeUndefined();
    expect(textPhase).toBe(1);
  });

  it('generatePack resolves templates from the Job bound Application Track', async () => {
    const { cpSync, mkdirSync } = await import('fs');
    const itTemplates = join(root, 'tracks/it-support/templates');
    mkdirSync(itTemplates, { recursive: true });
    cpSync(templatesRoot, itTemplates, { recursive: true });

    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('track-job', {
      companyInfo: '',
      jd: 'Helpdesk analyst role',
      applicationTrack: 'it-support',
    });

    expect(pack.templatesRootForJob('track-job')).toBe(itTemplates);

    const model = createSequencedModel({
      withMeta: ['c', 'p', 'm'],
      text: [
        '||\nPastCo - Engineer\n- B\n||',
        'Summary',
        'Cover',
        'PASS\nRole Title: Helpdesk Analyst\nEmployer Name: Contoso\nOk',
      ],
    });
    await pack.generatePack('track-job', { profile: sampleProfile, model });
    expect(pack.readPack('track-job').summary).toBe('Summary');
    expect(existsSync(join(root, 'out', 'track-job', 'application-track.txt'))).toBe(
      false
    );
  });
});
