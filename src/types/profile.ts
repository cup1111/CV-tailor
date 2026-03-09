import { z } from 'zod';

export const PersonalSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
});

export const ExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  startDate: z.string(),
  endDate: z.string().or(z.literal('Present')),
  description: z.string(), // 原始描述
  bulletCount: z.number().optional(), // 指定要生成的要点数量
  wordCount: z.union([z.string(), z.number()]).optional(), // 指定每个要点的字数（如 "20-25" 或 20 表示 20到25字）
});

export const EducationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const AdditionalInfoSchema = z.object({
  certifications: z.array(z.string()).optional(),
  awards: z.array(z.string()).optional(),
});

export const ProfileSchema = z.object({
  personal: PersonalSchema,
  experiences: z.array(ExperienceSchema),
  education: z.array(EducationSchema).optional(),
  skills: z.array(z.string()).optional(),
  additionalInfo: AdditionalInfoSchema.optional(),
  /** When true, mapping step allocates bullet count per experience by JD relevance; profile bulletCount is ignored. */
  autoAllocateBullets: z.boolean().optional(),
});

export type Personal = z.infer<typeof PersonalSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type AdditionalInfo = z.infer<typeof AdditionalInfoSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
