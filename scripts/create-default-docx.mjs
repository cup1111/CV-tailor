/**
 * One-off script to create templates/resume/default.docx with placeholders.
 * Run: node scripts/create-default-docx.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'templates', 'resume');
const outPath = join(outDir, 'default.docx');

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Summary:</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{summary}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Experience 1:</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{experience_1}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Experience 2:</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{experience_2}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Experience 3:</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{experience_3}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Experience 4:</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{experience_4}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Experience 5:</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{experience_5}}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/><w:docGrid w:linePitch="360"/></w:sectPr>
  </w:body>
</w:document>`;

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const zip = new PizZip();
zip.file('[Content_Types].xml', contentTypes);
zip.file('_rels/.rels', rels);
zip.file('word/document.xml', documentXml);

const buffer = zip.generate({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});

writeFileSync(outPath, buffer);
console.log('Created:', outPath);
