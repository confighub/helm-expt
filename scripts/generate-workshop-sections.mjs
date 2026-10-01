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
//   --verify-upstream   network: fail if a released plugin, app path or stacks snapshot drifted
//   --upstream-report PATH
//                       network: write JSON drift findings and exit zero when discovery succeeds
//   --sync-plugins      network: refresh released plugin tags, dates and pinned install commands
//   --sync-apps         network: print app drift URLs and paths without changing checked commits
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
  configs: { required: ["id", "name", "format", "version", "base", "summary", "state", "objectCount", "flatteningVerdict", "checks", "listing", "next"], optional: ["digest", "page"] },
  stacks: { required: ["id", "name", "summary", "state", "parts", "partCount", "checked", "source", "next"], optional: ["plugin"] },
  apps: { required: ["id", "name", "summary", "state", "delivery", "repository", "branch", "checkedCommit", "address", "next"], optional: ["path", "note"] },
  plugins: { required: ["id", "name", "summary", "state", "commands", "next"], optional: ["repository", "address", "release", "install", "note", "stack", "guide"] },
  guides: { required: ["id", "group", "title", "summary", "state", "address", "next"], optional: ["groupTitle", "firstCommand"] },
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

// The four assessment stages every listing records, in order. A row reports
// each stage's evidence and result, so an agent can see what was checked
// without opening the listing.
const ASSESSMENT_STAGES = ["inspection", "materialization", "destination", "post-deployment"];

function listingChecks(listing, readListing) {
  const stages = readListing(listing)?.assessment?.stages ?? [];
  const checks = {};
  for (const id of ASSESSMENT_STAGES) {
    const stage = stages.find((candidate) => candidate.id === id);
    check(stage?.evidenceState && stage?.resultState, `config ${listing.id}: its listing records no ${id} stage`);
    checks[id] = `${stage.evidenceState}/${stage.resultState}`;
  }
  return checks;
}

function readListingFile(listing) {
  const name = String(listing.url ?? "").split("/").pop();
  const path = join(siteRoot, "listings", name);
  check(name.endsWith(".json") && existsSync(path), `config ${listing.id}: site/listings/${name} is missing`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function configRows(index, readListing = readListingFile) {
  const rows = index.listings.map((listing) => {
    const checks = listingChecks(listing, readListing);
    const done = ASSESSMENT_STAGES.filter((id) => checks[id].startsWith("completed/"));
    return {
    id: listing.id,
    name: listing.name,
    format: listing.format,
    version: listing.version,
    base: listing.base,
    summary: `${listing.name} ${listing.version}, ${listing.format}, base ${listing.base}: ${listing.objectCount} objects, flattening verdict ${listing.flatteningVerdict}. Stages with evidence: ${done.join(", ") || "none"}.`,
    state: listing.discovery?.status ?? "not-classified",
    objectCount: listing.objectCount,
    flatteningVerdict: listing.flatteningVerdict,
    checks,
    ...(listing.digest ? { digest: listing.digest } : {}),
    listing: listing.url,
    next: { address: listing.url },
    };
  });
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
      ...(plugin.address ? { address: plugin.address } : {}),
      ...(plugin.release ? { release: plugin.release } : {}),
      ...(plugin.install ? { install: plugin.install } : {}),
      ...(plugin.note ? { note: plugin.note } : {}),
      ...(plugin.guide ? { guide: plugin.guide } : {}),
      ...(plugin.stack ? { stack: plugin.stack } : {}),
      next: plugin.install ? { command: plugin.install } : plugin.address ? { address: plugin.address } : { note: plugin.note ?? "Not yet published." },
    };
  });
  unique(rows, "plugins");
  return rows;
}

// A page's text as a reader sees it: tags and entities gone, a command
// continued with a trailing backslash joined onto one line, and runs of
// whitespace made single.
function pageText(page) {
  return readFileSync(join(siteRoot, page), "utf8")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\\\n\s*/g, " ")
    .replace(/\s+/g, " ");
}

