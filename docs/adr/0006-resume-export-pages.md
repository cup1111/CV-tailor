# Resume Export via Pages Layout; Job Label on first review

Status: accepted

Application Pack stays copy-only (bullets, summary, cover letter, and upstream steps). Deliverable CV layout is a separate **Resume Export**: an explicit user action that fills the Job's Track **Resume Layout** (Apple Pages placeholders: Summary + experience slots in Profile order) and writes both `.pages` and `.pdf` into a user-configured **Export Directory**. Export is allowed only when the pack is complete; slot-count mismatch fails with no output. Archive and Job delete do not touch Export Directory files.

Pack completeness now requires a valid **Job Label** (role + company short name) minted on the Job's first successful review and then frozen; PASS without a Label does not complete the pack. Label is cleared when Job Edit discards generation outputs. Export filenames are `{Profile.personal.name} CV {Job Label}.pages|.pdf` and overwrite on re-export.

**Rejected:** making filled Pages/PDF a Pack Generation Step or pack completeness signal; auto-export on pack complete; exporting cover letter or Profile static fields; tag-based experience slot matching or partial fills; jobId-only or timestamped export filenames; reminting Job Label on every review/Regenerate; treating Export Directory as out/ or Archive storage.
