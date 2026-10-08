// Checks the `cub` commands that reader-facing sources show against a committed
// snapshot of the CLI's own --help text. It reads files only; it never runs cub.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./proof-common.mjs";

export const snapshotRelativePath = "tests/cub-help-surface.json";

// What a reader is told to run. Each entry is a git pathspec. The first group
// is authored; the second is generated from it, and is read as well because a
// generator can assemble a command from parts that no single source line shows.
export const readerFacingSources = [
  "README.md",
  "docs/user",
  "docs/agent",
  "data/workshop-guides/guides.yaml",
  "data/workshop-journeys/journeys.yaml",
  "scripts/generate-public-site.mjs",
  "scripts/site",
  "scripts/lib/entry-next-steps.mjs",
  "scripts/generate-catalog-listings.mjs",
  "scripts/generate-config-workshop-command-contract.mjs",
  "data/config-workshop-command-contract/command-map.json",
  "site",
];

// Files inside those sources that record what was run at the time. They keep
// the commands of the CLI they were run with, so the gate does not read them.
// Add a rule here only for a dated record, a transcript, a receipt, or a
// mirror of one.
export const historicalRecordRules = [
  {
    pattern: /^site\/d\//,
    reason:
      "site/d mirrors repository documents so that links resolve. The gate reads docs/user and docs/agent at source. The other mirrored directories hold plans, demo transcripts, reference records, and example receipts, which keep the commands of their time.",
  },
  {
    pattern: /^docs\/user\/.*\d{4}-\d{2}-\d{2}[^/]*\.md$/,
    reason: "A dated user document is a run log. It records one run on one day.",
  },
];

// Plugin commands the site names whose help the snapshot does not record. The
// gate accepts the name and checks nothing below it.
export const unrecordedPluginCommands = ["check", "commander", "demo", "eksinf", "scan", "scout", "server"];

// Names that contain the words of a command without being one. Each is a
// label that a report or a record prints.
export const reportLabels = ["cub installer source package"];

// A line of prose may name a command in order to say that it is gone, or that
// it is only proposed. The waiver never applies inside a shell code block or a
// shell script, where a command is something to run.
const notCurrentPattern =
  /\b(no longer has|no longer accepts|no longer takes|no longer offers|was removed|were removed|has been removed|is gone|are gone|retired|older CLI|earlier CLI|historical|at that time|used to (?:be|take|accept)|renamed|not a current|not current|future|planned|proposed|roadmap|not yet|does not exist|may become|candidate product)\b/i;

// Words that show a sentence rather than a command.
const proseWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "command", "commands", "does", "do", "for", "from",
  "group", "has", "have", "if", "in", "is", "it", "its", "on", "or", "over", "plugin", "plugins", "subcommand",
  "subcommands", "that", "the", "then", "to", "verb", "verbs", "was", "when", "which", "with", "will", "would", "no",
  "not", "now", "only", "also", "so", "than", "this", "these", "step", "steps", "flow", "path", "side", "surface",
]);

export function loadSnapshot() {
  const snapshot = JSON.parse(readFileSync(join(repoRoot, snapshotRelativePath), "utf8"));
  validateSnapshot(snapshot);
  return snapshot;
}

// The snapshot is generated, so a malformed one means a hand edit or a
// truncated write. Refuse it rather than check sources against it.
export function validateSnapshot(snapshot) {
  const fail = (message) => {
    throw new Error(`${snapshotRelativePath}: ${message}. Regenerate it with node scripts/generate-cub-help-surface.mjs --write`);
  };
  if (snapshot.schema !== "cub-help-surface/v1") fail("unknown schema");
  if (!/^v\d+\.\d+\.\d+$/.test(snapshot.cub?.version ?? "")) fail("the cub version is not recorded");
  if (!Array.isArray(snapshot.globalFlags) || !snapshot.globalFlags.includes("--context")) fail("global flags are missing");
  const paths = new Set(Object.keys(snapshot.commands ?? {}));
  if (paths.size < 100) fail("too few command paths to be a real capture");
  for (const required of ["variant upload", "variant approve", "unit open", "space open", "release publish", "installer render", "config check"]) {
    if (!paths.has(required)) fail(`"${required}" is missing`);
  }
  for (const [path, entry] of Object.entries(snapshot.commands)) {
    if (!Array.isArray(entry.flags) || !Array.isArray(entry.subcommands) || typeof entry.source !== "string") fail(`entry "${path}" is malformed`);
    for (const sub of entry.subcommands) {
      if (!paths.has(`${path} ${sub}`)) fail(`entry "${path}" lists "${sub}" but holds no entry for it`);
    }
  }
  for (const name of snapshot.topLevel ?? []) {
    if (!paths.has(name)) fail(`top-level command "${name}" has no entry`);
  }
  for (const [name, plugin] of Object.entries(snapshot.plugins ?? {})) {
    if (!/^\d+\.\d+\.\d+/.test(plugin.version ?? "")) fail(`plugin ${name} has no recorded version`);
  }
}

