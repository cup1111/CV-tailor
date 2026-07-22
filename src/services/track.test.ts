import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadProfileForTrack,
  migrateJobTrackBindings,
  readPackTrackId,
  resolveTrackPaths,
  writePackTrackId,
} from './track.js';
import { ProfileSchema } from '../types/profile.js';
import { PackStore } from '../application-pack/store.js';

describe('Application Track helpers', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'track-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('resolves Track paths under tracks/{id}', () => {
    expect(resolveTrackPaths(root, 'it-support').templatesRoot).toBe(
      join(root, 'tracks/it-support/templates')
    );
  });

  it('loads profile for a specific Track', () => {
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
    const profile = loadProfileForTrack(root, 'it-support');
    expect(ProfileSchema.parse(profile).personal.name).toBe('Test User');
    expect(profile.experiences).toHaveLength(1);
  });

  it('migrates Job Track from pack marker, else track.yaml, else software-engineering', () => {
    const jobs = join(root, 'jobs');
    mkdirSync(jobs, { recursive: true });
    writeFileSync(join(jobs, 'from-pack.md'), 'JD pack');
    writeFileSync(join(jobs, 'from-yaml.md'), 'JD yaml');
    writeFileSync(join(jobs, 'fallback.md'), 'JD fallback');
    mkdirSync(join(root, 'out', 'from-pack'), { recursive: true });
    writePackTrackId(root, 'from-pack', 'it-support');
    writeFileSync(join(root, 'track.yaml'), 'activeTrack: it-support\n');

    migrateJobTrackBindings(root);

    const store = new PackStore(root);
    expect(store.loadJobInputs('from-pack').applicationTrack).toBe('it-support');
    expect(store.loadJobInputs('from-yaml').applicationTrack).toBe('it-support');
  });

  it('migrates unbound Job to software-engineering when no pack marker and no track.yaml', () => {
    const jobs = join(root, 'jobs');
    mkdirSync(jobs, { recursive: true });
    writeFileSync(join(jobs, 'fallback.md'), 'JD fallback');

    migrateJobTrackBindings(root);

    const store = new PackStore(root);
    expect(store.loadJobInputs('fallback').applicationTrack).toBe('software-engineering');
  });

  it('migrate is a no-op when Job already has a Track binding', () => {
    const store = new PackStore(root);
    store.saveJobInputs('bound', {
      companyInfo: '',
      jd: 'Already bound',
      applicationTrack: 'software-engineering',
    });
    mkdirSync(join(root, 'out', 'bound'), { recursive: true });
    writePackTrackId(root, 'bound', 'it-support');
    writeFileSync(join(root, 'track.yaml'), 'activeTrack: it-support\n');

    migrateJobTrackBindings(root);

    expect(store.loadJobInputs('bound').applicationTrack).toBe('software-engineering');
  });

  it('can still read legacy pack Track markers for migration only', () => {
    mkdirSync(join(root, 'out', '1'), { recursive: true });
    writePackTrackId(root, '1', 'it-support');
    expect(readPackTrackId(root, '1')).toBe('it-support');
    expect(existsSync(join(root, 'out', '1', 'application-track.txt'))).toBe(true);
    expect(readFileSync(join(root, 'out', '1', 'application-track.txt'), 'utf-8').trim()).toBe(
      'it-support'
    );
  });
});
