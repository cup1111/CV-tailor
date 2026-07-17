import { join } from 'path';
import { z } from 'zod';
import type { PackStore } from './store.js';
import type { ModelPort } from './types.js';
import { runReview } from './lifecycle.js';
import { parseStepOutput, preparePrompt } from './prompt-contracts.js';

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

function experiencesToRaw(experiences: RegenerateOutput['experiences']): string {
  return experiences
    .map((exp) => `||\n${exp.company} - ${exp.role}\n${exp.bullets.join('\n')}\n||`)
    .join('\n\n');
}

const EMPTY_PLACEHOLDER = '(none)';

/**
 * Regenerate summary, Experience Bullets, and cover letter from feedback, then re-run review.
 * Uses generated company profile (not raw company search keywords) when present.
 */
export async function regeneratePackForJob(args: {
  store: PackStore;
  jobId: string;
  feedback: string;
  model: ModelPort;
  templatesRoot: string;
  workspaceRoot: string;
}): Promise<RegenerateOutput> {
  const { store, jobId, feedback, model, templatesRoot } = args;
  const pack = store.readPack(jobId);
  if (!pack.exists) {
    throw new Error(`No output directory for job: ${jobId}`);
  }

  const inputs = store.loadJobInputs(jobId);
  const companyProfile = pack.companyProfile ?? '';
  const painPoints = pack.painPoints ?? '';
  const mapping = pack.mapping ?? '';
  const currentSummary = pack.summary ?? '';
  const currentExperienceBullets = pack.experienceBullets ?? '';
  const currentCoverLetter = pack.coverLetter ?? '';

  if (!currentSummary || !currentExperienceBullets || !currentCoverLetter) {
    throw new Error(
      'Missing current summary, experience bullets, or cover letter. Run full generate first.'
    );
  }
  if (!mapping) {
    throw new Error('Missing mapping. Run full generate first.');
  }

  store.setProgress(jobId, 'regenerate');

  try {
    const rendered = preparePrompt(
      'regenerate',
      {
        jd: inputs.jd,
        companyProfile: companyProfile || EMPTY_PLACEHOLDER,
        painPoints: painPoints || EMPTY_PLACEHOLDER,
        mapping,
        currentSummary,
        currentExperienceBullets,
        currentCoverLetter,
        feedback:
          feedback.trim() ||
          'Please improve alignment with the JD and company without adding new claims.',
      },
      templatesRoot
    );

    const rawPath = join(store.outDir(jobId), 'regenerate.raw.json');
    const result = await model.generateJson(rendered, RegenerateOutputSchema, 3, rawPath);

    const experienceRaw = experiencesToRaw(result.experiences);
    const parsed = parseStepOutput('experience-bullets', experienceRaw);
    store.writeArtifacts(jobId, {
      summary: result.summary,
      experienceBulletsRaw: experienceRaw,
      experienceBullets: parsed.extracted ?? '',
      coverLetter: result.coverLetter,
      regenerateFeedback: result.feedbackResponse,
    });

    store.setProgress(jobId, 'review');
    store.updateStepStatus(jobId, 'review', 'pending');
    await runReview({ store, jobId, model, templatesRoot, forceRun: true });
    return result;
  } finally {
    store.setProgress(jobId, null);
  }
}
