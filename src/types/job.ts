import { z } from 'zod';

/** 每个 job 的两项独立输入 */
export const JobInputsSchema = z.object({
  companyInfo: z.string(), // 公司信息，供 AI 做 Web 搜索
  jd: z.string(), // JD 正文
});

export type JobInputs = z.infer<typeof JobInputsSchema>;

export const JobDescriptionSchema = z.object({
  company: z.string(),
  role: z.string(),
  url: z.string().url().optional(),
  jd: z.string(), // Job Description text
  companyInfo: z.string().optional(), // 公司信息（与 jd 并列输入）
});

export type JobDescription = z.infer<typeof JobDescriptionSchema>;
