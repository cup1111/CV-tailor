import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  PainPointsOutput,
  ExperienceBulletsOutput,
  SummaryOutput,
  CoverLetterOutput,
} from '../types/outputs.js';
import { Profile } from '../types/profile.js';

/**
 * 渲染 Markdown 简历
 */
export function renderResume(
  jobId: string,
  profile: Profile,
  painPoints: PainPointsOutput,
  experienceBullets: ExperienceBulletsOutput,
  summary: SummaryOutput,
  coverLetter: CoverLetterOutput
): string {
  const sections: string[] = [];

  // 个人信息
  sections.push('# Resume\n');
  sections.push(`**${profile.personal.name}**`);
  if (profile.personal.email) {
    sections.push(`Email: ${profile.personal.email}`);
  }
  if (profile.personal.phone) {
    sections.push(`Phone: ${profile.personal.phone}`);
  }
  if (profile.personal.linkedin) {
    sections.push(`LinkedIn: ${profile.personal.linkedin}`);
  }
  sections.push('');

  // 摘要
  sections.push('## Summary\n');
  sections.push(summary.summary);
  sections.push('');

  // 工作经历
  sections.push('## Professional Experience\n');
  for (const exp of experienceBullets.experiences) {
    sections.push(`### ${exp.role} at ${exp.company}\n`);
    for (const bullet of exp.bullets) {
      sections.push(`- ${bullet}`);
    }
    sections.push('');
  }

  // 教育背景
  if (profile.education && profile.education.length > 0) {
    sections.push('## Education\n');
    for (const edu of profile.education) {
      sections.push(`### ${edu.degree}`);
      if (edu.field) {
        sections.push(`*${edu.field}*`);
      }
      sections.push(`${edu.school}`);
      if (edu.startDate || edu.endDate) {
        sections.push(`${edu.startDate || ''} - ${edu.endDate || ''}`);
      }
      sections.push('');
    }
  }

  // 技能
  if (profile.skills && profile.skills.length > 0) {
    sections.push('## Skills\n');
    sections.push(profile.skills.join(', '));
    sections.push('');
  }

  // 求职信
  sections.push('---\n');
  sections.push('## Cover Letter\n');
  sections.push(coverLetter.coverLetter);

  return sections.join('\n');
}

/**
 * 读取输出文件并渲染简历
 */
export function generateResumeMarkdown(jobId: string, profile: Profile): void {
  const outputDir = join(process.cwd(), 'out', jobId);

  // 读取所有 JSON 输出
  const painPointsPath = join(outputDir, 'pain-points.json');
  const experienceBulletsPath = join(outputDir, 'experience-bullets.json');
  const summaryPath = join(outputDir, 'summary.json');
  const coverLetterPath = join(outputDir, 'cover-letter.json');

  if (!existsSync(painPointsPath)) {
    throw new Error(`Pain points not found for job ${jobId}`);
  }
  if (!existsSync(experienceBulletsPath)) {
    throw new Error(`Experience bullets not found for job ${jobId}`);
  }
  if (!existsSync(summaryPath)) {
    throw new Error(`Summary not found for job ${jobId}`);
  }
  if (!existsSync(coverLetterPath)) {
    throw new Error(`Cover letter not found for job ${jobId}`);
  }

  const painPoints: PainPointsOutput = JSON.parse(
    readFileSync(painPointsPath, 'utf-8')
  );
  const experienceBullets: ExperienceBulletsOutput = JSON.parse(
    readFileSync(experienceBulletsPath, 'utf-8')
  );
  const summary: SummaryOutput = JSON.parse(
    readFileSync(summaryPath, 'utf-8')
  );
  const coverLetter: CoverLetterOutput = JSON.parse(
    readFileSync(coverLetterPath, 'utf-8')
  );

  // 渲染 Markdown
  const markdown = renderResume(
    jobId,
    profile,
    painPoints,
    experienceBullets,
    summary,
    coverLetter
  );

  // 写入文件
  const resumePath = join(outputDir, 'resume.md');
  writeFileSync(resumePath, markdown, 'utf-8');
  console.log(`✓ Resume markdown generated: ${resumePath}`);
}
