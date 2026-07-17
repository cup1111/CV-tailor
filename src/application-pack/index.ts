import { join } from 'path';
import type { Profile } from '../types/profile.js';
import type { Status } from '../types/outputs.js';
import { PackStore, type ArtifactWrite } from './store.js';
import { generatePackForJob } from './lifecycle.js';
import { regeneratePackForJob } from './regenerate.js';
import type {
  ApplicationPack,
  ApplicationPackModuleOptions,
  JobInputs,
  ModelPort,
} from './types.js';

export type {
  ApplicationPack,
  ApplicationPackModuleOptions,
  JobInputs,
  ModelPort,
  PackTruncation,
} from './types.js';

export type ApplicationPackModule = {
  saveJobInputs(jobId: string, inputs: JobInputs): void;
  loadJobInputs(jobId: string): JobInputs;
  listJobIds(): string[];
  readPack(jobId: string): ApplicationPack;
  writeArtifacts(jobId: string, artifacts: ArtifactWrite): void;
  deleteJob(jobId: string): void;
  clearAllJobsAndOutputs(): void;
  getProgress(jobId: string): string | undefined;
  setProgress(jobId: string, phase: string | null): void;
  readStatus(jobId: string): Status | null;
  isStepCompleted(jobId: string, step: keyof Status['steps']): boolean;
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
 * Disk layout stays inside this module; adapters use JobInputs / ApplicationPack only.
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
    readPack: (jobId) => store.readPack(jobId),
    writeArtifacts: (jobId, artifacts) => store.writeArtifacts(jobId, artifacts),
    deleteJob: (jobId) => store.deleteJob(jobId),
    clearAllJobsAndOutputs: () => store.clearAllJobsAndOutputs(),
    getProgress: (jobId) => store.getProgress(jobId),
    setProgress: (jobId, phase) => store.setProgress(jobId, phase),
    readStatus: (jobId) => store.readStatus(jobId),
    isStepCompleted: (jobId, step) => store.isStepCompleted(jobId, step),
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
