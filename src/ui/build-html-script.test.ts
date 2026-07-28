import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * buildHtml() embeds the page script inside a TS template literal.
 * A single '\n' in that template becomes a real newline in the served JS and
 * breaks parsing (heatmap/counter never run). Escaped '\\n' is required.
 */
describe('buildHtml inline script escaping', () => {
  const serverSrc = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

  it('escapes newline joins in archive sheet warning messages', () => {
    const goodSheetWarning =
      "UI.archiveSheetWarning + '" + '\\\\n' + "' + data.sheetWarning";
    const badSheetWarning =
      "UI.archiveSheetWarning + '" + '\\n' + "' + data.sheetWarning";
    const goodJoin = "sheetWarnings.join('" + '\\\\n' + "')";
    const badJoin = "sheetWarnings.join('" + '\\n' + "')";

    expect(serverSrc.includes(goodSheetWarning)).toBe(true);
    expect(serverSrc.includes(badSheetWarning)).toBe(false);
    expect(serverSrc.includes(goodJoin)).toBe(true);
    expect(serverSrc.includes(badJoin)).toBe(false);
  });
});
