#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC_MAP = path.join(ROOT, 'docs', 'README.md');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const relative = path.relative(ROOT, full).split(path.sep).join('/');
    if (entry.isDirectory() && (relative === '.git' || relative === '.tmp' || relative === '.claude')) return [];
    if (entry.isDirectory()) return listFiles(full);
    return [full];
  });
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function isExpectedMarkdownLocation(file) {
  return (
    file === 'README.md' ||
    file === 'CATALOG.md' ||
    file === 'WEBSITE_UX_TEST.md' ||
    file === 'site/README.md' ||
    file === 'docs/README.md' ||
    /^knowledge\/(SCHEMA|index|log)\.md$/.test(file) ||
    /^knowledge\/wiki\/[^/]+\.md$/.test(file) ||
    /^docs\/(user|planning|reference|corpus|skills|agent)\/[^/]+\.md$/.test(file) ||
    /^docs\/planning\/archive\/[^/]+\.md$/.test(file) ||
    /^docs\/demo\/[^/]+\/[^/]+\.md$/.test(file) ||
    /^examples\/.+\.md$/.test(file) ||
    /^recipes\/[^/]+\/[^/]+\/[^/]+\/(README|CATALOG|weirdness-and-mitigations)\.md$/.test(file) ||
    /^config-catalog\/package-extras\/[^/]+\/[^/]+\/[^/]+\/README\.md$/.test(file) ||
    /^packages\/[^/]+\/[^/]+\/[^/]+\/README\.md$/.test(file) ||
    /^packages\/[^/]+\/[^/]+\/[^/]+\/prerequisites\/[^/]+\/README\.md$/.test(file) ||
    /^data\/.+\.md$/.test(file) ||
    /^runs\/.+\.md$/.test(file) ||
    /^tests\/[^/]+\.md$/.test(file)
  );
}

function linkTargetExists(source, target) {
  if (
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('mailto:') ||
    target.startsWith('#')
  ) {
    return true;
  }

  const cleanTarget = target.split('#')[0];
  if (!cleanTarget) return true;

  const resolved = path.resolve(path.dirname(source), cleanTarget);
  return fs.existsSync(resolved);
}

const markdownFiles = listFiles(ROOT)
  .map(rel)
  .filter((file) => file.endsWith('.md'))
  .filter((file) => !file.startsWith('.git/'))
  .filter((file) => !file.startsWith('.tmp/'))
  .filter((file) => !file.startsWith('.claude/'))
  // These are immutable copies/exports of upstream Kubara catalogs, not
  // helm-expt documentation. Preserve their upstream-relative links verbatim.
  .filter((file) => !file.startsWith('data/kubara-catalog-snapshots/'))
  .filter((file) => !file.startsWith('data/kubara-catalog-adapter/exports/'))
  // Retained upstream trees are unmodified copies pinned by checksum; their
  // digest-index compilers verify them byte-for-byte, so editing them to fit
  // documentation rules would break the retention.
  .filter((file) => !/^examples\/aicr\/[^/]+\/upstream\//.test(file))
  .sort();

for (const file of markdownFiles) {
  const full = path.join(ROOT, file);
  const text = fs.readFileSync(full, 'utf8');

  if (!file.startsWith('runs/') && !/^# /m.test(text)) {
    fail(`Markdown file is missing an H1: ${file}`);
  }

  if (!isExpectedMarkdownLocation(file)) {
    fail(`Markdown file is in an unexpected location: ${file}`);
  }

  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1].trim();
    if (!linkTargetExists(full, target)) {
      fail(`Broken markdown link in ${file}: ${target}`);
    }
  }
}

const currentGuideFiles = markdownFiles.filter(
  (file) => file === 'README.md' || /^docs\/(user|reference|corpus)\//.test(file),
);
const unsupportedCurrentCommands = [
  [/\bcub gitops\b/, 'cub gitops'],
  [/\bcub unit import\b/, 'cub unit import'],
  [/(?:^|[^A-Za-z])cub install(?:\s|`|$)/m, 'cub install'],
  [/\bcub helm setup\b/, 'cub helm setup'],
  [/\bctc test\b/, 'ctc test'],
];

for (const file of currentGuideFiles) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const [pattern, command] of unsupportedCurrentCommands) {
    if (pattern.test(text)) fail(`Current documentation names an unsupported command (${command}): ${file}`);
  }
}

const docMap = fs.readFileSync(DOC_MAP, 'utf8');
const topLevelDocs = markdownFiles
  .filter((file) => /^docs\/(user|planning|reference|corpus|skills|agent)\/[^/]+\.md$/.test(file))
  .filter((file) => file !== 'docs/README.md');

for (const file of topLevelDocs) {
  const target = file.slice('docs/'.length);
  if (!docMap.includes(`(${target})`) && !docMap.includes(`(./${target})`)) {
    fail(`docs/README.md does not assign a role to ${file}`);
  }
}

console.log(`verified documentation map for ${markdownFiles.length} markdown file(s)`);
