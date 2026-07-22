# Submission Ledger as authority for apply progress

Status: accepted

Daily apply count, Submission Streak, and the Submission Heatmap must survive Restore and must not double-count re-Archive. Scanning `archive/` fails both (Restore removes the folder; folder dates are Job creation days, not Archive-action days). Browser `localStorage` mark-applied counters are not tied to Archive and are not durable across machines. We keep a **Submission Ledger** keyed by `jobId` with a `Australia/Sydney` Submission Date, written on first Archive (with a one-time backfill from existing archive folder dates as proxies). Progress UI is a projection of that ledger.

**Rejected:** derive progress only from current `archive/` contents; keep mark-applied `localStorage` as authority; store Submission Date only as archive-directory metadata that disappears on Restore.
