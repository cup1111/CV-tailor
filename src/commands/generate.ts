import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import pLimit from 'p-limit';
import { OpenAIService } from '../services/openai.js';
import { loadTemplate, renderTemplate } from '../services/template.js';
import {
  getOrCreateStatus,
  updateStepStatus,
  isStepCompleted,
} from '../services/status.js';
import { regenerateResumeContent } from '../services/regenerate.js';
// import { generateResumeMarkdown } from '../services/renderer.js'; // 暂时不使用完整简历生成
import { Profile, ProfileSchema } from '../types/profile.js';
import { JobDescription, JobInputs } from '../types/job.js';

/**
 * 读取 profile.yaml
 */
function loadProfile(): Profile {
  const profilePath = join(process.cwd(), 'profile.yaml');
  if (!existsSync(profilePath)) {
    throw new Error('profile.yaml not found. Please create it first.');
  }

  const content = readFileSync(profilePath, 'utf-8');
  const yaml = load(content);
  return ProfileSchema.parse(yaml);
}

/**
 * 从响应中提取 || 标记之间的经历要点
 */
function extractExperienceBullets(response: string): string {
  const sections: string[] = [];
  const regex = /\|\|([\s\S]*?)\|\|/g;
  let match;
  
  while ((match = regex.exec(response)) !== null) {
    const content = match[1].trim();
    if (content) {
      sections.push(content);
    }
  }
  
  return sections.join('\n\n');
}

const COMPANY_MARKER = '---COMPANY---';
const JD_MARKER = '---JD---';

function getPromptLang(): string {
  return process.env.LANG || process.env.PROMPT_LANG || 'en';
}

/**
 * 读取每个 job 的两项独立输入：公司信息 + JD
 * 存储方式兼容：（1）存在 jobs/{jobId}.company.txt 则公司信息从该文件读，JD 从 jobs/{jobId}.md 读；（2）否则从 jobs/{jobId}.md 解析，若含 ---JD--- 则前半为公司信息、后半为 JD，否则整份为 JD、公司信息为空。
 */
function loadJobInputs(jobId: string): JobInputs {
  const jdPath = join(process.cwd(), 'jobs', `${jobId}.md`);
  const companyPath = join(process.cwd(), 'jobs', `${jobId}.company.txt`);
  if (!existsSync(jdPath)) {
    throw new Error(`Job not found: ${jdPath}`);
  }

  let companyInfo = '';
  let jdText = '';

  if (existsSync(companyPath)) {
    companyInfo = readFileSync(companyPath, 'utf-8').trim();
    jdText = readFileSync(jdPath, 'utf-8').trim();
  } else {
    const content = readFileSync(jdPath, 'utf-8');
    const idx = content.indexOf(JD_MARKER);
    if (idx >= 0) {
      const before = content.slice(0, idx).trim();
      const after = content.slice(idx + JD_MARKER.length).trim();
      companyInfo = before.replace(new RegExp(`^${COMPANY_MARKER}\\s*`, 'i'), '').trim();
      jdText = after;
    } else {
      jdText = content.trim();
    }
  }

  return { companyInfo, jd: jdText };
}

/**
 * 读取 JD 文件（兼容旧逻辑，返回含 jd 与 companyInfo 的 JobDescription）
 */
function loadJobDescription(jobId: string): JobDescription {
  const inputs = loadJobInputs(jobId);
  const lines = inputs.jd.split('\n');
  let url: string | undefined;
  const urlLine = lines.find((line) => line.startsWith('URL:'));
  if (urlLine) {
    url = urlLine.replace('URL:', '').trim();
  }
  const jdLines = lines.filter((line) => !line.startsWith('URL:'));
  const jd = jdLines.join('\n').trim();
  return {
    company: 'Company',
    role: 'Role',
    url,
    jd,
    companyInfo: inputs.companyInfo || undefined,
  };
}

/**
 * 获取所有 job IDs
 */
function getAllJobIds(): string[] {
  const jobsDir = join(process.cwd(), 'jobs');
  if (!existsSync(jobsDir)) {
    return [];
  }

  return readdirSync(jobsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace('.md', ''));
}

