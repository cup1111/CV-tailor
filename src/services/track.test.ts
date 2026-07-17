import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getActiveTrackId,
  isPackStaleForActiveTrack,
  loadActiveProfile,
  resolveActiveTrack,
  setActiveTrackId,
  writePackTrackId,
} from './track.js';
import { ProfileSchema } from '../types/profile.js';

describe('Application Track resolution', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'track-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('defaults activeTrack to software-engineering when track.yaml is missing', () => {
    expect(getActiveTrackId(root)).toBe('software-engineering');
    expect(resolveActiveTrack(root).templatesRoot).toBe(
      join(root, 'tracks/software-engineering/templates')
    );
  });

  it('persists activeTrack via setActiveTrackId', () => {
    expect(getActiveTrackId(root)).toBe('software-engineering');
    setActiveTrackId('it-support', root);
    expect(getActiveTrackId(root)).toBe('it-support');
    setActiveTrackId('software-engineering', root);
    expect(getActiveTrackId(root)).toBe('software-engineering');
  });

  it('reads activeTrack from track.yaml', () => {
    writeFileSync(join(root, 'track.yaml'), 'activeTrack: it-support\n');
    expect(getActiveTrackId(root)).toBe('it-support');
  });

  it('marks pack stale when recorded Track differs from active', () => {
    const jobId = '1';
    mkdirSync(join(root, 'out', jobId), { recursive: true });
    writePackTrackId(root, jobId, 'software-engineering');
    writeFileSync(join(root, 'track.yaml'), 'activeTrack: it-support\n');
    expect(isPackStaleForActiveTrack(root, jobId, true)).toBe(true);
  });

  it('loads profile from the active Track folder', () => {
    writeFileSync(join(root, 'track.yaml'), 'activeTrack: it-support\n');
    const dir = join(root, 'tracks/it-support');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'profile.yaml'),
      `
personal:
  name: "Test User"
  email: "t@example.com"
experiences:
  - company: "Co"
    role: "Full Stack Developer"
    startDate: "2024-01"
    endDate: "Present"
    description: "Support-facing work only."
`
    );
    const profile = loadActiveProfile(root);
    expect(ProfileSchema.parse(profile).personal.name).toBe('Test User');
    expect(profile.experiences).toHaveLength(1);
  });
});
