// Finds the `cub` commands that scripts under scripts/ build from literals, and
// checks them against the committed snapshot of the CLI's own --help text.
// It reads files only; it never runs cub.
//
// Two shapes are read:
//   - a JavaScript argument list written as literals, such as
//     cub(context, ["variant", "upload", "--space", space, path]) or
//     execFileSync("cub", ["unit", "list"]), and
//   - a shell command written as a literal string, such as
//     "cub variant upload --space x" (read by scanText in cub-command-surface.mjs).
//
// An argument list whose command words are not literals (cub(context, args),
// cub(...parts)) is skipped and counted. So is a template literal with a
// substitution inside a command word.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { coreGroups, loadSnapshot, scanText } from "./cub-command-surface.mjs";
import { repoRoot } from "./proof-common.mjs";

// Scripts that name a removed command in order to refuse it, or that build a
// stub of the CLI. They quote commands the gate would otherwise report.
export const scriptsThatQuoteRemovedCommands = [
  {
    file: "scripts/verify-variant-command-surface.mjs",
    reason: "It names removed variant flags and subcommands in order to refuse them in sources.",
  },
  {
    file: "scripts/verify-installer-command-surface.mjs",
    reason: "It names a removed cub plugin install flag in order to refuse it in sources.",
  },
  {
    file: "scripts/verify-site-ux-contract.mjs",
    reason: "It names removed commands in order to refuse them on the site.",
  },
  {
    file: "scripts/verify-doc-map.mjs",
    reason: "It names removed commands in order to refuse them in docs.",
  },
  {
    file: "scripts/verify-script-cub-commands.mjs",
    reason: "This gate and its self-test quote removed commands as examples.",
  },
  {
    file: "scripts/lib/cub-script-invocations.mjs",
    reason: "This module quotes removed commands as examples.",
  },
];

export function listScriptFiles() {
  return execFileSync("git", ["ls-files", "--", "scripts"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 })
    .split("\n")
    .filter((file) => /\.(mjs|js|cjs|sh)$/.test(file));
}

// ---- A small lexer: strings, templates, punctuation, identifiers ----------

function lex(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  const length = source.length;
  const advance = (count = 1) => {
    for (let step = 0; step < count; step += 1) {
      if (source[index] === "\n") line += 1;
      index += 1;
    }
  };
  // Reads a template literal from the opening backtick. Returns its source
  // text and whether it holds a ${ } substitution.
  function readTemplate() {
    const start = index;
    let interpolated = false;
    advance();
    while (index < length && source[index] !== "`") {
      if (source[index] === "\\") advance(2);
      else if (source[index] === "$" && source[index + 1] === "{") {
        interpolated = true;
        advance(2);
        let depth = 1;
        while (index < length && depth > 0) {
          const ch = source[index];
          if (ch === "{") { depth += 1; advance(); }
          else if (ch === "}") { depth -= 1; advance(); }
          else if (ch === "`") readTemplate();
          else if (ch === '"' || ch === "'") readQuoted(ch);
          else advance();
        }
      } else advance();
    }
    advance();
    return { text: source.slice(start + 1, index - 1), interpolated };
  }
  function readQuoted(quote) {
    const start = index;
    advance();
    while (index < length && source[index] !== quote && source[index] !== "\n") {
      if (source[index] === "\\") advance(2);
      else advance();
    }
    advance();
    return source.slice(start + 1, index - 1);
  }
  const regexAllowedAfter = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "return", "typeof", "=>", "+", "-", "*", "%", "<", ">", "~", "^"]);
  while (index < length) {
    const ch = source[index];
    if (/\s/.test(ch)) { advance(); continue; }
    if (ch === "#" && index === 0 && source[1] === "!") {
      while (index < length && source[index] !== "\n") advance();
      continue;
    }
    if (ch === "/" && source[index + 1] === "/") {
      while (index < length && source[index] !== "\n") advance();
      continue;
    }
    if (ch === "/" && source[index + 1] === "*") {
      advance(2);
      while (index < length && !(source[index] === "*" && source[index + 1] === "/")) advance();
      advance(2);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const startLine = line;
      const text = readQuoted(ch);
      tokens.push({ type: "str", text, interpolated: false, line: startLine });
      continue;
    }
    if (ch === "`") {
      const startLine = line;
      const { text, interpolated } = readTemplate();
      tokens.push({ type: "str", text, interpolated, line: startLine, template: true });
      continue;
    }
    if (ch === "/") {
      const previous = tokens[tokens.length - 1];
      const regexHere = !previous || (previous.type === "punct" && regexAllowedAfter.has(previous.text)) || (previous.type === "id" && regexAllowedAfter.has(previous.text));
      if (regexHere) {
        advance();
        let inClass = false;
        while (index < length && (source[index] !== "/" || inClass) && source[index] !== "\n") {
          if (source[index] === "\\") advance(2);
          else {
            if (source[index] === "[") inClass = true;
            else if (source[index] === "]") inClass = false;
            advance();
          }
        }
        advance();
        while (/[a-z]/.test(source[index] ?? "")) advance();
        tokens.push({ type: "other", text: "/re/", line });
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = index;
      while (index < length && /[\w$]/.test(source[index])) advance();
      tokens.push({ type: "id", text: source.slice(start, index), line });
      continue;
    }
    if (/\d/.test(ch)) {
      while (index < length && /[\w.]/.test(source[index])) advance();
      tokens.push({ type: "other", text: "0", line });
      continue;
    }
    if (ch === "." && source[index + 1] === "." && source[index + 2] === ".") {
      tokens.push({ type: "punct", text: "...", line });
      advance(3);
      continue;
    }
    if (ch === "=" && source[index + 1] === ">") {
      tokens.push({ type: "punct", text: "=>", line });
      advance(2);
      continue;
    }
    tokens.push({ type: "punct", text: ch, line });
    advance();
  }
  return tokens;
}

