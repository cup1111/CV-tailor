# Resume Pack Generator

Domain for turning job descriptions into tailored application materials (experience bullets, summary, cover letter, review).

## Language

**UI Locale**:
The language of the web interface presented to the user (`en` or `zh`). User-facing copy is looked up from that locale's string table.
_Avoid_: LANG, prompt language, template language, hard-coded UI strings

**Prompt Template**:
The English instruction text used for one AI generation step within an Application Track. Each Track owns a complete set of Prompt Templates; UI Locale does not select or translate them.
_Avoid_: localized template, templates/en, templates/zh, LANG, PROMPT_LANG, shared cross-track template, Resume Layout

**Experience Bullet**:
A factual resume bullet for one past role, produced for a specific job application. Primary quality bar is fit to that JD (and company when provided); honesty about what the candidate actually did is a hard constraint — no invented skills, scope, or seniority. When the same past role appears in another Application Track's Profile, the role title stays as it was; only the description emphasis may change to facts that still hold.
_Avoid_: generic achievement line, buzzword filler, retitled past role

**Application Pack**:
The set of materials generated for one job application: at minimum experience bullets, CV summary, and cover letter (plus upstream research/mapping/review that feed them). An Application Pack is generated under the Job's bound Application Track. Completeness requires a successful review that includes a valid Job Label. User-facing copy for generate / generate-all names this set (e.g. 申请材料 / Application Pack), not the Job Description and not a CV.
_Avoid_: resume pack (ambiguous), full CV file, CV (as the name of the generated set), Resume Export (downstream of the pack), 生成 JD / generate JD, stale pack (relative to a workspace active Track)

**Pack Generation Step**:
One ordered stage in producing an Application Pack for a Job. There are seven user-facing steps through review (company research, pain points, mapping, experience bullets, summary, cover letter, review). The Application Pack is complete when review is completed, which includes minting a valid Job Label on that first successful review. Failed steps count as finished for batch progress accounting.
_Avoid_: render as a user-facing progress step, CV-generation step, JD-generation step, Resume Export as a pack step

**Resume Layout**:
The user-maintained Apple Pages document that owns resume typography and section layout for one Application Track. It lives with that Track's other private candidate assets alongside the Profile (conventional Track path; not under out/ or the Export Directory). It exposes Placeholder Text slots: one for Summary and one per Profile experience in list order (experience N maps to slot N). Resume Export for a Job uses that Job's bound Track's Layout. It is not Prompt Template content and not the Profile.
_Avoid_: template (unqualified), Prompt Template, Profile, resume file (as Profile), page/Pages as the domain name for the concept, workspace-shared layout, per-Job layout picker, matching slots by company name or role tag, configuring an arbitrary absolute path as the primary Layout location

**Resume Export**:
The downstream act of filling a copy of a Resume Layout with only the Summary and Experience Bullets from one Job's Application Pack, writing both a filled Pages document and a PDF into the Export Directory (and those resulting files). Filenames are `{Profile.personal.name} CV {Job Label}.pages` and the same stem with `.pdf`; a later Export for the same Job overwrites those paths. Experience Bullets are written into Layout slots by Profile experience order (1-based index). Personal details, education, skills, role titles/dates, and other static layout copy stay in the Resume Layout; Cover Letter is not part of Resume Export. Allowed only when that Job's Application Pack is complete (review completed). The experience-slot count on the Resume Layout must equal the Profile experience count for that Track — any mismatch fails the Export with no output written. Started only by an explicit user action (UI or CLI), not automatically when the pack completes. Deleting a Job (including Job Edit that clears the Job Description) does not remove files already written to the Export Directory. Not part of the Application Pack and not a Pack Generation Step. Uses the Resume Layout of the Job's bound Application Track.
_Avoid_: Application Pack, pack generation, CV generation step, treating the filled Pages file as pack completeness, exporting cover letter or Profile fields into the Layout, exporting before pack complete, tag-based experience slot matching, partial fill when slot counts differ, auto-export on pack complete, Pages-only or PDF-only as the default Export result, jobId-only export filenames, timestamped export versions, deleting Export Directory files when the Job is removed

**Job Label**:
A short, filesystem-safe phrase of role title plus company name for one Job, produced as part of that Job's first successful review completion, then frozen. Minting a valid Job Label is required for the review step to count as completed — without it the Application Pack is not complete. Used in Resume Export filenames with the Profile personal name. Cleared when Job Edit discards generation outputs (so the next completed review may mint a new Label). Not the Job View list title (that remains a JD snippet) and not Company Info.
_Avoid_: job title (ambiguous with View title), export slug as a free-edited field, regenerating the Label on every review or Regenerate, hard-coding a person's name in Export rules, treating PASS without a Label as pack-complete

**Export Directory**:
The user-configured folder where Resume Export writes the filled Pages document and PDF for a Job. It is a workspace-level default that persists across Exports; a single Export may override the directory for that run only. Not part of the Application Pack store under out/; not the Resume Layout's location.
_Avoid_: out/ as the Export Directory, treating Archive storage as the Export Directory, requiring a folder picker on every Export with no saved default

**Profile**:
The candidate's source facts for one Application Track: personal details, experiences, education, skills, and optional extras. Each Track owns a complete Profile; generation never mixes Profiles across Tracks.
_Avoid_: resume file, CV source, shared personal block, Resume Layout

**Company Info**:
User-provided keywords / notes about the employer, used as Web Search input. Not the generated research write-up.
_Avoid_: company profile (that is the generated artifact), company.txt contents as if they were research output

