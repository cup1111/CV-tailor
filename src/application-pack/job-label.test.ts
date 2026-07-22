import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseJobLabelFromReview, settleReviewStep } from './job-label.js';
import { PackStore } from './store.js';

describe('parseJobLabelFromReview', () => {
  it('extracts a filesystem-safe Job Label from a successful review', () => {
    const text = [
      'PASS',
      'Job Label: Software Engineer - Acme Corp',
      'Materials align with the JD without grafting.',
    ].join('\n');

    expect(parseJobLabelFromReview(text)).toBe('Software Engineer - Acme Corp');
  });

  it('returns null when the Job Label line is missing or unsafe', () => {
    expect(parseJobLabelFromReview('PASS\nLooks good.')).toBeNull();
    expect(
      parseJobLabelFromReview('PASS\nJob Label: Acme/Engineer\nOk')
    ).toBeNull();
  });
});

describe('settleReviewStep', () => {
  let root: string;
  let store: PackStore;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'job-label-'));
    store = new PackStore(root);
    store.saveJobInputs('j1', {
      companyInfo: '',
      jd: 'JD',
      applicationTrack: 'software-engineering',
    });
    store.getOrCreateStatus('j1');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('mints Job Label and completes review on first valid review output', () => {
    const review = [
      'PASS',
      'Job Label: Backend Engineer - Globex',
      'Solid fit.',
    ].join('\n');

    expect(settleReviewStep(store, 'j1', review)).toBe(true);
    expect(store.readJobLabel('j1')).toBe('Backend Engineer - Globex');
    expect(store.isStepCompleted('j1', 'review')).toBe(true);
  });

  it('does not complete review when Job Label is missing', () => {
    expect(settleReviewStep(store, 'j1', 'PASS\nLooks good.')).toBe(false);
    expect(store.readJobLabel('j1')).toBeUndefined();
    expect(store.isStepCompleted('j1', 'review')).toBe(false);
  });

  it('keeps a frozen Job Label on later review output', () => {
    settleReviewStep(
      store,
      'j1',
      'PASS\nJob Label: Backend Engineer - Globex\nOk'
    );

    expect(
      settleReviewStep(
        store,
        'j1',
        'PASS\nJob Label: Different Role - OtherCo\nStill ok'
      )
    ).toBe(true);
    expect(store.readJobLabel('j1')).toBe('Backend Engineer - Globex');
  });

  it('does not complete review on FAIL even when a Job Label is present', () => {
    expect(
      settleReviewStep(
        store,
        'j1',
        'FAIL\nJob Label: Backend Engineer - Globex\nNeeds work'
      )
    ).toBe(false);
    expect(store.readJobLabel('j1')).toBeUndefined();
    expect(store.isStepCompleted('j1', 'review')).toBe(false);
  });

  it('clears Job Label when generation outputs are discarded', () => {
    settleReviewStep(
      store,
      'j1',
      'PASS\nJob Label: Backend Engineer - Globex\nOk'
    );
    store.clearJobOutputs('j1');
    expect(store.readJobLabel('j1')).toBeUndefined();
  });
});
