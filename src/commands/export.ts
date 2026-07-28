import { createApplicationPackModule } from '../application-pack/index.js';
import { createPagesPort } from '../services/pages-port.js';
import { loadProfileForTrack } from '../services/track.js';

export async function exportCommand(options: {
  job: string;
  directory?: string;
  setDirectory?: string;
}): Promise<void> {
  const pack = createApplicationPackModule();
  if (options.setDirectory) {
    pack.setExportDirectory(options.setDirectory);
    console.log(`✓ Export Directory set to: ${options.setDirectory}`);
  }

  const inputs = pack.loadJobInputs(options.job);
  const profile = loadProfileForTrack(pack.workspaceRoot, inputs.applicationTrack);
  const result = await pack.exportResume(options.job, {
    profile,
    exportDirectory: options.directory,
    pages: createPagesPort(),
  });
  console.log(`✓ Pages: ${result.pagesPath}`);
  console.log(`✓ PDF:   ${result.pdfPath}`);
}
