import {
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  rmSync,
  statSync,
} from 'fs';
import { join } from 'path';

const ARCHIVE_DIR = 'archive';
const JOBS_DIR = 'jobs';
const OUT_DIR = 'out';

function getArchiveRoot(): string {
  return join(process.cwd(), ARCHIVE_DIR);
}

/** jobId 多为时间戳，转为 YYYY-MM-DD */
function getDateFromJobId(jobId: string): string {
  const n = Number(jobId);
  if (!Number.isNaN(n) && n > 0) {
    return new Date(n).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/** 单个 job 的存档目录：archive/YYYY-MM-DD/{jobId}/ */
export function getArchiveJobDir(jobId: string): string {
  const date = getDateFromJobId(jobId);
  return join(getArchiveRoot(), date, jobId);
}

/** 读取某 job 下所有文本并拼接，用于搜索 */
function readJobTextForSearch(archiveJobDir: string): string {
  if (!existsSync(archiveJobDir)) return '';
  const files = readdirSync(archiveJobDir);
  const parts: string[] = [];
  for (const f of files) {
    if (f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.json')) {
      try {
        parts.push(readFileSync(join(archiveJobDir, f), 'utf-8'));
      } catch {
        // skip
      }
    }
  }
  return parts.join('\n');
}

/** 从 jd.md 或内容取标题 */
function getTitleFromArchive(archiveJobDir: string): string {
  const jdPath = join(archiveJobDir, 'jd.md');
  if (!existsSync(jdPath)) return 'Untitled';
  try {
    const content = readFileSync(jdPath, 'utf-8');
    const lines = content.split('\n').filter((l) => !l.startsWith('URL:'));
    const text = lines.join('\n').trim();
    const first = text.replace(/\s+/g, ' ').trim().slice(0, 50);
    return first.length < text.length ? first + '...' : first || 'Untitled';
  } catch {
    return 'Untitled';
  }
}

/** 收集所有已存档的 (date, jobId)，按日期倒序、同日内 jobId 倒序 */
function collectArchivedJobs(): Array<{ date: string; jobId: string }> {
  const root = getArchiveRoot();
  if (!existsSync(root)) return [];
  const list: Array<{ date: string; jobId: string }> = [];
  const dates = readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  for (const date of dates) {
    const dateDir = join(root, date);
    if (!statSync(dateDir).isDirectory()) continue;
    const jobIds = readdirSync(dateDir).filter((id) => {
      const p = join(dateDir, id);
      return statSync(p).isDirectory();
    });
    jobIds.sort((a, b) => Number(b) - Number(a));
    for (const jobId of jobIds) {
      list.push({ date, jobId });
    }
  }
  return list;
}

export interface ArchiveJobItem {
  jobId: string;
  date: string;
  title: string;
  hasCompany: boolean;
}

export interface ArchiveListResult {
  groups: Array<{ date: string; jobs: ArchiveJobItem[] }>;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * 分页列出存档，按日分组；支持关键词全文搜索
 */
export function listArchive(options: {
  page: number;
  limit: number;
  keyword?: string;
}): ArchiveListResult {
  let list = collectArchivedJobs();
  const { page, limit, keyword } = options;

  if (keyword && keyword.trim()) {
    const k = keyword.trim().toLowerCase();
    const root = getArchiveRoot();
    list = list.filter(({ date, jobId }) => {
      const dir = join(root, date, jobId);
      const text = readJobTextForSearch(dir).toLowerCase();
      return text.includes(k);
    });
  }

  const total = list.length;
  const start = (page - 1) * limit;
  const pageList = list.slice(start, start + limit);
  const hasMore = start + pageList.length < total;

  const root = getArchiveRoot();
  const jobItems: ArchiveJobItem[] = pageList.map(({ date, jobId }) => {
    const dir = join(root, date, jobId);
    const hasCompany = existsSync(join(dir, 'company.txt'));
    return {
      jobId,
      date,
      title: getTitleFromArchive(dir),
      hasCompany,
    };
  });

  const groupsByDate = new Map<string, ArchiveJobItem[]>();
  for (const j of jobItems) {
    const arr = groupsByDate.get(j.date) || [];
    arr.push(j);
    groupsByDate.set(j.date, arr);
  }
  const groups = Array.from(groupsByDate.entries())
    .map(([date, jobs]) => ({ date, jobs }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    groups,
    total,
    page,
    limit,
    hasMore,
  };
}

/**
 * 将工作区的一个 job 移动到存档
 */
export function archiveJob(jobId: string): void {
  const jobsDir = join(process.cwd(), JOBS_DIR);
  const outDir = join(process.cwd(), OUT_DIR);
  const jdPath = join(jobsDir, `${jobId}.md`);
  const companyPath = join(jobsDir, `${jobId}.company.txt`);
  const outJobDir = join(outDir, jobId);

  if (!existsSync(jdPath)) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const date = getDateFromJobId(jobId);
  const destDir = join(getArchiveRoot(), date, jobId);
  if (!existsSync(getArchiveRoot())) {
    mkdirSync(getArchiveRoot(), { recursive: true });
  }
  const dateDir = join(getArchiveRoot(), date);
  if (!existsSync(dateDir)) {
    mkdirSync(dateDir, { recursive: true });
  }
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  renameSync(jdPath, join(destDir, 'jd.md'));
  if (existsSync(companyPath)) {
    renameSync(companyPath, join(destDir, 'company.txt'));
  }
  const trackPath = join(jobsDir, `${jobId}.track.txt`);
  if (existsSync(trackPath)) {
    renameSync(trackPath, join(destDir, 'track.txt'));
  }
  if (existsSync(outJobDir)) {
    const files = readdirSync(outJobDir);
    for (const f of files) {
      renameSync(join(outJobDir, f), join(destDir, f));
    }
    rmSync(outJobDir, { recursive: true, force: true });
  }
}

/**
 * 批量归档当前工作区所有 job
 */
export function archiveAllJobs(): string[] {
  const jobsDir = join(process.cwd(), JOBS_DIR);
  if (!existsSync(jobsDir)) return [];
  const files = readdirSync(jobsDir).filter((f) => f.endsWith('.md'));
  const jobIds = files.map((f) => f.replace('.md', ''));
  for (const jobId of jobIds) {
    archiveJob(jobId);
  }
  return jobIds;
}

/**
 * 在 archive 下查找 job 所在目录（按日期遍历）
 */
function findArchiveJobDir(jobId: string): string | null {
  const root = getArchiveRoot();
  if (!existsSync(root)) return null;
  const dates = readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  for (const date of dates) {
    const dir = join(root, date, jobId);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      return dir;
    }
  }
  return null;
}

/**
 * 从存档恢复到工作区
 */
export function restoreJob(jobId: string): void {
  const archiveJobDir = findArchiveJobDir(jobId);
  if (!archiveJobDir) {
    throw new Error(`Archived job not found: ${jobId}`);
  }

  const jobsDir = join(process.cwd(), JOBS_DIR);
  const outDir = join(process.cwd(), OUT_DIR);
  const jdPath = join(jobsDir, `${jobId}.md`);
  const companyPath = join(jobsDir, `${jobId}.company.txt`);
  const outJobDir = join(outDir, jobId);

  if (!existsSync(jobsDir)) mkdirSync(jobsDir, { recursive: true });
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  if (!existsSync(outJobDir)) mkdirSync(outJobDir, { recursive: true });

  const jdSrc = join(archiveJobDir, 'jd.md');
  if (existsSync(jdSrc)) {
    renameSync(jdSrc, jdPath);
  }
  const companySrc = join(archiveJobDir, 'company.txt');
  if (existsSync(companySrc)) {
    renameSync(companySrc, companyPath);
  }
  const trackSrc = join(archiveJobDir, 'track.txt');
  const trackPath = join(jobsDir, `${jobId}.track.txt`);
  if (existsSync(trackSrc)) {
    renameSync(trackSrc, trackPath);
  }

  for (const f of readdirSync(archiveJobDir)) {
    if (f === 'jd.md' || f === 'company.txt' || f === 'track.txt') continue;
    const src = join(archiveJobDir, f);
    if (statSync(src).isFile()) {
      renameSync(src, join(outJobDir, f));
    }
  }

  try {
    if (readdirSync(archiveJobDir).length === 0) {
      rmSync(archiveJobDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
  const dateDir = join(archiveJobDir, '..');
  try {
    if (existsSync(dateDir) && readdirSync(dateDir).length === 0) {
      rmSync(dateDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

/**
 * 获取单个存档 job 的文件列表与内容（用于存档区展开详情）
 */
export function getArchiveJobDetail(jobId: string): Record<string, string> | null {
  const dir = findArchiveJobDir(jobId);
  if (!dir) return null;
  const result: Record<string, string> = {};
  const files = readdirSync(dir);
  for (const f of files) {
    if (statSync(join(dir, f)).isFile()) {
      try {
        result[f] = readFileSync(join(dir, f), 'utf-8');
      } catch {
        result[f] = '';
      }
    }
  }
  return result;
}
