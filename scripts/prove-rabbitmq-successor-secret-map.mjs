#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { check, command, parseDocs, readYaml, repoRoot, sha256, sha256File, write } from "./lib/proof-common.mjs";

const source = "recipes/bitnami/rabbitmq/16.0.14/effective-values-existing-secret.yaml";
const variant = "recipes/bitnami/rabbitmq/16.0.14/variants/existing-secret/variant.yaml";
const target = "recipes/cloudpirates/rabbitmq/0.21.13/source-lock.yaml";
const output = join(repoRoot, "data/successor-track/rabbitmq-secret-switch-map");
const cases = [
  { name: "consolidated-keys", secret: "rabbitmq-consolidated", password: "rabbitmq-password", cookie: "rabbitmq-erlang-cookie" },
  { name: "alternate-keys", secret: "rabbitmq-switch-map-probe", password: "migration-password", cookie: "migration-cookie" },
];
function inputs() {
  const auth = readYaml(join(repoRoot, source)).spec.values.auth;
  const facts = readYaml(join(repoRoot, variant)).spec.targetFacts.requiredSecrets;
  const lock = readYaml(join(repoRoot, target)).spec;
  check(lock.ref === "cloudpirates/rabbitmq" && String(lock.version) === "0.21.13", "target identity changed");
  check(auth.existingPasswordSecret !== auth.existingErlangSecret, "source no longer uses separate Secrets");
  for (const [name, key] of [[auth.existingPasswordSecret, cases[0].password], [auth.existingErlangSecret, cases[0].cookie]]) {
    check(facts.some((fact) => fact.namespace === "rabbitmq" && fact.name === name && fact.keys.includes(key)), "source credential facts disagree");
  }
  return { sources: Object.fromEntries([source, variant, target].map((path) => [path, sha256File(join(repoRoot, path))])), sourceSecrets: { password: auth.existingPasswordSecret, cookie: auth.existingErlangSecret } };
}
function inspect(text, expected) {
  const docs = parseDocs(text);
  check(!docs.some((doc) => doc.kind === "Secret"), "target emitted a Secret");
  const workloads = docs.filter((doc) => doc.kind === "StatefulSet");
  check(workloads.length === 1, "expected one StatefulSet");
  const workload = workloads[0];
  check(workload.metadata.namespace === "rabbitmq" && workload.spec.replicas === 1, "target scope changed");
  const pod = workload.spec.template.spec;
  const app = pod.containers.find((item) => item.name === "rabbitmq");
  check(app && /@sha256:[a-f0-9]{64}$/.test(app.image), "digest-pinned RabbitMQ container missing");
  const refs = [];
  for (const container of [...(pod.initContainers ?? []), ...pod.containers]) {
    for (const env of container.env ?? []) {
      if (!["RABBITMQ_DEFAULT_PASS", "RABBITMQ_ERLANG_COOKIE"].includes(env.name)) continue;
      const ref = env.valueFrom?.secretKeyRef;
      const key = env.name === "RABBITMQ_DEFAULT_PASS" ? expected.password : expected.cookie;
      check(!Object.hasOwn(env, "value") && ref?.name === expected.secret && ref?.key === key && ref?.optional !== true, "credential reference does not match consolidation plan");
      refs.push({ container: container.name, environment: env.name, secret: ref.name, key: ref.key });
    }
  }
  check(refs.filter((ref) => ref.environment === "RABBITMQ_DEFAULT_PASS").length === 1 && refs.filter((ref) => ref.environment === "RABBITMQ_ERLANG_COOKIE").length === 2, "password or application/init cookie reference missing");
  return { objectCount: docs.length, renderedSecrets: 0, image: app.image, references: refs };
}
function summary(receipt) {
  return `# RabbitMQ successor credential switch map

The retained Bitnami RabbitMQ 16.0.14 configuration uses two Secrets:
password from ${receipt.sourceSecrets.password}, cookie from ${receipt.sourceSecrets.cookie}.
CloudPirates RabbitMQ 0.21.13 uses one auth.existingSecret for both.
The original two Secret names therefore cannot be transferred unchanged through
these successor auth settings. This is a credential consolidation prerequisite,
not a completed migration. See #1380 and #1757.

| Source | Successor | Required preparation |
| --- | --- | --- |
| auth.existingPasswordSecret | auth.existingSecret | Consolidate password and cookie into one existing Secret |
| auth.existingErlangSecret | auth.existingSecret | Use that same existing Secret |
| rabbitmq-password key | auth.existingPasswordKey | Set the retained key explicitly |
| rabbitmq-erlang-cookie key | auth.existingErlangCookieKey | Set the retained key explicitly |

Two deterministic renders prove explicit Secret-name and key selection, including
the init container cookie reference. Neither render emits a Secret. The alternate
case changes all three settings. The chart archive is checked against SourceLock
before rendering; captures trim trailing line whitespace after raw repeat equality.

| Case | Required Secret | Password key | Cookie key | Objects |
| --- | --- | --- | --- | ---: |
${receipt.cases.map((row, index) => `| ${row.name} | ${cases[index].secret} | ${cases[index].password} | ${cases[index].cookie} | ${row.observation.objectCount} |`).join("\n")}

## Boundary and operator action

The operator must provision the consolidated Secret in namespace rabbitmq,
preserving the intended password and Erlang cookie, before installation. No
credential values are read, copied, or created by this proof. Target scope is one
replica with its own digest-pinned image and default username; username, topology,
storage, service names, and other overrides still require migration review.
This does not prove installation, package equivalence, data migration, cluster
readiness, or supported status. Catalog verdicts remain unchanged.

## Evidence

- [Receipt](receipt.json) binds source files and rendered observations.
- [Consolidated keys render](consolidated-keys.yaml).
- [Alternate keys render](alternate-keys.yaml).

Generate with \`node scripts/prove-rabbitmq-successor-secret-map.mjs --generate\`.
Use \`--verify\` for retained evidence and \`--self-test\` for negative checks.
`;
}
function verify() {
  const receipt = JSON.parse(readFileSync(join(output, "receipt.json"), "utf8"));
  const current = inputs();
  check(receipt.kind === "RabbitMQSuccessorSecretSwitchMap" && receipt.status === "requires-secret-consolidation", "receipt scope changed");
  check(receipt.renderNormalization === "trim-trailing-line-whitespace", "normalization changed");
  for (const key of ["sources", "sourceSecrets"]) check(JSON.stringify(receipt[key]) === JSON.stringify(current[key]), `${key} changed`);
  check(receipt.cases.length === cases.length, "case count changed");
  for (const expected of cases) {
    const text = readFileSync(join(output, `${expected.name}.yaml`), "utf8");
    const row = receipt.cases.find((item) => item.name === expected.name);
    check(row?.renderSHA256 === sha256(text) && row.deterministicAcrossTwoRenders === true, "render witness changed");
    check(JSON.stringify(row.observation) === JSON.stringify(inspect(text, expected)), "observation changed");
  }
  check(readFileSync(join(output, "summary.md"), "utf8") === summary(receipt), "summary stale");
  console.log("verified RabbitMQ credential mapping: consolidation required, two static cases");
}
const mode = process.argv[2] ?? "--verify";
if (mode === "--generate") {
  const current = inputs();
  const lock = readYaml(join(repoRoot, target)).spec;
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-rabbit-map-"));
  try {
    command("helm", ["pull", lock.repositoryURL, "--version", String(lock.version), "--destination", temp]);
    const archive = join(temp, `rabbitmq-${lock.version}.tgz`);
    check(sha256File(archive) === lock.packageSHA256, "chart archive differs from SourceLock");
    const receipt = { kind: "RabbitMQSuccessorSecretSwitchMap", status: "requires-secret-consolidation", ...current, renderNormalization: "trim-trailing-line-whitespace", helmVersion: command("helm", ["version", "--short"]).trim(), cases: [] };
    for (const expected of cases) {
      const args = ["template", "rabbitmq", archive, "--namespace", "rabbitmq", "--kube-version", "1.30.0", "--include-crds", "--skip-tests", "--no-hooks", "--set-string", `auth.existingSecret=${expected.secret}`, "--set-string", `auth.existingPasswordKey=${expected.password}`, "--set-string", `auth.existingErlangCookieKey=${expected.cookie}`];
      const raw = command("helm", args);
      check(raw === command("helm", args), "render is nondeterministic");
      const text = raw.split("\n").map((line) => line.trimEnd()).join("\n");
      const observation = inspect(text, expected);
      write(join(output, `${expected.name}.yaml`), text);
      receipt.cases.push({ name: expected.name, renderSHA256: sha256(text), deterministicAcrossTwoRenders: true, observation });
    }
    write(join(output, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    write(join(output, "summary.md"), summary(receipt));
  } finally { rmSync(temp, { recursive: true, force: true }); }
  verify();
} else if (mode === "--verify") verify();
else if (mode === "--self-test") {
  const expected = cases[1];
  const text = readFileSync(join(output, `${expected.name}.yaml`), "utf8");
  inspect(text, expected);
  for (const changed of [text.replaceAll(expected.password, "wrong-password-key"), text.replaceAll(expected.cookie, "wrong-cookie-key"), text.replaceAll(expected.secret, "wrong-secret"), `${text}\n---\napiVersion: v1\nkind: Secret\nmetadata:\n  name: unexpected\n`]) {
    let rejected = false;
    try { inspect(changed, expected); } catch { rejected = true; }
    check(rejected, "accepted invalid credential evidence");
  }
  console.log("self-test passed: wrong password key, cookie key, Secret name, and emitted Secret rejected");
} else throw new Error("use --generate, --verify, or --self-test");
