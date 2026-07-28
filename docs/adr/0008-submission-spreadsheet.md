# Submission Spreadsheet as best-effort projection

Status: accepted

On a Job's first Archive (when the Submission Ledger gains a new entry), write one **Submission Sheet Entry** row to the **`Jobs`** tab of an optional workspace-configured Google Spreadsheet (e.g. *work application list*). Columns: A=Index (preserve or mint as row−1), B/C/D/E/G/H = Company/Job/Date/Status/Follow Up/Link (F empty). Date is the Submission Date as `M/D/YYYY` for the sheet's `en_US` locale (Ledger/heatmap stay `YYYY-MM-DD`). Target the last row when its Date is empty; otherwise append. Config mirrors Export Directory (spreadsheet ID/URL in workspace); auth via Service Account in `.env`. Unconfigured spreadsheet → skip silently. Write failure → UI warning + log; Archive and Ledger always succeed. No backfill of ledger history. Restore / re-Archive do not write again.

**Rejected:** spreadsheet as Submission Ledger authority; OAuth as primary auth; blocking Archive on sheet failure; automatic history backfill on first config.
