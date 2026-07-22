import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Profile } from '../types/profile.js';
import { resolveTrackPaths } from '../services/track.js';
import { readExportDirectory } from './export-directory.js';
import { isPackComplete } from './job-label.js';
import type { PackStore } from './store.js';

export type PagesPort = {
  listPlaceholderTags(layoutPath: string): Promise<string[]>;
  fillAndExport(args: {
    layoutPath: string;
    fills: Record<string, string>;
    pagesOutPath: string;
    pdfOutPath: string;
  }): Promise<void>;
};

export type PlanResumeExportFillsInput = {
  summary: string;
  /** One block per Profile experience order: first line is "Company - Role", rest are bullets. */
  experienceBulletBlocks: string[];
  experienceCount: number;
  layoutTags: string[];
};

export function buildResumeExportBasename(
  personalName: string,
  jobLabel: string
): string {
  return `${personalName.trim()} CV ${jobLabel.trim()}`;
}

function experienceSlotCount(layoutTags: string[]): number {
  let n = 0;
  for (const tag of layoutTags) {
    const m = /^EXP_(\d+)$/.exec(tag);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return n;
}

function bulletsOnly(block: string): string {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return '';
  return lines.slice(1).join('\n');
}

/**
 * Build Placeholder Text fills for Resume Export.
 * Requires SUMMARY plus EXP_1..EXP_N matching Profile experience count.
 */
export function planResumeExportFills(
  input: PlanResumeExportFillsInput
): Record<string, string> {
  const { summary, experienceBulletBlocks, experienceCount, layoutTags } = input;
  const slotCount = experienceSlotCount(layoutTags);
  if (!layoutTags.includes('SUMMARY')) {
    throw new Error('Resume Layout is missing SUMMARY placeholder slot');
  }
  if (slotCount !== experienceCount) {
    throw new Error(
      `Resume Layout experience slot count (${slotCount}) does not match Profile experience count (${experienceCount})`
    );
  }
  if (experienceBulletBlocks.length !== experienceCount) {
    throw new Error(
      `Experience bullet block count (${experienceBulletBlocks.length}) does not match Profile experience count (${experienceCount})`
    );
  }

  const fills: Record<string, string> = {
    SUMMARY: summary.trim(),
  };
  for (let i = 1; i <= experienceCount; i++) {
    fills[`EXP_${i}`] = bulletsOnly(experienceBulletBlocks[i - 1]!);
  }
  return fills;
}

/** Split extracted experience-bullets display text into ordered blocks. */
export function splitExperienceBulletBlocks(extracted: string): string[] {
  return extracted
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

export function resumeLayoutPath(
  workspaceRoot: string,
  trackId: Parameters<typeof resolveTrackPaths>[1]
): string {
  return join(resolveTrackPaths(workspaceRoot, trackId).trackRoot, 'resume-layout.pages');
}

export type ExportResumeResult = {
  pagesPath: string;
  pdfPath: string;
};

export async function exportResume(args: {
  store: PackStore;
  workspaceRoot: string;
  jobId: string;
  profile: Profile;
  pages: PagesPort;
  /** One-off override; does not change the workspace default. */
  exportDirectory?: string;
}): Promise<ExportResumeResult> {
  const { store, workspaceRoot, jobId, profile, pages } = args;

  if (!isPackComplete(store, jobId)) {
    throw new Error('Resume Export requires a complete Application Pack');
  }

  const jobLabel = store.readJobLabel(jobId)!;
  const pack = store.readPack(jobId);
  if (!pack.summary?.trim() || !pack.experienceBullets?.trim()) {
    throw new Error('Resume Export requires Summary and Experience Bullets');
  }

  const trackId = store.loadJobInputs(jobId).applicationTrack;
  const layoutPath = resumeLayoutPath(workspaceRoot, trackId);
  if (!existsSync(layoutPath)) {
    throw new Error(
      `Resume Layout not found for track "${trackId}" (expected ${layoutPath})`
    );
  }

  const exportDir =
    args.exportDirectory?.trim() || readExportDirectory(workspaceRoot);
  if (!exportDir) {
    throw new Error('Export Directory is not configured');
  }

  const layoutTags = await pages.listPlaceholderTags(layoutPath);
  const fills = planResumeExportFills({
    summary: pack.summary,
    experienceBulletBlocks: splitExperienceBulletBlocks(pack.experienceBullets),
    experienceCount: profile.experiences.length,
    layoutTags,
  });

  mkdirSync(exportDir, { recursive: true });

  const basename = buildResumeExportBasename(profile.personal.name, jobLabel);
  const pagesOutPath = join(exportDir, `${basename}.pages`);
  const pdfOutPath = join(exportDir, `${basename}.pdf`);

  await pages.fillAndExport({
    layoutPath,
    fills,
    pagesOutPath,
    pdfOutPath,
  });

  return { pagesPath: pagesOutPath, pdfPath: pdfOutPath };
}
