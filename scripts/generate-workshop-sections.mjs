#!/usr/bin/env node
// The Catalog's five section files: one machine-readable list per section, so
// an agent reads a file and a person reads a page generated from the same rows
// (site IA phase 4, step 1).
//
//   --generate          write site/{configs,stacks,apps,plugins,guides}.json and their schemas
//   --verify            regenerate in memory and require the committed files to match,
//                       every row to satisfy its section's schema, and every link to resolve
//   --self-test         show that --verify refuses a broken registry
//   --sync-stacks DIR   pin data/workshop-stacks/stacks.yaml from a cub-workshop checkout
//   --verify-upstream   network: each released plugin's latest GitHub release, each app's
//                       default branch and the stacks' pinned commit, against what is recorded
//
// Sources kept by hand live outside site/: data/workshop-plugins/plugins.yaml,
// data/workshop-apps/apps.yaml and data/workshop-guides/guides.yaml. The stacks
// snapshot is written by --sync-stacks. Configs are a view of
// site/listings/index.json, which stays the canonical per-entry index.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const siteRoot = join(repoRoot, "site");
const sources = {
  plugins: join(repoRoot, "data", "workshop-plugins", "plugins.yaml"),
  apps: join(repoRoot, "data", "workshop-apps", "apps.yaml"),
  guides: join(repoRoot, "data", "workshop-guides", "guides.yaml"),
  stacks: join(repoRoot, "data", "workshop-stacks", "stacks.yaml"),
  listings: join(siteRoot, "listings", "index.json"),
};
export const SECTIONS = ["configs", "stacks", "apps", "plugins", "guides"];
const API_VERSION = "catalog.confighub.com/v1alpha1";

// A stack that exists to show a refusal, or to test an install cheaply, belongs
// to a Guide rather than to the list of platforms you would build.
const STACK_ROLES = {
  "conflict-demo": "refusal",
  "metrics-double": "refusal",
  "kubara-shop-first-try": "refusal",
  "web-tiny": "fixture",
};

const PLUGIN_STATES = ["released", "draft", "in-progress"];
const APP_DELIVERIES = ["plain", "argo-cd", "flux", "generator"];

// Each row carries a stable ID, a one-line summary, its state, and the exact
// command or address an agent uses next.
const ROW_FIELDS = {
  configs: { required: ["id", "name", "format", "version", "base", "summary", "state", "objectCount", "flatteningVerdict", "listing", "next"], optional: ["digest", "page"] },
  stacks: { required: ["id", "name", "summary", "state", "parts", "partCount", "checked", "source", "next"], optional: [] },
  apps: { required: ["id", "name", "summary", "state", "delivery", "repository", "branch", "checkedCommit", "address", "next"], optional: ["path", "note"] },
  plugins: { required: ["id", "name", "summary", "state", "commands", "next"], optional: ["repository", "release", "install", "note"] },
  guides: { required: ["id", "group", "title", "summary", "state", "address", "next"], optional: ["groupTitle"] },
};

function readSource(name) {
  check(existsSync(sources[name]), `${relativeRepo(sources[name])} is missing`);
  return name === "listings" ? JSON.parse(readFileSync(sources[name], "utf8")) : readYaml(sources[name]);
}

function unique(rows, what) {
  const seen = new Set();
  for (const row of rows) {
    check(row.id && /^[a-z0-9][a-z0-9.-]*$/.test(row.id), `${what}: "${row.id}" is not a stable lowercase ID`);
    check(!seen.has(row.id), `${what}: ID ${row.id} appears twice`);
    seen.add(row.id);
  }
}

function sentence(text, where) {
  check(typeof text === "string" && text.trim().length > 0, `${where} has no summary`);
  return text.trim();
}

function configRows(index) {
  const rows = index.listings.map((listing) => ({
    id: listing.id,
    name: listing.name,
    format: listing.format,
    version: listing.version,
    base: listing.base,
    summary: `${listing.name} ${listing.version}, ${listing.format}, base ${listing.base}: ${listing.objectCount} objects, flattening verdict ${listing.flatteningVerdict}.`,
    state: listing.discovery?.status ?? "not-classified",
    objectCount: listing.objectCount,
    flatteningVerdict: listing.flatteningVerdict,
    ...(listing.digest ? { digest: listing.digest } : {}),
    listing: listing.url,
    next: { address: listing.url },
  }));
  unique(rows, "configs");
  return rows;
}

