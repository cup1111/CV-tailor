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

  it('lists jobs with title, hasCompanyInfo, status, and packComplete', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('100', {
      companyInfo: 'Acme',
      jd: 'Senior backend engineer for robotics platform',
    });
    pack.saveJobInputs('200', {
      companyInfo: '',
      jd: 'Frontend role only',
    });

    const jobs = pack.listJobs();
    expect(jobs).toHaveLength(2);

    const withCompany = jobs.find((j) => j.id === '100')!;
    expect(withCompany.hasCompanyInfo).toBe(true);
    expect(withCompany.packComplete).toBe(false);
    expect(withCompany.stale).toBe(false);
    expect(withCompany.title).toContain('Senior backend');
    expect(withCompany.progress).toBeUndefined();

    const jdOnly = jobs.find((j) => j.id === '200')!;
    expect(jdOnly.hasCompanyInfo).toBe(false);
    expect(jdOnly.stale).toBe(false);
  });

  it('listIncompleteJobIds skips packs whose review step is complete', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('a', { companyInfo: '', jd: 'Incomplete job' });
    pack.saveJobInputs('b', { companyInfo: '', jd: 'Complete job' });
    pack.writeArtifacts('b', {
      summary: 'S',
      experienceBullets: 'E',
      coverLetter: 'C',
      review: 'PASS',
    });
    const outB = join(root, 'out', 'b');
    mkdirSync(outB, { recursive: true });
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
    pack.saveJobInputs('x', { companyInfo: 'Kw', jd: 'JD' });
    pack.writeArtifacts('x', { companyProfile: 'Profile text', summary: 'S' });
    const result = pack.readPack('x');
    expect(result.hasCompanyInfo).toBe(true);
    expect(Object.keys(result)).not.toContain('hasCompanyProfile');
  });
});