// Index of the token that closes the bracket opened at `open`.
function closer(tokens, open) {
  const pairs = { "[": "]", "(": ")", "{": "}" };
  const stack = [];
  for (let at = open; at < tokens.length; at += 1) {
    const token = tokens[at];
    if (token.type !== "punct") continue;
    if (pairs[token.text]) stack.push(pairs[token.text]);
    else if (token.text === "]" || token.text === ")" || token.text === "}") {
      stack.pop();
      if (stack.length === 0) return at;
    }
  }
  return tokens.length - 1;
}

// Command groups that no other tool the scripts run (kubectl, helm, docker,
// flux, git) also has. A list that starts with one of these is read as a cub
// call even when its callee does not say so. The others (apply, config, run,
// version, helm and the like) are read only when the callee is named for cub
// or the list follows the word "cub".
const unambiguousGroups = new Set([
  "attestation", "changeorder", "changeset", "changeworkflow", "component", "installer", "kubara", "oauthclient",
  "organization-member", "review-comment", "revision", "space", "sveltos", "trigger", "unit", "unit-action", "unit-event", "variant",
]);

// ---- Checking one literal argument list ------------------------------------

// Resolves the command path from the leading literals, then checks every flag
// literal in the list. Returns { status, violations }.
//   status "checked": the leading words were literals and the path resolved.
//   status "skipped": the list does not start with literal command words.
function checkItems(items, snapshot, { file, assumeCub }) {
  const violations = [];
  const global = new Set(snapshot.globalFlags);
  const topLevel = new Set(snapshot.topLevel);
  const first = items[0];
  if (!first || first.kind !== "lit") return { status: "skipped", violations };
  if (!topLevel.has(first.text)) return { status: assumeCub ? "skipped" : "none", violations };
  if (!assumeCub && !unambiguousGroups.has(first.text)) return { status: "none", violations };
  let path = first.text;
  let cursor = 1;
  while (cursor < items.length) {
    const entry = snapshot.commands[path];
    const item = items[cursor];
    if (entry && entry.subcommands.length > 0 && item.kind === "expr") {
      // cond ? "update" : "create": check the list once for each word.
      const words = alternatives(item);
      if (words) {
        const merged = { status: "checked", violations: [] };
        for (const word of words) {
          const copy = [...items];
          copy[cursor] = { kind: "lit", text: word, line: item.line };
          const result = checkItems(copy, snapshot, { file, assumeCub });
          merged.violations.push(...result.violations);
          if (result.status !== "checked") merged.status = result.status;
        }
        return merged;
      }
      // The subcommand is computed, so nothing below it can be checked.
      return { status: "skipped", violations };
    }
    if (!entry || entry.subcommands.length === 0 || item.kind !== "lit" || !/^[a-z][a-z0-9-]*$/.test(item.text)) break;
    if (entry.subcommands.includes(item.text)) {
      path = `${path} ${item.text}`;
      cursor += 1;
      continue;
    }
    // A word that is not a subcommand, written where a subcommand belongs. In
    // an argument list that is not clearly a cub call, it may be data.
    if (!assumeCub) return { status: "none", violations };
    violations.push({ file, line: item.line, kind: "subcommand", command: `cub ${path} ${item.text}`, detail: `cub ${path} has no subcommand "${item.text}"` });
    return { status: "checked", violations };
  }
  const entry = snapshot.commands[path];
  if (!entry) return { status: "checked", violations };
  const allowed = new Set(entry.flags);
  for (const item of items.slice(cursor)) {
    if (item.kind !== "lit") continue;
    const flag = item.text.match(/^(--[a-z][a-z0-9-]*)/)?.[1];
    if (!flag || allowed.has(flag) || global.has(flag)) continue;
    violations.push({ file, line: item.line, kind: "flag", command: `cub ${path} ${flag}`, detail: `cub ${path} has no flag ${flag}` });
  }
  return { status: "checked", violations, path };
}