function stackRows(snapshot) {
  const spec = snapshot.spec;
  check(/^[0-9a-f]{40}$/.test(spec.commit ?? ""), "the stacks snapshot records no commit");
  const rows = spec.stacks
    .filter((stack) => (STACK_ROLES[stack.id] ?? "platform") === "platform")
    .map((stack) => ({
      id: stack.id,
      name: stack.id,
      summary: sentence(stack.description, `stack ${stack.id}`),
      state: "shipped",
      parts: stack.components,
      partCount: stack.components.length,
      checked: stack.receipts === stack.components.length,
      source: `https://github.com/${spec.repository}/blob/${spec.commit}/${stack.path}`,
      next: { command: `cub stack check ${stack.id}` },
    }));
  unique(rows, "stacks");
  return rows;
}

function appRows(registry) {
  const rows = registry.spec.apps.map((app) => {
    check(APP_DELIVERIES.includes(app.delivery), `app ${app.id}: delivery must be one of ${APP_DELIVERIES.join(", ")}`);
    check(/^[0-9a-f]{40}$/.test(app.checkedCommit ?? ""), `app ${app.id}: checkedCommit must be a full commit`);
    // A single manifest opens as a file (blob); a directory or a whole repository as a tree.
    const kind = /\.(ya?ml|json)$/.test(app.path ?? "") ? "blob" : "tree";
    const address = `https://github.com/${app.repository}/${kind}/${app.branch}${app.path ? `/${app.path}` : ""}`;
    return {
      id: app.id,
      name: app.name,
      summary: sentence(app.summary, `app ${app.id}`),
      state: "maintained",
      delivery: app.delivery,
      repository: app.repository,
      ...(app.path ? { path: app.path } : {}),
      branch: app.branch,
      checkedCommit: app.checkedCommit,
      address,
      ...(app.note ? { note: app.note } : {}),
      next: { address },
    };
  });
  unique(rows, "apps");
  return rows;
}

function pluginRows(registry) {
  const rows = registry.spec.plugins.map((plugin) => {
    check(PLUGIN_STATES.includes(plugin.state), `plugin ${plugin.id}: state must be one of ${PLUGIN_STATES.join(", ")}`);
    check(Array.isArray(plugin.commands) && plugin.commands.length > 0, `plugin ${plugin.id} names no command`);
    if (plugin.state === "released") {
      check(plugin.repository && plugin.install && plugin.release?.tag, `plugin ${plugin.id} is released but lacks a repository, install command or release tag`);
      check(plugin.install.startsWith("cub plugin install "), `plugin ${plugin.id}: install must be a cub plugin install command`);
    }
    return {
      id: plugin.id,
      name: plugin.name,
      summary: sentence(plugin.summary, `plugin ${plugin.id}`),
      state: plugin.state,
      commands: plugin.commands,
      ...(plugin.repository ? { repository: plugin.repository } : {}),
      ...(plugin.release ? { release: plugin.release } : {}),
      ...(plugin.install ? { install: plugin.install } : {}),
      ...(plugin.note ? { note: plugin.note } : {}),
      next: plugin.install ? { command: plugin.install } : { note: plugin.note ?? "Not yet published." },
    };
  });
  unique(rows, "plugins");
  return rows;
}

function guideRows(registry) {
  const groups = new Map(registry.spec.groups.map((group) => [group.id, group.title]));
  check(registry.spec.groups[0]?.id === "journeys", "the five journeys must be the first group");
  const rows = registry.spec.guides.map((guide) => {
    check(groups.has(guide.group), `guide ${guide.id}: unknown group ${guide.group}`);
    check(Boolean(guide.page) !== Boolean(guide.repository), `guide ${guide.id}: give a site page or a repository path, not both`);
    if (guide.page) check(existsSync(join(siteRoot, guide.page)), `guide ${guide.id}: site/${guide.page} does not exist`);
    const address = guide.page
      ? `${SITE_BASE_URL}${guide.page}`
      : `https://github.com/${guide.repository}/tree/main/${guide.path}`;
    return {
      id: guide.id,
      group: guide.group,
      groupTitle: groups.get(guide.group),
      title: guide.title,
      summary: sentence(guide.summary, `guide ${guide.id}`),
      state: "published",
      address,
      next: { address },
    };
  });
  unique(rows, "guides");
  check(rows.filter((row) => row.group === "journeys").length === 5, "the journeys group must hold the five journeys");
  return rows;
}

