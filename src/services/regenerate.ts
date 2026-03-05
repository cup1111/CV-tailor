import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { z } from 'zod';
import { OpenAIService } from './openai.js';
import { loadTemplate, renderTemplate } from './template.js';
import { ProfileSchema } from '../types/profile.js';

const RegenerateExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  bullets: z.array(z.string()),
});

export const RegenerateOutputSchema = z.object({
  summary: z.string(),
  experiences: z.array(RegenerateExperienceSchema),
  coverLetter: z.string(),
  feedbackResponse: z.string(),
});

export type RegenerateOutput = z.infer<typeof RegenerateOutputSchema>;

function extractExperienceBullets(response: string): string {
  const sections: string[] = [];
  const regex = /\|\|([\s\S]*?)\|\|/g;
  let match;
  while ((match = regex.exec(response)) !== null) {
    const content = match[1].trim();
    if (content) sections.push(content);
  }
  return sections.join('\n\n');
}

function experiencesToRaw(experiences: RegenerateOutput['experiences']): string {
  return experiences
    .map(
      (exp) =>
        `||\n${exp.company} - ${exp.role}\n${exp.bullets.join('\n')}\n||`
    )
    .join('\n\n');
}

function readOutFile(outDir: string, filename: string): string {
  const p = join(outDir, filename);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf-8');
}

/**
 * 从 jobs 目录读取 JD 与公司信息（与 generate 的 loadJobInputs 逻辑一致）
 */
function loadJobContext(jobId: string): { jd: string; companyProfile: string } {
  const jobsDir = join(process.cwd(), 'jobs');
  const jdPath = join(jobsDir, `${jobId}.md`);
  const companyPath = join(jobsDir, `${jobId}.company.txt`);
  if (!existsSync(jdPath)) throw new Error(`Job not found: ${jobId}`);

  let jd = readFileSync(jdPath, 'utf-8').trim();
  let companyProfile = '';
  if (existsSync(companyPath)) {
    companyProfile = readFileSync(companyPath, 'utf-8').trim();
  } else {
    const JD_MARKER = '---JD---';
    const idx = jd.indexOf(JD_MARKER);
    if (idx >= 0) {
      companyProfile = jd.slice(0, idx).replace(/^---COMPANY---\s*/i, '').trim();
      jd = jd.slice(idx + JD_MARKER.length).trim();
    }
  }
  return { jd, companyProfile };
}

function getPromptLang(): string {
  return process.env.LANG || process.env.PROMPT_LANG || 'en';
}

function getRegenerateFallbacks(lang: string): {
  noProfile: string;
  parseError: string;
  none: string;
} {
  if (lang === 'zh') {
    return { noProfile: '(未找到 profile.yaml)', parseError: '(解析 profile 失败)', none: '(无)' };
  }
  return { noProfile: '(profile.yaml not found)', parseError: '(Failed to parse profile)', none: '(none)' };
}

function loadProfileExperiences(lang?: string): string {
  const fallbacks = getRegenerateFallbacks(lang || getPromptLang());
  const profilePath = join(process.cwd(), 'profile.yaml');
  if (!existsSync(profilePath)) return fallbacks.noProfile;
  try {
    const content = readFileSync(profilePath, 'utf-8');
    const parsed = load(content);
    const profile = ProfileSchema.parse(parsed);
    return JSON.stringify(profile.experiences, null, 2);
  } catch {
    return fallbacks.parseError;
  }
}

/**
 * 根据用户反馈重新生成 Summary、经历要点、求职信，并写入 out 目录；返回结构化结果与 feedbackResponse（Markdown）。
 */
export async function regenerateResumeContent(
  openai: OpenAIService,
  jobId: string,
  feedback: string
): Promise<RegenerateOutput> {
  const outDir = join(process.cwd(), 'out', jobId);
  if (!existsSync(outDir)) throw new Error(`No output directory for job: ${jobId}`);

  const { jd, companyProfile } = loadJobContext(jobId);
  const painPoints = readOutFile(outDir, 'pain-points.raw.txt');
  const mapping = readOutFile(outDir, 'mapping.raw.txt');
  const currentSummary = readOutFile(outDir, 'summary.raw.txt');
  const currentExperienceBullets = readOutFile(outDir, 'experience-bullets.extracted.txt');
  const currentCoverLetter = readOutFile(outDir, 'cover-letter.raw.txt');
  const promptLang = getPromptLang();
  const candidateExperience = loadProfileExperiences(promptLang);
  const fallbacks = getRegenerateFallbacks(promptLang);

  if (!currentSummary || !currentExperienceBullets || !currentCoverLetter) {
    throw new Error('Missing current summary, experience bullets, or cover letter. Run full generate first.');
  }

  const template = loadTemplate('regenerate', promptLang);
  const rendered = renderTemplate(template, {
    jd,
    companyProfile: companyProfile || fallbacks.none,
    painPoints: painPoints || fallbacks.none,
    mapping: mapping || fallbacks.none,
    currentSummary,
    currentExperienceBullets,
    currentCoverLetter,
    candidateExperience,
    feedback: feedback.trim() || 'Please improve alignment with the JD and company without adding new claims.',
  });

  const rawPath = join(outDir, 'regenerate.raw.json');
  const result = await openai.generateJson(
    rendered,
    RegenerateOutputSchema,
    3,
    rawPath
  );

  const experienceRaw = experiencesToRaw(result.experiences);
  const experienceExtracted = extractExperienceBullets(experienceRaw);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'summary.raw.txt'), result.summary, 'utf-8');
  writeFileSync(join(outDir, 'experience-bullets.raw.txt'), experienceRaw, 'utf-8');
  writeFileSync(join(outDir, 'experience-bullets.extracted.txt'), experienceExtracted, 'utf-8');
  writeFileSync(join(outDir, 'cover-letter.raw.txt'), result.coverLetter, 'utf-8');
  writeFileSync(join(outDir, 'regenerate-feedback.raw.md'), result.feedbackResponse, 'utf-8');

  return result;
}