/**
 * Step 1: 公司调研（产出「公司自己的内容」）
 * 用户输入的公司信息仅作为 Web Search 的搜索关键词，不作为普通 GPT 输入；必须使用 OpenAI Web Search 能力。
 */
async function generateCompanyResearch(
  openai: OpenAIService,
  jobId: string,
  companyInfo: string,
  jd: string
): Promise<void> {
  if (isStepCompleted(jobId, 'companyResearch')) {
    console.log(`⏭️  Skipping company research (already completed)`);
    return;
  }

  console.log(`🔍 Step 1/7: Company research...`);
  updateStepStatus(jobId, 'companyResearch', 'in_progress');

  const outputDir = join(process.cwd(), 'out', jobId);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const rawPath = join(outputDir, 'company-profile.raw.txt');
  const promptPath = join(outputDir, 'company-research.prompt.txt');

  try {
    let webSearchResults: string;
    if (companyInfo.trim()) {
      console.log(`   Using OpenAI Web Search for company keywords...`);
      webSearchResults = await openai.webSearch(companyInfo.trim(), 3);
    } else {
      webSearchResults =
        'No web search was performed (no company keywords provided). Use only the job description below to infer company context.';
    }

    const template = loadTemplate('company-research', getPromptLang());
    const rendered = renderTemplate(template, { webSearchResults, jd });
    const { text, finishReason } = await openai.generateTextWithMeta(rendered, 3, promptPath);
    writeFileSync(rawPath, text, 'utf-8');
    if (finishReason === 'length') {
      writeFileSync(join(outputDir, 'company-profile.truncated'), '1', 'utf-8');
    }

    updateStepStatus(jobId, 'companyResearch', 'completed');
    console.log(`✓ Company research generated`);
  } catch (error) {
    updateStepStatus(jobId, 'companyResearch', 'failed');
    throw error;
  }
}

/**
 * Step 2: 生成痛点
 */
async function generatePainPoints(
  openai: OpenAIService,
  jobId: string,
  jdText: string,
  companyProfile: string
): Promise<void> {
  if (isStepCompleted(jobId, 'painPoints')) {
    console.log(`⏭️  Skipping pain points (already completed)`);
    return;
  }

  console.log(`📊 Step 2/7: Generating pain points...`);
  updateStepStatus(jobId, 'painPoints', 'in_progress');

  try {
    const template = loadTemplate('pain-points', getPromptLang());
    const rendered = renderTemplate(template, {
      jd: jdText,
      companyProfile,
    });

    const outputDir = join(process.cwd(), 'out', jobId);
    const rawResponsePath = join(outputDir, 'pain-points.raw.txt');
    const promptPath = join(outputDir, 'pain-points.prompt.txt');

    const { text, finishReason } = await openai.generateTextWithMeta(rendered, 3, promptPath);
    writeFileSync(rawResponsePath, text, 'utf-8');
    if (finishReason === 'length') {
      writeFileSync(join(outputDir, 'pain-points.truncated'), '1', 'utf-8');
    }

    updateStepStatus(jobId, 'painPoints', 'completed');
    console.log(`✓ Pain points generated`);
  } catch (error) {
    updateStepStatus(jobId, 'painPoints', 'failed');
    throw error;
  }
}

/** 按 JD 重要程度分配 bullet 条数的说明（中文） */
const BULLET_ALLOCATION_INSTRUCTION_ZH =
  '请根据 JD 与痛点，为下面 EXPERIENCE LIST 中的每条经历分配 bullet 条数与字数要求。原则：与 JD/痛点越相关的经历分配越多条（1–4 条）。约束：每条经历 1–4 条；第一条经历至少 2 条；全部经历总条数建议 10–14（经历少于 4 段时可 8–12）；字数写 "20-25" 或 "25-30"。若提供了公司画像，对第一条经历在要求末尾加：For the first experience add 1–2 bullets tied to the target company if company profile provided. 输出格式：每行一条，形如 Experience N (公司 - 角色): Write EXACTLY X bullet point(s), each approximately Y words. [首条可加上述额外句]';

