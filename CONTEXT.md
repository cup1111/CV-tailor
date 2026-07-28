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
The set of materials generated for one job application: at minimum experience bullets, CV summary, and cover letter (plus upstream research/mapping/review that feed them). An Application Pack is generated under the Job's bound Application Track. Completeness requires the review Pack Generation Step to be completed with valid minted Role Title and Employer Name — Review Verdict FAIL does not block completeness. User-facing copy for generate / generate-all names this set (e.g. 申请材料 / Application Pack), not the Job Description and not a CV.
_Avoid_: resume pack (ambiguous), full CV file, CV (as the name of the generated set), Resume Export (downstream of the pack), 生成 JD / generate JD, stale pack (relative to a workspace active Track), requiring Review Verdict PASS for completeness

**Pack Generation Step**:
One ordered stage in producing an Application Pack for a Job. There are seven user-facing steps through review (company research, pain points, mapping, experience bullets, summary, cover letter, review). The Application Pack is complete when review is completed with valid minted Role Title and Employer Name, regardless of Review Verdict. A step marked failed means the step did not finish (e.g. API error) or review output could not yield parseable mint fields — not a quality FAIL verdict. Failed steps count as finished for batch progress accounting.
_Avoid_: render as a user-facing progress step, CV-generation step, JD-generation step, Resume Export as a pack step, treating Review Verdict FAIL as step failed

**Resume Layout**:
The user-maintained Apple Pages document that owns resume typography and section layout for one Application Track. It lives with that Track's other private candidate assets alongside the Profile (conventional Track path; not under out/ or the Export Directory). It exposes Placeholder Text slots: one for Summary and one per Profile experience in list order (experience N maps to slot N). Resume Export for a Job uses that Job's bound Track's Layout. It is not Prompt Template content and not the Profile.
_Avoid_: template (unqualified), Prompt Template, Profile, resume file (as Profile), page/Pages as the domain name for the concept, workspace-shared layout, per-Job layout picker, matching slots by company name or role tag, configuring an arbitrary absolute path as the primary Layout location

**Resume Export**:
The downstream act of filling a copy of a Resume Layout with only the Summary and Experience Bullets from one Job's Application Pack, writing both a filled Pages document and a PDF into the Export Directory (and those resulting files). Filenames are `{Profile.personal.name} CV {Role Title} - {Employer Name}.pages` and the same stem with `.pdf`; a later Export for the same Job overwrites those paths. Experience Bullets are written into Layout slots by Profile experience order (1-based index). Personal details, education, skills, role titles/dates, and other static layout copy stay in the Resume Layout; Cover Letter is not part of Resume Export. Allowed only when that Job's Application Pack is complete (review completed). The experience-slot count on the Resume Layout must equal the Profile experience count for that Track — any mismatch fails the Export with no output written. Started only by an explicit user action (UI or CLI), not automatically when the pack completes. Deleting a Job (including Job Edit that clears the Job Description) does not remove files already written to the Export Directory. Not part of the Application Pack and not a Pack Generation Step. Uses the Resume Layout of the Job's bound Application Track.
_Avoid_: Application Pack, pack generation, CV generation step, treating the filled Pages file as pack completeness, exporting cover letter or Profile fields into the Layout, exporting before pack complete, tag-based experience slot matching, partial fill when slot counts differ, auto-export on pack complete, Pages-only or PDF-only as the default Export result, jobId-only export filenames, timestamped export versions, deleting Export Directory files when the Job is removed

**Role Title**:
The target position name for one Job (e.g. Software Engineer), minted from the first review completion whose output includes a parseable Role Title and then frozen. Required for the review step to count as completed and for Resume Export filenames. Not the Job View list title (that remains a JD snippet). Legacy combined mints split on the first ` - ` into Role Title and Employer Name when read.
_Avoid_: Job (ambiguous with the Job entity), job title (ambiguous with View title), Job Label, regenerating on every review or Regenerate, requiring Review Verdict PASS to mint, treating PASS without a Role Title as pack-complete

**Employer Name**:
The target employer's company name for one Job (e.g. Acme Corp), minted from the first review completion whose output includes a parseable Employer Name and then frozen. Required for the review step to count as completed and for Resume Export filenames. Not Company Info (user search keywords) and not Company Profile (generated research). Legacy combined mints split on the first ` - ` into Role Title and Employer Name when read.
_Avoid_: company (ambiguous), company info, Job Label, regenerating on every review or Regenerate, requiring Review Verdict PASS to mint, treating PASS without an Employer Name as pack-complete

