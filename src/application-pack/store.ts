import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  rmSync,
} from 'fs';
import { join } from 'path';
import {
  StatusSchema,
  type Status,
  type StepStatus,
} from '../types/outputs.js';
import type { ApplicationPack, JobInputs, PackTruncation } from './types.js';

const COMPANY_MARKER = '---COMPANY---';
const JD_MARKER = '---JD---';

export type ArtifactWrite = {
  companyProfile?: string;
  painPoints?: string;
  mapping?: string;
  experienceBulletsRaw?: string;
  experienceBullets?: string;
  summary?: string;
  coverLetter?: string;
  review?: string;
  regenerateFeedback?: string;
  truncation?: Partial<PackTruncation>;
};

export class PackStore {
  constructor(private readonly workspaceRoot: string) {}

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  jobsDir(): string {
    return join(this.workspaceRoot, 'jobs');
  }

  outDir(jobId: string): string {
    return join(this.workspaceRoot, 'out', jobId);
  }

  ensureJobsDir(): void {
    const dir = this.jobsDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  ensureOutDir(jobId: string): void {
    const dir = this.outDir(jobId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  saveJobInputs(jobId: string, inputs: JobInputs): void {
    this.ensureJobsDir();
    const jdPath = join(this.jobsDir(), `${jobId}.md`);
    const urlMatch = inputs.jd.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : '';
    writeFileSync(
      jdPath,
      `${url ? `URL: ${url}\n\n` : ''}${inputs.jd.trim()}`,
      'utf-8'
    );
    const companyPath = join(this.jobsDir(), `${jobId}.company.txt`);
    const company = inputs.companyInfo.trim();
    if (company) {
      writeFileSync(companyPath, company, 'utf-8');
    } else if (existsSync(companyPath)) {
      unlinkSync(companyPath);
    }
  }

  loadJobInputs(jobId: string): JobInputs {
    const jdPath = join(this.jobsDir(), `${jobId}.md`);
    const companyPath = join(this.jobsDir(), `${jobId}.company.txt`);
    if (!existsSync(jdPath)) {
      throw new Error(`Job not found: ${jdPath}`);
    }

    let companyInfo = '';
    let jdText = '';

    if (existsSync(companyPath)) {
      companyInfo = readFileSync(companyPath, 'utf-8').trim();
      jdText = readFileSync(jdPath, 'utf-8').trim();
    } else {
      const content = readFileSync(jdPath, 'utf-8');
      const idx = content.indexOf(JD_MARKER);
      if (idx >= 0) {
        const before = content.slice(0, idx).trim();
        const after = content.slice(idx + JD_MARKER.length).trim();
        companyInfo = before.replace(new RegExp(`^${COMPANY_MARKER}\\s*`, 'i'), '').trim();
        jdText = after;
      } else {
        jdText = content.trim();
      }
    }

    return { companyInfo, jd: jdText };
  }

  listJobIds(): string[] {
    const dir = this.jobsDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
  }

  hasCompanyInfo(jobId: string): boolean {
    const companyPath = join(this.jobsDir(), `${jobId}.company.txt`);
    if (existsSync(companyPath) && readFileSync(companyPath, 'utf-8').trim()) {
      return true;
    }
    try {
      return !!this.loadJobInputs(jobId).companyInfo.trim();
    } catch {
      return false;
    }
  }

  readOutFile(jobId: string, filename: string): string | undefined {
    const p = join(this.outDir(jobId), filename);
    if (!existsSync(p)) return undefined;
    return readFileSync(p, 'utf-8');
  }

  writeOutFile(jobId: string, filename: string, content: string): void {
    this.ensureOutDir(jobId);
    writeFileSync(join(this.outDir(jobId), filename), content, 'utf-8');
  }

  writeArtifacts(jobId: string, artifacts: ArtifactWrite): void {
    this.ensureOutDir(jobId);
    const map: Array<[keyof ArtifactWrite, string]> = [
      ['companyProfile', 'company-profile.raw.txt'],
      ['painPoints', 'pain-points.raw.txt'],
      ['mapping', 'mapping.raw.txt'],
      ['experienceBulletsRaw', 'experience-bullets.raw.txt'],
      ['experienceBullets', 'experience-bullets.extracted.txt'],
      ['summary', 'summary.raw.txt'],
      ['coverLetter', 'cover-letter.raw.txt'],
      ['review', 'review.raw.txt'],
      ['regenerateFeedback', 'regenerate-feedback.raw.md'],
    ];
    for (const [key, filename] of map) {
      const value = artifacts[key];
      if (typeof value === 'string') {
        this.writeOutFile(jobId, filename, value);
      }
    }
    if (artifacts.truncation?.companyResearch) {
      this.writeOutFile(jobId, 'company-profile.truncated', '1');
    }
    if (artifacts.truncation?.painPoints) {
      this.writeOutFile(jobId, 'pain-points.truncated', '1');
    }
    if (artifacts.truncation?.mapping) {
      this.writeOutFile(jobId, 'mapping.truncated', '1');
    }
  }

  readPack(jobId: string): ApplicationPack {
    const out = this.outDir(jobId);
    const hasCompanyInfo = this.hasCompanyInfo(jobId);
    if (!existsSync(out)) {
      return {
        exists: false,
        hasCompanyInfo,
        truncation: { companyResearch: false, painPoints: false, mapping: false },
      };
    }

    const companyProfile = hasCompanyInfo
      ? this.readOutFile(jobId, 'company-profile.raw.txt')
      : undefined;

    return {
      exists: true,
      hasCompanyInfo,
      companyProfile,
      painPoints: this.readOutFile(jobId, 'pain-points.raw.txt'),
      mapping: this.readOutFile(jobId, 'mapping.raw.txt'),
      experienceBullets: this.readOutFile(jobId, 'experience-bullets.extracted.txt'),
      summary: this.readOutFile(jobId, 'summary.raw.txt'),
      coverLetter: this.readOutFile(jobId, 'cover-letter.raw.txt'),
      review: this.readOutFile(jobId, 'review.raw.txt'),
      regenerateFeedback: this.readOutFile(jobId, 'regenerate-feedback.raw.md'),
      truncation: {
        companyResearch: existsSync(join(out, 'company-profile.truncated')),
        painPoints: existsSync(join(out, 'pain-points.truncated')),
        mapping: existsSync(join(out, 'mapping.truncated')),
      },
    };
  }

  deleteJob(jobId: string): void {
    const jdPath = join(this.jobsDir(), `${jobId}.md`);
    const companyPath = join(this.jobsDir(), `${jobId}.company.txt`);
    if (existsSync(jdPath)) unlinkSync(jdPath);
    if (existsSync(companyPath)) unlinkSync(companyPath);
  }

  setProgress(jobId: string, phase: string | null): void {
    const progressPath = join(this.outDir(jobId), '.progress');
    if (phase === null) {
      if (existsSync(progressPath)) unlinkSync(progressPath);
      return;
    }
    this.ensureOutDir(jobId);
    writeFileSync(progressPath, phase, 'utf-8');
  }

  getProgress(jobId: string): string | undefined {
    const progressPath = join(this.outDir(jobId), '.progress');
    if (!existsSync(progressPath)) return undefined;
    try {
      return readFileSync(progressPath, 'utf-8').trim() || undefined;
    } catch {
      return undefined;
    }
  }

  clearAllJobsAndOutputs(): void {
    const jobs = this.jobsDir();
    const outRoot = join(this.workspaceRoot, 'out');
    if (existsSync(jobs)) {
      for (const file of readdirSync(jobs)) {
        if (file.endsWith('.md') || file.endsWith('.company.txt')) {
          unlinkSync(join(jobs, file));
        }
      }
    }
    if (existsSync(outRoot)) {
      for (const dir of readdirSync(outRoot)) {
        rmSync(join(outRoot, dir), { recursive: true, force: true });
      }
    }
  }

  readStatus(jobId: string): Status | null {
    const statusPath = join(this.outDir(jobId), 'status.json');
    if (!existsSync(statusPath)) return null;
    try {
      return StatusSchema.parse(JSON.parse(readFileSync(statusPath, 'utf-8')));
    } catch {
      return null;
    }
  }

  createStatus(jobId: string): Status {
    const now = new Date().toISOString();
    const status: Status = {
      jobId,
      steps: {
        companyResearch: 'pending',
        painPoints: 'pending',
        mapping: 'pending',
        experienceBullets: 'pending',
        summary: 'pending',
        coverLetter: 'pending',
        review: 'pending',
        render: 'pending',
      },
      createdAt: now,
      updatedAt: now,
    };
    this.writeStatus(jobId, status);
    return status;
  }

  writeStatus(jobId: string, status: Status): void {
    this.ensureOutDir(jobId);
    status.updatedAt = new Date().toISOString();
    writeFileSync(
      join(this.outDir(jobId), 'status.json'),
      JSON.stringify(status, null, 2),
      'utf-8'
    );
  }

  getOrCreateStatus(jobId: string): Status {
    return this.readStatus(jobId) ?? this.createStatus(jobId);
  }

  updateStepStatus(
    jobId: string,
    step: keyof Status['steps'],
    stepStatus: StepStatus
  ): void {
    const status = this.getOrCreateStatus(jobId);
    status.steps[step] = stepStatus;
    this.writeStatus(jobId, status);
  }

  isStepCompleted(jobId: string, step: keyof Status['steps']): boolean {
    return this.readStatus(jobId)?.steps[step] === 'completed';
  }
}
