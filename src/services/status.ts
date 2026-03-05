import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { StatusSchema, StepStatus, Status } from '../types/outputs.js';

/**
 * 获取状态文件路径
 */
function getStatusPath(jobId: string): string {
  return join(process.cwd(), 'out', jobId, 'status.json');
}

/**
 * 获取输出目录路径
 */
function getOutputDir(jobId: string): string {
  return join(process.cwd(), 'out', jobId);
}

/**
 * 读取状态
 */
export function readStatus(jobId: string): Status | null {
  const statusPath = getStatusPath(jobId);
  
  if (!existsSync(statusPath)) {
    return null;
  }

  try {
    const content = readFileSync(statusPath, 'utf-8');
    const json = JSON.parse(content);
    return StatusSchema.parse(json);
  } catch (error) {
    console.warn(`Failed to read status for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 创建初始状态
 */
export function createStatus(jobId: string): Status {
  const now = new Date().toISOString();
  const status: Status = {
    jobId,
    steps: {
      companyResearch: 'pending',
      painPoints: 'pending',
      mapping: 'pending',
      experienceBullets: 'pending',
      summary: 'pending',
      coverLetter: 'pending',
      review: 'pending',
      render: 'pending',
    },
    createdAt: now,
    updatedAt: now,
  };

  writeStatus(jobId, status);
  return status;
}

/**
 * 写入状态
 */
export function writeStatus(jobId: string, status: Status): void {
  const outputDir = getOutputDir(jobId);
  const statusPath = getStatusPath(jobId);

  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 更新更新时间
  status.updatedAt = new Date().toISOString();

  writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf-8');
}

/**
 * 更新步骤状态
 */
export function updateStepStatus(
  jobId: string,
  step: keyof Status['steps'],
  stepStatus: StepStatus
): void {
  let status = readStatus(jobId);
  
  if (!status) {
    status = createStatus(jobId);
  }

  status.steps[step] = stepStatus;
  writeStatus(jobId, status);
}

/**
 * 检查步骤是否已完成
 */
export function isStepCompleted(jobId: string, step: keyof Status['steps']): boolean {
  const status = readStatus(jobId);
  return status?.steps[step] === 'completed';
}

/**
 * 获取或创建状态
 */
export function getOrCreateStatus(jobId: string): Status {
  const status = readStatus(jobId);
  return status ?? createStatus(jobId);
}