function sectionDoc(section, rows, generatedFrom) {
  return {
    apiVersion: API_VERSION,
    kind: "WorkshopSection",
    section,
    schema: `${SITE_BASE_URL}${section}.schema.json`,
    generatedFrom,
    count: rows.length,
    rows,
  };
}

function schemaFor(section) {
  const { required, optional } = ROW_FIELDS[section];
  const properties = Object.fromEntries([...required, ...optional].map((field) => [field, fieldSchema(field)]));
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${SITE_BASE_URL}${section}.schema.json`,
    title: `ConfigHub Workshop ${section} section`,
    description: `One row per ${section.replace(/s$/, "")} in the Catalog's ${section} section. Every row carries a stable id, a one-line summary, its state, and next: the exact command or address an agent uses.`,
    type: "object",
    required: ["apiVersion", "kind", "section", "schema", "generatedFrom", "count", "rows"],
    additionalProperties: false,
    properties: {
      apiVersion: { const: API_VERSION },
      kind: { const: "WorkshopSection" },
      section: { const: section },
      schema: { const: `${SITE_BASE_URL}${section}.schema.json` },
      generatedFrom: { type: "array", items: { type: "string" }, minItems: 1 },
      count: { type: "integer", minimum: 0 },
      rows: {
        type: "array",
        items: { type: "object", required, additionalProperties: false, properties },
      },
    },
  };
}

function fieldSchema(field) {
  if (["objectCount", "partCount"].includes(field)) return { type: "integer", minimum: 0 };
  if (field === "checked") return { type: "boolean" };
  if (["commands", "parts"].includes(field)) return { type: "array", items: { type: "string" }, minItems: 1 };
  if (field === "release") return { type: "object", required: ["tag"], properties: { tag: { type: "string" }, date: { type: "string" } } };
  if (field === "next") {
    return {
      type: "object",
      description: "What an agent does next: run command, open address, or read note.",
      minProperties: 1,
      properties: { command: { type: "string" }, address: { type: "string" }, note: { type: "string" } },
      additionalProperties: false,
    };
  }
  if (field === "checkedCommit") return { type: "string", pattern: "^[0-9a-f]{40}$" };
  if (field === "id") return { type: "string", pattern: "^[a-z0-9][a-z0-9.-]*$" };
  return { type: "string", minLength: 1 };
}

