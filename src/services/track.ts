import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { z } from 'zod';
import { ProfileSchema, type Profile } from '../types/profile.js';

export const TRACK_IDS = ['software-engineering', 'it-support'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

const TrackConfigSchema = z.object({
  activeTrack: z.enum(TRACK_IDS),
});

const DEFAULT_TRACK: TrackId = 'software-engineering';
export const DEFAULT_APPLICATION_TRACK: TrackId = DEFAULT_TRACK;

export type ResolvedTrack = {
  id: TrackId;
  profilePath: string;
  templatesRoot: string;
  trackRoot: string;
};

function tracksRoot(workspaceRoot: string): string {
  return join(workspaceRoot, 'tracks');
}

export function trackRoot(workspaceRoot: string, trackId: TrackId): string {
  return join(tracksRoot(workspaceRoot), trackId);
}

export function resolveTrackPaths(
  workspaceRoot: string,
  trackId: TrackId
): ResolvedTrack {
  const root = trackRoot(workspaceRoot, trackId);
  return {
    id: trackId,
    trackRoot: root,
    profilePath: join(root, 'profile.yaml'),
    templatesRoot: join(root, 'templates'),
  };
}

export function listTrackIds(): readonly TrackId[] {
  return TRACK_IDS;
}

/** Read legacy workspace activeTrack from track.yaml (migration only). */
function readLegacyActiveTrackId(workspaceRoot: string): TrackId | null {
  const configPath = join(workspaceRoot, 'track.yaml');
  if (!existsSync(configPath)) {
    return null;
  }
  const raw = load(readFileSync(configPath, 'utf-8'));
  const parsed = TrackConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.activeTrack;
}

/** Legacy pack marker — used only while migrating to Job bindings. */
export function readPackTrackId(
  workspaceRoot: string,
  jobId: string
): TrackId | null {
  const markerPath = join(workspaceRoot, 'out', jobId, 'application-track.txt');
  if (!existsSync(markerPath)) return null;
  const value = readFileSync(markerPath, 'utf-8').trim();
  if ((TRACK_IDS as readonly string[]).includes(value)) {
    return value as TrackId;
  }
  return null;
}

/** Test/migration helper: write a legacy pack Track marker. */
export function writePackTrackId(
  workspaceRoot: string,
  jobId: string,
  trackId: TrackId
): void {
  const outDir = join(workspaceRoot, 'out', jobId);
  writeFileSync(join(outDir, 'application-track.txt'), `${trackId}\n`, 'utf-8');
}

function jobTrackPath(workspaceRoot: string, jobId: string): string {
  return join(workspaceRoot, 'jobs', `${jobId}.track.txt`);
}

/**
 * Bind unbound Jobs to an Application Track:
 * pack marker → legacy track.yaml activeTrack → software-engineering.
 * Existing Job bindings are left unchanged.
 */
export function migrateJobTrackBindings(workspaceRoot: string): void {
  const jobsDir = join(workspaceRoot, 'jobs');
  if (!existsSync(jobsDir)) return;

  const jobIds = readdirSync(jobsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));

  const legacyActive = readLegacyActiveTrackId(workspaceRoot);

  for (const jobId of jobIds) {
    const trackPath = jobTrackPath(workspaceRoot, jobId);
    if (existsSync(trackPath)) continue;

    const fromPack = readPackTrackId(workspaceRoot, jobId);
    const trackId = fromPack ?? legacyActive ?? DEFAULT_TRACK;
    writeFileSync(trackPath, `${trackId}\n`, 'utf-8');
  }
}

export function loadProfileForTrack(
  workspaceRoot: string,
  trackId: TrackId
): Profile {
  const { profilePath } = resolveTrackPaths(workspaceRoot, trackId);
  if (!existsSync(profilePath)) {
    throw new Error(
      `Profile not found for Application Track "${trackId}": ${profilePath}. ` +
        `Copy tracks/${trackId}/profile.example.yaml to profile.yaml and edit it.`
    );
  }
  const yaml = load(readFileSync(profilePath, 'utf-8'));
  return ProfileSchema.parse(yaml);
}
