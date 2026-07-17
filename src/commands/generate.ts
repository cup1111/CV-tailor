import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import pLimit from 'p-limit';
import { OpenAIService } from '../services/openai.js';
import { Profile, ProfileSchema } from '../types/profile.js';
import {
  createApplicationPackModule,
  type ApplicationPackModule,
} from '../application-pack/index.js';

function loadProfile(): Profile {
  const profilePath = join(process.cwd(), 'profile.yaml');
  if (!existsSync(profilePath)) {
    throw new Error('profile.yaml not found. Please create it first.');
  }
  const content = readFileSync(profilePath, 'utf-8');
  const yaml = load(content);
  return ProfileSchema.parse(yaml);
}

function createModel(): OpenAIService {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  const model = process.env.OPENAI_MODEL || 'gpt-5.2';
  const responsesModel = process.env.OPENAI_RESPONSES_MODEL || 'gpt-4o';
  return new OpenAIService({ apiKey, model, responsesModel });
}

/**
 * Generate command — thin CLI adapter over the Application Pack module.
 */
export async function generateCommand(options: {
  job?: string;
  concurrency?: number;
  pack?: ApplicationPackModule;
}) {
  const openai = createModel();
  const pack = options.pack ?? createApplicationPackModule();
  const profile = loadProfile();

  let jobIds: string[];
  if (options.job) {
    jobIds = [options.job];
  } else {
    const allIds = pack.listJobIds();
    if (allIds.length === 0) {
      console.log('No job descriptions found. Run "pnpm ingest" first.');
      return;
    }
    jobIds = allIds.filter((id) => !pack.isStepCompleted(id, 'review'));
    if (jobIds.length === 0) {
      console.log('All jobs already completed. Nothing to generate.');
      return;
    }
    if (jobIds.length < allIds.length) {
      console.log(`Skipping ${allIds.length - jobIds.length} already completed job(s).`);
    }
  }

  const concurrency = options.concurrency || 1;
  const limit = pLimit(concurrency);

  console.log(
    `🚀 Starting generation for ${jobIds.length} job(s) with concurrency ${concurrency}`
  );

  await Promise.all(
    jobIds.map((jobId) =>
      limit(async () => {
        console.log(`\n🔄 Processing job: ${jobId}`);
        const { reviewFailed } = await pack.generatePack(jobId, {
          profile,
          model: openai,
        });
        if (reviewFailed) {
          console.log(
            `⚠️ Review returned FAIL. Use the "Regenerate" button in the UI to re-run with feedback.`
          );
        }
        console.log(`✅ Job ${jobId} completed!\n`);
      })
    )
  );

  console.log(`\n🎉 All jobs completed!`);
}
