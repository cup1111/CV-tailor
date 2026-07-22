#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { ingestCommand } from './commands/ingest.js';
import { generateCommand } from './commands/generate.js';
import { exportCommand } from './commands/export.js';

// 加载环境变量
dotenv.config();

const program = new Command();

program
  .name('resume-pack-generator')
  .description('CLI tool to automate job application material generation')
  .version('1.0.0');

program
  .command('ingest')
  .description('Start local JD paste server')
  .option('-p, --port <port>', 'Server port', '3000')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    await ingestCommand(port);
  });

program
  .command('generate')
  .description('Generate resume packs')
  .option('-j, --job <jobId>', 'Generate for specific job ID')
  .option('-c, --concurrency <n>', 'Concurrency level', '1')
  .action(async (options) => {
    await generateCommand({
      job: options.job,
      concurrency: options.concurrency ? parseInt(options.concurrency, 10) : undefined,
    });
  });

program
  .command('export')
  .description('Resume Export: fill Pages Layout and write .pages + .pdf')
  .requiredOption('-j, --job <jobId>', 'Job ID to export')
  .option('-d, --directory <path>', 'One-off Export Directory override')
  .option('--set-directory <path>', 'Persist workspace Export Directory default')
  .action(async (options) => {
    await exportCommand({
      job: options.job,
      directory: options.directory,
      setDirectory: options.setDirectory,
    });
  });

program.parse();
