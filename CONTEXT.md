# Resume Pack Generator

Domain for turning job descriptions into tailored application materials (experience bullets, summary, cover letter, review).

## Language

**UI Locale**:
The language of the web interface presented to the user (`en` or `zh`). User-facing copy is looked up from that locale's string table.
_Avoid_: LANG, prompt language, template language, hard-coded UI strings

**Prompt Template**:
The English instruction text used for one AI generation step within an Application Track. Each Track owns a complete set of Prompt Templates; UI Locale does not select or translate them.
_Avoid_: localized template, templates/en, templates/zh, LANG, PROMPT_LANG, shared cross-track template

**Experience Bullet**:
A factual resume bullet for one past role, produced for a specific job application. Primary quality bar is fit to that JD (and company when provided); honesty about what the candidate actually did is a hard constraint — no invented skills, scope, or seniority. When the same past role appears in another Application Track's Profile, the role title stays as it was; only the description emphasis may change to facts that still hold.
_Avoid_: generic achievement line, buzzword filler, retitled past role

**Application Pack**:
The set of materials generated for one job application: at minimum experience bullets, CV summary, and cover letter (plus upstream research/mapping/review that feed them). An Application Pack is generated under the Job's bound Application Track.
_Avoid_: resume pack (ambiguous), full CV file, stale pack (relative to a workspace active Track)

**Profile**:
The candidate's source facts for one Application Track: personal details, experiences, education, skills, and optional extras. Each Track owns a complete Profile; generation never mixes Profiles across Tracks.
_Avoid_: resume file, CV source, shared personal block

**Company Info**:
User-provided keywords / notes about the employer, used as Web Search input. Not the generated research write-up.
_Avoid_: company profile (that is the generated artifact), company.txt contents as if they were research output

**Company Profile**:
The generated company research artifact for one Application Pack (from Web Search + Prompt Template). Empty when Company Info was not provided.
_Avoid_: company info, user search keywords

**Job**:
One application target in the workspace: a Job Description, optional Company Info, and an immutable binding to exactly one Application Track. The binding is the sole authority for which Profile and Prompt Templates generation uses; Application Pack outputs do not carry a separate Track record.
_Avoid_: JD (the text alone), posting, listing, pack-side Track marker as authority

**Job View**:
The read-only workspace snapshot for one job (title, Company Info flag, generation status, in-flight progress, whether the Application Pack is complete, and which Application Track the Job is bound to). Adapters list jobs through this view instead of reading status or progress files directly.
_Avoid_: status.json, .progress, hasCompanyProfile (use hasCompanyInfo), stale (workspace Track switch)

**Application Track**:
A career-direction bundle: one Profile plus one set of Prompt Templates used to generate Application Packs for that direction. This project has two Tracks: `software-engineering` and `it-support`. Multiple Tracks coexist without overwriting each other. Each Job is bound to exactly one Application Track when the Job Description is entered; that binding does not change afterward. Generation for that Job uses its bound Track. There is no workspace-level active Track.
_Avoid_: career target, profile variant, job type, 分类, persona, LANG-based template switch, default (as a Track id), workspace active Track, track.yaml activeTrack
