import { join } from 'path';
import type { Profile } from '../types/profile.js';
import type { PackStore } from './store.js';
import type { ModelPort } from './types.js';
import { parseStepOutput, preparePrompt } from './prompt-contracts.js';

const BULLET_ALLOCATION_INSTRUCTION_EN =
  'Allocate bullet counts per experience based on relevance to the JD and pain points. More relevant experiences get more bullets (1–4 each). Constraints: 1–4 bullets per experience; first experience at least 2; total bullets 10–14 (or 8–12 if fewer than 4 experiences). Word count per bullet: "20-25" or "25-30". For the first experience, if company profile was provided, append: For the first experience add 1–2 bullets tied to the target company if company profile provided. Output one line per experience: Experience N (Company - Role): Write EXACTLY X bullet point(s), each approximately Y words.';

function buildBulletRequirementsAndExperienceList(profile: Profile): {
  bulletRequirements: string;
  experienceList: string;
} {
  const lines: string[] = [];
  const listLines: string[] = [];
  profile.experiences.forEach((exp, index) => {
    const bulletCount = exp.bulletCount ?? 2;
    const isFirst = index === 0;
    const extra = isFirst
      ? ' For the first experience add 1–2 bullets tied to the target company if company profile provided.'
      : '';
    const wordCount = exp.wordCount
      ? typeof exp.wordCount === 'string'
        ? exp.wordCount
        : `${exp.wordCount}-${exp.wordCount + 5}`
      : '20-25';
    lines.push(
      `Experience ${index + 1} (${exp.company} - ${exp.role}): Write EXACTLY ${bulletCount} bullet point(s), each approximately ${wordCount} words.${extra}`
    );
    listLines.push(`${exp.company} - ${exp.role}`);
  });
  return {
    bulletRequirements: lines.join('\n'),
    experienceList: listLines.join('\n'),
  };
}

function buildBulletRequirementsSection(profile: Profile): string {
  const { bulletRequirements } = buildBulletRequirementsAndExperienceList(profile);
  if (profile.autoAllocateBullets) {
    return (
      'Generate the PER-EXPERIENCE BULLET REQUIREMENTS block yourself according to the following instructions. Do NOT copy a pre-written block; write one line per experience in EXPERIENCE LIST with your chosen bullet count and word count.\n\n' +
      BULLET_ALLOCATION_INSTRUCTION_EN
    );
  }
  return 'Copy the following block EXACTLY (do not modify):\n\n' + bulletRequirements;
}

