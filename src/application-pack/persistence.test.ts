import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationPackModule } from './index.js';

describe('Application Pack persistence', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'app-pack-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('saves job inputs and loads them back', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('job-1', {
      companyInfo: 'Acme robotics',
      jd: 'Build APIs for warehouse robots',
    });

    expect(pack.loadJobInputs('job-1')).toEqual({
      companyInfo: 'Acme robotics',
      jd: 'Build APIs for warehouse robots',
    });
  });

  it('distinguishes company info input from generated company profile', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('job-2', {
      companyInfo: 'search keywords only',
      jd: 'Senior engineer JD',
    });
    pack.writeArtifacts('job-2', {
      companyProfile: 'Generated company research about Acme',
      summary: 'A tailored summary',
      experienceBullets: 'Acme - Engineer\n- Built X',
      coverLetter: 'Dear hiring manager',
    });

    const result = pack.readPack('job-2');
    expect(result.exists).toBe(true);
    expect(result.hasCompanyInfo).toBe(true);
    expect(result.companyProfile).toBe('Generated company research about Acme');
    expect(pack.loadJobInputs('job-2').companyInfo).toBe('search keywords only');
  });

  it('reports missing pack when no outputs exist', () => {
    const pack = createApplicationPackModule({ workspaceRoot: root });
    pack.saveJobInputs('job-3', { companyInfo: '', jd: 'Only JD' });

    const result = pack.readPack('job-3');
    expect(result.exists).toBe(false);
    expect(result.hasCompanyInfo).toBe(false);
  });
});
