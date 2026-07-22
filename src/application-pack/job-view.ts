import type { PackStore } from './store.js';
import type { JobView } from './types.js';

function displayJd(jd: string): { title: string; content: string } {
  let jdContent = jd;
  const lines = jdContent.split('\n');
  if (lines[0]?.startsWith('#')) {
    jdContent = lines.slice(1).join('\n');
  }
  if (jdContent.includes('URL:')) {
    jdContent = jdContent.replace(/URL:.*\n/, '');
  }
  jdContent = jdContent.replace(/##\s*Job\s*Description\s*\n?/i, '');
  const trimmed = jdContent.trim();
  const title = trimmed.substring(0, 50).replace(/\n/g, ' ').trim();
  const finalTitle = title.length < trimmed.length ? title + '...' : title;
  return { title: finalTitle || 'Untitled', content: trimmed };
}

/** Build the read-only workspace view for one job. */
export function buildJobView(store: PackStore, jobId: string): JobView {
  const inputs = store.loadJobInputs(jobId);
  const { title, content } = displayJd(inputs.jd);
  const status = store.readStatus(jobId);
  return {
    id: jobId,
    title,
    content,
    hasCompanyInfo: store.hasCompanyInfo(jobId),
    status,
    progress: store.getProgress(jobId),
    packComplete: status?.steps.review === 'completed',
    hasGenerationOutputs: store.hasGenerationOutputs(jobId),
    applicationTrack: inputs.applicationTrack,
  };
}

export function listJobs(store: PackStore): JobView[] {
  return store.listJobIds().map((id) => buildJobView(store, id));
}

export function listIncompleteJobIds(store: PackStore): string[] {
  return store.listJobIds().filter((id) => !store.isStepCompleted(id, 'review'));
}