**Review Verdict**:
The quality judgment (PASS or FAIL) on line 1 of review model output. When FAIL and Role Title and Employer Name are parseable, the verdict is advisory only: it does not block Application Pack completeness, Resume Export, Archive, or batch completion. The UI shows a small secondary badge (e.g. ⚠ Review / ⚠ 审查) on the Job card; full review output including the explanation remains visible in results. Regenerate overwrites the stored advisory from the latest review; PASS clears it. Review Verdict FAIL with unparseable mint fields is not advisory — the review step stays failed and the pack stays incomplete.
_Avoid_: treating FAIL as step failed when mint fields parse, blocking Export on FAIL, CLI warnings for FAIL, successful review (as a completeness gate)

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
One application target in the workspace: a Job Description, optional Company Info, optional Job Link, and a binding to exactly one Application Track. The binding is the sole authority for which Profile and Prompt Templates generation uses; Application Pack outputs do not carry a separate Track record. jobId stays the same across Edit.
_Avoid_: JD (the text alone), posting, listing, pack-side Track marker as authority, immutable Track binding

**Job Link**:
The optional URL of the job posting for one Job, set at create or Job Edit. Authoritative source for the Link column in a Submission Sheet Entry. When empty at Archive, fallback extracts the first `http(s)://` URL from the Job Description text; if none, Link is empty.
_Avoid_: URL line in jd.md as authority, requiring Link for Archive, treating Company Info as Link

**Job Edit**:
Changing a workspace Job's Job Description, Company Info, Job Link, and/or Application Track binding in place. A save that does not change any of those fields is a no-op. Saving with an empty Job Description deletes the Job from the workspace (same outcome as Delete), after confirmation. Empty Company Info is allowed and clears that Job's Company Info. Empty Job Link is allowed and clears that Job's Job Link. If at least one field changes, the Job Description is non-empty, and that Job has any generation output under it (complete Application Pack or incomplete/failed leftovers), Edit discards those outputs and the Role Title and Employer Name (after confirmation) and returns the Job to ungenerated; otherwise a non-deleting Edit only updates the inputs. Job Edit is only for Jobs currently in the workspace — not while generation is in flight, and not for Archived Jobs (Restore first).
_Avoid_: ingest as a new Job, Regenerate (review-feedback re-run), leaving outputs from a previous Track or JD, Edit during in-flight generation, Edit inside Archive, discard outputs on unchanged save, leave failed/partial out/ after a dirty Edit, keep a Job with an empty Job Description, keeping Role Title or Employer Name after outputs are discarded

**Job View**:
The read-only workspace snapshot for one job (title, Company Info flag, generation status, in-flight progress, whether the Application Pack is complete, advisory Review Verdict when FAIL, and which Application Track the Job is bound to). Reading Job View reconciles legacy review-failed jobs against persisted review output. Adapters list jobs through this view instead of reading status or progress files directly.
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

**Submission Spreadsheet**:
The user-configured Google Spreadsheet that receives Submission Sheet Entries. Optional at workspace level: when unset, Archive skips sheet write with no warning. Configured by Spreadsheet ID or full spreadsheet URL (parsed to ID), stored like Export Directory. Authenticated via a Google Service Account whose credentials live outside the repo (e.g. `.env`). Writes one row per first Archive to the **`Jobs`** worksheet tab in the user's Submission Spreadsheet (e.g. the file named *work application list* — configured by spreadsheet URL/ID, not by file name). Column positions are fixed by letter (header row assumed present, not written): A=Index (sheet row number minus 1; preserved when already present), B=Company, C=Job, D=Date, E=Status, F unused (left empty), G=Follow Up, H=Link. Target row: if the last sheet row's Date cell is empty, fill that row; otherwise append a new row after it. No automatic backfill of Submission Ledger history when the spreadsheet is first configured — only Archives after configuration produce Entries.
_Avoid_: Google Excel as the domain name, OAuth as the primary auth story, requiring spreadsheet config for Archive, writing to arbitrary tabs by default, backfilling ledger history on config save, filling older empty holes above a filled tail row

**Submission Sheet Entry**:
One row in the user's external application-tracking spreadsheet that projects a single Application Submission. Created exactly when that Submission is first recorded (the Job's first Archive); Restore and re-Archive do not create another Entry. Fixed columns map to domain fields: Company → Employer Name, Job → Role Title, Date → Submission Date written as `M/D/YYYY` for the spreadsheet's `en_US` locale so `USER_ENTERED` stores a real date serial (same calendar day as the Ledger / heatmap key `YYYY-MM-DD` in `Australia/Sydney`), Status → `submitted`, Follow Up → `following`, Link → Job Link (with JD URL fallback). When Role Title or Employer Name were not minted (Pack incomplete at Archive), fallback applies: Role Title uses the Job View title (JD snippet); Employer Name uses Company Info when present, otherwise empty. Sheet write is best-effort: Archive and Submission Ledger always succeed; a failed write shows a UI warning and is logged, with no retry and no rollback. The spreadsheet is not the authority for daily count, streak, or heatmap — the Submission Ledger remains authoritative for those.
_Avoid_: Google Excel as the domain name, treating the spreadsheet as Submission Ledger, rewriting or duplicating a row on Restore or re-Archive, blocking Archive when minted fields are missing, blocking Archive on sheet write failure, silent sheet failures, writing Date as `DD/MM/YYYY` or `DD-MM-YYYY` (stored as text in the en_US sheet and breaks date charts)

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