// The two words of a conditional such as `existing ? "update" : "create"`, or
// null when the item is anything else.
function alternatives(item) {
  const tokens = item.tokens ?? [];
  const mark = tokens.findIndex((token) => token.type === "punct" && token.text === "?");
  if (mark === -1) return null;
  const rest = tokens.slice(mark + 1);
  if (rest.length === 3 && rest[0].type === "str" && !rest[0].interpolated && rest[1].text === ":" && rest[2].type === "str" && !rest[2].interpolated) {
    return [rest[0].text, rest[2].text];
  }
  return null;
}

// Splits the tokens between two brackets into top-level items. A string with
// no substitution is a literal; anything else is not. Flags found at any depth
// are returned as literals too, so that a flag inside a conditional spread is
// still read.
function itemsOf(tokens, open, close) {
  const items = [];
  let depth = 0;
  let current = [];
  const flush = () => {
    if (current.length === 0) return;
    const head = current[0];
    if (current.length === 1 && head.type === "str" && !head.interpolated) {
      items.push({ kind: "lit", text: head.text, line: head.line });
    } else if (current.length === 1 && head.type === "str" && head.interpolated) {
      items.push({ kind: "template", text: head.text, line: head.line });
    } else {
      items.push({ kind: "expr", line: head.line, tokens: current });
    }
    current = [];
  };
  for (let at = open + 1; at < close; at += 1) {
    const token = tokens[at];
    if (token.type === "punct" && "([{".includes(token.text)) depth += 1;
    if (token.type === "punct" && ")]}".includes(token.text)) depth -= 1;
    if (depth === 0 && token.type === "punct" && token.text === ",") {
      flush();
      continue;
    }
    current.push(token);
  }
  flush();
  // Flags that sit inside a nested expression (a ternary, a spread of a
  // literal list) are read as well, as literals that follow the path.
  const nested = [];
  for (const item of items) {
    if (item.kind !== "expr") continue;
    for (const token of item.tokens) {
      if (token.type === "str" && /^--[a-z]/.test(token.text)) nested.push({ kind: "lit", text: token.text, line: token.line });
    }
  }
  return [...items, ...nested];
}

// Template literals that start a command word are read by their literal head
// when it is a plain word before the first substitution.
function normalize(items) {
  return items.map((item) => {
    if (item.kind === "template") {
      const head = item.text.split("${")[0];
      if (/^--[a-z][a-z0-9-]*(=|$)/.test(head)) return { kind: "lit", text: head, line: item.line };
      return { kind: "expr", line: item.line, tokens: [] };
    }
    return item;
  });
}

// ---- Scanning a script ------------------------------------------------------

const callerPattern = /cub/i;

// Written on a line, or in the three lines above it, to say that the line names
// a removed command on purpose. It needs a reason after the colon.
const ignoreMarker = /cub-surface-ignore:\s*\S/;

