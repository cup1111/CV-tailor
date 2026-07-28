import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PackStore } from '../application-pack/store.js';
import { buildSubmissionSheetEntry, entryToSheetRow } from './submission-sheet.js';
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

describe('entryToSheetRow', () => {
  it('places fields in B/C/D/E/G/H with A and F empty', () => {
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
      '2026-07-28',
      'submitted',
      '',
      'following',
      'https://example.com/job',
    ]);
  });
});
