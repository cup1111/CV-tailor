# Single English Prompt Template source

UI Locale (en/zh) and Prompt Templates are deliberately decoupled: the web UI can be Chinese, but generation always loads English files from `templates/{name}.jsonprompt`. We rejected a `templates/{lang}/` seam and `LANG`/`PROMPT_LANG` env switching because only one real adapter existed (root English templates); a second locale would double maintenance cost for little gain. See CONTEXT.md for the terms.