export async function generatePackForJob(args: {
  store: PackStore;
  jobId: string;
  profile: Profile;
  model: ModelPort;
  templatesRoot: string;
  workspaceRoot: string;
}): Promise<{ reviewFailed: boolean }> {
  const { store, jobId, profile, model, templatesRoot } = args;
  store.getOrCreateStatus(jobId);
  const inputs = store.loadJobInputs(jobId);
  const jdText = inputs.jd;
  const hasCompanyInfo = !!inputs.companyInfo.trim();

  // Step 1: company research
  if (!store.isStepCompleted(jobId, 'companyResearch')) {
    store.updateStepStatus(jobId, 'companyResearch', 'in_progress');
    try {
      let webSearchResults: string;
      if (inputs.companyInfo.trim()) {
        webSearchResults = await model.webSearch(inputs.companyInfo.trim(), 3);
      } else {
        webSearchResults =
          'No web search was performed (no company keywords provided). Use only the job description below to infer company context.';
      }
      const rendered = preparePrompt(
        'company-research',
        { webSearchResults, jd: jdText },
        templatesRoot
      );
      const promptPath = join(store.outDir(jobId), 'company-research.prompt.txt');
      store.ensureOutDir(jobId);
      const { text, finishReason } = await model.generateTextWithMeta(rendered, 3, promptPath);
      store.writeOutFile(jobId, 'company-profile.raw.txt', text);
      if (finishReason === 'length') {
        store.writeOutFile(jobId, 'company-profile.truncated', '1');
      }
      store.updateStepStatus(jobId, 'companyResearch', 'completed');
    } catch (error) {
      store.updateStepStatus(jobId, 'companyResearch', 'failed');
      throw error;
    }
  }

  const companyProfileForPrompts = hasCompanyInfo
    ? store.readOutFile(jobId, 'company-profile.raw.txt') ?? ''
    : '';

  // Step 2: pain points
  if (!store.isStepCompleted(jobId, 'painPoints')) {
    store.updateStepStatus(jobId, 'painPoints', 'in_progress');
    try {
      const rendered = preparePrompt(
        'pain-points',
        { jd: jdText, companyProfile: companyProfileForPrompts },
        templatesRoot
      );
      const promptPath = join(store.outDir(jobId), 'pain-points.prompt.txt');
      const { text, finishReason } = await model.generateTextWithMeta(rendered, 3, promptPath);
      store.writeOutFile(jobId, 'pain-points.raw.txt', text);
      if (finishReason === 'length') {
        store.writeOutFile(jobId, 'pain-points.truncated', '1');
      }
      store.updateStepStatus(jobId, 'painPoints', 'completed');
    } catch (error) {
      store.updateStepStatus(jobId, 'painPoints', 'failed');
      throw error;
    }
  }
  const painPointsText = store.readOutFile(jobId, 'pain-points.raw.txt') ?? '';

  // Step 3: mapping
  if (!store.isStepCompleted(jobId, 'mapping')) {
    store.updateStepStatus(jobId, 'mapping', 'in_progress');
    try {
      const { experienceList } = buildBulletRequirementsAndExperienceList(profile);
      const bulletRequirementsSection = buildBulletRequirementsSection(profile);
      const rendered = preparePrompt(
        'mapping',
        {
          companyProfile: companyProfileForPrompts,
          jd: jdText,
          painPoints: painPointsText,
          candidateExperience: JSON.stringify(profile.experiences, null, 2),
          bulletRequirementsSection,
          experienceList,
        },
        templatesRoot
      );
      const promptPath = join(store.outDir(jobId), 'mapping.prompt.txt');
      const { text, finishReason } = await model.generateTextWithMeta(rendered, 3, promptPath);
      store.writeOutFile(jobId, 'mapping.raw.txt', text);
      if (finishReason === 'length') {
        store.writeOutFile(jobId, 'mapping.truncated', '1');
      }
      store.updateStepStatus(jobId, 'mapping', 'completed');
    } catch (error) {
      store.updateStepStatus(jobId, 'mapping', 'failed');
      throw error;
    }
  }
  const mappingText = store.readOutFile(jobId, 'mapping.raw.txt') ?? '';

  // Step 4: experience bullets (contract omits unused jd)
  if (!store.isStepCompleted(jobId, 'experienceBullets')) {
    store.updateStepStatus(jobId, 'experienceBullets', 'in_progress');
    try {
      const rendered = preparePrompt(
        'experience-bullets',
        {
          painPoints: painPointsText,
          companyProfile: companyProfileForPrompts,
          mapping: mappingText,
        },
        templatesRoot
      );
      const promptPath = join(store.outDir(jobId), 'experience-bullets.prompt.txt');
      const result = await model.generateText(rendered, 3, promptPath);
      const parsed = parseStepOutput('experience-bullets', result);
      store.writeOutFile(jobId, 'experience-bullets.raw.txt', parsed.raw);
      store.writeOutFile(jobId, 'experience-bullets.extracted.txt', parsed.extracted ?? '');
      store.updateStepStatus(jobId, 'experienceBullets', 'completed');
    } catch (error) {
      store.updateStepStatus(jobId, 'experienceBullets', 'failed');
      throw error;
    }
  }
  const experienceBulletsText =
    store.readOutFile(jobId, 'experience-bullets.raw.txt') ?? '';

  // Step 5: summary (contract omits unused experienceBullets)
  if (!store.isStepCompleted(jobId, 'summary')) {
    store.updateStepStatus(jobId, 'summary', 'in_progress');
    try {
      const rendered = preparePrompt(
        'summary',
        {
          jd: jdText,
          painPoints: painPointsText,
          companyProfile: companyProfileForPrompts,
          mapping: mappingText,
        },
        templatesRoot
      );
      const promptPath = join(store.outDir(jobId), 'summary.prompt.txt');
      const result = await model.generateText(rendered, 3, promptPath);
      store.writeOutFile(jobId, 'summary.raw.txt', result);
      store.updateStepStatus(jobId, 'summary', 'completed');
    } catch (error) {
      store.updateStepStatus(jobId, 'summary', 'failed');
      throw error;
    }
  }
  const summaryText = store.readOutFile(jobId, 'summary.raw.txt') ?? '';

  // Step 6: cover letter
  if (!store.isStepCompleted(jobId, 'coverLetter')) {
    store.updateStepStatus(jobId, 'coverLetter', 'in_progress');
    try {
      const rendered = preparePrompt(
        'cover-letter',
        {
          jd: jdText,
          summary: summaryText,
          painPoints: painPointsText,
          experienceBullets: experienceBulletsText,
          mapping: mappingText,
        },
        templatesRoot
      );
      const promptPath = join(store.outDir(jobId), 'cover-letter.prompt.txt');
      const result = await model.generateText(rendered, 3, promptPath);
      store.writeOutFile(jobId, 'cover-letter.raw.txt', result);
      store.updateStepStatus(jobId, 'coverLetter', 'completed');
    } catch (error) {
      store.updateStepStatus(jobId, 'coverLetter', 'failed');
      throw error;
    }
  }
  const coverLetterText = store.readOutFile(jobId, 'cover-letter.raw.txt') ?? '';

  // Step 7: review
  if (!store.isStepCompleted(jobId, 'review')) {
    store.updateStepStatus(jobId, 'review', 'in_progress');
    try {
      const rendered = preparePrompt(
        'review',
        {
          companyProfile: companyProfileForPrompts,
          painPoints: painPointsText,
          mapping: mappingText,
          experienceBullets: experienceBulletsText,
          summary: summaryText,
          coverLetter: coverLetterText,
          jd: jdText,
        },
        templatesRoot
      );
      const promptPath = join(store.outDir(jobId), 'review.prompt.txt');
      const result = await model.generateText(rendered, 3, promptPath);
      store.writeOutFile(jobId, 'review.raw.txt', result);
      store.updateStepStatus(jobId, 'review', 'completed');
    } catch (error) {
      store.updateStepStatus(jobId, 'review', 'failed');
      throw error;
    }
  }

  const reviewText = (store.readOutFile(jobId, 'review.raw.txt') ?? '').trim();
  const firstLine = reviewText.split(/\r?\n/)[0]?.trim().toUpperCase() || '';
  const reviewFailed = firstLine === 'FAIL' || firstLine.startsWith('FAIL');
  return { reviewFailed };
}

