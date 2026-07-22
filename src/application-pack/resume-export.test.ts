import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Profile } from '../types/profile.js';
import {
  readExportDirectory,
  writeExportDirectory,
} from './export-directory.js';
import {
  buildResumeExportBasename,
  exportResume,
  planResumeExportFills,
  type PagesPort,
} from './resume-export.js';
import { PackStore } from './store.js';

const profile: Profile = {
  personal: { name: 'Zane Wang', email: 'z@example.com' },
  experiences: [
    {
      company: 'PastCo',
      role: 'Engineer',
      startDate: '2020-01',
      endDate: 'Present',
      description: 'Built APIs',
    },
    {
      company: 'OldCo',
      role: 'Intern',
      startDate: '2019-01',
      endDate: '2019-12',
      description: 'Scripts',
    },
  ],
};

describe('buildResumeExportBasename', () => {
  it('builds "{name} CV {Job Label}" for Pages and PDF stems', () => {
    expect(
      buildResumeExportBasename('Zane Wang', 'Software Engineer - Acme')
    ).toBe('Zane Wang CV Software Engineer - Acme');
  });
});

describe('planResumeExportFills', () => {
  it('maps Summary and Profile-ordered experience bullets to placeholder tags', () => {
    const fills = planResumeExportFills({
      summary: 'Junior engineer with API focus.',
      experienceBulletBlocks: [
        'PastCo - Engineer\nBuilt APIs\nShipped features',
        'OldCo - Intern\nWrote scripts',
      ],
      experienceCount: 2,
      layoutTags: ['SUMMARY', 'EXP_1', 'EXP_2'],
    });

    expect(fills).toEqual({
      SUMMARY: 'Junior engineer with API focus.',
      EXP_1: 'Built APIs\nShipped features',
      EXP_2: 'Wrote scripts',
    });
  });

  it('fails when layout experience slot count does not match Profile', () => {
    expect(() =>
      planResumeExportFills({
        summary: 'S',
        experienceBulletBlocks: ['PastCo - Engineer\nBullet'],
        experienceCount: 2,
        layoutTags: ['SUMMARY', 'EXP_1'],
      })
    ).toThrow(/slot/i);
  });
});

describe('Export Directory', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'export-dir-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('persists a workspace default Export Directory', () => {
    writeExportDirectory(root, '/Users/me/Applications');
    expect(readExportDirectory(root)).toBe('/Users/me/Applications');
  });
});

describe('exportResume', () => {
  let root: string;
  let store: PackStore;
  let exportDir: string;
  let recorded: {
    fills?: Record<string, string>;
    pagesOutPath?: string;
    pdfOutPath?: string;
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'resume-export-'));
    exportDir = join(root, 'exports');
    mkdirSync(exportDir, { recursive: true });
    writeExportDirectory(root, exportDir);

    const trackDir = join(root, 'tracks/software-engineering');
    mkdirSync(trackDir, { recursive: true });
    writeFileSync(join(trackDir, 'resume-layout.pages'), 'fake-pages');

    store = new PackStore(root);
    store.saveJobInputs('j1', {
      companyInfo: '',
      jd: 'Backend role at Acme',
      applicationTrack: 'software-engineering',
    });
    store.writeArtifacts('j1', {
      summary: 'Engineer with API focus.',
      experienceBullets:
        'PastCo - Engineer\nBuilt APIs\nShipped features\n\nOldCo - Intern\nWrote scripts',
      coverLetter: 'Cover',
      review: 'PASS\nJob Label: Software Engineer - Acme\nOk',
    });
    store.writeJobLabel('j1', 'Software Engineer - Acme');
    store.getOrCreateStatus('j1');
    store.updateStepStatus('j1', 'review', 'completed');

    recorded = {};
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function fakePages(tags: string[]): PagesPort {
    return {
      async listPlaceholderTags() {
        return tags;
      },
      async fillAndExport(args) {
        recorded.fills = args.fills;
        recorded.pagesOutPath = args.pagesOutPath;
        recorded.pdfOutPath = args.pdfOutPath;
        writeFileSync(args.pagesOutPath, 'pages');
        writeFileSync(args.pdfOutPath, 'pdf');
      },
    };
  }

  it('writes Pages and PDF into the Export Directory when pack is complete', async () => {
    const result = await exportResume({
      store,
      workspaceRoot: root,
      jobId: 'j1',
      profile,
      pages: fakePages(['SUMMARY', 'EXP_1', 'EXP_2']),
    });

    const stem = 'Zane Wang CV Software Engineer - Acme';
    expect(result.pagesPath).toBe(join(exportDir, `${stem}.pages`));
    expect(result.pdfPath).toBe(join(exportDir, `${stem}.pdf`));
    expect(existsSync(result.pagesPath)).toBe(true);
    expect(existsSync(result.pdfPath)).toBe(true);
    expect(recorded.fills).toEqual({
      SUMMARY: 'Engineer with API focus.',
      EXP_1: 'Built APIs\nShipped features',
      EXP_2: 'Wrote scripts',
    });
  });

  it('rejects export when Application Pack is not complete', async () => {
    store.updateStepStatus('j1', 'review', 'pending');
    await expect(
      exportResume({
        store,
        workspaceRoot: root,
        jobId: 'j1',
        profile,
        pages: fakePages(['SUMMARY', 'EXP_1', 'EXP_2']),
      })
    ).rejects.toThrow(/complete/i);
  });

  it('allows a one-off Export Directory override', async () => {
    const other = join(root, 'other-exports');
    mkdirSync(other, { recursive: true });
    const result = await exportResume({
      store,
      workspaceRoot: root,
      jobId: 'j1',
      profile,
      pages: fakePages(['SUMMARY', 'EXP_1', 'EXP_2']),
      exportDirectory: other,
    });
    expect(result.pagesPath.startsWith(other)).toBe(true);
    expect(readExportDirectory(root)).toBe(exportDir);
  });
});
