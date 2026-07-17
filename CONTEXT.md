# Resume Pack Generator

Domain for turning job descriptions into tailored application materials (experience bullets, summary, cover letter, review).

## Language

**UI Locale**:
The language of the web interface presented to the user (`en` or `zh`). User-facing copy is looked up from that locale's string table.
_Avoid_: LANG, prompt language, template language, hard-coded UI strings

**Prompt Template**:
The English instruction text used for one AI generation step. This project has a single English source; UI Locale does not change it.
_Avoid_: localized template, templates/en, templates/zh, LANG, PROMPT_LANG

**Experience Bullet**:
A factual resume bullet for one past role, produced for a specific job application. Primary quality bar is fit to that JD (and company when provided); honesty about what the candidate actually did is a hard constraint — no invented skills, scope, or seniority.
_Avoid_: generic achievement line, buzzword filler

**Application Pack**:
The set of materials generated for one job application: at minimum experience bullets, CV summary, and cover letter (plus upstream research/mapping/review that feed them).
_Avoid_: resume pack (ambiguous), full CV file

**Company Info**:
User-provided keywords / notes about the employer, used as Web Search input. Not the generated research write-up.
_Avoid_: company profile (that is the generated artifact), company.txt contents as if they were research output

**Company Profile**:
The generated company research artifact for one Application Pack (from Web Search + Prompt Template). Empty when Company Info was not provided.
_Avoid_: company info, user search keywords

**Job View**:
The read-only workspace snapshot for one job (title, Company Info flag, generation status, in-flight progress, whether the Application Pack is complete). Adapters list jobs through this view instead of reading status or progress files directly.
_Avoid_: status.json, .progress, hasCompanyProfile (use hasCompanyInfo)
