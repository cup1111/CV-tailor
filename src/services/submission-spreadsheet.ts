import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const FILENAME = 'submission-spreadsheet.txt';

/** Worksheet tab name in the user's Submission Spreadsheet (e.g. "work application list" file → Jobs tab). */
export const SUBMISSION_WORKSHEET_NAME = 'Jobs';

/** Extract spreadsheet ID from a URL or return the raw ID if already bare. */
export function parseSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (match) return match[1]!;
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function readSubmissionSpreadsheetId(workspaceRoot: string): string | null {
  const path = join(workspaceRoot, FILENAME);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return null;
  return parseSpreadsheetId(raw);
}

export function writeSubmissionSpreadsheetId(
  workspaceRoot: string,
  urlOrId: string
): string {
  const id = parseSpreadsheetId(urlOrId);
  if (!id) {
    throw new Error('Invalid Google Spreadsheet URL or ID');
  }
  writeFileSync(join(workspaceRoot, FILENAME), id + '\n', 'utf-8');
  return id;
}
