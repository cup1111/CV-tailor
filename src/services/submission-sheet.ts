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
 * Map a Submission Sheet Entry to one row on the Jobs worksheet (columns A–H).
 * A and F are left empty; B=Company, C=Job, D=Date, E=Status, G=Follow Up, H=Link.
 */
export function entryToSheetRow(entry: SubmissionSheetEntry): string[] {
  return [
    '', // A — unused
    entry.company,
    entry.job,
    entry.date,
    entry.status,
    '', // F — unused
    entry.followUp,
    entry.link,
  ];
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
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SUBMISSION_WORKSHEET_NAME}!A:H`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [entryToSheetRow(entry)],
      },
    });
  } catch (error) {
    throw new Error(formatSubmissionSheetError(error, credentials));
  }
}
