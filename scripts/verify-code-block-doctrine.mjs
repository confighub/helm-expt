#!/usr/bin/env node
// Site IA phase-3 code-block doctrine check.
//
// Enforces, across the authored top-level site pages, that terminal/command
// blocks put the comment ABOVE the command and never after it, and that no
// command or comment line is long enough to wrap. Blocks are meant to be built
// with the commandBlock() helper in generate-public-site.mjs; this check fails
// the build if any block breaks the doctrine, so it cannot silently regress.
//
// Scope: site/*.html (the authored pages). The rendered docs under site/d/ come
// from markdown fences and are out of scope here.

import fs from "node:fs";
import path from "node:path";
import { check, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const SITE = path.join(repoRoot, "site");
// Comments must be succinct: a comment line longer than this is not a short
// phrase and should be cut. Commands and tool output are not length-checked
// here — the terminal panel scrolls horizontally, so a long command or a real
// registry URL never wraps to a second line.
const MAX_COMMENT = 88;

const decode = (text) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

const stripTags = (html) => html.replace(/<[^>]+>/g, "");

const violations = [];
const files = fs
  .readdirSync(SITE)
  .filter((name) => name.endsWith(".html"))
  .sort();

for (const name of files) {
  const file = path.join(SITE, name);
  const html = fs.readFileSync(file, "utf8");
  // Every <pre ...><code> ... </code></pre> block on the page.
  for (const match of html.matchAll(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)) {
    const lines = decode(stripTags(match[1])).split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      // A command line is prompted with "$", or begins with any of the
      // executables these blocks run — not just cub — so a `helm install … # note`
      // or `kubectl … # note` is caught too.
      const isCommand =
        /^\s*\$\s/.test(line) ||
        /^\s*(cub|helm|kubectl|kustomize|docker|oras|node|npm|kubara|git|flux|argocd|gcloud|cosign|aws)\b/.test(line);
      // Doctrine 1: a command line must not carry a trailing "# comment".
      if (isCommand && /\S\s{2,}#\s/.test(line)) {
        violations.push(
          `${relativeRepo(file)}: comment sits AFTER a command (put it on its own line above): ${line.trim().slice(0, 90)}`,
        );
      }
      // Doctrine 3: comments are short phrases. Commands and output are exempt
      // (the panel scrolls, so they never wrap).
      const isComment = /^\s*#/.test(line);
      if (isComment && line.length > MAX_COMMENT) {
        violations.push(
          `${relativeRepo(file)}: comment is ${line.length} chars, cut it to a short phrase (<= ${MAX_COMMENT}): ${line.trim().slice(0, 90)}`,
        );
      }
    }
  }
}

check(
  violations.length === 0,
  `code-block doctrine violations:\n${violations.join("\n")}`,
);
console.log(
  `verified code-block doctrine across ${files.length} site page(s): comment-above and no wrapping`,
);
