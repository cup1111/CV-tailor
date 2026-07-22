# Job Edit may rebind Application Track

Status: accepted (supersedes the immutable Job↔Track clause of [0003](./0003-per-job-application-track.md))

Per-job Track binding remains the sole authority for Profile + Prompt Templates, and there is still no workspace-level active Track. We now allow **Job Edit** to change a workspace Job's Job Description, Company Info, and Application Track in place (same jobId). A dirty Edit that leaves any generation output (complete or partial/failed) discards that output and returns the Job to ungenerated, so packs never survive under a different JD/Track. Empty Company Info on save clears Company Info; empty Job Description on save deletes the Job. Edit is unavailable while generation is in flight and unavailable for Archived Jobs.

**Rejected:** forever-immutable Job↔Track binding; rebinding while leaving stale or partial packs; Edit during in-flight generation; Edit inside Archive.
