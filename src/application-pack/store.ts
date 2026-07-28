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
import { TRACK_IDS, type TrackId } from '../services/track.js';
import type { ApplicationPack, JobIdentity, JobInputs, PackTruncation } from './types.js';

const COMPANY_MARKER = '---COMPANY---';
const JD_MARKER = '---JD---';

function parseTrackId(value: string): TrackId | null {
  const trimmed = value.trim();
  if ((TRACK_IDS as readonly string[]).includes(trimmed)) {
    return trimmed as TrackId;
  }
  return null;
}

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
    if (!(TRACK_IDS as readonly string[]).includes(inputs.applicationTrack)) {
      throw new Error(
        `Invalid Application Track: ${inputs.applicationTrack}. ` +
          `Must be one of ${TRACK_IDS.join(', ')}`
      );
    }

    const trackPath = join(this.jobsDir(), `${jobId}.track.txt`);
    const jdPath = join(this.jobsDir(), `${jobId}.md`);
    writeFileSync(jdPath, inputs.jd.trim(), 'utf-8');
    const companyPath = join(this.jobsDir(), `${jobId}.company.txt`);
    const company = inputs.companyInfo.trim();
    if (company) {
      writeFileSync(companyPath, company, 'utf-8');
    } else if (existsSync(companyPath)) {
      unlinkSync(companyPath);
    }
    const linkPath = join(this.jobsDir(), `${jobId}.link.txt`);
    const jobLink = (inputs.jobLink ?? '').trim();
    if (jobLink) {
      writeFileSync(linkPath, jobLink, 'utf-8');
    } else if (existsSync(linkPath)) {
      unlinkSync(linkPath);
    }
    writeFileSync(trackPath, `${inputs.applicationTrack}\n`, 'utf-8');
  }

  loadJobInputs(jobId: string): JobInputs {
    const jdPath = join(this.jobsDir(), `${jobId}.md`);
    const companyPath = join(this.jobsDir(), `${jobId}.company.txt`);
    const trackPath = join(this.jobsDir(), `${jobId}.track.txt`);
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

    if (!existsSync(trackPath)) {
      throw new Error(
        `Application Track binding missing for job "${jobId}". Run Track migration.`
      );
    }
    const applicationTrack = parseTrackId(readFileSync(trackPath, 'utf-8'));
    if (applicationTrack == null) {
      throw new Error(
        `Invalid Application Track binding for job "${jobId}" in ${trackPath}`
      );
    }

    return {
      companyInfo,
      jd: jdText,
      jobLink: this.readJobLinkFromFiles(jobId, jdText),
      applicationTrack,
    };
  }

  private readJobLinkFromFiles(jobId: string, jdText: string): string {
    const linkPath = join(this.jobsDir(), `${jobId}.link.txt`);
    if (existsSync(linkPath)) {
      const link = readFileSync(linkPath, 'utf-8').trim();
      if (link) return link;
    }
    const urlLine = jdText
      .split('\n')
      .find((line) => /^URL:\s*/i.test(line.trim()));
    if (urlLine) {
      const match = /https?:\/\/[^\s]+/.exec(urlLine);
      if (match) return match[0];
    }
    const match = /https?:\/\/[^\s]+/.exec(jdText);
    return match ? match[0] : '';
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

  hasGenerationOutputs(jobId: string): boolean {
    const dir = this.outDir(jobId);
    if (!existsSync(dir)) return false;
    return readdirSync(dir).length > 0;
  }

  clearJobOutputs(jobId: string): void {
    const dir = this.outDir(jobId);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  deleteJob(jobId: string): void {
    const jdPath = join(this.jobsDir(), `${jobId}.md`);
    const companyPath = join(this.jobsDir(), `${jobId}.company.txt`);
    const trackPath = join(this.jobsDir(), `${jobId}.track.txt`);
    const linkPath = join(this.jobsDir(), `${jobId}.link.txt`);
    if (existsSync(jdPath)) unlinkSync(jdPath);
    if (existsSync(companyPath)) unlinkSync(companyPath);
    if (existsSync(trackPath)) unlinkSync(trackPath);
    if (existsSync(linkPath)) unlinkSync(linkPath);
    this.clearJobOutputs(jobId);
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
        if (file.endsWith('.md') || file.endsWith('.company.txt') || file.endsWith('.track.txt') || file.endsWith('.link.txt')) {
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

  setReviewVerdict(jobId: string, verdict: 'fail' | null): void {
    const status = this.getOrCreateStatus(jobId);
    if (verdict === 'fail') {
      status.reviewVerdict = 'fail';
    } else {
      delete status.reviewVerdict;
    }
    this.writeStatus(jobId, status);
  }

  hasReviewVerdictFail(jobId: string): boolean {
    return this.readStatus(jobId)?.reviewVerdict === 'fail';
  }

  isStepCompleted(jobId: string, step: keyof Status['steps']): boolean {
    return this.readStatus(jobId)?.steps[step] === 'completed';
  }

  readJobIdentity(jobId: string): JobIdentity {
    const roleRaw = this.readOutFile(jobId, 'role-title.txt');
    const employerRaw = this.readOutFile(jobId, 'employer-name.txt');
    const roleTitle = roleRaw?.trim() || undefined;
    const employerName = employerRaw?.trim() || undefined;
    if (roleTitle && employerName) {
      return { roleTitle, employerName };
    }

    const legacy = this.readOutFile(jobId, 'job-label.txt')?.trim();
    if (legacy) {
      const sep = legacy.indexOf(' - ');
      if (sep > 0) {
        const splitRole = legacy.slice(0, sep).trim();
        const splitEmployer = legacy.slice(sep + 3).trim();
        if (splitRole && splitEmployer) {
          return { roleTitle: splitRole, employerName: splitEmployer };
        }
      }
    }

    return {
      roleTitle: roleTitle || undefined,
      employerName: employerName || undefined,
    };
  }

  writeJobIdentity(jobId: string, roleTitle: string, employerName: string): void {
    this.writeOutFile(jobId, 'role-title.txt', roleTitle.trim());
    this.writeOutFile(jobId, 'employer-name.txt', employerName.trim());
  }
}