// The command a single-task Guide starts with, recorded by hand in the
// registry. A Guide of several questions, paths or decisions has none. It must
// appear on the Guide's page, so the row cannot drift from it.
function guideCommand(guide) {
  check(guide.page, `guide ${guide.id}: a first command needs a site page to check it against`);
  const command = String(guide.command).replace(/\s+/g, " ").trim();
  check(pageText(guide.page).includes(command), `guide ${guide.id}: its first command does not appear on site/${guide.page}: ${command}`);
  return command;
}

function guideRows(registry) {
  const groups = new Map(registry.spec.groups.map((group) => [group.id, group.title]));
  check(registry.spec.groups[0]?.id === "journeys", "the five journeys must be the first group");
  for (const group of registry.spec.groups) {
    const extra = Object.keys(group).filter((key) => !["id", "title"].includes(key));
    check(extra.length === 0, `guide group ${group.id}: ${extra.join(", ")} belongs on a Guide, not a group`);
  }
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
      ...(guide.command ? { firstCommand: guideCommand(guide) } : {}),
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
  const properties = Object.fromEntries([...required, ...optional].map((field) => [field, fieldSchema(field, section)]));
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

function fieldSchema(field, section) {
  if (field === "guide") return { type: "object", required: ["address", "title"], additionalProperties: false, properties: { address: { type: "string", pattern: "^https://", minLength: 1 }, title: { type: "string", minLength: 1 } } };
  if (field === "state" && section === "configs") return { type: "string", minLength: 1, description: "Discovery classification: classified when the listing carries roles that cub config list --role finds, and not-classified otherwise. It is not a review or readiness state; checks says what was checked." };
  if (field === "checks") return { type: "object", description: "The listing's four assessment stages, each as evidenceState/resultState, for example completed/pass. completed means the stage's evidence exists for this exact configuration; pending, not-run and blocked mean it does not. It checks the configuration, not your values or your cluster.", required: ["inspection", "materialization", "destination", "post-deployment"], additionalProperties: false, properties: Object.fromEntries(["inspection", "materialization", "destination", "post-deployment"].map((stage) => [stage, { type: "string", pattern: "^[a-z-]+/[a-z-]+$" }])) };
  if (field === "firstCommand") return { type: "string", minLength: 1, description: "The one command a single-task Guide starts with, as the Guide prints it. Only a Guide that begins with one command carries it; a Guide of several questions, paths or decisions does not. Read the Guide for the inputs and what to look for." };
  if (field === "plugin") return { type: "string", description: "The cub plugin that runs this stack on real infrastructure. The stack row itself checks the composition without a cluster." };
  if (field === "stack" && section === "plugins") return { type: "string", description: "The Workshop stack this plugin runs. The stack's row checks its composition without a cluster; this plugin runs it on real infrastructure." };
  if (["objectCount", "partCount"].includes(field)) return { type: "integer", minimum: 0 };
  if (field === "checked") return { type: "boolean", description: "True when every part of the stack carries a receipt. It says the parts were checked, not that the stack has run; the stack check itself is static and needs the workshop plugin." };
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
  const pluginList = pluginRows(plugins);
  const stackList = stackRows(stacks);
  // A plugin that runs a Workshop stack names it, and the stack's row names the
  // plugin back, so an agent reading either one finds the other.
  for (const plugin of pluginList.filter((row) => row.stack)) {
    const stack = stackList.find((row) => row.id === plugin.stack);
    check(stack, `plugin ${plugin.id}: stack ${plugin.stack} is not a shipped platform stack`);
    check(!stack.plugin, `stack ${stack.id}: two plugins name it`);
    stack.plugin = plugin.id;
  }
  const docs = {
    configs: sectionDoc("configs", configRows(listings, input.readListing), ["site/listings/index.json", "site/listings/<id>.json"]),
    stacks: sectionDoc("stacks", stackList, ["data/workshop-stacks/stacks.yaml", "data/workshop-plugins/plugins.yaml"]),
    apps: sectionDoc("apps", appRows(apps), ["data/workshop-apps/apps.yaml"]),
    plugins: sectionDoc("plugins", pluginList, ["data/workshop-plugins/plugins.yaml"]),
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
  refuses("field on a guide group", (i) => { i.guides.spec.groups[1].command = "cub config check redis"; }, "belongs on a Guide, not a group");
  refuses("first command not on the page", (i) => { i.guides.spec.guides.find((g) => g.command).command = "cub no-such-command"; }, "does not appear on");
  refuses("plugin naming a missing stack", (i) => { i.plugins.spec.plugins.find((p) => p.stack).stack = "no-such-stack"; }, "is not a shipped platform stack");
  refuses("listing missing an assessment stage", (i) => {
    i.readListing = (listing) => {
      const record = readListingFile(listing);
      record.assessment.stages = record.assessment.stages.filter((stage) => stage.id !== "destination");
      return record;
    };
  }, "records no destination stage");
  refuses("unknown plugin state", (i) => { i.plugins.spec.plugins[0].state = "beta"; }, "state must be one of");
  refuses("released plugin without install", (i) => { delete i.plugins.spec.plugins[0].install; }, "lacks a repository, install command or release tag");
  refuses("short app commit", (i) => { i.apps.spec.apps[0].checkedCommit = "abc123"; }, "full commit");
  refuses("unknown delivery", (i) => { i.apps.spec.apps[0].delivery = "kubectl"; }, "delivery must be one of");
  refuses("missing guide page", (i) => { i.guides.spec.guides.find((g) => g.page).page = "no-such-page.html"; }, "does not exist");
  refuses("journeys not first", (i) => { i.guides.spec.groups.reverse(); }, "journeys must be the first group");
  refuses("four journeys", (i) => { i.guides.spec.guides.shift(); }, "five journeys");
  refuses("empty summary", (i) => { i.stacks.spec.stacks[0].description = " "; }, "has no summary");
  check(validate({ rows: [] }, schemaFor("plugins")).length > 0, "self-test: the schema accepted a document with no header");
  selfTestUpstreamReport();
  // Keep the issue tracker’s pure offline contract in this existing self-test
  // entry point, so the verify chain covers the report consumer as well.
  execFileSync(process.execPath, ["--test", "tests/workshop-drift-report.test.mjs"], { cwd: repoRoot, stdio: "inherit" });
  console.log("self-test passed: registry schema refusals, bounded upstream drift discovery, and the upstream issue tracker are all covered");
}

function selfTestUpstreamReport() {
  const sha = (letter) => letter.repeat(40);
  const releases = [
    { tag_name: "tool-v1.2.0-rc.1", published_at: "2026-10-03T00:00:00Z", prerelease: true, draft: false },
    { tag_name: "tool-v1.1.0", published_at: "2026-10-02T00:00:00Z", prerelease: false, draft: false },
    { tag_name: "tool-v1.0.0", published_at: "2026-10-01T00:00:00Z", prerelease: false, draft: false },
    { tag_name: "other-v9.0.0", published_at: "2026-10-04T00:00:00Z", prerelease: false, draft: false },
  ];
  const responses = new Map([
    ["repos/acme/tools/releases?per_page=100&page=1", releases],
    ["repos/acme/repo/commits/main", { sha: sha("b") }],
    ["repos/acme/repo/git/trees/" + sha("a") + "?recursive=1", { tree: [{ path: "apps/old.yaml", type: "blob", sha: "one" }, { path: "unchanged.yaml", type: "blob", sha: "same" }] }],
    ["repos/acme/repo/git/trees/" + sha("b") + "?recursive=1", { tree: [{ path: "apps/new.yaml", type: "blob", sha: "two" }, { path: "unchanged.yaml", type: "blob", sha: "same" }] }],
    ["repos/acme/stacks/commits/main", { sha: sha("d") }],
    ["repos/acme/stacks/git/trees/" + sha("c") + "?recursive=1", { tree: [{ path: "stacks/old.yaml", type: "blob", sha: "old" }] }],
    ["repos/acme/stacks/git/trees/" + sha("d") + "?recursive=1", { tree: [{ path: "stacks/new.yaml", type: "blob", sha: "new" }] }],
  ]);
  const calls = [];
  const client = githubClient((path) => {
    calls.push(path);
    check(responses.has(path), `self-test upstream: unexpected API path ${path}`);
    return responses.get(path);
  });
  const report = upstreamReport({
    plugins: [{ id: "tool", state: "released", repository: "acme/tools", release: { tag: "tool-v1.0.0" }, install: "cub plugin install acme/tools@tool-v1.0.0" }],
    apps: [
      { id: "renamed", repository: "acme/repo", path: "apps/old.yaml", branch: "main", checkedCommit: sha("a") },
      { id: "unchanged-path", repository: "acme/repo", path: "unchanged.yaml", branch: "main", checkedCommit: sha("a") },
    ],
    stacks: { repository: "acme/stacks", commit: sha("c") }, client,
  });
  check(report.plugins.length === 1 && report.plugins[0].latestTag === "tool-v1.1.0", "self-test upstream: stable prefixed release selection failed");
  check(report.apps.length === 1 && report.apps[0].files[0] === "apps/old.yaml", "self-test upstream: renamed app path was not reported");
  check(report.stacks.length === 1 && report.stacks[0].files[0] === "stacks/new.yaml", "self-test upstream: changed stack tree was not reported");
  check(calls.filter((path) => path === `repos/acme/repo/commits/main`).length === 1, "self-test upstream: repeated repository head was not cached");
  const modeClient = githubClient((path) => ({ tree: [{ path: "run.sh", type: "blob", sha: "same", mode: path.includes(sha("a")) ? "100644" : "100755" }] }));
  check(changedPaths("acme/repo", sha("a"), sha("b"), "run.sh", modeClient)[0] === "run.sh", "self-test upstream: executable mode change was missed");
  const missingStable = githubClient((path) => path === "repos/acme/tools/releases?per_page=100&page=1" ? [{ tag_name: "tool-v2.0.0-rc.1", prerelease: true, draft: false }] : { sha: sha("e") });
  let refusedMissingStable = false;
  try {
    upstreamReport({ plugins: [{ id: "tool", state: "released", repository: "acme/tools", release: { tag: "tool-v1.0.0" } }], apps: [], stacks: { repository: "acme/stacks", commit: sha("e") }, client: missingStable });
  } catch (error) {
    check(error.message.includes("no stable GitHub release"), `self-test upstream: missing stable release failed unclearly: ${error.message}`);
    refusedMissingStable = true;
  }
  check(refusedMissingStable, "self-test upstream: a missing stable release was accepted");
  const truncated = githubClient((path) => {
    if (path === "repos/acme/repo/commits/main") return { sha: sha("b") };
    if (path.includes("/git/trees/")) return { truncated: true, tree: [] };
    throw new Error(`self-test API error for ${path}`);
  });
  let refusedTruncated = false;
  try {
    upstreamReport({ plugins: [], apps: [{ id: "app", repository: "acme/repo", path: "apps", branch: "main", checkedCommit: sha("a") }], stacks: false, client: truncated });
  } catch (error) {
    check(error.message.includes("tree was truncated"), `self-test upstream: truncation failed unclearly: ${error.message}`);
    refusedTruncated = true;
  }
  check(refusedTruncated, "self-test upstream: truncated tree was accepted");
  try {
    upstreamReport({ plugins: [], apps: [{ id: "app", repository: "acme/error", path: "apps", branch: "main", checkedCommit: sha("a") }], stacks: false, client: githubClient(() => { throw new Error("GitHub API 503"); }) });
  } catch (error) {
    check(error.message.includes("GitHub API 503"), `self-test upstream: API error was hidden: ${error.message}`);
    return;
  }
  throw new Error("self-test upstream: an API error was accepted");
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

function ghJson(path) {
  const text = execFileSync("gh", ["api", path], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024,
  });
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`GitHub API returned invalid JSON for ${path}: ${error.message}`);
  }
}

