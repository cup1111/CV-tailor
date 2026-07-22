import type { PackStore } from './store.js';

/**
 * Parse a Job Label from review output.
 * Expected shape:
 *   Line 1: PASS or FAIL
 *   Line 2: Job Label: <role> - <company>
 *   Rest: explanation
 */
export function parseJobLabelFromReview(reviewText: string): string | null {
  const lines = reviewText.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    const match = /^Job Label:\s*(.+)$/i.exec(line);
    if (!match) continue;
    const label = match[1]!.trim();
    if (isValidJobLabel(label)) return label;
  }
  return null;
}

/** Filesystem-safe short phrase: no path separators or null bytes; non-empty. */
export function isValidJobLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (trimmed.length > 120) return false;
  if (/[/\\:\0]/.test(trimmed)) return false;
  return true;
}

function isPassVerdict(reviewText: string): boolean {
  const firstLine = reviewText.split(/\r?\n/)[0]?.trim().toUpperCase() || '';
  return firstLine === 'PASS' || firstLine.startsWith('PASS');
}

export function isPackComplete(store: PackStore, jobId: string): boolean {
  return store.isStepCompleted(jobId, 'review') && !!store.readJobLabel(jobId);
}

/**
 * After review model output is written: on first PASS with a valid Job Label, mint
 * and mark review completed. Later reviews keep a frozen Label and complete.
 * FAIL (or PASS without Label) does not complete the pack.
 */
export function settleReviewStep(
  store: PackStore,
  jobId: string,
  reviewText: string
): boolean {
  const existing = store.readJobLabel(jobId);
  if (existing) {
    store.updateStepStatus(jobId, 'review', 'completed');
    return true;
  }

  if (!isPassVerdict(reviewText)) {
    store.updateStepStatus(jobId, 'review', 'failed');
    return false;
  }

  const minted = parseJobLabelFromReview(reviewText);
  if (!minted) {
    store.updateStepStatus(jobId, 'review', 'failed');
    return false;
  }

  store.writeJobLabel(jobId, minted);
  store.updateStepStatus(jobId, 'review', 'completed');
  return true;
}
