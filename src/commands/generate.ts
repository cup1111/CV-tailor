import { loadActiveProfile } from '../services/track.js';
import pLimit from 'p-limit';
import { OpenAIService } from '../services/openai.js';
import type { Profile } from '../types/profile.js';
import {
  createApplicationPackModule,
  type ApplicationPackModule,
} from '../application-pack/index.js';

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
  profile?: Profile;
}) {
  const openai = createModel();
  const pack = options.pack ?? createApplicationPackModule();
  const profile = options.profile ?? loadActiveProfile(pack.workspaceRoot);

  let jobIds: string[];
  if (options.job) {
    jobIds = [options.job];
  } else {
    const allIds = pack.listJobIds();
    if (allIds.length === 0) {
      console.log('No job descriptions found. Run "pnpm ingest" first.');
      return;
    }
    jobIds = pack.listIncompleteJobIds();
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
    `🚀 Starting generation for ${jobIds.length} job(s) with concurrency ${concurrency} (track: ${pack.applicationTrackId})`
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
