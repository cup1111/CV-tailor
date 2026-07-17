import { join } from 'path';
import type { OpenAIService } from './openai.js';
import { PackStore } from '../application-pack/store.js';
import {
  regeneratePackForJob,
  RegenerateOutputSchema,
  type RegenerateOutput,
} from '../application-pack/regenerate.js';
import { getActiveTrackId, resolveActiveTrack } from './track.js';

export { RegenerateOutputSchema, type RegenerateOutput };

/**
 * Legacy adapter — prefer `createApplicationPackModule().regeneratePack`.
 */
export async function regenerateResumeContent(
  openai: OpenAIService,
  jobId: string,
  feedback: string
): Promise<RegenerateOutput> {
  const workspaceRoot = process.cwd();
  const store = new PackStore(workspaceRoot);
  const { templatesRoot } = resolveActiveTrack(workspaceRoot);
  return regeneratePackForJob({
    store,
    jobId,
    feedback,
    model: openai,
    templatesRoot,
    workspaceRoot,
    applicationTrackId: getActiveTrackId(workspaceRoot),
  });
}
