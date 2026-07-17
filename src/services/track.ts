import { existsSync, readFileSync, writeFileSync } from 'fs';
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
/** Legacy packs without a marker are treated as this Track. */
export const LEGACY_PACK_TRACK: TrackId = 'software-engineering';

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

/**
 * Read active Application Track from track.yaml (workspace root).
 * Missing file defaults to software-engineering.
 */
export function getActiveTrackId(workspaceRoot: string = process.cwd()): TrackId {
  const configPath = join(workspaceRoot, 'track.yaml');
  if (!existsSync(configPath)) {
    return DEFAULT_TRACK;
  }
  const raw = load(readFileSync(configPath, 'utf-8'));
  const parsed = TrackConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid track.yaml: activeTrack must be one of ${TRACK_IDS.join(', ')}`
    );
  }
  return parsed.data.activeTrack;
}

/** Persist active Application Track to track.yaml (UI / config shell). */
export function setActiveTrackId(
  trackId: TrackId,
  workspaceRoot: string = process.cwd()
): TrackId {
  if (!(TRACK_IDS as readonly string[]).includes(trackId)) {
    throw new Error(
      `Invalid Application Track: ${trackId}. Must be one of ${TRACK_IDS.join(', ')}`
    );
  }
  const configPath = join(workspaceRoot, 'track.yaml');
  writeFileSync(configPath, `activeTrack: ${trackId}\n`, 'utf-8');
  return trackId;
}

export function listTrackIds(): readonly TrackId[] {
  return TRACK_IDS;
}

export function resolveActiveTrack(
  workspaceRoot: string = process.cwd()
): ResolvedTrack {
  return resolveTrackPaths(workspaceRoot, getActiveTrackId(workspaceRoot));
}

export function loadActiveProfile(
  workspaceRoot: string = process.cwd()
): Profile {
  const { id, profilePath } = resolveActiveTrack(workspaceRoot);
  if (!existsSync(profilePath)) {
    throw new Error(
      `Profile not found for Application Track "${id}": ${profilePath}. ` +
        `Copy tracks/${id}/profile.example.yaml to profile.yaml and edit it.`
    );
  }
  const yaml = load(readFileSync(profilePath, 'utf-8'));
  return ProfileSchema.parse(yaml);
}

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

export function writePackTrackId(
  workspaceRoot: string,
  jobId: string,
  trackId: TrackId
): void {
  const outDir = join(workspaceRoot, 'out', jobId);
  writeFileSync(join(outDir, 'application-track.txt'), `${trackId}\n`, 'utf-8');
}

/** True when pack materials exist for a different Track than the active one. */
export function isPackStaleForActiveTrack(
  workspaceRoot: string,
  jobId: string,
  packExists: boolean
): boolean {
  if (!packExists) return false;
  const active = getActiveTrackId(workspaceRoot);
  const recorded = readPackTrackId(workspaceRoot, jobId) ?? LEGACY_PACK_TRACK;
  return recorded !== active;
}
