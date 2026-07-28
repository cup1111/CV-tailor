import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseEmployerNameFromReview,
  parseRoleTitleFromReview,
  settleReviewStep,
  splitLegacyJobLabel,
} from './job-identity.js';
import { PackStore } from './store.js';

describe('parseRoleTitleFromReview', () => {
  it('extracts a filesystem-safe Role Title from review output', () => {
    const text = [
      'PASS',
      'Role Title: Software Engineer',
      'Employer Name: Acme Corp',
      'Materials align with the JD.',
    ].join('\n');

    expect(parseRoleTitleFromReview(text)).toBe('Software Engineer');
    expect(parseEmployerNameFromReview(text)).toBe('Acme Corp');
  });

  it('returns null when fields are missing or unsafe', () => {
    expect(parseRoleTitleFromReview('PASS\nLooks good.')).toBeNull();
    expect(
      parseRoleTitleFromReview('PASS\nRole Title: Bad/Role\nOk')
    ).toBeNull();
  });

  it('falls back to legacy Job Label lines in review output', () => {
    const text = [
      'PASS',
      'Job Label: Software Engineer - Acme Corp',
      'Materials align with the JD.',
    ].join('\n');

    expect(parseRoleTitleFromReview(text)).toBe('Software Engineer');
    expect(parseEmployerNameFromReview(text)).toBe('Acme Corp');
  });
});

describe('splitLegacyJobLabel', () => {
  it('splits on the first separator', () => {
    expect(splitLegacyJobLabel('Backend Engineer - Globex')).toEqual({
      roleTitle: 'Backend Engineer',
      employerName: 'Globex',
    });
  });
});

describe('settleReviewStep', () => {
  let root: string;
  let store: PackStore;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'job-identity-'));
    store = new PackStore(root);
    store.saveJobInputs('j1', {
      companyInfo: '',
      jd: 'JD',
      jobLink: '',
      applicationTrack: 'software-engineering',
    });
    store.getOrCreateStatus('j1');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('mints identity and completes review on first valid review output', () => {
    const review = [
      'PASS',
      'Role Title: Backend Engineer',
      'Employer Name: Globex',
      'Solid fit.',
    ].join('\n');

    expect(settleReviewStep(store, 'j1', review)).toBe(true);
    expect(store.readJobIdentity('j1')).toEqual({
      roleTitle: 'Backend Engineer',
      employerName: 'Globex',
    });
    expect(store.isStepCompleted('j1', 'review')).toBe(true);
  });

  it('does not complete review when identity fields are missing', () => {
    expect(settleReviewStep(store, 'j1', 'PASS\nLooks good.')).toBe(false);
    expect(store.readJobIdentity('j1')).toEqual({});
    expect(store.isStepCompleted('j1', 'review')).toBe(false);
  });

  it('completes review when the model still returns legacy Job Label format', () => {
    expect(
      settleReviewStep(
        store,
        'j1',
        'PASS\nJob Label: Backend Engineer - Globex\nLegacy format still returned'
      )
    ).toBe(true);
    expect(store.readJobIdentity('j1')).toEqual({
      roleTitle: 'Backend Engineer',
      employerName: 'Globex',
    });
    expect(store.isStepCompleted('j1', 'review')).toBe(true);
  });

  it('keeps frozen identity on later review output', () => {
    settleReviewStep(
      store,
      'j1',
      'PASS\nRole Title: Backend Engineer\nEmployer Name: Globex\nOk'
    );

    expect(
      settleReviewStep(
        store,
        'j1',
        'PASS\nRole Title: Different Role\nEmployer Name: OtherCo\nStill ok'
      )
    ).toBe(true);
    expect(store.readJobIdentity('j1')).toEqual({
      roleTitle: 'Backend Engineer',
      employerName: 'Globex',
    });
  });

  it('completes review and mints identity on FAIL when mint fields parse', () => {
    expect(
      settleReviewStep(
        store,
        'j1',
        'FAIL\nRole Title: Backend Engineer\nEmployer Name: Globex\nNeeds work'
      )
    ).toBe(true);
    expect(store.readJobIdentity('j1')).toEqual({
      roleTitle: 'Backend Engineer',
      employerName: 'Globex',
    });
    expect(store.isStepCompleted('j1', 'review')).toBe(true);
    expect(store.readStatus('j1')?.reviewVerdict).toBe('fail');
  });

  it('clears advisory on PASS after a prior FAIL', () => {
    settleReviewStep(
      store,
      'j1',
      'FAIL\nRole Title: Backend Engineer\nEmployer Name: Globex\nNeeds work'
    );
    expect(store.readStatus('j1')?.reviewVerdict).toBe('fail');

    settleReviewStep(
      store,
      'j1',
      'PASS\nRole Title: Different Role\nEmployer Name: OtherCo\nFixed'
    );
    expect(store.readStatus('j1')?.reviewVerdict).toBeUndefined();
    expect(store.readJobIdentity('j1')).toEqual({
      roleTitle: 'Backend Engineer',
      employerName: 'Globex',
    });
  });

  it('clears identity when generation outputs are discarded', () => {
    settleReviewStep(
      store,
      'j1',
      'PASS\nRole Title: Backend Engineer\nEmployer Name: Globex\nOk'
    );
    store.clearJobOutputs('j1');
    expect(store.readJobIdentity('j1')).toEqual({});
  });

  it('reads legacy job-label.txt via readJobIdentity', () => {
    store.writeOutFile('j1', 'job-label.txt', 'Analyst - Contoso');
    expect(store.readJobIdentity('j1')).toEqual({
      roleTitle: 'Analyst',
      employerName: 'Contoso',
    });
  });
});
