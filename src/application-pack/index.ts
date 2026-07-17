import { join } from 'path';
import type { Profile } from '../types/profile.js';
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
  /** Read-only workspace list: title, hasCompanyInfo, status, progress, packComplete. */
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
    options: { profile: Profile; model: ModelPort }
  ): Promise<{ reviewFailed: boolean }>;
  regeneratePack(
    jobId: string,
    feedback: string,
    options: { model: ModelPort }
  ): Promise<void>;
  workspaceRoot: string;
  templatesRoot: string;
};

/**
 * Application Pack lifecycle module: generate, read, regenerate one pack.
 * Disk layout and status/progress stay inside this module.
 */
export function createApplicationPackModule(
  options: ApplicationPackModuleOptions = {}
): ApplicationPackModule {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const templatesRoot =
    options.templatesRoot ?? join(workspaceRoot, 'templates');
  const store = new PackStore(workspaceRoot);

  return {
    workspaceRoot,
    templatesRoot,
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
        profile,
        model,
        templatesRoot,
        workspaceRoot,
      });
    },
    async regeneratePack(jobId, feedback, { model }) {
      await regeneratePackForJob({
        store,
        jobId,
        feedback,
        model,
        templatesRoot,
        workspaceRoot,
      });
    },
  };
}
