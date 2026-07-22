# Per-job Application Track binding

Status: accepted (supersedes [0002](./0002-application-tracks.md))

A workspace-level active Application Track (`track.yaml` + UI switcher) forced every Job to share one direction and made packs “stale” when the switcher moved. We bind each **Job** to exactly one Application Track when the Job Description is entered; that binding is immutable and is the sole authority for Profile + Prompt Templates used in generation. The global switcher, `track.yaml` `activeTrack`, pack-side Track markers as authority, and stale-vs-active-Track are removed. New Jobs default the Track control to `software-engineering` but still require an explicit choice in the form; the job list always shows the bound Track. Existing Jobs migrate: pack-recorded Track if present, else then-current `activeTrack`, else `software-engineering`.

**Rejected:** keep a workspace active Track as “default for new Jobs only”; mutable Job↔Track rebinding with stale packs; dual-writing Track onto Application Pack outputs as a second source of truth.
