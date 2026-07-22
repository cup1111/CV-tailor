import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

export const SUBMISSION_TIMEZONE = 'Australia/Sydney';
export const LEDGER_FILENAME = 'submission-ledger.json';

export type SubmissionLedgerFile = {
  version: 1;
  entries: Record<string, string>; // jobId -> YYYY-MM-DD (Submission Date)
};

export type HeatmapDay = {
  date: string;
  count: number;
  level: number;
};

export type SubmissionStats = {
  todayCount: number;
  streak: number;
  today: string;
  heatmap: HeatmapDay[];
};

const INTENSITY_BANDS: Array<{ min: number; max: number; level: number }> = [
  { min: 0, max: 0, level: 0 },
  { min: 1, max: 5, level: 1 },
  { min: 6, max: 10, level: 2 },
  { min: 11, max: 15, level: 3 },
  { min: 16, max: 20, level: 4 },
  { min: 21, max: 25, level: 5 },
  { min: 26, max: 30, level: 6 },
  { min: 31, max: Number.POSITIVE_INFINITY, level: 7 },
];

function ledgerPath(workspaceRoot: string): string {
  return join(workspaceRoot, LEDGER_FILENAME);
}

export function sydneyDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SUBMISSION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Parse YYYY-MM-DD as a civil date and offset by whole days (no TZ drift). */
export function offsetDateKey(dateKey: string, offsetDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + offsetDays);
  const dt = new Date(utc);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Monday=0 … Sunday=6 for a YYYY-MM-DD civil date. */
export function mondayBasedWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // Sun=0
  return js === 0 ? 6 : js - 1;
}

export function intensityLevel(count: number): number {
  for (const band of INTENSITY_BANDS) {
    if (count >= band.min && count <= band.max) return band.level;
  }
  return 7;
}

function emptyLedger(): SubmissionLedgerFile {
  return { version: 1, entries: {} };
}

export function readLedger(workspaceRoot: string): SubmissionLedgerFile {
  const path = ledgerPath(workspaceRoot);
  if (!existsSync(path)) return emptyLedger();
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<SubmissionLedgerFile>;
    if (!raw || raw.version !== 1 || typeof raw.entries !== 'object' || !raw.entries) {
      return emptyLedger();
    }
    const entries: Record<string, string> = {};
    for (const [jobId, date] of Object.entries(raw.entries)) {
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        entries[jobId] = date;
      }
    }
    return { version: 1, entries };
  } catch {
    return emptyLedger();
  }
}

function writeLedger(workspaceRoot: string, ledger: SubmissionLedgerFile): void {
  writeFileSync(ledgerPath(workspaceRoot), JSON.stringify(ledger, null, 2) + '\n', 'utf-8');
}

/**
 * Record first Archive of a Job. Idempotent: existing jobId is left unchanged.
 * @returns true if a new entry was written
 */
export function recordSubmission(
  workspaceRoot: string,
  jobId: string,
  submissionDate: string = sydneyDateKey()
): boolean {
  const ledger = readLedger(workspaceRoot);
  if (ledger.entries[jobId]) return false;
  ledger.entries[jobId] = submissionDate;
  writeLedger(workspaceRoot, ledger);
  return true;
}

/** Collect archived (folderDate, jobId) pairs from archive/. */
export function listArchivedJobDates(
  workspaceRoot: string
): Array<{ date: string; jobId: string }> {
  const root = join(workspaceRoot, 'archive');
  if (!existsSync(root)) return [];
  const list: Array<{ date: string; jobId: string }> = [];
  const dates = readdirSync(root)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  for (const date of dates) {
    const dateDir = join(root, date);
    if (!statSync(dateDir).isDirectory()) continue;
    for (const jobId of readdirSync(dateDir)) {
      const p = join(dateDir, jobId);
      if (statSync(p).isDirectory()) list.push({ date, jobId });
    }
  }
  return list;
}

/**
 * One-time-style backfill: add missing jobIds from archive folders.
 * Proxy Submission Date = archive folder date. Does not overwrite existing entries.
 * @returns number of newly inserted entries
 */
export function backfillLedgerFromArchive(workspaceRoot: string): number {
  const ledger = readLedger(workspaceRoot);
  let added = 0;
  for (const { date, jobId } of listArchivedJobDates(workspaceRoot)) {
    if (ledger.entries[jobId]) continue;
    ledger.entries[jobId] = date;
    added += 1;
  }
  if (added > 0) writeLedger(workspaceRoot, ledger);
  return added;
}

function countsByDate(ledger: SubmissionLedgerFile): Map<string, number> {
  const map = new Map<string, number>();
  for (const date of Object.values(ledger.entries)) {
    map.set(date, (map.get(date) || 0) + 1);
  }
  return map;
}

export function calcSubmissionStreak(
  activeDates: Set<string>,
  today: string = sydneyDateKey()
): number {
  let cursor = today;
  if (!activeDates.has(cursor)) {
    cursor = offsetDateKey(today, -1);
    if (!activeDates.has(cursor)) return 0;
  }
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = offsetDateKey(cursor, -1);
  }
  return streak;
}

export function buildHeatmap(
  counts: Map<string, number>,
  today: string = sydneyDateKey()
): HeatmapDay[] {
  const weekday = mondayBasedWeekday(today);
  const thisMonday = offsetDateKey(today, -weekday);
  const startMonday = offsetDateKey(thisMonday, -52 * 7);
  const days: HeatmapDay[] = [];
  let cursor = startMonday;
  while (cursor <= today) {
    const count = counts.get(cursor) || 0;
    days.push({ date: cursor, count, level: intensityLevel(count) });
    cursor = offsetDateKey(cursor, 1);
  }
  return days;
}

export function getSubmissionStats(workspaceRoot: string): SubmissionStats {
  backfillLedgerFromArchive(workspaceRoot);
  const ledger = readLedger(workspaceRoot);
  const counts = countsByDate(ledger);
  const today = sydneyDateKey();
  const activeDates = new Set(counts.keys());
  return {
    today,
    todayCount: counts.get(today) || 0,
    streak: calcSubmissionStreak(activeDates, today),
    heatmap: buildHeatmap(counts, today),
  };
}

/** Test helper: atomically replace ledger file. */
export function writeLedgerForTest(
  workspaceRoot: string,
  entries: Record<string, string>
): void {
  if (!existsSync(workspaceRoot)) mkdirSync(workspaceRoot, { recursive: true });
  const tmp = join(workspaceRoot, LEDGER_FILENAME + '.tmp');
  writeFileSync(tmp, JSON.stringify({ version: 1, entries }, null, 2) + '\n');
  renameSync(tmp, ledgerPath(workspaceRoot));
}
