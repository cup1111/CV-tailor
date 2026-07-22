# Application Tracks (global active Track)

Status: superseded by [0003](./0003-per-job-application-track.md)

We need parallel career directions (software engineering and IT support) without overwriting each other. Each **Application Track** owns a full Profile and a full set of English Prompt Templates. The workspace has one active Track at a time, selected via config (`track.yaml`) as the single source of truth; the web UI switcher writes that same file. Per-job Track binding was rejected to keep the first version simple. Changing the active Track makes existing Application Packs **stale** until regenerated. Track ids: `software-engineering` (default) and `it-support`.