/** 按 JD 重要程度分配 bullet 条数的说明（英文） */
const BULLET_ALLOCATION_INSTRUCTION_EN =
  'Allocate bullet counts per experience based on relevance to the JD and pain points. More relevant experiences get more bullets (1–4 each). Constraints: 1–4 bullets per experience; first experience at least 2; total bullets 10–14 (or 8–12 if fewer than 4 experiences). Word count per bullet: "20-25" or "25-30". For the first experience, if company profile was provided, append: For the first experience add 1–2 bullets tied to the target company if company profile provided. Output one line per experience: Experience N (Company - Role): Write EXACTLY X bullet point(s), each approximately Y words.';

/**
 * 从 profile 构建「每条经历写作要求」和「经历列表」，供 mapping 输出后给 Step 4/regenerate 使用
 */
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

/**
 * 构建 mapping 中 PER-EXPERIENCE BULLET REQUIREMENTS 段的占位内容：
 * 若启用 autoAllocateBullets 则传入「按说明生成」的指引，否则传入「照抄」的固定 block。
 */
function buildBulletRequirementsSection(profile: Profile): string {
  const { bulletRequirements, experienceList } = buildBulletRequirementsAndExperienceList(profile);
  const lang = getPromptLang();
  if (profile.autoAllocateBullets) {
    const instruction =
      lang === 'en' ? BULLET_ALLOCATION_INSTRUCTION_EN : BULLET_ALLOCATION_INSTRUCTION_ZH;
    return (
      'Generate the PER-EXPERIENCE BULLET REQUIREMENTS block yourself according to the following instructions. Do NOT copy a pre-written block; write one line per experience in EXPERIENCE LIST with your chosen bullet count and word count.\n\n' +
      instruction
    );
  }
  return (
    'Copy the following block EXACTLY (do not modify):\n\n' +
    bulletRequirements
  );
}

/**
 * Step 3: 经历映射（唯一使用 profile 的步骤；输出含 CANDIDATE SUMMARY + BULLET REQUIREMENTS + EXPERIENCE LIST 供后续仅用 mapping）
 */
async function generateMapping(
  openai: OpenAIService,
  jobId: string,
  companyProfile: string,
  jdText: string,
  painPoints: string,
  profile: Profile
): Promise<void> {
  if (isStepCompleted(jobId, 'mapping')) {
    console.log(`⏭️  Skipping mapping (already completed)`);
    return;
  }

  console.log(`🗺️  Step 3/7: Generating mapping...`);
  updateStepStatus(jobId, 'mapping', 'in_progress');

  const { experienceList } = buildBulletRequirementsAndExperienceList(profile);
  const bulletRequirementsSection = buildBulletRequirementsSection(profile);

  try {
    const template = loadTemplate('mapping', getPromptLang());
    const rendered = renderTemplate(template, {
      companyProfile,
      jd: jdText,
      painPoints,
      candidateExperience: JSON.stringify(profile.experiences, null, 2),
      bulletRequirementsSection,
      experienceList,
    });

    const outputDir = join(process.cwd(), 'out', jobId);
    const rawPath = join(outputDir, 'mapping.raw.txt');
    const promptPath = join(outputDir, 'mapping.prompt.txt');

    const { text, finishReason } = await openai.generateTextWithMeta(rendered, 3, promptPath);
    writeFileSync(rawPath, text, 'utf-8');
    if (finishReason === 'length') {
      writeFileSync(join(outputDir, 'mapping.truncated'), '1', 'utf-8');
    }

    updateStepStatus(jobId, 'mapping', 'completed');
    console.log(`✓ Mapping generated`);
  } catch (error) {
    updateStepStatus(jobId, 'mapping', 'failed');
    throw error;
  }
}

/**
 * Step 4: 生成经历要点（仅用 mapping，mapping 中已含 PER-EXPERIENCE BULLET REQUIREMENTS 与证据）
 */
