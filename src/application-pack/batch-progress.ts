/**
 * Batch progress for Application Pack generation (user-facing Pack Generation Steps).
 * Primary metric: finished steps / (jobs × 7). Secondary: finished jobs / jobs.
 */

export const PACK_GENERATION_STEPS = [
  'companyResearch',
  'painPoints',
  'mapping',
  'experienceBullets',
  'summary',
  'coverLetter',
  'review',
] as const;

export type PackGenerationStep = (typeof PACK_GENERATION_STEPS)[number];

export type StepStatusValue = 'pending' | 'in_progress' | 'completed' | 'failed';

export type BatchJobSnapshot = {
  id: string;
  /** Regenerating-from-feedback marker; not pack-generation batch progress. */
  progress?: string;
  status?: {
    steps?: Partial<Record<string, StepStatusValue>>;
  } | null;
};

export type BatchProgressSummary = {
  stepFinished: number;
  stepTotal: number;
  jobFinished: number;
  jobTotal: number;
  jobFailed: number;
  /** True while any batch job still has a pack-generation step in progress. */
  inFlight: boolean;
  /** True when every batch job has ended (review completed or any step failed). */
  allDone: boolean;
};

function stepsOf(job: BatchJobSnapshot): Partial<Record<string, StepStatusValue>> {
  return job.status?.steps ?? {};
}

/** Job has finished this batch: review completed, or any pack step failed. */
export function isBatchJobDone(job: BatchJobSnapshot): boolean {
  const steps = stepsOf(job);
  if (steps.review === 'completed') return true;
  return PACK_GENERATION_STEPS.some((step) => steps[step] === 'failed');
}

export function isBatchJobFailed(job: BatchJobSnapshot): boolean {
  const steps = stepsOf(job);
  if (steps.review === 'completed') return false;
  return PACK_GENERATION_STEPS.some((step) => steps[step] === 'failed');
}

export function isPackGenerationInFlight(job: BatchJobSnapshot): boolean {
  if (job.progress) return false;
  const steps = stepsOf(job);
  return PACK_GENERATION_STEPS.some((step) => steps[step] === 'in_progress');
}

/** Finished step count for one job (all 7 once the job has ended). */
export function finishedPackStepsForJob(job: BatchJobSnapshot): number {
  if (isBatchJobDone(job)) return PACK_GENERATION_STEPS.length;
  const steps = stepsOf(job);
  return PACK_GENERATION_STEPS.filter(
    (step) => steps[step] === 'completed' || steps[step] === 'failed'
  ).length;
}

export function summarizeBatchProgress(jobs: BatchJobSnapshot[]): BatchProgressSummary {
  const jobTotal = jobs.length;
  const stepTotal = jobTotal * PACK_GENERATION_STEPS.length;
  let stepFinished = 0;
  let jobFinished = 0;
  let jobFailed = 0;
  let inFlight = false;

  for (const job of jobs) {
    stepFinished += finishedPackStepsForJob(job);
    if (isBatchJobDone(job)) {
      jobFinished += 1;
      if (isBatchJobFailed(job)) jobFailed += 1;
    }
    if (isPackGenerationInFlight(job)) inFlight = true;
  }

  return {
    stepFinished,
    stepTotal,
    jobFinished,
    jobTotal,
    jobFailed,
    inFlight,
    allDone: jobTotal > 0 && jobFinished === jobTotal,
  };
}

/**
 * True when the batch UI should show a moving indeterminate bar:
 * still open, but either no step has finished yet (0%) or no step is currently running
 * (startup gap / between sequential jobs).
 */
export function isBatchProgressIndeterminate(summary: BatchProgressSummary): boolean {
  if (summary.allDone) return false;
  return summary.stepFinished === 0 || !summary.inFlight;
}
