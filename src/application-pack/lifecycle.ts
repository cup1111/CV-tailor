import type { Profile } from '../types/profile.js';
import type { PackStore } from './store.js';
import type { ModelPort } from './types.js';
import { runPromptStep } from './prompt-contracts.js';

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
}): Promise<void> {
  const { store, jobId, profile, model, templatesRoot } = args;
  store.getOrCreateStatus(jobId);
  store.ensureOutDir(jobId);
  const inputs = store.loadJobInputs(jobId);
  const jdText = inputs.jd;
  const hasCompanyInfo = !!inputs.companyInfo.trim();

  let webSearchResults: string;
  if (inputs.companyInfo.trim()) {
    // Only call web search when the company-research step will actually run
    if (!store.isStepCompleted(jobId, 'companyResearch')) {
      webSearchResults = await model.webSearch(inputs.companyInfo.trim(), 3);
    } else {
      webSearchResults = '';
    }
  } else {
    webSearchResults =
      'No web search was performed (no company keywords provided). Use only the job description below to infer company context.';
  }

  await runPromptStep({
    store,
    jobId,
    step: 'company-research',
    variables: { webSearchResults, jd: jdText },
    model,
    templatesRoot,
  });

  const companyProfileForPrompts = hasCompanyInfo
    ? store.readOutFile(jobId, 'company-profile.raw.txt') ?? ''
    : '';

  await runPromptStep({
    store,
    jobId,
    step: 'pain-points',
    variables: { jd: jdText, companyProfile: companyProfileForPrompts },
    model,
    templatesRoot,
  });
  const painPointsText = store.readOutFile(jobId, 'pain-points.raw.txt') ?? '';

  const { experienceList } = buildBulletRequirementsAndExperienceList(profile);
  const bulletRequirementsSection = buildBulletRequirementsSection(profile);
  await runPromptStep({
    store,
    jobId,
    step: 'mapping',
    variables: {
      companyProfile: companyProfileForPrompts,
      jd: jdText,
      painPoints: painPointsText,
      candidateExperience: JSON.stringify(profile.experiences, null, 2),
      bulletRequirementsSection,
      experienceList,
    },
    model,
    templatesRoot,
  });
  const mappingText = store.readOutFile(jobId, 'mapping.raw.txt') ?? '';

  await runPromptStep({
    store,
    jobId,
    step: 'experience-bullets',
    variables: {
      painPoints: painPointsText,
      companyProfile: companyProfileForPrompts,
      mapping: mappingText,
    },
    model,
    templatesRoot,
  });
  const experienceBulletsText =
    store.readOutFile(jobId, 'experience-bullets.raw.txt') ?? '';

  await runPromptStep({
    store,
    jobId,
    step: 'summary',
    variables: {
      jd: jdText,
      painPoints: painPointsText,
      companyProfile: companyProfileForPrompts,
      mapping: mappingText,
    },
    model,
    templatesRoot,
  });
  const summaryText = store.readOutFile(jobId, 'summary.raw.txt') ?? '';

  await runPromptStep({
    store,
    jobId,
    step: 'cover-letter',
    variables: {
      jd: jdText,
      summary: summaryText,
      painPoints: painPointsText,
      experienceBullets: experienceBulletsText,
      mapping: mappingText,
    },
    model,
    templatesRoot,
  });
  const coverLetterText = store.readOutFile(jobId, 'cover-letter.raw.txt') ?? '';

  await runPromptStep({
    store,
    jobId,
    step: 'review',
    variables: {
      companyProfile: companyProfileForPrompts,
      painPoints: painPointsText,
      mapping: mappingText,
      experienceBullets: experienceBulletsText,
      summary: summaryText,
      coverLetter: coverLetterText,
      jd: jdText,
    },
    model,
    templatesRoot,
  });
}

export async function runReview(args: {
  store: PackStore;
  jobId: string;
  model: ModelPort;
  templatesRoot: string;
  forceRun?: boolean;
}): Promise<void> {
  const { store, jobId, model, templatesRoot, forceRun } = args;
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

  await runPromptStep({
    store,
    jobId,
    step: 'review',
    variables: {
      companyProfile,
      painPoints,
      mapping,
      experienceBullets,
      summary,
      coverLetter,
      jd: inputs.jd,
    },
    model,
    templatesRoot,
    force: forceRun,
  });
}
