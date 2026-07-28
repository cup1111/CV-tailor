import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationPackModule, JobEditBlockedError } from './index.js';
import { PackStore } from './store.js';

describe('Job Edit', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'job-edit-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('allows rebinding Application Track and updates JD/Company Info', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('j1', {
      companyInfo: 'Acme',
      jd: 'Original JD',
      applicationTrack: 'software-engineering',
    });

    const result = pack.editJob('j1', {
      companyInfo: '',
      jd: 'Updated JD',
      applicationTrack: 'it-support',
    });

    expect(result).toEqual({ kind: 'updated', clearedOutputs: false });
    expect(pack.loadJobInputs('j1')).toEqual({
      companyInfo: '',
      jd: 'Updated JD',
      jobLink: '',
      applicationTrack: 'it-support',
    });
  });

  it('is a no-op when no fields change', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('j1', {
      companyInfo: 'Acme',
      jd: 'Same JD',
      applicationTrack: 'it-support',
    });
    pack.writeArtifacts('j1', { summary: 'keep me' });

    const result = pack.editJob('j1', {
      companyInfo: 'Acme',
      jd: 'Same JD',
      applicationTrack: 'it-support',
    });

    expect(result).toEqual({ kind: 'unchanged' });
    expect(pack.readPack('j1').summary).toBe('keep me');
  });

  it('discards complete and partial generation outputs on dirty Edit', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('j1', {
      companyInfo: '',
      jd: 'JD',
      applicationTrack: 'software-engineering',
    });
    pack.writeArtifacts('j1', {
      summary: 'old summary',
      experienceBullets: 'old bullets',
    });

    const result = pack.editJob('j1', {
      companyInfo: '',
      jd: 'JD changed',
      applicationTrack: 'software-engineering',
    });

    expect(result).toEqual({ kind: 'updated', clearedOutputs: true });
    expect(pack.readPack('j1').exists).toBe(false);
    expect(existsSync(join(root, 'out', 'j1'))).toBe(false);
  });

  it('deletes the Job when JD is empty', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('j1', {
      companyInfo: 'x',
      jd: 'Will delete',
      applicationTrack: 'software-engineering',
    });
    pack.writeArtifacts('j1', { summary: 'gone' });

    const result = pack.editJob('j1', {
      companyInfo: 'x',
      jd: '   ',
      applicationTrack: 'software-engineering',
    });

    expect(result).toEqual({ kind: 'deleted' });
    expect(pack.listJobIds()).not.toContain('j1');
    expect(existsSync(join(root, 'out', 'j1'))).toBe(false);
  });

  it('blocks Edit while generation is in flight', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    const store = new PackStore(root);
    pack.saveJobInputs('j1', {
      companyInfo: '',
      jd: 'Busy',
      applicationTrack: 'software-engineering',
    });
    store.setProgress('j1', 'regenerate');

    expect(() =>
      pack.editJob('j1', {
        companyInfo: '',
        jd: 'Busy changed',
        applicationTrack: 'software-engineering',
      })
    ).toThrow(JobEditBlockedError);

    expect(pack.loadJobInputs('j1').jd).toBe('Busy');
  });
});
