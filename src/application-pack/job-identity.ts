import type { PackStore } from './store.js';

/** Filesystem-safe mint field: non-empty, no path separators, max 120 chars. */
export function isValidMintField(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > 120) return false;
  if (/[/\\:\0]/.test(trimmed)) return false;
  return true;
}

/**
 * Parse Role Title from review output.
 * Expected: `Role Title: <title>`
 */
export function parseRoleTitleFromReview(reviewText: string): string | null {
  const lines = reviewText.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    const match = /^Role Title:\s*(.+)$/i.exec(line);
    if (!match) continue;
    const value = match[1]!.trim();
    if (isValidMintField(value)) return value;
  }
  for (const line of lines) {
    const match = /^Job Label:\s*(.+)$/i.exec(line);
    if (!match) continue;
    return splitLegacyJobLabel(match[1]!)?.roleTitle ?? null;
  }
  return null;
}

/**
 * Parse Employer Name from review output.
 * Expected: `Employer Name: <company>`
 */
export function parseEmployerNameFromReview(reviewText: string): string | null {
  const lines = reviewText.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    const match = /^Employer Name:\s*(.+)$/i.exec(line);
    if (!match) continue;
    const value = match[1]!.trim();
    if (isValidMintField(value)) return value;
  }
  for (const line of lines) {
    const match = /^Job Label:\s*(.+)$/i.exec(line);
    if (!match) continue;
    return splitLegacyJobLabel(match[1]!)?.employerName ?? null;
  }
  return null;
}

/** Split legacy `job-label.txt` on the first ` - `. */
export function splitLegacyJobLabel(label: string): {
  roleTitle: string;
  employerName: string;
} | null {
  const trimmed = label.trim();
  const sep = trimmed.indexOf(' - ');
  if (sep <= 0) return null;
  const roleTitle = trimmed.slice(0, sep).trim();
  const employerName = trimmed.slice(sep + 3).trim();
  if (!isValidMintField(roleTitle) || !isValidMintField(employerName)) return null;
  return { roleTitle, employerName };
}

/** Parse line-1 PASS/FAIL from review output. */
export function parseReviewVerdict(reviewText: string): 'pass' | 'fail' | null {
  const firstLine = reviewText.split(/\r?\n/)[0]?.trim().toUpperCase() || '';
  if (firstLine === 'PASS' || firstLine.startsWith('PASS')) return 'pass';
  if (firstLine === 'FAIL' || firstLine.startsWith('FAIL')) return 'fail';
  return null;
}

export function isPackComplete(store: PackStore, jobId: string): boolean {
  const identity = store.readJobIdentity(jobId);
  return (
    store.isStepCompleted(jobId, 'review') &&
    !!identity.roleTitle &&
    !!identity.employerName
  );
}

/**
 * Heal jobs generated under an older review format or parser by re-evaluating
 * the persisted review output. Safe to call repeatedly.
 */
export function reconcileReviewStep(store: PackStore, jobId: string): void {
  const reviewText = store.readOutFile(jobId, 'review.raw.txt')?.trim();
  if (!reviewText) return;
  settleReviewStep(store, jobId, reviewText);
}

function applyReviewVerdict(
  store: PackStore,
  jobId: string,
  reviewText: string
): void {
  const verdict = parseReviewVerdict(reviewText);
  if (verdict === 'fail') {
    store.setReviewVerdict(jobId, 'fail');
  } else {
    store.setReviewVerdict(jobId, null);
  }
}

/**
 * After review model output is written: mint on first parseable Role Title and
 * Employer Name, mark review completed. Review Verdict FAIL is advisory only.
 * Later reviews keep frozen identity but overwrite the advisory verdict.
 */
export function settleReviewStep(
  store: PackStore,
  jobId: string,
  reviewText: string
): boolean {
  const existing = store.readJobIdentity(jobId);
  if (existing.roleTitle && existing.employerName) {
    store.updateStepStatus(jobId, 'review', 'completed');
    applyReviewVerdict(store, jobId, reviewText);
    return true;
  }

  const roleTitle = parseRoleTitleFromReview(reviewText);
  const employerName = parseEmployerNameFromReview(reviewText);
  if (!roleTitle || !employerName) {
    store.updateStepStatus(jobId, 'review', 'failed');
    store.setReviewVerdict(jobId, null);
    return false;
  }

  store.writeJobIdentity(jobId, roleTitle, employerName);
  store.updateStepStatus(jobId, 'review', 'completed');
  applyReviewVerdict(store, jobId, reviewText);
  return true;
}
