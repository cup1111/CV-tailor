import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { preparePrompt, listRequiredVariables } from './prompt-contracts.js';

const repoTemplates = join(import.meta.dirname, '../..', 'templates');

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
      preparePrompt(
        'pain-points',
        { jd: 'Some JD' },
        repoTemplates
      )
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

  it('throws when template file has a placeholder not supplied', () => {
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
      preparePrompt(
        'pain-points',
        { jd: 'x', companyProfile: 'y' },
        dir
      )
    ).toThrow(/unexpected/);
  });
});