export function scanScriptSource(file, source, snapshot) {
  const tokens = lex(source);
  const violations = [];
  const stats = { checked: 0, skipped: 0 };
  const seen = new Set();
  const variables = new Map();

  const record = (result, at) => {
    if (result.status === "none") return;
    seen.add(at);
    if (result.status === "checked") stats.checked += 1;
    else stats.skipped += 1;
    violations.push(...result.violations);
  };

  for (let at = 0; at < tokens.length; at += 1) {
    const token = tokens[at];
    // args.push("--granularity", "per-file") on a list read earlier. A name is
    // read against the nearest list assigned to it above.
    if (token.type === "id" && variables.has(token.text) && tokens[at + 1]?.text === "." && tokens[at + 2]?.text === "push" && tokens[at + 3]?.text === "(") {
      const close = closer(tokens, at + 3);
      const { path, entry } = variables.get(token.text);
      const allowed = new Set(entry.flags);
      const global = new Set(snapshot.globalFlags);
      for (let inner = at + 4; inner < close; inner += 1) {
        const literal = tokens[inner];
        if (literal.type !== "str") continue;
        const flag = literal.text.match(/^(--[a-z][a-z0-9-]*)/)?.[1];
        if (!flag || allowed.has(flag) || global.has(flag)) continue;
        violations.push({ file, line: literal.line, kind: "flag", command: `cub ${path} ${flag}`, detail: `cub ${path} has no flag ${flag}` });
      }
      continue;
    }
    if (token.type !== "punct") continue;
    // A literal list: [ "variant", "upload", ... ]
    if (token.text === "[") {
      const close = closer(tokens, at);
      const next = tokens[at + 1];
      if (next?.type !== "str" || next.interpolated) {
        if (tokens[at - 1]?.text === "=" && tokens[at - 2]?.type === "id") variables.delete(tokens[at - 2].text);
        continue;
      }
      const items = normalize(itemsOf(tokens, at, close));
      const previous = tokens[at - 1];
      const assumeCub =
        (previous?.type === "punct" && (previous.text === "," || previous.text === "(")) &&
        (() => {
          // The list is an argument of a call; read the callee name.
          let depth = 0;
          for (let back = at - 1; back >= 0; back -= 1) {
            const t = tokens[back];
            if (t.type === "punct" && (t.text === ")" || t.text === "]" || t.text === "}")) depth += 1;
            if (t.type === "punct" && (t.text === "(" || t.text === "[" || t.text === "{")) {
              if (depth === 0) {
                const callee = tokens[back - 1];
                const firstArg = tokens[back + 1];
                return t.text === "(" && ((callee?.type === "id" && callerPattern.test(callee.text)) || (firstArg?.type === "str" && firstArg.text === "cub"));
              }
              depth -= 1;
            }
          }
          return false;
        })();
      const result = checkItems(items, snapshot, { file, assumeCub });
      record(result, at);
      // Remember the name, so that later .push() calls are read against it.
      if (previous?.text === "=" && tokens[at - 2]?.type === "id") {
        if (result.status === "checked" && result.path) variables.set(tokens[at - 2].text, { path: result.path, entry: snapshot.commands[result.path] });
        else variables.delete(tokens[at - 2].text);
      }
      continue;
    }
    // A call whose name holds "cub", written with literal words:
    // cubJson("revision", "list", ...).
    if (token.text === "(") {
      const callee = tokens[at - 1];
      if (callee?.type !== "id" || !callerPattern.test(callee.text)) continue;
      if (/^(cubDefinition|buildCub|isCub|hasCub|usesCub)/.test(callee.text)) continue;
      const close = closer(tokens, at);
      const items = normalize(itemsOf(tokens, at, close));
      // Skip leading non-literal arguments such as the context.
      let start = 0;
      while (start < items.length && items[start].kind === "expr" && !items[start].tokens.some((t) => t.type === "punct" && t.text === "[")) start += 1;
      const head = items.slice(start);
      if (head[0]?.kind === "lit" && head[0].text === "cub") head.shift();
      if (head.length === 0 || head[0].kind !== "lit") {
        // cub(context, [..]) is read from the list itself; cub(args) is skipped.
        const hasList = items.some((item) => item.kind === "expr" && item.tokens[0]?.text === "[");
        if (!hasList && items.length > 0 && !seen.has(at)) {
          if (/^cub[A-Z]?\w*$/.test(callee.text) && items.some((item) => item.kind === "expr")) stats.skipped += 1;
        }
        continue;
      }
      record(checkItems(head, snapshot, { file, assumeCub: true }), at);
    }
  }

  return { violations, stats };
}

export function scanScripts({ files = listScriptFiles(), snapshot = loadSnapshot() } = {}) {
  const quoting = new Map(scriptsThatQuoteRemovedCommands.map((item) => [item.file, item.reason]));
  const core = coreGroups(snapshot);
  const violations = [];
  const totals = { files: 0, waived: 0, argumentLists: 0, argumentListsSkipped: 0, shellLines: 0, exempt: [] };
  for (const file of files) {
    if (quoting.has(file)) {
      totals.exempt.push({ file, reason: quoting.get(file) });
      continue;
    }
    const source = readFileSync(join(repoRoot, file), "utf8");
    totals.files += 1;
    if (/\.(mjs|js|cjs)$/.test(file)) {
      const result = scanScriptSource(file, source, snapshot);
      totals.argumentLists += result.stats.checked;
      totals.argumentListsSkipped += result.stats.skipped;
      violations.push(...result.violations);
    }
    // A shell command written as a literal string, in any script.
    const stats = { invocations: 0 };
    const shell = scanText(file, source, snapshot, { groups: core, unknownCommands: false, stats });
    totals.shellLines += stats.invocations;
    // A line can name a removed command on purpose, for example to list it as
    // not current. It says so in a comment on that line or in the three lines
    // above it.
    const lines = source.split(/\r?\n/);
    const waived = (item) => [0, 1, 2, 3].some((back) => ignoreMarker.test(lines[item.line - 1 - back] ?? ""));
    for (let index = violations.length - 1; index >= 0; index -= 1) {
      if (violations[index].file === file && waived(violations[index])) {
        totals.waived += 1;
        violations.splice(index, 1);
      }
    }
    const shellKept = shell.filter((item) => !waived(item));
    totals.waived += shell.length - shellKept.length;
    violations.push(...shellKept);
  }
  // The same flag can be found by both readers on one line.
  const unique = new Map(violations.map((item) => [`${item.file}:${item.line}:${item.detail}`, item]));
  return { snapshot, violations: [...unique.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line), totals };
}
