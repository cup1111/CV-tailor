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
import {
  editJob,
  type EditJobResult,
} from './edit-job.js';
import {
  readExportDirectory,
  writeExportDirectory,
} from './export-directory.js';
import {
  exportResume,
  type ExportResumeResult,
  type PagesPort,
} from './resume-export.js';
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

export type { EditJobResult } from './edit-job.js';
export { JobEditBlockedError, JobNotFoundError } from './edit-job.js';
export type { ExportResumeResult, PagesPort } from './resume-export.js';
export { readExportDirectory, writeExportDirectory } from './export-directory.js';

export type ApplicationPackModule = {
  saveJobInputs(jobId: string, inputs: JobInputs): void;
  loadJobInputs(jobId: string): JobInputs;
  /** Job Edit: update inputs, discard outputs on dirty change, or delete when JD empty. */
  editJob(jobId: string, inputs: JobInputs): EditJobResult;
  listJobIds(): string[];
  /** Read-only workspace list: title, hasCompanyInfo, status, progress, packComplete, Track. */
  listJobs(): JobView[];
  /** Job IDs whose Application Pack review step is not yet completed. */
  listIncompleteJobIds(): string[];
  readPack(jobId: string): ApplicationPack;
  readJobLabel(jobId: string): string | undefined;
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
  exportResume(
    jobId: string,
    options: {
      pages: PagesPort;
      profile?: Profile;
      exportDirectory?: string;
    }
  ): Promise<ExportResumeResult>;
  getExportDirectory(): string | null;
  setExportDirectory(directory: string): void;
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
    editJob: (jobId, inputs) => editJob(store, jobId, inputs),
    listJobIds: () => store.listJobIds(),
    listJobs: () => listJobs(store),
    listIncompleteJobIds: () => listIncompleteJobIds(store),
    readPack: (jobId) => store.readPack(jobId),
    readJobLabel: (jobId) => store.readJobLabel(jobId),
    writeArtifacts: (jobId, artifacts) => store.writeArtifacts(jobId, artifacts),
    deleteJob: (jobId) => store.deleteJob(jobId),
    clearAllJobsAndOutputs: () => store.clearAllJobsAndOutputs(),
    getExportDirectory: () => readExportDirectory(workspaceRoot),
    setExportDirectory: (directory) =>
      writeExportDirectory(workspaceRoot, directory),
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
    async exportResume(jobId, { pages, profile, exportDirectory }) {
      return exportResume({
        store,
        workspaceRoot,
        jobId,
        profile: profileForJob(jobId, profile),
        pages,
        exportDirectory,
      });
    },
  };
}

export type { TrackId };
