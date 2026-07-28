import { TRACK_IDS, type TrackId } from '../services/track.js';
import type { PackStore } from './store.js';
import type { JobInputs } from './types.js';

export type EditJobResult =
  | { kind: 'unchanged' }
  | { kind: 'deleted' }
  | { kind: 'updated'; clearedOutputs: boolean };

export class JobEditBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobEditBlockedError';
  }
}

export class JobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`);
    this.name = 'JobNotFoundError';
  }
}

export function isGenerationInFlight(store: PackStore, jobId: string): boolean {
  if (store.getProgress(jobId)) return true;
  const status = store.readStatus(jobId);
  if (!status) return false;
  return Object.values(status.steps).some((s) => s === 'in_progress');
}

function assertTrackId(value: string): TrackId {
  if (!(TRACK_IDS as readonly string[]).includes(value)) {
    throw new Error(
      `Invalid Application Track: ${value}. Must be one of ${TRACK_IDS.join(', ')}`
    );
  }
  return value as TrackId;
}

/**
 * Apply a Job Edit: empty JD deletes the Job; unchanged fields are a no-op;
 * dirty updates may discard generation outputs.
 */
export function editJob(store: PackStore, jobId: string, inputs: JobInputs): EditJobResult {
  if (!store.listJobIds().includes(jobId)) {
    throw new JobNotFoundError(jobId);
  }
  if (isGenerationInFlight(store, jobId)) {
    throw new JobEditBlockedError(
      `Job Edit is not available while generation is in flight for job "${jobId}"`
    );
  }

  const jd = inputs.jd.trim();
  if (!jd) {
    store.deleteJob(jobId);
    return { kind: 'deleted' };
  }

  const applicationTrack = assertTrackId(inputs.applicationTrack);
  const companyInfo =
    typeof inputs.companyInfo === 'string' ? inputs.companyInfo.trim() : '';
  const jobLink = typeof inputs.jobLink === 'string' ? inputs.jobLink.trim() : '';

  const existing = store.loadJobInputs(jobId);
  const unchanged =
    existing.jd.trim() === jd &&
    existing.companyInfo.trim() === companyInfo &&
    existing.jobLink?.trim() === jobLink &&
    existing.applicationTrack === applicationTrack;

  if (unchanged) {
    return { kind: 'unchanged' };
  }

  const clearedOutputs = store.hasGenerationOutputs(jobId);
  if (clearedOutputs) {
    store.clearJobOutputs(jobId);
  }

  store.saveJobInputs(jobId, { jd, companyInfo, jobLink, applicationTrack });
  return { kind: 'updated', clearedOutputs };
}
