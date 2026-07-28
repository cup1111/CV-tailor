import { z } from 'zod';

// Step 1: Pain Points
export const PainPointsOutputSchema = z.object({
  painPoints: z.array(z.string()),
});

export type PainPointsOutput = z.infer<typeof PainPointsOutputSchema>;

// Step 2: Experience Bullets
export const ExperienceBulletSchema = z.object({
  company: z.string(),
  role: z.string(),
  bullets: z.array(z.string()),
});

export const ExperienceBulletsOutputSchema = z.object({
  experiences: z.array(ExperienceBulletSchema),
});

export type ExperienceBullet = z.infer<typeof ExperienceBulletSchema>;
export type ExperienceBulletsOutput = z.infer<typeof ExperienceBulletsOutputSchema>;

// Step 3: Summary
export const SummaryOutputSchema = z.object({
  summary: z.string(),
});

export type SummaryOutput = z.infer<typeof SummaryOutputSchema>;

// Step 4: Cover Letter
export const CoverLetterOutputSchema = z.object({
  coverLetter: z.string(),
});

export type CoverLetterOutput = z.infer<typeof CoverLetterOutputSchema>;

// Status tracking
export const StepStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed']);

export const StatusSchema = z.object({
  jobId: z.string(),
  /** Present only when the latest Review Verdict is FAIL (advisory; does not block completeness). */
  reviewVerdict: z.literal('fail').optional(),
  steps: z.object({
    companyResearch: StepStatusSchema.optional(),
    painPoints: StepStatusSchema,
    experienceBullets: StepStatusSchema,
    mapping: StepStatusSchema.optional(),
    summary: StepStatusSchema,
    coverLetter: StepStatusSchema,
    review: StepStatusSchema.optional(),
    render: StepStatusSchema,
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StepStatus = z.infer<typeof StepStatusSchema>;
export type Status = z.infer<typeof StatusSchema>;
