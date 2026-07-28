import { cpSync, existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { PagesPort } from '../application-pack/resume-export.js';

const execFileAsync = promisify(execFile);

function escapeAppleScriptString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '" & return & "');
}

async function runOsascript(source: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-e', source], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

/**
 * macOS Pages adapter: list Placeholder Text tags and fill a Layout copy to .pages + .pdf.
 */
export function createPagesPort(): PagesPort {
  return {
    async listPlaceholderTags(layoutPath: string): Promise<string[]> {
      if (!existsSync(layoutPath)) {
        throw new Error(`Resume Layout not found: ${layoutPath}`);
      }
      const script = `
tell application "Pages"
  set theDoc to open POSIX file "${escapeAppleScriptString(layoutPath)}"
  set theTags to tag of every placeholder text of theDoc
  close theDoc saving no
  set AppleScript's text item delimiters to linefeed
  return theTags as text
end tell
`;
      const out = await runOsascript(script);
      if (!out) return [];
      return out.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    },

    async fillAndExport(args) {
      const { layoutPath, fills, pagesOutPath, pdfOutPath } = args;
      if (!existsSync(layoutPath)) {
        throw new Error(`Resume Layout not found: ${layoutPath}`);
      }
      cpSync(layoutPath, pagesOutPath, { recursive: true });

      const setLines = Object.entries(fills)
        .map(
          ([tag, value]) =>
            `set (every placeholder text whose tag is "${escapeAppleScriptString(tag)}") to "${escapeAppleScriptString(value)}"`
        )
        .join('\n    ');

      const script = `
tell application "Pages"
  set theDoc to open POSIX file "${escapeAppleScriptString(pagesOutPath)}"
  tell theDoc
    ${setLines}
  end tell
  export theDoc to POSIX file "${escapeAppleScriptString(pdfOutPath)}" as PDF
  close theDoc saving yes
end tell
`;
      await runOsascript(script);
    },
  };
}