**Company Profile**:
The generated company research artifact for one Application Pack (from Web Search + Prompt Template). Empty when Company Info was not provided.
_Avoid_: company info, user search keywords

**Job**:
One application target in the workspace: a Job Description, optional Company Info, and a binding to exactly one Application Track. The binding is the sole authority for which Profile and Prompt Templates generation uses; Application Pack outputs do not carry a separate Track record. jobId stays the same across Edit.
_Avoid_: JD (the text alone), posting, listing, pack-side Track marker as authority, immutable Track binding

**Job Edit**:
Changing a workspace Job's Job Description, Company Info, and/or Application Track binding in place. A save that does not change any of those fields is a no-op. Saving with an empty Job Description deletes the Job from the workspace (same outcome as Delete), after confirmation. Empty Company Info is allowed and clears that Job's Company Info. If at least one field changes, the Job Description is non-empty, and that Job has any generation output under it (complete Application Pack or incomplete/failed leftovers), Edit discards those outputs and the Job Label (after confirmation) and returns the Job to ungenerated; otherwise a non-deleting Edit only updates the inputs. Job Edit is only for Jobs currently in the workspace — not while generation is in flight, and not for Archived Jobs (Restore first).
_Avoid_: ingest as a new Job, Regenerate (review-feedback re-run), leaving outputs from a previous Track or JD, Edit during in-flight generation, Edit inside Archive, discard outputs on unchanged save, leave failed/partial out/ after a dirty Edit, keep a Job with an empty Job Description, keeping a Job Label after outputs are discarded

**Job View**:
The read-only workspace snapshot for one job (title, Company Info flag, generation status, in-flight progress, whether the Application Pack is complete, and which Application Track the Job is bound to). Adapters list jobs through this view instead of reading status or progress files directly.
_Avoid_: status.json, .progress, hasCompanyProfile (use hasCompanyInfo), stale (workspace Track switch)

**Application Track**:
A career-direction bundle: one Profile, one set of Prompt Templates, and one Resume Layout used for Resume Export in that direction. This project has two Tracks: `software-engineering` and `it-support`. Multiple Tracks coexist without overwriting each other. Each Job is bound to exactly one Application Track (set at create, changeable via Job Edit). Generation for that Job uses its current bound Track; Resume Export uses that same Track's Resume Layout. There is no workspace-level active Track.
_Avoid_: career target, profile variant, job type, 分类, persona, LANG-based template switch, default (as a Track id), workspace active Track, track.yaml activeTrack, forever-immutable Job↔Track binding

**Archive**:
Moving one Job and its Application Pack out of the workspace into durable dated archive storage. The workspace exposes a per-Job Archive action (replacing the old manual mark-applied control); Archive-all remains a bulk way to Archive every current workspace Job. Archive does not require the Application Pack to be complete. Archive does not move, copy, or delete Resume Export files in the Export Directory. Archived Jobs are not editable in place.
_Avoid_: delete, backup, mark applied, 已投递 button as the submission action, pack-complete gate on Archive, Job Edit on Archived Jobs, bundling Export Directory files into Archive

**Application Submission**:
A recorded instance of having applied for one Job. It occurs when that Job is Archived: each Archived Job is one Application Submission, including when several Jobs are Archived together via Archive-all. The same Job counts at most once for its lifetime — Restore does not remove the Submission; Archiving again does not add another. Generating an Application Pack or saving a Job Description alone is not an Application Submission.
_Avoid_: mark applied, 今日投递 click, pack generation as submission, one count per Archive-all click, recount on re-Archive

**Submission Date**:
The calendar day on which the Archive action happened for that Job, computed in the fixed timezone `Australia/Sydney`. Daily apply count, streak, and the submission heatmap all attribute an Application Submission to this day. Job creation day is not the Submission Date.
_Avoid_: jobId timestamp day, archive folder date-as-creation-day, UTC day, browser-local day, server OS local day without an explicit zone

**Submission Ledger**:
The authoritative record of Application Submissions: one entry per Job (keyed by jobId) with that Job's Submission Date. Written on the Job's first Archive; Restore and re-Archive do not remove or duplicate the entry. Daily count, streak, and heatmap are projections of this ledger — not of the current archive folder contents, and not of browser localStorage alone. Existing archived Jobs are backfilled into the ledger once; for those entries the Submission Date uses the archive folder date as a proxy for the unknown Archive-action day.
_Avoid_: scanning archive/ as truth, daily_apply_counter_v1 as authority, mark-applied job list, leaving pre-ledger archives out of the heatmap

**Submission Heatmap**:
A GitHub-style year view of Application Submissions from the Submission Ledger: the last ~12 months (~53 weeks), weeks starting Monday. Each cell is one calendar day in `Australia/Sydney`; intensity is that day's Submission count, shown on a blue scale; hover shows the date and count. Intensity bands (inclusive ranges, no shared endpoints): 0, 1–5, 6–10, 11–15, 16–20, 21–25, 26–30, 31+. It belongs with the daily count and streak as the workspace progress view, not inside the archive browsing view.
_Avoid_: mark-applied localStorage chart, archive-folder browsing as the heatmap, placing the heatmap primarily in the Archive tab

**Submission Streak**:
The count of consecutive `Australia/Sydney` calendar days with at least one Application Submission. If today has none yet, the streak is allowed to start from yesterday; if yesterday also has none, the streak is 0.
_Avoid_: requiring today to be non-zero, browser-local streak, localStorage activeDates
