#!/usr/bin/env node

// Refuse a literal credential value anywhere in committed configuration.
//
// The AICR inference compiler has refused literal values assigned to NGC_API_KEY
// and HF_TOKEN since the license read, because retaining an upstream document
// that carries a key would publish that key. That rule was never AICR-specific.
// Every producer in this repository writes configuration, and any of them could
// commit a secret surface holding a value instead of a name.
//
// This applies it everywhere. It walks committed YAML structurally rather than
// by line, so a credential-shaped key inside a CRD's schema description is not
// mistaken for an assignment, and it looks at the shape Kubernetes actually
// uses: an environment variable with a name and a value.
//
// The policy lives at tests/credential-boundary.yaml, including every exception
// with the reason it is not a credential. The lane refuses an exception that
// matches nothing, so a stale exemption cannot outlive the thing it excused.
//
// What it deliberately does not cover: the contents of Secret objects, which
// npm run default-credential-check already examines for fixed defaults shared
// across installs. Two lanes looking at the same bytes from the same angle
// would be one lane and one copy.
//
// Everything runs offline against committed bytes.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, py, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const policyPath = join(repoRoot, "tests", "credential-boundary.yaml");
const summaryPath = join(repoRoot, "data", "credential-boundary", "summary.md");

// The walk itself runs in one python process rather than one per file. The
// repository holds around ten thousand candidate documents, and a process per
// document put this lane at five minutes, which is a cost every contributor
// would pay on every run. The policy still lives in one place: its patterns are
// handed to that process rather than restated there.
const WALK = `
import json, re, sys, yaml

payload = json.loads(sys.stdin.read())
name_re = re.compile(payload["credentialName"], re.I)
not_a_value = [re.compile(p, re.I) for p in payload["notAValue"]]
not_a_secret_name = [re.compile(p, re.I) for p in payload["notASecretValueName"]]

class ManifestLoader(yaml.SafeLoader):
    pass
ManifestLoader.add_constructor("tag:yaml.org,2002:value", lambda loader, node: loader.construct_scalar(node))

findings = []
scanned = skipped = unparsed = 0

def walk(node, path):
    if isinstance(node, list):
        for item in node:
            walk(item, path)
        return
    if not isinstance(node, dict):
        return
    name = node.get("name")
    if isinstance(name, str) and "value" in node and isinstance(node.get("value"), (str, int)):
        value = str(node["value"]).strip()
        if (
            value
            and name_re.search(name)
            and not any(rule.search(name) for rule in not_a_secret_name)
            and not any(rule.match(value) for rule in not_a_value)
        ):
            findings.append({"file": path, "variable": name, "value": value})
    for child in node.values():
        walk(child, path)

for path in payload["files"]:
    try:
        with open(path, "r", errors="replace") as handle:
            text = handle.read()
    except OSError:
        continue
    # An assignment can only exist if the variable name appears verbatim, so a
    # document mentioning none of the credential words cannot hold one.
    if not name_re.search(text):
        skipped += 1
        continue
    try:
        docs = [doc for doc in yaml.load_all(text, Loader=ManifestLoader) if isinstance(doc, (dict, list))]
    except Exception:
        unparsed += 1
        continue
    scanned += 1
    for doc in docs:
        walk(doc, path)

print(json.dumps({"findings": findings, "scanned": scanned, "skipped": skipped, "unparsed": unparsed}))
`;

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-credential-boundary.mjs --generate
  node scripts/verify-credential-boundary.mjs --verify
  node scripts/verify-credential-boundary.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const report = audit(loadPolicy(), trackedFiles());
  write(summaryPath, renderSummary(report));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = audit(loadPolicy(), trackedFiles());
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run credential-boundary:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run credential-boundary:generate`,
  );
  console.log(
    `verified the credential boundary across ${report.scanned + report.skipped} committed document(s): ${report.excused.length} declared exception(s), no undeclared literal credential values`,
  );
} else {
  selfTest();
  console.log("verified the credential-boundary checker against fake documents");
}

function loadPolicy(path = policyPath) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const doc = readYaml(path);
  check(doc.kind === "CredentialBoundaryPolicy", `${relativeRepo(path)}: expected kind CredentialBoundaryPolicy`);
  const spec = doc.spec ?? {};
  check((spec.credentialNamePatterns ?? []).length > 0, `${relativeRepo(path)}: no credential name patterns are declared`);
  const seen = new Set();
  for (const exception of spec.exceptions ?? []) {
    check(exception.id, `${relativeRepo(path)}: an exception declares no id`);
    check(!seen.has(exception.id), `${relativeRepo(path)}: two exceptions share the id ${exception.id}`);
    seen.add(exception.id);
    check(exception.variable && exception.value !== undefined, `${relativeRepo(path)}: exception ${exception.id} names no variable and value`);
    check(exception.reason, `${relativeRepo(path)}: exception ${exception.id} gives no reason`);
  }
  for (const group of ["notAValue", "notASecretValueName"]) {
    for (const rule of spec[group] ?? []) {
      check(rule.id && rule.pattern && rule.reason, `${relativeRepo(path)}: a ${group} rule is missing an id, pattern, or reason`);
    }
  }
  // Patterns are compiled case-insensitively. Environment variable names are
  // conventionally upper case and values are not, and a policy that had to
  // spell both would be a policy about spelling.
  return {
    path,
    spec,
    credentialName: new RegExp(`(${spec.credentialNamePatterns.join("|")})`, "i"),
    notAValue: (spec.notAValue ?? []).map((rule) => ({ ...rule, regex: new RegExp(rule.pattern, "i") })),
    notASecretValueName: (spec.notASecretValueName ?? []).map((rule) => ({ ...rule, regex: new RegExp(rule.pattern, "i") })),
    exceptions: spec.exceptions ?? [],
  };
}

function trackedFiles() {
  // The tracked-file list runs to tens of megabytes in this repository, so the
  // buffer is raised rather than left at the default that truncates it.
  const output = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return output.split("\n").filter(Boolean);
}

function audit(policy, files) {
  const include = policy.spec.scope?.include ?? [".yaml", ".yml"];
  const includePrefixes = policy.spec.scope?.includePrefixes ?? [];
  check(includePrefixes.length > 0, `${relativeRepo(policy.path)}: the policy names no directories to scan`);
  const targets = files
    .filter(
      (file) => include.some((suffix) => file.endsWith(suffix)) && includePrefixes.some((prefix) => file.startsWith(prefix)),
    )
    .filter((file) => existsSync(join(repoRoot, file)));
  check(targets.length > 0, "no committed documents matched the policy scope");

  const walked = py(WALK, JSON.stringify({
    files: targets.map((file) => join(repoRoot, file)),
    credentialName: `(${policy.spec.credentialNamePatterns.join("|")})`,
    notAValue: (policy.spec.notAValue ?? []).map((rule) => rule.pattern),
    notASecretValueName: (policy.spec.notASecretValueName ?? []).map((rule) => rule.pattern),
  }));
  const findings = walked.findings.map((row) => ({
    file: relativeRepo(row.file),
    variable: row.variable,
    value: row.value,
  }));

  const excused = [];
  const undeclared = [];
  for (const finding of findings) {
    const exception = policy.exceptions.find(
      (row) => row.variable === finding.variable && String(row.value) === finding.value,
    );
    if (exception) excused.push({ ...finding, exception: exception.id });
    else undeclared.push(finding);
  }

  check(
    undeclared.length === 0,
    `these committed documents assign a literal value to a credential variable: ${undeclared
      .slice(0, 5)
      .map((row) => `${row.file} sets ${row.variable}`)
      .join("; ")}${undeclared.length > 5 ? `, and ${undeclared.length - 5} more` : ""}`,
  );

  // An exception nobody triggers is an exemption that outlived its cause.
  const stale = policy.exceptions.filter((row) => !excused.some((finding) => finding.exception === row.id));
  check(
    stale.length === 0,
    `${relativeRepo(policy.path)}: ${stale.map((row) => row.id).join(", ")} match nothing and should be removed`,
  );

  return {
    policy,
    scanned: walked.scanned,
    skipped: walked.skipped,
    unparsed: walked.unparsed,
    findings,
    excused,
    undeclared,
  };
}

function renderSummary(report) {
  const rows = report.policy.exceptions
    .map((exception) => {
      const files = report.excused.filter((row) => row.exception === exception.id);
      return `| \`${exception.id}\` | \`${exception.variable}\` | ${files.length} | ${exception.reason.replace(/\s+/g, " ").trim()} |`;
    })
    .join("\n");
  const notAValueRows = [...report.policy.notAValue, ...report.policy.notASecretValueName]
    .map((rule) => `| \`${rule.id}\` | \`${rule.pattern}\` | ${rule.reason.replace(/\s+/g, " ").trim()} |`)
    .join("\n");

  return `# The credential boundary, applied to every producer

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run credential-boundary:generate\` and checked by
\`npm run credential-boundary:verify\`. The policy is hand-authored at
\`${relativeRepo(report.policy.path)}\`.

No committed configuration assigns a literal value to a credential-shaped
environment variable. Secret surfaces carry names or substitutions, and the
value arrives at install time.

The AICR inference compiler has enforced this for one entry since the NGC
license read, because retaining an upstream document that carried a key would
publish that key. The rule was never AICR-specific, and this is it applied
everywhere: ${report.scanned + report.skipped} committed documents in scope,
${report.undeclared.length} undeclared literal credential values.

## How a value is judged

The scan walks parsed documents structurally rather than by line, so a
credential-shaped key inside a schema description is not mistaken for an
assignment. It looks for the shape Kubernetes uses, an environment variable
with a name and a value, and then applies these rules.

| Rule | Pattern | Why it is not a credential |
| --- | --- | --- |
${notAValueRows}

## The declared exceptions

Everything the scan still finds is listed here with the reason it is not a
credential in that place. The lane refuses an exception that matches nothing,
so a stale exemption cannot outlive the thing it excused.

| Exception | Variable | Occurrences | Reason |
| --- | --- | --- | --- |
${rows}

Two of these are worth reading twice. The bring-your-own-values review keeps a
key that looks leaked because that line is the finding it demonstrates
catching, and deleting it would delete the evidence that the review works. The
Vault dev-mode token is upstream's own default in a base named for dev mode,
and rewriting it would misrepresent what the chart ships.

## What this does not cover

The contents of Secret objects. \`npm run default-credential-check\` already
examines those for fixed defaults shared across installs, which is a different
failure with a different test. Two lanes reading the same bytes from the same
angle would be one lane and one copy.

It also cannot tell a real credential from a convincing string. It refuses a
literal value in a secret surface whatever that value means, which is the point:
the shape is the problem, and judging the string would be guessing.

${report.skipped} documents mention none of the credential words, so they cannot hold an
assignment and are not parsed. The remaining ${report.scanned} are parsed and walked, and
${report.unparsed} could not be parsed and are counted rather than skipped silently.

Everything runs offline against committed bytes. No cluster, no organization,
and no network takes part.
`;
}

