import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const sourcePatch = readFileSync('.codex-dynamic-i18n.patch', 'utf8').replaceAll('\r\n', '\n');
const fileSections = sourcePatch.split(/(?=^diff --git )/m).filter(Boolean);
const generatedDiffs = [];
const temporaryFiles = [];

for (const section of fileSections) {
  const match = section.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
  if (!match) throw new Error('Invalid file section in source patch');
  const sourcePath = match[1];
  const temporaryPath = `${sourcePath}.i18n-tmp`;
  let content = readFileSync(sourcePath, 'utf8').replaceAll('\r\n', '\n');
  const hunks = section.split(/^@@[^\n]*@@[^\n]*\n/m).slice(1);

  for (const hunk of hunks) {
    const lines = hunk.split('\n');
    while (lines.length > 0 && /^diff --git /.test(lines.at(-1) ?? '')) lines.pop();
    const oldText = lines
      .filter((line) => line.startsWith(' ') || line.startsWith('-'))
      .map((line) => line.slice(1))
      .join('\n');
    const newText = lines
      .filter((line) => line.startsWith(' ') || line.startsWith('+'))
      .map((line) => line.slice(1))
      .join('\n');
    if (!content.includes(oldText)) {
      throw new Error(`Expected hunk not found in ${sourcePath}: ${oldText.slice(0, 80)}`);
    }
    content = content.replace(oldText, newText);
  }

  writeFileSync(temporaryPath, content, 'utf8');
  temporaryFiles.push(temporaryPath);
  const diffResult = spawnSync(
    'git',
    ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--', sourcePath, temporaryPath],
    { encoding: 'utf8' },
  );
  if (![0, 1].includes(diffResult.status ?? -1)) throw new Error(diffResult.stderr);
  generatedDiffs.push(diffResult.stdout.replaceAll(`b/${temporaryPath}`, `b/${sourcePath}`));
}

writeFileSync('.codex-generated.patch', generatedDiffs.join(''), 'utf8');
const applyResult = spawnSync(
  'git',
  ['apply', '--recount', '--whitespace=nowarn', '.codex-generated.patch'],
  { encoding: 'utf8' },
);
if (applyResult.status !== 0) throw new Error(applyResult.stderr);
for (const path of temporaryFiles) unlinkSync(path);
unlinkSync('.codex-generated.patch');
