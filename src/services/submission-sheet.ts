import { readFileSync, existsSync } from 'fs';
import { google } from 'googleapis';
import type { PackStore } from '../application-pack/store.js';
import { buildJobView } from '../application-pack/job-view.js';
import { readSubmissionSpreadsheetId, SUBMISSION_WORKSHEET_NAME } from './submission-spreadsheet.js';

export type SubmissionSheetEntry = {
  company: string;
  job: string;
  date: string;
  status: 'submitted';
  followUp: 'following';
  link: string;
};

const URL_IN_TEXT = /https?:\/\/[^\s]+/;

/**
 * Convert YYYY-MM-DD (ledger / heatmap key) to the Jobs sheet Date display form.
 * The spreadsheet locale is en_US, so USER_ENTERED must be M/D/YYYY (e.g. 7/29/2026).
 * DD/MM/YYYY is stored as text and breaks date-typed columns / charts.
 */
export function formatSheetDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  if (!y || !m || !d) return dateKey;
  return `${Number(m)}/${Number(d)}/${y}`;
}

const DATE_COL = 3; // column D

export function rowDateIsEmpty(row: string[] | undefined): boolean {
  return !row?.[DATE_COL]?.trim();
}

/**
 * Use the last sheet row when its Date cell is empty; otherwise append a new row.
 */
export function findSubmissionTargetRow(existingRows: string[][]): number {
  if (existingRows.length <= 1) return 2;

  const lastRow = existingRows[existingRows.length - 1] ?? [];
  if (rowDateIsEmpty(lastRow)) {
    return existingRows.length;
  }
  return existingRows.length + 1;
}

/** Index value for a data row (row 1 is the header). */
export function submissionIndexForRow(targetRow: number): string {
  return String(targetRow - 1);
}

export function buildSubmissionSheetUpdate(
  entry: SubmissionSheetEntry,
  existingRows: string[][],
  targetRow: number
): { range: string; values: string[][] } {
  const dataColumns = entryToSheetDataColumns(entry);
  const hasIndex = Boolean(existingRows[targetRow - 1]?.[0]?.trim());
  if (hasIndex) {
    return {
      range: `B${targetRow}:H${targetRow}`,
      values: [dataColumns],
    };
  }
  return {
    range: `A${targetRow}:H${targetRow}`,
    values: [[submissionIndexForRow(targetRow), ...dataColumns]],
  };
}

/**
 * Map a Submission Sheet Entry to one row on the Jobs worksheet (columns A–H).
 * A is empty here (Index is filled by buildSubmissionSheetUpdate when needed);
 * F is unused; B=Company, C=Job, D=Date (M/D/YYYY for en_US sheet), E=Status, G=Follow Up, H=Link.
 */
export function entryToSheetRow(entry: SubmissionSheetEntry): string[] {
  return [
    '', // A — Index filled by buildSubmissionSheetUpdate when missing
    entry.company,
    entry.job,
    formatSheetDate(entry.date),
    entry.status,
    '', // F — unused
    entry.followUp,
    entry.link,
  ];
}

/** B–H values for the Jobs worksheet (preserves column A index). */
export function entryToSheetDataColumns(entry: SubmissionSheetEntry): string[] {
  return entryToSheetRow(entry).slice(1);
}

function extractUrlFromJdText(jd: string): string {
  const urlLine = jd
    .split('\n')
    .find((line) => /^URL:\s*/i.test(line.trim()));
  if (urlLine) {
    const match = URL_IN_TEXT.exec(urlLine);
    if (match) return match[0];
  }
  const match = URL_IN_TEXT.exec(jd);
  return match ? match[0] : '';
}

/** Build a Submission Sheet Entry while the Job is still in the workspace. */
export function buildSubmissionSheetEntry(
  store: PackStore,
  jobId: string,
  submissionDate: string
): SubmissionSheetEntry {
  const inputs = store.loadJobInputs(jobId);
  const identity = store.readJobIdentity(jobId);
  const view = buildJobView(store, jobId);

  const job = identity.roleTitle ?? view.title;
  const company = identity.employerName ?? inputs.companyInfo.trim();
  const link = (inputs.jobLink ?? '').trim() || extractUrlFromJdText(inputs.jd);

  return {
    company,
    job,
    date: submissionDate,
    status: 'submitted',
    followUp: 'following',
    link,
  };
}

function loadServiceAccountCredentials(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  if (raw.startsWith('{')) {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  if (existsSync(raw)) {
    return JSON.parse(readFileSync(raw, 'utf-8')) as Record<string, unknown>;
  }
  return null;
}

/** Turn Google API errors into actionable archive warnings. */
export function formatSubmissionSheetError(
  error: unknown,
  credentials: Record<string, unknown> | null
): string {
  const message = error instanceof Error ? error.message : String(error);
  const email =
    credentials && typeof credentials.client_email === 'string'
      ? credentials.client_email
      : null;

  if (/does not have permission/i.test(message) && email) {
    return `Spreadsheet not shared with the service account. In Google Sheets, click Share and add ${email} as Editor.`;
  }

  return message;
}

export async function appendSubmissionSheetEntry(
  workspaceRoot: string,
  entry: SubmissionSheetEntry
): Promise<void> {
  const spreadsheetId = readSubmissionSpreadsheetId(workspaceRoot);
  if (!spreadsheetId) return;

  const credentials = loadServiceAccountCredentials();
  if (!credentials) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set (path to JSON file or inline JSON)'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    let existingRows: string[][] = [];
    try {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SUBMISSION_WORKSHEET_NAME}!A:H`,
      });
      existingRows = (existing.data.values as string[][]) ?? [];
    } catch { /* sheet may be empty */ }
    const targetRow = findSubmissionTargetRow(existingRows);
    const { range, values } = buildSubmissionSheetUpdate(entry, existingRows, targetRow);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SUBMISSION_WORKSHEET_NAME}!${range}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
  } catch (error) {
    throw new Error(formatSubmissionSheetError(error, credentials));
  }
}
