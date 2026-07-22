import { describe, expect, it } from 'vitest';
import {
  PACK_GENERATION_STEPS,
  finishedPackStepsForJob,
  isBatchJobDone,
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
});
