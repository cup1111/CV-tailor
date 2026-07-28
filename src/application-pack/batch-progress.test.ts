import { describe, expect, it } from 'vitest';
import {
  PACK_GENERATION_STEPS,
  finishedPackStepsForJob,
  isBatchJobDone,
  isBatchProgressIndeterminate,
  isPackGenerationInFlight,
  summarizeBatchProgress,
  type BatchJobSnapshot,
  type StepStatusValue,
} from './batch-progress.js';

function job(
  id: string,
  steps: Partial<Record<string, StepStatusValue>>,
  progress?: string
): BatchJobSnapshot {
  return { id, progress, status: { steps } };
}

describe('batch-progress', () => {
  it('uses seven pack generation steps through review', () => {
    expect(PACK_GENERATION_STEPS).toEqual([
      'companyResearch',
      'painPoints',
      'mapping',
      'experienceBullets',
      'summary',
      'coverLetter',
      'review',
    ]);
  });

  it('counts all seven steps once a job has failed', () => {
    const failed = job('a', {
      companyResearch: 'completed',
      painPoints: 'completed',
      mapping: 'failed',
      experienceBullets: 'pending',
      summary: 'pending',
      coverLetter: 'pending',
      review: 'pending',
    });
    expect(isBatchJobDone(failed)).toBe(true);
    expect(finishedPackStepsForJob(failed)).toBe(7);
  });

  it('counts partial steps before the job ends', () => {
    const mid = job('a', {
      companyResearch: 'completed',
      painPoints: 'in_progress',
      mapping: 'pending',
      experienceBullets: 'pending',
      summary: 'pending',
      coverLetter: 'pending',
      review: 'pending',
    });
    expect(isBatchJobDone(mid)).toBe(false);
    expect(finishedPackStepsForJob(mid)).toBe(1);
    expect(isPackGenerationInFlight(mid)).toBe(true);
  });

  it('ignores regenerate progress marker for pack-generation in-flight', () => {
    const regen = job(
      'a',
      {
        companyResearch: 'completed',
        painPoints: 'completed',
        mapping: 'completed',
        experienceBullets: 'completed',
        summary: 'in_progress',
        coverLetter: 'pending',
        review: 'completed',
      },
      'regenerate'
    );
    expect(isPackGenerationInFlight(regen)).toBe(false);
  });

  it('summarizes primary step progress and secondary job progress with failures', () => {
    const jobs: BatchJobSnapshot[] = [
      job('done', {
        companyResearch: 'completed',
        painPoints: 'completed',
        mapping: 'completed',
        experienceBullets: 'completed',
        summary: 'completed',
        coverLetter: 'completed',
        review: 'completed',
      }),
      job('failed', {
        companyResearch: 'completed',
        painPoints: 'failed',
        mapping: 'pending',
        experienceBullets: 'pending',
        summary: 'pending',
        coverLetter: 'pending',
        review: 'pending',
      }),
      job('running', {
        companyResearch: 'completed',
        painPoints: 'completed',
        mapping: 'in_progress',
        experienceBullets: 'pending',
        summary: 'pending',
        coverLetter: 'pending',
        review: 'pending',
      }),
    ];

    const summary = summarizeBatchProgress(jobs);
    expect(summary.jobTotal).toBe(3);
    expect(summary.stepTotal).toBe(21);
    expect(summary.jobFinished).toBe(2);
    expect(summary.jobFailed).toBe(1);
    expect(summary.stepFinished).toBe(16);
    expect(summary.inFlight).toBe(true);
    expect(summary.allDone).toBe(false);
  });

  it('marks allDone when every job finished including failures', () => {
    const summary = summarizeBatchProgress([
      job('ok', { review: 'completed' }),
      job('bad', { mapping: 'failed' }),
    ]);
    expect(summary.allDone).toBe(true);
    expect(summary.inFlight).toBe(false);
    expect(summary.stepFinished).toBe(14);
    expect(summary.jobFailed).toBe(1);
  });

  it('uses indeterminate progress when the batch is open but no step is running', () => {
    const waiting = summarizeBatchProgress([
      job('a', {
        companyResearch: 'pending',
        painPoints: 'pending',
        mapping: 'pending',
        experienceBullets: 'pending',
        summary: 'pending',
        coverLetter: 'pending',
        review: 'pending',
      }),
    ]);
    expect(waiting.inFlight).toBe(false);
    expect(waiting.allDone).toBe(false);
    expect(isBatchProgressIndeterminate(waiting)).toBe(true);
  });

  it('uses indeterminate progress at 0% even while a step is in flight', () => {
    const starting = summarizeBatchProgress([
      job('a', {
        companyResearch: 'in_progress',
        painPoints: 'pending',
        mapping: 'pending',
        experienceBullets: 'pending',
        summary: 'pending',
        coverLetter: 'pending',
        review: 'pending',
      }),
    ]);
    expect(starting.inFlight).toBe(true);
    expect(starting.stepFinished).toBe(0);
    expect(isBatchProgressIndeterminate(starting)).toBe(true);
  });

  it('uses indeterminate progress between sequential jobs when nothing is in flight', () => {
    const gap = summarizeBatchProgress([
      job('done', { review: 'completed' }),
      job('next', {
        companyResearch: 'pending',
        painPoints: 'pending',
        mapping: 'pending',
        experienceBullets: 'pending',
        summary: 'pending',
        coverLetter: 'pending',
        review: 'pending',
      }),
    ]);
    expect(gap.inFlight).toBe(false);
    expect(gap.stepFinished).toBe(7);
    expect(gap.allDone).toBe(false);
    expect(isBatchProgressIndeterminate(gap)).toBe(true);
  });

  it('uses determinate progress once finished steps exist and a step is running', () => {
    const mid = summarizeBatchProgress([
      job('a', {
        companyResearch: 'completed',
        painPoints: 'in_progress',
        mapping: 'pending',
        experienceBullets: 'pending',
        summary: 'pending',
        coverLetter: 'pending',
        review: 'pending',
      }),
    ]);
    expect(isBatchProgressIndeterminate(mid)).toBe(false);
  });

  it('does not use indeterminate progress after the batch ends', () => {
    const done = summarizeBatchProgress([job('a', { review: 'completed' })]);
    expect(isBatchProgressIndeterminate(done)).toBe(false);
  });
});
