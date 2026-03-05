# Resume Pack Generator

A tool that generates job application materials from job descriptions (JDs): pain points, experience bullets, CV summary, cover letter, and a review step. It includes a web UI for adding jobs and viewing results, plus CLI generation and archive/restore.

## Tech stack

- Node.js + TypeScript
- OpenAI API (chat completions + optional web search)
- Zod for validation
- Commander for CLI
- Express for the web server
- p-limit for concurrency

## Install

1. Clone the repo:

   ```bash
   git clone <repo-url>
   cd job
   ```

2. Install dependencies:

   ```bash
   pnpm install
   # or: npm install / yarn install
   ```

3. Environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least:

   - `OPENAI_API_KEY` — your OpenAI API key (required)

   Optional: `OPENAI_MODEL`, `OPENAI_RESPONSES_MODEL`, `LANG` (see below).

4. Profile (your resume data):

   ```bash
   cp profile.example.yaml profile.yaml
   ```

   Edit `profile.yaml` with your name, email, work experiences, education, and skills. `profile.yaml` is gitignored and will not be committed.

## Usage

### Start the app (web UI)

```bash
pnpm run ingest
# or: pnpm run ingest -- --port 3000
```

Then open http://localhost:3000 in your browser.

**In the UI:**

- **Workspace:** Add jobs by pasting company info (optional) and job description (JD). You can upload a text file instead.
- **Generate:** Run “Generate” for a single job or “Generate all” for all incomplete jobs. Progress is shown per job.
- **View results:** After generation, open “View results” to see company profile, pain points, mapping, experience bullets, summary, cover letter, and review. Copy buttons let you copy sections to the clipboard.
- **Regenerate:** For completed jobs, use “Regenerate” to revise summary, experience bullets, and cover letter using editable feedback (e.g. from the review step). Regeneration runs in the background and re-runs the review step when done.
- **Archive:** Use “Archive” to move jobs to the archive (by date). In the archive tab you can search, expand details, and “Restore to workspace” if needed.

### Generate from CLI

Generate for all incomplete jobs (or a specific job):

```bash
pnpm run generate
pnpm run generate -- --job <job_id>
pnpm run generate -- --concurrency 2
```

Outputs are written under `out/{job_id}/`.

## Workflow (7 steps)

For each job, the pipeline runs:

1. **Company research** — Optional web search using company info; produces a company profile (or JD-only if no company info).
2. **Pain points** — Key hiring pain points from the JD (and company profile if present).
3. **Mapping** — Maps your profile experiences to JD requirements and pain points.
4. **Experience bullets** — Bullet points per experience, aligned to pain points and mapping.
5. **Summary** — Short CV summary paragraph (~50 words) at the top of the resume.
6. **Cover letter** — Tailored cover letter.
7. **Review** — Quality check (PASS/FAIL and short explanation). If FAIL, one automatic regenerate run is triggered with the review as feedback.

All outputs are under `out/{job_id}/` (e.g. `company-profile.raw.txt`, `pain-points.raw.txt`, `mapping.raw.txt`, `experience-bullets.raw.txt`, `summary.raw.txt`, `cover-letter.raw.txt`, `review.raw.txt`). Archive moves `jobs/{id}.md`, `jobs/{id}.company.txt`, and `out/{id}/*` into `archive/YYYY-MM-DD/{id}/`.

## Project structure

```
job/
  profile.example.yaml   # Sample profile; copy to profile.yaml (gitignored)
  .env.example           # Sample env; copy to .env (gitignored)
  templates/             # JSON prompt templates (en/zh by LANG)
  src/
    cli.ts               # CLI entry
    server.ts            # Express app + web UI
    commands/
      ingest.ts          # Starts server
      generate.ts        # 7-step generation + regenerate-on-FAIL
    services/
      openai.ts          # OpenAI client
      template.ts        # Template loader
      status.ts          # Step status
      regenerate.ts      # Regenerate summary/experience/cover letter
      archive.ts         # Archive list, archive, restore
  out/                   # Generated outputs (gitignored)
  jobs/                  # Stored JDs (gitignored)
  archive/               # Archived jobs (gitignored)
```

## Configuration

### profile.yaml

Create from `profile.example.yaml`. Include:

- `personal`: name, email, phone, linkedin, github
- `experiences`: list of `company`, `role`, `startDate`, `endDate`, `description`, optional `bulletCount` / `wordCount`
- `education`: school, degree, field, dates
- `skills`: list of strings
- `additionalInfo`: optional certifications, awards

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_MODEL` | No | Chat model (default from env or gpt-4o) |
| `OPENAI_RESPONSES_MODEL` | No | Model for web search (default gpt-4o) |
| `LANG` | No | Prompt language: `en` or `zh` (default `en`) |

### Templates

Templates live under `templates/` (and optionally `templates/en/`, `templates/zh/` when using `LANG`). Each is a JSON file with `systemPrompt`, `userPrompt`, and optional `temperature`, `maxTokens`. Variables use `{{name}}` and are filled at runtime.

## Development

```bash
pnpm run build
pnpm run dev generate   # Run generate with tsx
tsc --noEmit           # Type check
```

## License

MIT

---

## 中文说明

本工具根据职位描述（JD）自动生成求职材料：招聘痛点、经历要点、简历摘要、求职信和审查。提供网页界面添加职位、查看结果、重新生成与存档。

**安装：** 克隆项目后执行 `pnpm install`，复制 `.env.example` 为 `.env` 并填写 `OPENAI_API_KEY`，复制 `profile.example.yaml` 为 `profile.yaml` 并填写个人经历与技能。

**使用：** 运行 `pnpm run ingest` 启动服务，在浏览器打开 http://localhost:3000，在“工作区”添加 JD 后点击“生成”，在“查看结果”中查看并复制内容；可使用“重新生成”根据反馈修改摘要/经历/求职信，或使用“存档”将职位移至存档区。

**流程：** 公司调研 → 痛点 → 映射 → 经历要点 → 摘要 → 求职信 → 审查；输出在 `out/{job_id}/`，存档在 `archive/YYYY-MM-DD/{id}/`。
