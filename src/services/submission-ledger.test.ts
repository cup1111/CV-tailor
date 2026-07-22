import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  backfillLedgerFromArchive,
  buildHeatmap,
  calcSubmissionStreak,
  getSubmissionStats,
  intensityLevel,
  mondayBasedWeekday,
  offsetDateKey,
  readLedger,
  recordSubmission,
  writeLedgerForTest,
} from './submission-ledger.js';

describe('submission ledger', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ledger-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('records a Job only once', () => {
    expect(recordSubmission(root, 'job-1', '2026-07-20')).toBe(true);
    expect(recordSubmission(root, 'job-1', '2026-07-21')).toBe(false);
    expect(readLedger(root).entries['job-1']).toBe('2026-07-20');
  });

  it('backfills from archive folder dates without overwriting', () => {
    const a = join(root, 'archive', '2026-03-01', 'old-1');
    const b = join(root, 'archive', '2026-03-02', 'old-2');
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 'jd.md'), 'x');
    writeFileSync(join(b, 'jd.md'), 'y');
    recordSubmission(root, 'old-1', '2026-07-01');
    expect(backfillLedgerFromArchive(root)).toBe(1);
    const ledger = readLedger(root);
    expect(ledger.entries['old-1']).toBe('2026-07-01');
    expect(ledger.entries['old-2']).toBe('2026-03-02');
  });

  it('uses yesterday grace for streak', () => {
    const today = '2026-07-22';
    const active = new Set(['2026-07-21', '2026-07-20']);
    expect(calcSubmissionStreak(active, today)).toBe(2);
    expect(calcSubmissionStreak(new Set(['2026-07-22', '2026-07-21']), today)).toBe(2);
    expect(calcSubmissionStreak(new Set(['2026-07-19']), today)).toBe(0);
  });

  it('maps intensity bands without shared endpoints', () => {
    expect(intensityLevel(0)).toBe(0);
    expect(intensityLevel(5)).toBe(1);
    expect(intensityLevel(6)).toBe(2);
    expect(intensityLevel(30)).toBe(6);
    expect(intensityLevel(31)).toBe(7);
  });

  it('builds Monday-start heatmap ending today', () => {
    // 2026-07-22 is Wednesday → Monday of week is 2026-07-20
    expect(mondayBasedWeekday('2026-07-22')).toBe(2);
    expect(offsetDateKey('2026-07-22', -2)).toBe('2026-07-20');
    writeLedgerForTest(root, {
      a: '2026-07-20',
      b: '2026-07-20',
      c: '2026-07-22',
    });
    const stats = getSubmissionStats(root);
    expect(stats.today).toBeTruthy();
    const heat = buildHeatmap(
      new Map([
        ['2026-07-20', 2],
        ['2026-07-22', 1],
      ]),
      '2026-07-22'
    );
    expect(heat[0].date).toBe(offsetDateKey('2026-07-20', -52 * 7));
    expect(mondayBasedWeekday(heat[0].date)).toBe(0);
    expect(heat[heat.length - 1].date).toBe('2026-07-22');
    const day = heat.find((d) => d.date === '2026-07-20');
    expect(day?.count).toBe(2);
    expect(day?.level).toBe(1);
  });
});