// The command-line client keeps this script usable with either GH_TOKEN or an
// existing gh login. Its path cache is also important here: many app rows share
// the same repository, head and checked commit.
function githubClient(get = ghJson) {
  const cache = new Map();
  return {
    get(path) {
      if (!cache.has(path)) cache.set(path, get(path));
      return cache.get(path);
    },
  };
}

function tagPrefix(tag) {
  const match = String(tag).match(/^(.*?)(?:v?\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.-]+)?)$/);
  check(match, `release tag ${tag} does not end in a version`);
  return match[1];
}

function releaseFor(plugin, client) {
  const releases = [];
  for (let page = 1; ; page += 1) {
    const batch = client.get(`repos/${plugin.repository}/releases?per_page=100&page=${page}`);
    check(Array.isArray(batch), `${plugin.id}: GitHub releases response is not an array`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const prefix = tagPrefix(plugin.release.tag);
  const candidates = releases
    .filter((release) => !release.draft && !release.prerelease && typeof release.tag_name === "string")
    .filter((release) => {
      try { return tagPrefix(release.tag_name) === prefix; } catch { return false; }
    })
    .sort((left, right) => String(right.published_at ?? "").localeCompare(String(left.published_at ?? "")));
  check(candidates.length > 0, `${plugin.id}: no stable GitHub release matches ${prefix || "the unprefixed tag series"} in ${plugin.repository}`);
  const latest = candidates[0];
  check(latest.published_at, `${plugin.id}: latest stable release ${latest.tag_name} has no published_at`);
  return { tag: latest.tag_name, publishedAt: latest.published_at };
}

function commitSha(repository, ref, client) {
  const commit = client.get(`repos/${repository}/commits/${ref}`);
  check(/^[0-9a-f]{40}$/.test(commit?.sha ?? ""), `${repository}@${ref}: GitHub returned no full commit SHA`);
  return commit.sha;
}

function tree(repository, commit, client) {
  const result = client.get(`repos/${repository}/git/trees/${commit}?recursive=1`);
  check(result && result.truncated !== true, `${repository}@${commit}: recursive Git tree was truncated; refusing to hide possible path drift`);
  check(Array.isArray(result?.tree), `${repository}@${commit}: GitHub returned no recursive Git tree`);
  return new Map(result.tree.filter((entry) => ["blob", "commit"].includes(entry.type)).map((entry) => [entry.path, `${entry.type}:${entry.mode ?? ""}:${entry.sha}`]));
}

function changedPaths(repository, checkedCommit, head, path, client) {
  const before = tree(repository, checkedCommit, client);
  const after = tree(repository, head, client);
  const within = (name) => !path || name === path || name.startsWith(`${path}/`);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter(within)
    .filter((name) => before.get(name) !== after.get(name))
    .sort();
}

function compareUrl(repository, checkedCommit, head) {
  return `https://github.com/${repository}/compare/${checkedCommit}...${head}`;
}

export function upstreamReport(input = {}) {
  const plugins = input.plugins ?? readSource("plugins").spec.plugins;
  const apps = input.apps ?? readSource("apps").spec.apps;
  const stacks = input.stacks === false ? false : input.stacks ?? readSource("stacks").spec;
  const client = input.client ?? githubClient();
  const report = { plugins: [], apps: [], stacks: [] };
  for (const plugin of plugins.filter((row) => row.state === "released")) {
    const latest = releaseFor(plugin, client);
    if (latest.tag !== plugin.release.tag) report.plugins.push({
      id: plugin.id, repository: plugin.repository, currentTag: plugin.release.tag, latestTag: latest.tag, publishedAt: latest.publishedAt,
    });
  }
  for (const app of apps) {
    const head = commitSha(app.repository, app.branch, client);
    if (head === app.checkedCommit) continue;
    const files = changedPaths(app.repository, app.checkedCommit, head, app.path ?? "", client);
    if (!app.path || files.length) report.apps.push({
      id: app.id, repository: app.repository, path: app.path ?? "", checkedCommit: app.checkedCommit, head,
      compareUrl: compareUrl(app.repository, app.checkedCommit, head), files,
    });
  }
  if (stacks) {
    const head = commitSha(stacks.repository, "main", client);
    if (head !== stacks.commit) {
      const files = changedPaths(stacks.repository, stacks.commit, head, "stacks", client);
      if (files.length) report.stacks.push({
        repository: stacks.repository, checkedCommit: stacks.commit, head,
        compareUrl: compareUrl(stacks.repository, stacks.commit, head), files,
      });
    }
  }
  return report;
}

function hasDrift(report) {
  return report.plugins.length + report.apps.length + report.stacks.length > 0;
}

function formatDrift(report) {
  return JSON.stringify(report, null, 2);
}

function verifyUpstream() {
  const report = upstreamReport();
  if (hasDrift(report)) throw new Error(`the section registries have drifted from upstream:\n${formatDrift(report)}`);
  console.log("verified upstream: every released plugin is at its latest stable release, every app path and the stacks are unchanged since they were checked");
}

function writeUpstreamReport(path) {
  check(path, "--upstream-report needs an output path");
  const report = upstreamReport();
  write(path, `${formatDrift(report)}\n`);
  console.log(`wrote upstream drift report to ${path}: ${report.plugins.length} plugin(s), ${report.apps.length} app(s), ${report.stacks.length} stack snapshot(s)`);
}

function updatedPinnedInstall(plugin, latestTag) {
  const install = plugin.install;
  check(install.startsWith(`cub plugin install ${plugin.repository}`), `${plugin.id}: install command does not start with its repository`);
  const escaped = plugin.repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^(cub plugin install ${escaped})@([^\\s]+)(.*)$`);
  const match = install.match(pattern);
  if (!match) return install;
  return `${match[1]}@${latestTag}${match[2]}`;
}

function syncPlugins() {
  const registry = readSource("plugins");
  const report = upstreamReport({ plugins: registry.spec.plugins, apps: [], stacks: false });
  const byId = new Map(report.plugins.map((plugin) => [plugin.id, plugin]));
  let text = readFileSync(sources.plugins, "utf8");
  for (const plugin of registry.spec.plugins) {
    const update = byId.get(plugin.id);
    if (!update) continue;
    const start = text.indexOf(`    - id: ${plugin.id}\n`);
    check(start >= 0, `${plugin.id}: registry source has no matching row`);
    const next = text.indexOf("    - id: ", start + 1);
    const row = text.slice(start, next < 0 ? text.length : next);
    const release = `release: {tag: ${plugin.release.tag}, date: "${plugin.release.date}"}`;
    check(row.includes(release), `${plugin.id}: registry source release differs from parsed record`);
    let replacement = row.replace(release, `release: {tag: ${update.latestTag}, date: "${update.publishedAt.slice(0, 10)}"}`);
    const install = updatedPinnedInstall(plugin, update.latestTag);
    if (install !== plugin.install) {
      check(replacement.includes(`install: ${plugin.install}`), `${plugin.id}: registry source install differs from parsed record`);
      replacement = replacement.replace(`install: ${plugin.install}`, `install: ${install}`);
    }
    text = `${text.slice(0, start)}${replacement}${text.slice(next < 0 ? text.length : next)}`;
  }
  if (byId.size) write(sources.plugins, text);
  console.log(byId.size ? `updated ${byId.size} released plugin release pin(s); only already-pinned install commands changed and notes were left unchanged` : "released plugin pins already match latest stable releases");
}

function syncApps() {
  const report = upstreamReport({ plugins: [], stacks: false });
  if (!report.apps.length) console.log("no app paths changed; checked commits were left unchanged");
  else for (const app of report.apps) console.log(`${app.id}: ${app.files.join(", ") || "repository changed"}\n  ${app.compareUrl}`);
}

const args = process.argv.slice(2);
if (args.includes("--generate")) generate();
else if (args.includes("--verify")) verify();
else if (args.includes("--self-test")) selfTest();
else if (args.includes("--verify-upstream")) verifyUpstream();
else if (args.includes("--upstream-report")) writeUpstreamReport(args[args.indexOf("--upstream-report") + 1]);
else if (args.includes("--sync-plugins")) syncPlugins();
else if (args.includes("--sync-apps")) syncApps();
else if (args.includes("--sync-stacks")) syncStacks(args[args.indexOf("--sync-stacks") + 1]);
else if (args.includes("--sync-journeys")) syncJourneys(args[args.indexOf("--sync-journeys") + 1]);
else {
  console.error("usage: generate-workshop-sections.mjs --generate | --verify | --self-test | --verify-upstream | --upstream-report <path> | --sync-plugins | --sync-apps | --sync-stacks <cub-workshop dir> | --sync-journeys <workshop-demo dir>");
  process.exit(2);
}
