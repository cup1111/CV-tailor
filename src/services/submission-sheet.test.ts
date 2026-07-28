import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PackStore } from '../application-pack/store.js';
import {
  buildSubmissionSheetEntry,
  buildSubmissionSheetUpdate,
  entryToSheetRow,
  findSubmissionTargetRow,
  formatSheetDate,
  rowDateIsEmpty,
  submissionIndexForRow,
} from './submission-sheet.js';
import {
  parseSpreadsheetId,
  readSubmissionSpreadsheetId,
  writeSubmissionSpreadsheetId,
} from './submission-spreadsheet.js';

describe('parseSpreadsheetId', () => {
  it('parses a full Google Sheets URL', () => {
    expect(
      parseSpreadsheetId(
        'https://docs.google.com/spreadsheets/d/abc123XYZ-_/edit#gid=0'
      )
    ).toBe('abc123XYZ-_');
  });

  it('accepts a bare spreadsheet ID', () => {
    expect(parseSpreadsheetId('abc123XYZ-_abcdefghij')).toBe(
      'abc123XYZ-_abcdefghij'
    );
  });
});

describe('submission spreadsheet config', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'submission-sheet-config-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('persists spreadsheet ID from URL', () => {
    writeSubmissionSpreadsheetId(
      root,
      'https://docs.google.com/spreadsheets/d/sheet123456789012345678/edit'
    );
    expect(readSubmissionSpreadsheetId(root)).toBe('sheet123456789012345678');
  });
});

describe('buildSubmissionSheetEntry', () => {
  let root: string;
  let store: PackStore;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'submission-sheet-entry-'));
    store = new PackStore(root);
    store.saveJobInputs('j1', {
      companyInfo: 'Acme keywords',
      jd: 'We need a backend engineer.',
      jobLink: 'https://jobs.example.com/123',
      applicationTrack: 'software-engineering',
    });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('uses minted identity when present', () => {
    store.writeJobIdentity('j1', 'Backend Engineer', 'Acme Corp');
    expect(buildSubmissionSheetEntry(store, 'j1', '2026-07-28')).toEqual({
      company: 'Acme Corp',
      job: 'Backend Engineer',
      date: '2026-07-28',
      status: 'submitted',
      followUp: 'following',
      link: 'https://jobs.example.com/123',
    });
  });

  it('falls back to Job View title and Company Info when identity is missing', () => {
    expect(buildSubmissionSheetEntry(store, 'j1', '2026-07-28')).toEqual({
      company: 'Acme keywords',
      job: 'We need a backend engineer.',
      date: '2026-07-28',
      status: 'submitted',
      followUp: 'following',
      link: 'https://jobs.example.com/123',
    });
  });
});

describe('formatSheetDate', () => {
  it('converts YYYY-MM-DD to M/D/YYYY for the en_US sheet locale', () => {
    expect(formatSheetDate('2026-07-28')).toBe('7/28/2026');
    expect(formatSheetDate('2025-10-01')).toBe('10/1/2025');
  });
});

describe('rowDateIsEmpty', () => {
  it('treats missing or blank Date column as empty', () => {
    expect(rowDateIsEmpty(['1', 'Acme', 'Job'])).toBe(true);
    expect(rowDateIsEmpty(['1', 'Acme', 'Job', ''])).toBe(true);
    expect(rowDateIsEmpty(['1', 'Acme', 'Job', '10/1/2025'])).toBe(false);
  });
});

describe('findSubmissionTargetRow', () => {
  const header = ['Index', 'Company', 'Job', 'Date', 'Status', 'Interview Time', 'Follow Up', 'Link'];

  it('uses the last row when its Date cell is empty', () => {
    const rows = [
      header,
      ['1', 'Acme', 'Engineer', '10/1/2025', 'submitted', '', 'following', 'https://a'],
      ['2'],
      ['3'],
    ];
    expect(findSubmissionTargetRow(rows)).toBe(4);
  });

  it('appends a new row when the last row already has a date', () => {
    const rows = [
      header,
      ['1', 'Acme', 'Engineer', '10/1/2025', 'submitted', '', 'following', 'https://a'],
      ['2', 'Other', 'Role', '7/23/2026', 'submitted', '', 'following', 'https://b'],
    ];
    expect(findSubmissionTargetRow(rows)).toBe(4);
  });

  it('does not fill older holes when the tail row already has a date', () => {
    const rows = [
      header,
      ['277', '', '', '', '', '', '', ''],
      ['278', 'Filled', 'Role', '7/1/2026', 'submitted', '', 'following', 'https://tail'],
    ];
    expect(findSubmissionTargetRow(rows)).toBe(4);
  });

  it('starts at row 2 on an empty sheet', () => {
    expect(findSubmissionTargetRow([header])).toBe(2);
  });
});

describe('buildSubmissionSheetUpdate', () => {
  const header = ['Index', 'Company', 'Job', 'Date', 'Status', 'Interview Time', 'Follow Up', 'Link'];
  const entry = {
    company: 'Acme',
    job: 'Engineer',
    date: '2026-07-28',
    status: 'submitted' as const,
    followUp: 'following' as const,
    link: 'https://example.com/job',
  };

  it('writes B:H when the target row already has an index', () => {
    const rows = [header, ['2']];
    expect(buildSubmissionSheetUpdate(entry, rows, 2)).toEqual({
      range: 'B2:H2',
      values: [['Acme', 'Engineer', '7/28/2026', 'submitted', '', 'following', 'https://example.com/job']],
    });
  });

  it('writes A:H with index when the target row has no index', () => {
    const rows = [header, ['1', 'Filled', 'Role', '10/1/2025', 'submitted', '', 'following', 'https://a'], []];
    expect(buildSubmissionSheetUpdate(entry, rows, 3)).toEqual({
      range: 'A3:H3',
      values: [['2', 'Acme', 'Engineer', '7/28/2026', 'submitted', '', 'following', 'https://example.com/job']],
    });
  });
});

describe('submissionIndexForRow', () => {
  it('maps sheet row to index (header is row 1)', () => {
    expect(submissionIndexForRow(2)).toBe('1');
    expect(submissionIndexForRow(876)).toBe('875');
  });
});

describe('entryToSheetRow', () => {
  it('places fields in B/C/D/E/G/H with A empty and F unused', () => {
    expect(
      entryToSheetRow({
        company: 'Acme',
        job: 'Engineer',
        date: '2026-07-28',
        status: 'submitted',
        followUp: 'following',
        link: 'https://example.com/job',
      })
    ).toEqual([
      '',
      'Acme',
      'Engineer',
      '7/28/2026',
      'submitted',
      '',
      'following',
      'https://example.com/job',
    ]);
  });
});