export function listReaderFacingFiles() {
  const tracked = execFileSync("git", ["ls-files", "--", ...readerFacingSources], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  })
    .split("\n")
    .filter((file) => /\.(md|mjs|js|yaml|yml|json|sh|html|txt)$/.test(file));
  const scanned = [];
  const exempt = [];
  for (const file of tracked) {
    const rule = historicalRecordRules.find((item) => item.pattern.test(file));
    if (rule) exempt.push({ file, reason: rule.reason });
    else scanned.push(file);
  }
  return { scanned, exempt };
}

// Returns the cub invocations on one logical line. Each has the tokens that
// follow the word `cub` and how it is written. `tagged` means it opens a code
// element or a line; `codeLike` also accepts a quote, as a script holds it.
function invocations(text, joined) {
  const found = [];
  const pattern = /(^|[^\w./-])cub[ \t]+(?=[a-z])/g;
  for (const match of text.matchAll(pattern)) {
    const opener = match[1];
    const before = text.slice(0, match.index + opener.length);
    const tagged =
      /^[\s$>#]*$/.test(before) || /<(?:code|pre|kbd|samp)\b[^>]*>$/.test(before) || /(?:\$|&gt;|%)\s$/.test(before);
    const codeLike = tagged || /[`"'(;=]$/.test(before);
    let rest = text.slice(match.index + match[0].length);
    const closers = ["`", "|", ";", "&&", "&amp;&amp;", "</", "<br", "$(", ")", " # ", "\\n", "→", ". ", ", "];
    let end = rest.search(/\scub\s/);
    if (end === -1) end = rest.length;
    for (const closer of closers) {
      const at = rest.indexOf(closer);
      if (at !== -1 && at < end) end = at;
    }
    if (!joined && (opener === '"' || opener === "'")) {
      for (let at = rest.indexOf(opener); at !== -1; at = rest.indexOf(opener, at + 1)) {
        if (rest[at - 1] === "\\") continue;
        if (at < end) end = at;
        break;
      }
    }
    rest = rest.slice(0, end);
    found.push({ tokens: rest.split(/\s+/).filter(Boolean), tagged, codeLike, opener });
  }
  return found;
}

// Joins shell continuation lines, including the form a script template takes
// when each line of a command is its own quoted string ending in a backslash.
function logicalLines(lines) {
  const joined = [];
  const continues = /\\{1,2}(?:n\\)?["'`]?,?\s*$/;
  for (let index = 0; index < lines.length; index += 1) {
    let text = lines[index];
    const start = index;
    let count = 0;
    while (index + 1 < lines.length && continues.test(text)) {
      text = `${text.replace(continues, " ")}${lines[index + 1].replace(/^\s*["'`]?/, "")}`;
      index += 1;
      count += 1;
    }
    joined.push({ text, line: start + 1, joined: count > 0 });
  }
  return joined;
}

export function scanText(file, text, snapshot, { groups, unknownCommands = true, stats } = {}) {
  const violations = [];
  const lines = text.split(/\r?\n/);
  const isMarkdown = file.endsWith(".md");
  const isShell = file.endsWith(".sh");
  // A fenced block tagged as shell holds commands to run. Other fences hold
  // diagrams, output, and YAML, and are read as prose.
  const shellFence = new Array(lines.length).fill(false);
  if (isMarkdown) {
    let inside = null;
    lines.forEach((line, index) => {
      const fence = line.match(/^\s*(?:```|~~~)\s*([a-z]*)/);
      if (fence) inside = inside === null ? fence[1] : null;
      else shellFence[index] = inside !== null && /^(sh|bash|shell|console|zsh)$/.test(inside);
    });
  }
  const global = new Set(snapshot.globalFlags);
  const topLevel = new Set(snapshot.topLevel);
  const namedOnly = new Set(unrecordedPluginCommands);

  for (const { text: logical, line, joined } of logicalLines(lines)) {
    const index = line - 1;
    const runnable = isShell || shellFence[index];
    const context = isMarkdown && !runnable ? [lines[index - 1], lines[index], lines[index + 1]].filter(Boolean).join(" ") : logical;
    const waived = !runnable && notCurrentPattern.test(context);
    const readable = reportLabels.reduce((value, label) => value.split(label).join(""), logical);
    for (const { tokens, tagged, codeLike, opener } of invocations(readable, joined)) {
      // Markdown prose names a command in backticks. Elsewhere a command is
      // written as code: see invocations().
      const asCommand = runnable || (isMarkdown ? opener === "`" : codeLike);
      const strictly = runnable || (isMarkdown ? opener === "`" : tagged);
      const sentence = tokens.some((token) => proseWords.has(token));
      const first = clean(tokens[0]);
      if (!topLevel.has(first)) {
        // A word after `cub` that is no command at all, written as a command.
        const shaped = /^[a-z][a-z0-9-]*$/.test(first) && tokens[0] === first && !sentence;
        if (shaped && strictly && !namedOnly.has(first) && unknownCommands && !waived) {
          violations.push({ file, line, kind: "command", command: `cub ${first}`, detail: `cub has no command "${first}"` });
        }
        continue;
      }
      if (groups && !groups.has(first)) continue;
      if (stats) stats.invocations += 1;
      let path = first;
      let cursor = 1;
      let unknown = null;
      let prose = false;
      while (cursor < tokens.length) {
        const entry = snapshot.commands[path];
        const word = clean(tokens[cursor]);
        if (!entry || entry.subcommands.length === 0) break;
        if (entry.subcommands.includes(word)) {
          path = `${path} ${word}`;
          cursor += 1;
          continue;
        }
        if (/^[a-z][a-z0-9-]*$/.test(word) && tokens[cursor] === word) {
          if (asCommand && !sentence) unknown = word;
          else prose = true;
        }
        break;
      }
      if (unknown) {
        if (!waived) violations.push({ file, line, kind: "subcommand", command: `cub ${path} ${unknown}`, detail: `cub ${path} has no subcommand "${unknown}"` });
        continue;
      }
      // A sentence such as "cub installer uses declared inputs" is not a command.
      if (prose) continue;
      const entry = snapshot.commands[path];
      if (!entry) continue;
      const allowed = new Set(entry.flags);
      for (const token of tokens.slice(cursor)) {
        // A bare "--" ends the command's own flags; function arguments follow.
        if (token === "--") break;
        const flag = token.match(/^[("'[]*(--[a-z][a-z0-9-]*)/)?.[1];
        if (!flag || allowed.has(flag) || global.has(flag)) continue;
        if (!waived) violations.push({ file, line, kind: "flag", command: `cub ${path} ${flag}`, detail: `cub ${path} has no flag ${flag}` });
      }
    }
  }
  return violations;
}

function clean(token = "") {
  return token.replace(/^[("'[]+/, "").replace(/[)"'\],.:;!?]+$/, "");
}

export function scanReaderFacingSources({ groups, unknownCommands = true } = {}) {
  const snapshot = loadSnapshot();
  const { scanned, exempt } = listReaderFacingFiles();
  const violations = [];
  for (const file of scanned) {
    violations.push(...scanText(file, readFileSync(join(repoRoot, file), "utf8"), snapshot, { groups, unknownCommands }));
  }
  return { snapshot, scanned, exempt, violations };
}

function groupsFrom(snapshot, prefix) {
  return new Set(
    Object.entries(snapshot.commands)
      .filter(([path, entry]) => !path.includes(" ") && entry.source.startsWith(prefix))
      .map(([path]) => path),
  );
}

export function coreGroups(snapshot) {
  return groupsFrom(snapshot, "cub ");
}

export function pluginGroups(snapshot) {
  return groupsFrom(snapshot, "plugin ");
}

export function formatViolations(violations) {
  return violations.map((item) => `${item.file}:${item.line}: ${item.detail}`).join("\n");
}