async function generateExperienceBullets(
  openai: OpenAIService,
  jobId: string,
  jdText: string,
  painPoints: string,
  companyProfile: string,
  mapping: string
): Promise<void> {
  if (isStepCompleted(jobId, 'experienceBullets')) {
    console.log(`⏭️  Skipping experience bullets (already completed)`);
    return;
  }

  console.log(`📝 Step 4/7: Generating experience bullets...`);
  updateStepStatus(jobId, 'experienceBullets', 'in_progress');

  try {
    const template = loadTemplate('experience-bullets', getPromptLang());
    const rendered = renderTemplate(template, {
      jd: jdText,
      painPoints,
      companyProfile,
      mapping,
    });

    const outputDir = join(process.cwd(), 'out', jobId);
    const rawResponsePath = join(outputDir, 'experience-bullets.raw.txt');
    const extractedPath = join(outputDir, 'experience-bullets.extracted.txt');
    const promptPath = join(outputDir, 'experience-bullets.prompt.txt');
    
    // 使用 generateText 而不是 generateJson，因为不再需要 JSON 格式
    const result = await openai.generateText(rendered, 3, promptPath);

    // 保存原始响应
    writeFileSync(rawResponsePath, result, 'utf-8');
    
    // 提取 || 标记之间的内容
    const extractedContent = extractExperienceBullets(result);
    writeFileSync(extractedPath, extractedContent, 'utf-8');

    updateStepStatus(jobId, 'experienceBullets', 'completed');
    console.log(`✓ Experience bullets generated`);
  } catch (error) {
    updateStepStatus(jobId, 'experienceBullets', 'failed');
    throw error;
  }
}

/**
 * Step 5: 生成摘要（仅用 mapping，其中 CANDIDATE SUMMARY 含足够候选人信息）
 */
async function generateSummary(
  openai: OpenAIService,
  jobId: string,
  jdText: string,
  painPoints: string,
  experienceBullets: string,
  companyProfile: string,
  mapping: string
): Promise<void> {
  if (isStepCompleted(jobId, 'summary')) {
    console.log(`⏭️  Skipping summary (already completed)`);
    return;
  }

  console.log(`📄 Step 5/7: Generating summary...`);
  updateStepStatus(jobId, 'summary', 'in_progress');

  try {
    const template = loadTemplate('summary', getPromptLang());
    const rendered = renderTemplate(template, {
      jd: jdText,
      painPoints,
      companyProfile,
      mapping,
    });

    const outputDir = join(process.cwd(), 'out', jobId);
    const rawResponsePath = join(outputDir, 'summary.raw.txt');
    const promptPath = join(outputDir, 'summary.prompt.txt');
    
    // 使用 generateText 而不是 generateJson，因为不再需要 JSON 格式
    const result = await openai.generateText(rendered, 3, promptPath);

    // 保存原始响应
    writeFileSync(rawResponsePath, result, 'utf-8');

    updateStepStatus(jobId, 'summary', 'completed');
    console.log(`✓ Summary generated`);
  } catch (error) {
    updateStepStatus(jobId, 'summary', 'failed');
    throw error;
  }
}

/**
 * Step 6: 生成求职信（仅用 mapping，其中 CANDIDATE SUMMARY 含足够候选人信息）
 */
async function generateCoverLetter(
  openai: OpenAIService,
  jobId: string,
  jdText: string,
  painPoints: string,
  summary: string,
  experienceBullets: string,
  mapping: string
): Promise<void> {
  if (isStepCompleted(jobId, 'coverLetter')) {
    console.log(`⏭️  Skipping cover letter (already completed)`);
    return;
  }

  console.log(`✉️  Step 6/7: Generating cover letter...`);
  updateStepStatus(jobId, 'coverLetter', 'in_progress');

  try {
    const template = loadTemplate('cover-letter', getPromptLang());
    const rendered = renderTemplate(template, {
      jd: jdText,
      summary,
      painPoints,
      experienceBullets,
      mapping,
    });

    const outputDir = join(process.cwd(), 'out', jobId);
    const rawResponsePath = join(outputDir, 'cover-letter.raw.txt');
    const promptPath = join(outputDir, 'cover-letter.prompt.txt');
    
    // 使用 generateText 而不是 generateJson，因为不再需要 JSON 格式
    const result = await openai.generateText(rendered, 3, promptPath);

    // 保存原始响应
    writeFileSync(rawResponsePath, result, 'utf-8');

    updateStepStatus(jobId, 'coverLetter', 'completed');
    console.log(`✓ Cover letter generated`);
  } catch (error) {
    updateStepStatus(jobId, 'coverLetter', 'failed');
    throw error;
  }
}

