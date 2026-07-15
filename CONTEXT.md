# Resume Pack Generator

Domain for turning job descriptions into tailored application materials (experience bullets, summary, cover letter, review).

## Language

**UI Locale**:
The language of the web interface presented to the user (`en` or `zh`). User-facing copy is looked up from that locale's string table.
_Avoid_: LANG, prompt language, template language, hard-coded UI strings

**Prompt Template**:
The English instruction text used for one AI generation step. This project has a single English source; UI Locale does not change it.
_Avoid_: localized template, templates/en, templates/zh, LANG, PROMPT_LANG
