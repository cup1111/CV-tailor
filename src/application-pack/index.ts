import type { Profile } from '../types/profile.js';
import {
  loadProfileForTrack,
  migrateJobTrackBindings,
  resolveTrackPaths,
  type TrackId,
} from '../services/track.js';
import { PackStore, type ArtifactWrite } from './store.js';
import { generatePackForJob } from './lifecycle.js';
import { regeneratePackForJob } from './regenerate.js';
import { listIncompleteJobIds, listJobs } from './job-view.js';
import type {
  ApplicationPack,
  ApplicationPackModuleOptions,
  JobInputs,
  JobView,
  ModelPort,
} from './types.js';

export type {
  ApplicationPack,
  ApplicationPackModuleOptions,
  JobInputs,
  JobView,
  ModelPort,
  PackTruncation,
} from './types.js';

export type ApplicationPackModule = {
  saveJobInputs(jobId: string, inputs: JobInputs): void;
  loadJobInputs(jobId: string): JobInputs;
  listJobIds(): string[];
  /** Read-only workspace list: title, hasCompanyInfo, status, progress, packComplete, Track. */
  listJobs(): JobView[];
  /** Job IDs whose Application Pack review step is not yet completed. */
  listIncompleteJobIds(): string[];
  readPack(jobId: string): ApplicationPack;
  /** Test/support: seed artifacts without going through generatePack. */
  writeArtifacts(jobId: string, artifacts: ArtifactWrite): void;
  deleteJob(jobId: string): void;
  clearAllJobsAndOutputs(): void;
  generatePack(
    jobId: string,
    options: { model: ModelPort; profile?: Profile }
  ): Promise<{ reviewFailed: boolean }>;
  regeneratePack(
    jobId: string,
    feedback: string,
    options: { model: ModelPort }
  ): Promise<void>;
  workspaceRoot: string;
  /** Resolve templates for a Job's bound Application Track (test override via options.templatesRoot). */
  templatesRootForJob(jobId: string): string;
};

/**
 * Application Pack lifecycle module: generate, read, regenerate one pack.
 * Each Job's bound Application Track selects Profile + Prompt Templates.
 */
export function createApplicationPackModule(
  options: ApplicationPackModuleOptions = {}
): ApplicationPackModule {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  migrateJobTrackBindings(workspaceRoot);
  const store = new PackStore(workspaceRoot);

  function templatesRootForJob(jobId: string): string {
    if (options.templatesRoot != null) {
      return options.templatesRoot;
    }
    const trackId = store.loadJobInputs(jobId).applicationTrack;
    return resolveTrackPaths(workspaceRoot, trackId).templatesRoot;
  }

  function profileForJob(jobId: string, override?: Profile): Profile {
    if (override) return override;
    const trackId = store.loadJobInputs(jobId).applicationTrack;
    return loadProfileForTrack(workspaceRoot, trackId);
  }

  return {
    workspaceRoot,
    templatesRootForJob,
    saveJobInputs: (jobId, inputs) => store.saveJobInputs(jobId, inputs),
    loadJobInputs: (jobId) => store.loadJobInputs(jobId),
    listJobIds: () => store.listJobIds(),
    listJobs: () => listJobs(store),
    listIncompleteJobIds: () => listIncompleteJobIds(store),
    readPack: (jobId) => store.readPack(jobId),
    writeArtifacts: (jobId, artifacts) => store.writeArtifacts(jobId, artifacts),
    deleteJob: (jobId) => store.deleteJob(jobId),
    clearAllJobsAndOutputs: () => store.clearAllJobsAndOutputs(),
    async generatePack(jobId, { profile, model }) {
      return generatePackForJob({
        store,
        jobId,
        profile: profileForJob(jobId, profile),
        model,
        templatesRoot: templatesRootForJob(jobId),
      });
    },
    async regeneratePack(jobId, feedback, { model }) {
      await regeneratePackForJob({
        store,
        jobId,
        feedback,
        model,
        templatesRoot: templatesRootForJob(jobId),
      });
    },
  };
}

export type { TrackId };