// The self-test drives the checker with fake documents, so every refusal runs
// without touching the committed corpus.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "credential-boundary-self-test-"));
  try {
    const base = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "CredentialBoundaryPolicy",
      metadata: { name: "fixture" },
      spec: {
        scope: { include: [".yaml"], includePrefixes: ["examples/credential-boundary-fixture/"] },
        credentialNamePatterns: ["password", "token"],
        notAValue: [{ id: "substitution", pattern: "^\\$", reason: "fixture" }],
        notASecretValueName: [{ id: "file", pattern: "_FILE$", reason: "fixture" }],
        exceptions: [{ id: "known", variable: "DEMO_TOKEN", value: "placeholder", reason: "fixture" }],
      },
    };
    const writePolicy = (name, mutate) => {
      const value = JSON.parse(JSON.stringify(base));
      mutate(value);
      const path = join(scratch, `${name}.yaml`);
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      return path;
    };
    const fails = (fn, pattern) => {
      try {
        fn();
        return false;
      } catch (error) {
        return pattern.test(String(error.message));
      }
    };

    // The scan reads files relative to the repository root, so fixtures live
    // under it and are removed at the end.
    const fixtureDir = join(repoRoot, "examples", "credential-boundary-fixture");
    const rel = (name) => `examples/credential-boundary-fixture/${name}`;
    const podWith = (env) =>
      `${JSON.stringify({ kind: "Pod", spec: { containers: [{ name: "app", env }] } })}\n`;

    try {
      write(join(fixtureDir, "clean.yaml"), podWith([
        { name: "DB_PASSWORD", value: "$DB_PASSWORD" },
        { name: "DB_PASSWORD_FILE", value: "/run/secrets/db" },
        { name: "DEMO_TOKEN", value: "placeholder" },
      ]));
      const policy = loadPolicy(writePolicy("good", () => {}));
      const clean = audit(policy, [rel("clean.yaml")]);
      check(clean.excused.length === 1 && clean.undeclared.length === 0, "self-test did not excuse the declared exception");

      write(join(fixtureDir, "leak.yaml"), podWith([{ name: "DB_PASSWORD", value: "hunter2" }]));
      check(
        fails(() => audit(policy, [rel("clean.yaml"), rel("leak.yaml")]), /assign a literal value to a credential variable/),
        "self-test accepted an undeclared literal credential value",
      );

      // A schema that describes a password must not read as one.
      write(
        join(fixtureDir, "schema.yaml"),
        `${JSON.stringify({ kind: "CustomResourceDefinition", spec: { versions: [{ schema: { openAPIV3Schema: { properties: { password: { type: "string", description: "the password to use" } } } } }] } })}\n`,
      );
      const schema = audit(policy, [rel("clean.yaml"), rel("schema.yaml")]);
      check(schema.undeclared.length === 0, "self-test read a schema description as an assignment");

      check(
        fails(() => audit(loadPolicy(writePolicy("stale", (value) => {
          value.spec.exceptions.push({ id: "unused", variable: "GONE_TOKEN", value: "x", reason: "fixture" });
        })), [rel("clean.yaml")]), /unused match nothing and should be removed/),
        "self-test accepted an exception matching nothing",
      );
      check(
        fails(() => loadPolicy(writePolicy("reasonless", (value) => {
          delete value.spec.exceptions[0].reason;
        })), /gives no reason/),
        "self-test accepted an exception with no reason",
      );
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