/**
 * Step 7: 审查（可由 server 在重新生成后调用）
 */
export async function generateReview(
  openai: OpenAIService,
  jobId: string,
  companyProfile: string,
  painPoints: string,
  mapping: string,
  experienceBullets: string,
  summary: string,
  coverLetter: string,
  jdText: string,
  forceRun?: boolean
): Promise<void> {
  if (!forceRun && isStepCompleted(jobId, 'review')) {
    console.log(`⏭️  Skipping review (already completed)`);
    return;
  }

  console.log(`🔎 Step 7/7: Generating review...`);
  updateStepStatus(jobId, 'review', 'in_progress');

  try {
    const template = loadTemplate('review', getPromptLang());
    const rendered = renderTemplate(template, {
      companyProfile,
      painPoints,
      mapping,
      experienceBullets,
      summary,
      coverLetter,
      jd: jdText,
    });

    const outputDir = join(process.cwd(), 'out', jobId);
    const rawPath = join(outputDir, 'review.raw.txt');
    const promptPath = join(outputDir, 'review.prompt.txt');

    const result = await openai.generateText(rendered, 3, promptPath);
    writeFileSync(rawPath, result, 'utf-8');

    updateStepStatus(jobId, 'review', 'completed');
    console.log(`✓ Review generated`);
  } catch (error) {
    updateStepStatus(jobId, 'review', 'failed');
    throw error;
  }
}

/**
 * 渲染 Markdown (暂时禁用)
 */
// async function renderMarkdown(
//   jobId: string,
//   profile: Profile
// ): Promise<void> {
//   if (isStepCompleted(jobId, 'render')) {
//     console.log(`⏭️  Skipping render (already completed)`);
//     return;
//   }

//   console.log(`📄 Step 5/5: Rendering markdown resume...`);
//   updateStepStatus(jobId, 'render', 'in_progress');

//   try {
//     generateResumeMarkdown(jobId, profile);
//     updateStepStatus(jobId, 'render', 'completed');
//     console.log(`✓ Markdown resume rendered`);
//   } catch (error) {
//     updateStepStatus(jobId, 'render', 'failed');
//     throw error;
//   }
// }

/**
 * 处理单个 job（七步流程）
 */
