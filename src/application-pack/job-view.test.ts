import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationPackModule } from './index.js';

describe('Application Pack job view', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'app-pack-view-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists jobs with title, hasCompanyInfo, status, packComplete, and bound Track', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('100', {
      companyInfo: 'Acme',
      jd: 'Senior backend engineer for robotics platform',
      applicationTrack: 'software-engineering',
    });
    pack.saveJobInputs('200', {
      companyInfo: '',
      jd: 'Frontend role only',
      applicationTrack: 'it-support',
    });

    const jobs = pack.listJobs();
    expect(jobs).toHaveLength(2);

    const withCompany = jobs.find((j) => j.id === '100')!;
    expect(withCompany.hasCompanyInfo).toBe(true);
    expect(withCompany.packComplete).toBe(false);
    expect(withCompany.applicationTrack).toBe('software-engineering');
    expect(withCompany.title).toContain('Senior backend');
    expect(withCompany.progress).toBeUndefined();
    expect(Object.keys(withCompany)).not.toContain('stale');

    const jdOnly = jobs.find((j) => j.id === '200')!;
    expect(jdOnly.hasCompanyInfo).toBe(false);
    expect(jdOnly.applicationTrack).toBe('it-support');
  });

  it('listIncompleteJobIds skips packs whose review step is complete', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('a', {
      companyInfo: '',
      jd: 'Incomplete job',
      applicationTrack: 'software-engineering',
    });
    pack.saveJobInputs('b', {
      companyInfo: '',
      jd: 'Complete job',
      applicationTrack: 'software-engineering',
    });
    pack.writeArtifacts('b', {
      summary: 'S',
      experienceBullets: 'E',
      coverLetter: 'C',
      review: 'PASS',
    });
    const outB = join(root, 'out', 'b');
    mkdirSync(outB, { recursive: true });
    writeFileSync(join(outB, 'role-title.txt'), 'Engineer');
    writeFileSync(join(outB, 'employer-name.txt'), 'CompleteCo');
    writeFileSync(
      join(outB, 'status.json'),
      JSON.stringify({
        jobId: 'b',
        steps: {
          companyResearch: 'completed',
          painPoints: 'completed',
          mapping: 'completed',
          experienceBullets: 'completed',
          summary: 'completed',
          coverLetter: 'completed',
          review: 'completed',
          render: 'pending',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      'utf-8'
    );

    expect(pack.listIncompleteJobIds()).toEqual(['a']);
  });

  it('readPack results use hasCompanyInfo not hasCompanyProfile', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('x', {
      companyInfo: 'Kw',
      jd: 'JD',
      applicationTrack: 'software-engineering',
    });
    pack.writeArtifacts('x', { companyProfile: 'Profile text', summary: 'S' });
    const result = pack.readPack('x');
    expect(result.hasCompanyInfo).toBe(true);
    expect(Object.keys(result)).not.toContain('hasCompanyProfile');
  });

  it('heals a stuck review from persisted legacy review output', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('legacy', {
      companyInfo: '',
      jd: 'Legacy review job',
      applicationTrack: 'software-engineering',
    });
    pack.writeArtifacts('legacy', {
      summary: 'S',
      experienceBullets: 'E',
      coverLetter: 'C',
      review: 'PASS\nJob Label: Backend Engineer - Globex\nLooks good.',
    });
    const outDir = join(root, 'out', 'legacy');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'status.json'),
      JSON.stringify({
        jobId: 'legacy',
        steps: {
          companyResearch: 'completed',
          painPoints: 'completed',
          mapping: 'completed',
          experienceBullets: 'completed',
          summary: 'completed',
          coverLetter: 'completed',
          review: 'failed',
          render: 'pending',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      'utf-8'
    );

    const legacy = pack.listJobs().find((j) => j.id === 'legacy')!;
    expect(legacy.packComplete).toBe(true);
  });

  it('reconciles legacy review-failed jobs with advisory FAIL verdict', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('fail-advisory', {
      companyInfo: '',
      jd: 'Advisory fail job',
      applicationTrack: 'software-engineering',
    });
    pack.writeArtifacts('fail-advisory', {
      summary: 'S',
      experienceBullets: 'E',
      coverLetter: 'C',
      review:
        'FAIL\nRole Title: Backend Engineer\nEmployer Name: Globex\nNeeds better JD fit.',
    });
    const outDir = join(root, 'out', 'fail-advisory');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'status.json'),
      JSON.stringify({
        jobId: 'fail-advisory',
        steps: {
          companyResearch: 'completed',
          painPoints: 'completed',
          mapping: 'completed',
          experienceBullets: 'completed',
          summary: 'completed',
          coverLetter: 'completed',
          review: 'failed',
          render: 'pending',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      'utf-8'
    );

    const job = pack.listJobs().find((j) => j.id === 'fail-advisory')!;
    expect(job.packComplete).toBe(true);
    expect(job.reviewVerdictFail).toBe(true);
    expect(pack.readJobIdentity('fail-advisory')).toEqual({
      roleTitle: 'Backend Engineer',
      employerName: 'Globex',
    });
  });
});