export async function runReview(args: {
  store: PackStore;
  jobId: string;
  model: ModelPort;
  templatesRoot: string;
  forceRun?: boolean;
}): Promise<void> {
  const { store, jobId, model, templatesRoot, forceRun } = args;
  if (!forceRun && store.isStepCompleted(jobId, 'review')) return;

  const inputs = store.loadJobInputs(jobId);
  const hasCompanyInfo = !!inputs.companyInfo.trim();
  const companyProfile = hasCompanyInfo
    ? store.readOutFile(jobId, 'company-profile.raw.txt') ?? ''
    : '';
  const painPoints = store.readOutFile(jobId, 'pain-points.raw.txt') ?? '';
  const mapping = store.readOutFile(jobId, 'mapping.raw.txt') ?? '';
  const experienceBullets =
    store.readOutFile(jobId, 'experience-bullets.raw.txt') ??
    store.readOutFile(jobId, 'experience-bullets.extracted.txt') ??
    '';
  const summary = store.readOutFile(jobId, 'summary.raw.txt') ?? '';
  const coverLetter = store.readOutFile(jobId, 'cover-letter.raw.txt') ?? '';

  store.updateStepStatus(jobId, 'review', 'in_progress');
  try {
    const rendered = preparePrompt(
      'review',
      {
        companyProfile,
        painPoints,
        mapping,
        experienceBullets,
        summary,
        coverLetter,
        jd: inputs.jd,
      },
      templatesRoot
    );
    const promptPath = join(store.outDir(jobId), 'review.prompt.txt');
    const result = await model.generateText(rendered, 3, promptPath);
    store.writeOutFile(jobId, 'review.raw.txt', result);
    store.updateStepStatus(jobId, 'review', 'completed');
  } catch (error) {
    store.updateStepStatus(jobId, 'review', 'failed');
    throw error;
  }
}