async function processJob(
  openai: OpenAIService,
  jobId: string,
  profile: Profile
): Promise<void> {
  console.log(`\n🔄 Processing job: ${jobId}`);

  getOrCreateStatus(jobId);
  const inputs = loadJobInputs(jobId);
  const jdText = inputs.jd;
  const hasCompanyInfo = !!inputs.companyInfo.trim();

  // Step 1: 公司调研（有公司信息时才做 Web Search；无则仅基于 JD 分析，且后续步骤不把 company profile 放进 prompt）
  await generateCompanyResearch(openai, jobId, inputs.companyInfo, jdText);
  const companyProfileForPrompts = hasCompanyInfo
    ? readFileSync(join(process.cwd(), 'out', jobId, 'company-profile.raw.txt'), 'utf-8')
    : '';

  // Step 2: 痛点（无公司信息时 companyProfile 为空，仅用 JD 与痛点说明）
  await generatePainPoints(openai, jobId, jdText, companyProfileForPrompts);
  const painPointsText = readFileSync(
    join(process.cwd(), 'out', jobId, 'pain-points.raw.txt'),
    'utf-8'
  );

  // Step 3: 经历映射（唯一传入 profile 的步骤）
  await generateMapping(
    openai,
    jobId,
    companyProfileForPrompts,
    jdText,
    painPointsText,
    profile
  );
  const mappingText = readFileSync(
    join(process.cwd(), 'out', jobId, 'mapping.raw.txt'),
    'utf-8'
  );

  // Step 4: 经历要点（仅用 mapping）
  await generateExperienceBullets(
    openai,
    jobId,
    jdText,
    painPointsText,
    companyProfileForPrompts,
    mappingText
  );
  const experienceBulletsText = readFileSync(
    join(process.cwd(), 'out', jobId, 'experience-bullets.raw.txt'),
    'utf-8'
  );

  // Step 5: 摘要（仅用 mapping）
  await generateSummary(
    openai,
    jobId,
    jdText,
    painPointsText,
    experienceBulletsText,
    companyProfileForPrompts,
    mappingText
  );
  const summaryText = readFileSync(
    join(process.cwd(), 'out', jobId, 'summary.raw.txt'),
    'utf-8'
  );

  // Step 6: 求职信（仅用 mapping）
  await generateCoverLetter(
    openai,
    jobId,
    jdText,
    painPointsText,
    summaryText,
    experienceBulletsText,
    mappingText
  );
  const coverLetterText = readFileSync(
    join(process.cwd(), 'out', jobId, 'cover-letter.raw.txt'),
    'utf-8'
  );

  // Step 7: 审查
  await generateReview(
    openai,
    jobId,
    companyProfileForPrompts,
    painPointsText,
    mappingText,
    experienceBulletsText,
    summaryText,
    coverLetterText,
    jdText
  );

  // 若审查结果为 FAIL，自动跑一次重新生成（以审查内容为反馈），只跑一次
  const reviewPath = join(process.cwd(), 'out', jobId, 'review.raw.txt');
  const reviewText = readFileSync(reviewPath, 'utf-8').trim();
  const firstLine = reviewText.split(/\r?\n/)[0]?.trim().toUpperCase() || '';
  const isFail = firstLine === 'FAIL' || firstLine.startsWith('FAIL');
  if (isFail) {
    console.log(`⚠️ Review returned FAIL, running one auto-regenerate with feedback...`);
    console.log(`[Regenerate] Job ${jobId}: 1/2 更新摘要、经历要点、求职信...`);
    await regenerateResumeContent(openai, jobId, reviewText);
    console.log(`[Regenerate] Job ${jobId}: 2/2 运行审查...`);
    const summaryText2 = readFileSync(join(process.cwd(), 'out', jobId, 'summary.raw.txt'), 'utf-8');
    const experienceBulletsText2 = readFileSync(
      join(process.cwd(), 'out', jobId, 'experience-bullets.extracted.txt'),
      'utf-8'
    );
    const coverLetterText2 = readFileSync(
      join(process.cwd(), 'out', jobId, 'cover-letter.raw.txt'),
      'utf-8'
    );
    updateStepStatus(jobId, 'review', 'pending');
    await generateReview(
      openai,
      jobId,
      companyProfileForPrompts,
      painPointsText,
      mappingText,
      experienceBulletsText2,
      summaryText2,
      coverLetterText2,
      jdText,
      true
    );
    console.log(`[Regenerate] Job ${jobId}: 完成`);
  }

  console.log(`✅ Job ${jobId} completed!\n`);
}

/**
 * Generate 命令主函数
 */
export async function generateCommand(options: {
  job?: string;
  concurrency?: number;
}) {
  // 检查 OpenAI API Key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5.2';
  const responsesModel = process.env.OPENAI_RESPONSES_MODEL || 'gpt-4o';
  const openai = new OpenAIService({ apiKey, model, responsesModel });

  // 加载 profile
  const profile = loadProfile();

  // 确定要处理的 job IDs
  let jobIds: string[];
  if (options.job) {
    // 点击单条「生成」：始终重新生成该条
    jobIds = [options.job];
  } else {
    // 一键生成：跳过已生成完成的条目（以 review 步骤完成为准）
    const allIds = getAllJobIds();
    if (allIds.length === 0) {
      console.log('No job descriptions found. Run "pnpm ingest" first.');
      return;
    }
    jobIds = allIds.filter((id) => !isStepCompleted(id, 'review'));
    if (jobIds.length === 0) {
      console.log('All jobs already completed. Nothing to generate.');
      return;
    }
    if (jobIds.length < allIds.length) {
      console.log(`Skipping ${allIds.length - jobIds.length} already completed job(s).`);
    }
  }

  // 并发控制
  const concurrency = options.concurrency || 1;
  const limit = pLimit(concurrency);

  console.log(`🚀 Starting generation for ${jobIds.length} job(s) with concurrency ${concurrency}`);

  // 处理所有 jobs
  await Promise.all(
    jobIds.map((jobId) =>
      limit(() => processJob(openai, jobId, profile))
    )
  );

  console.log(`\n🎉 All jobs completed!`);
}