// Enough of JSON Schema to hold these files to their schemas: required and
// unknown fields, types, and the const, pattern and minimum checks used above.
export function validate(value, schema, where = "$") {
  const errors = [];
  if (schema.const !== undefined && value !== schema.const) errors.push(`${where} must be ${JSON.stringify(schema.const)}`);
  const type = schema.type;
  const actual = Array.isArray(value) ? "array" : value === null ? "null" : Number.isInteger(value) ? "integer" : typeof value;
  if (type && !(type === actual || (type === "number" && actual === "integer"))) {
    errors.push(`${where} must be ${type}, not ${actual}`);
    return errors;
  }
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${where} is empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where} does not match ${schema.pattern}`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errors.push(`${where} is below ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${where} needs at least ${schema.minItems} item(s)`);
    value.forEach((item, i) => errors.push(...validate(item, schema.items ?? {}, `${where}[${i}]`)));
  }
  if (actual === "object") {
    for (const field of schema.required ?? []) if (!(field in value)) errors.push(`${where}.${field} is required`);
    if (schema.minProperties && Object.keys(value).length < schema.minProperties) errors.push(`${where} needs at least ${schema.minProperties} field(s)`);
    for (const [field, fieldValue] of Object.entries(value)) {
      const sub = schema.properties?.[field];
      if (!sub) {
        if (schema.additionalProperties === false) errors.push(`${where}.${field} is not allowed`);
        continue;
      }
      errors.push(...validate(fieldValue, sub, `${where}.${field}`));
    }
  }
  return errors;
}

export function buildSections(input = {}) {
  const listings = input.listings ?? readSource("listings");
  const stacks = input.stacks ?? readSource("stacks");
  const apps = input.apps ?? readSource("apps");
  const plugins = input.plugins ?? readSource("plugins");
  const guides = input.guides ?? readSource("guides");
  const docs = {
    configs: sectionDoc("configs", configRows(listings), ["site/listings/index.json"]),
    stacks: sectionDoc("stacks", stackRows(stacks), ["data/workshop-stacks/stacks.yaml"]),
    apps: sectionDoc("apps", appRows(apps), ["data/workshop-apps/apps.yaml"]),
    plugins: sectionDoc("plugins", pluginRows(plugins), ["data/workshop-plugins/plugins.yaml"]),
    guides: sectionDoc("guides", guideRows(guides), ["data/workshop-guides/guides.yaml"]),
  };
  check(docs.configs.count === listings.listings.length, "configs.json must hold every listing");
  const files = {};
  for (const section of SECTIONS) {
    const schema = schemaFor(section);
    const errors = validate(docs[section], schema, `site/${section}.json`);
    check(errors.length === 0, `site/${section}.json breaks its schema:\n  ${errors.slice(0, 10).join("\n  ")}`);
    files[`${section}.json`] = `${JSON.stringify(docs[section], null, 2)}\n`;
    files[`${section}.schema.json`] = `${JSON.stringify(schema, null, 2)}\n`;
  }
  return { docs, files };
}

function generate() {
  const { docs, files } = buildSections();
  for (const [name, text] of Object.entries(files)) write(join(siteRoot, name), text);
  console.log(`wrote the five section files: ${SECTIONS.map((s) => `${s} ${docs[s].count}`).join(", ")}`);
}

function verify() {
  const { docs, files } = buildSections();
  for (const [name, text] of Object.entries(files)) {
    const path = join(siteRoot, name);
    check(existsSync(path), `site/${name} is missing: run npm run site:sections`);
    check(readFileSync(path, "utf8") === text, `site/${name} is stale: run npm run site:sections`);
  }
  const llms = readFileSync(join(siteRoot, "llms.txt"), "utf8");
  const firstBullets = llms.split("\n").filter((line) => line.startsWith("- [")).slice(0, SECTIONS.length);
  for (const [i, section] of SECTIONS.entries()) {
    check(firstBullets[i]?.includes(`(${SITE_BASE_URL}${section}.json)`), `llms.txt must list ${section}.json in place ${i + 1}, before any other entry`);
  }
  console.log(`verified the five section files against their sources and schemas: ${SECTIONS.map((s) => `${s} ${docs[s].count}`).join(", ")}`);
}

function selfTest() {
  const base = {
    listings: readSource("listings"),
    stacks: readSource("stacks"),
    apps: readSource("apps"),
    plugins: readSource("plugins"),
    guides: readSource("guides"),
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const refuses = (name, mutate, expected) => {
    const input = clone(base);
    mutate(input);
    try {
      buildSections(input);
    } catch (error) {
      check(error.message.includes(expected), `self-test ${name}: refused for the wrong reason: ${error.message}`);
      return;
    }
    throw new Error(`self-test ${name}: a broken registry was accepted`);
  };
  refuses("duplicate plugin", (i) => i.plugins.spec.plugins.push(clone(i.plugins.spec.plugins[0])), "appears twice");
  refuses("unknown plugin state", (i) => { i.plugins.spec.plugins[0].state = "beta"; }, "state must be one of");
  refuses("released plugin without install", (i) => { delete i.plugins.spec.plugins[0].install; }, "lacks a repository, install command or release tag");
  refuses("short app commit", (i) => { i.apps.spec.apps[0].checkedCommit = "abc123"; }, "full commit");
  refuses("unknown delivery", (i) => { i.apps.spec.apps[0].delivery = "kubectl"; }, "delivery must be one of");
  refuses("missing guide page", (i) => { i.guides.spec.guides.find((g) => g.page).page = "no-such-page.html"; }, "does not exist");
  refuses("journeys not first", (i) => { i.guides.spec.groups.reverse(); }, "journeys must be the first group");
  refuses("four journeys", (i) => { i.guides.spec.guides.shift(); }, "five journeys");
  refuses("empty summary", (i) => { i.stacks.spec.stacks[0].description = " "; }, "has no summary");
  check(validate({ rows: [] }, schemaFor("plugins")).length > 0, "self-test: the schema accepted a document with no header");
  console.log("self-test passed: duplicate IDs, unknown states, missing install commands, short commits, unknown deliveries, missing pages, journey order and empty summaries are all refused");
}

function syncStacks(from) {
  check(from && existsSync(join(from, "stacks")), "--sync-stacks needs a cub-workshop checkout with a stacks/ directory");
  // The snapshot records HEAD, so the files it reads must be HEAD's.
  const dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "--", "stacks"], { encoding: "utf8" }).trim();
  check(dirty === "", `${from} has uncommitted changes under stacks/, so its HEAD would not describe them:\n${dirty}`);
  const commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const stacks = readdirSync(join(from, "stacks"))
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => {
      const manifest = readYaml(join(from, "stacks", name));
      const components = manifest.spec?.components ?? [];
      return {
        id: manifest.metadata.name,
        path: `stacks/${name}`,
        role: STACK_ROLES[manifest.metadata.name] ?? "platform",
        description: manifest.spec?.description ?? "",
        components: components.map((c) => c.name),
        receipts: components.filter((c) => c.receipt).length,
      };
    });
  writeYaml(sources.stacks, {
    apiVersion: API_VERSION,
    kind: "WorkshopStackSnapshot",
    metadata: { name: "workshop-stacks" },
    spec: {
      description: "The shipped stacks in cub-workshop's stacks/ directory at a pinned commit, written by scripts/generate-workshop-sections.mjs --sync-stacks. Stacks whose role is refusal or fixture belong to Guides and stay out of site/stacks.json.",
      repository: "confighub/cub-workshop",
      commit,
      stacks,
    },
  });
  console.log(`pinned ${stacks.length} stacks from confighub/cub-workshop at ${commit.slice(0, 12)}`);
}

// The five journeys live in monadic/workshop-demo. Each journey Guide on the
// site is generated from this snapshot, pinned at a commit like the stacks.
const JOURNEYS = [
  ["journey-values-did-nothing", "1-catch-the-ai", "My values did nothing"],
  ["journey-preserve-my-fixes", "2-my-fixes-survive", "Preserve my fixes"],
  ["journey-what-my-app-needs", "3-what-my-app-needs", "What my app needs"],
  ["journey-before-gitops", "4-before-argo-takes-over", "Before GitOps takes over"],
  ["journey-installs-never-starts", "5-it-installs-and-never-starts", "It installs but never starts"],
];

function syncJourneys(from) {
  check(from && existsSync(join(from, "README.md")), "--sync-journeys needs a workshop-demo checkout");
  const dirty = execFileSync("git", ["-C", from, "status", "--porcelain"], { encoding: "utf8" }).trim();
  check(dirty === "", `${from} has uncommitted changes, so its HEAD would not describe them:\n${dirty}`);
  const commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const journeys = JOURNEYS.map(([id, dir, title]) => {
    const readme = readFileSync(join(from, dir, "README.md"), "utf8");
    const heading = readme.match(/^# (.+)$/m)?.[1] ?? title;
    const para = (label) => readme.match(new RegExp(`^\\*\\*${label}\\*\\* (.+)$`, "m"))?.[1]?.trim() ?? "";
    const sections = [...readme.matchAll(/^## (.+)$/gm)].map(([, text]) => text.trim());
    // The body of a "## " section, up to the next one.
    const section = (pattern) => {
      const found = readme.match(new RegExp(`^## (${pattern}.*)$\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
      return found ? { heading: found[1].trim(), body: found[2].trim() } : null;
    };
    // Each step is its bold heading and the text up to the next step, so the
    // Guide can show the step's commands and what to look for.
    const stepText = section("The steps")?.body ?? "";
    const steps = [...stepText.matchAll(/^\*\*(\d+)\. ([^*]+?)\*\*[ \t]*([\s\S]*?)(?=^\*\*\d+\. |(?![\s\S]))/gm)].map(([, n, text, body]) => ({
      n: Number(n),
      title: text.trim().replace(/\.$/, ""),
      body: body.trim(),
    }));
    check(steps.length >= 4, `journey ${dir}: found only ${steps.length} numbered steps`);
    check(steps.every((step, i) => step.n === i + 1), `journey ${dir}: steps are not numbered 1 to ${steps.length}`);
    check(existsSync(join(from, dir, "run.sh")) && existsSync(join(from, dir, "PROMPT.md")), `journey ${dir} needs run.sh and PROMPT.md`);
    check(existsSync(join(from, dir, "expected")), `journey ${dir} needs an expected/ directory`);
    const own = section("(?:Continue with your own|Use the image check in your own)");
    const howItKnows = section("How it knows")?.body ?? "";
    return { id, dir, title, heading, point: para("The point\\."), needs: para("Time\\."), steps, sections, ...(own ? { own } : {}), ...(howItKnows ? { howItKnows } : {}) };
  });
  writeYaml(join(repoRoot, "data", "workshop-journeys", "journeys.yaml"), {
    apiVersion: API_VERSION,
    kind: "WorkshopJourneySnapshot",
    metadata: { name: "workshop-journeys" },
    spec: {
      description: "The five journeys in monadic/workshop-demo at a pinned commit, written by scripts/generate-workshop-sections.mjs --sync-journeys. The site generates one journey Guide from each.",
      repository: "monadic/workshop-demo",
      commit,
      journeys,
    },
  });
  console.log(`pinned ${journeys.length} journeys from monadic/workshop-demo at ${commit.slice(0, 12)}`);
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function verifyUpstream() {
  const drift = [];
  for (const plugin of readSource("plugins").spec.plugins.filter((p) => p.state === "released")) {
    const latest = gh(["release", "view", "--repo", plugin.repository, "--json", "tagName", "--jq", ".tagName"]);
    if (latest !== plugin.release.tag) drift.push(`plugin ${plugin.id}: recorded ${plugin.release.tag}, latest release is ${latest}`);
  }
  for (const app of readSource("apps").spec.apps) {
    const head = gh(["api", `repos/${app.repository}/commits/${app.branch}`, "--jq", ".sha"]);
    if (head === app.checkedCommit) continue;
    if (!app.path) {
      drift.push(`app ${app.id}: checked at ${app.checkedCommit.slice(0, 12)}, ${app.branch} is now ${head.slice(0, 12)}`);
      continue;
    }
    const compare = gh(["api", `repos/${app.repository}/compare/${app.checkedCommit}...${head}`, "--jq", "[.files[].filename]|join(\"\\n\")"]);
    if (compare.split("\n").some((file) => file === app.path || file.startsWith(`${app.path}/`))) {
      drift.push(`app ${app.id}: ${app.path} changed on ${app.branch} since ${app.checkedCommit.slice(0, 12)}`);
    }
  }
  const stacks = readSource("stacks").spec;
  const stacksHead = gh(["api", `repos/${stacks.repository}/commits/main`, "--jq", ".sha"]);
  if (stacksHead !== stacks.commit) {
    const changed = gh(["api", `repos/${stacks.repository}/compare/${stacks.commit}...${stacksHead}`, "--jq", "[.files[].filename|select(startswith(\"stacks/\"))]|length"]);
    if (changed !== "0") drift.push(`stacks: ${changed} file(s) under stacks/ changed since ${stacks.commit.slice(0, 12)}; run --sync-stacks`);
  }
  if (drift.length) {
    console.error(`the section registries have drifted from upstream:\n  ${drift.join("\n  ")}`);
    process.exit(1);
  }
  console.log("verified upstream: every released plugin is at its latest release, every app and the stacks are unchanged since they were checked");
}

const args = process.argv.slice(2);
if (args.includes("--generate")) generate();
else if (args.includes("--verify")) verify();
else if (args.includes("--self-test")) selfTest();
else if (args.includes("--verify-upstream")) verifyUpstream();
else if (args.includes("--sync-stacks")) syncStacks(args[args.indexOf("--sync-stacks") + 1]);
else if (args.includes("--sync-journeys")) syncJourneys(args[args.indexOf("--sync-journeys") + 1]);
else {
  console.error("usage: generate-workshop-sections.mjs --generate | --verify | --self-test | --sync-stacks <cub-workshop dir> | --sync-journeys <workshop-demo dir> | --verify-upstream");
  process.exit(2);
}
