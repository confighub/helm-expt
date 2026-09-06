#!/usr/bin/env node

// A static values switch-map witness, not an upgrade or support-promotion proof.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { check, command, parseDocs, readYaml, repoRoot, sha256, sha256File, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const sourceValues = "recipes/bitnami/redis/25.5.3/effective-values-reuse-existing-secret.yaml";
const sourceVariant = "recipes/bitnami/redis/25.5.3/variants/reuse-existing-secret/variant.yaml";
const targetLock = "recipes/cloudpirates/redis/0.34.11/source-lock.yaml";
const output = join(repoRoot, "data/successor-track/redis-secret-switch-map");
const receiptPath = join(output, "receipt.json");
const mappings = ["auth.existingSecret", "auth.existingSecretPasswordKey"];
const flags = ["--namespace", "redis", "--kube-version", "1.30.0", "--include-crds", "--skip-tests", "--no-hooks"];
const fileHash = (path) => sha256File(join(repoRoot, path));

function inputs() {
  const lock = readYaml(join(repoRoot, targetLock)).spec;
  check(lock.ref === "cloudpirates/redis" && String(lock.version) === "0.34.11", "target chart identity changed");
  const auth = readYaml(join(repoRoot, sourceValues)).spec.values.auth;
  const required = readYaml(join(repoRoot, sourceVariant)).spec.targetFacts.requiredSecrets[0];
  check(auth.existingSecret === required.name && required.keys.includes(auth.existingSecretPasswordKey), "source values disagree with the required Secret");
  check(required.namespace === "redis", "source Secret namespace changed");
  return {
    sources: Object.fromEntries([sourceValues, sourceVariant, targetLock].map((path) => [path, fileHash(path)])),
    cases: [
      { name: "retained-values", secret: auth.existingSecret, key: auth.existingSecretPasswordKey },
      { name: "alternate-values", secret: "redis-switch-map-probe", key: "migration-password" },
    ],
  };
}

function inspect(text, expected) {
  const docs = parseDocs(text);
  check(!docs.some((doc) => doc.kind === "Secret"), "existing-secret values emitted a Secret");
  const workloads = docs.filter((doc) => doc.kind === "StatefulSet");
  check(workloads.length === 1, "expected one standalone Redis StatefulSet");
  const workload = workloads[0];
  check(workload.metadata.namespace === "redis" && workload.spec.replicas === 1, "standalone Redis scope changed");
  const pod = workload.spec.template.spec;
  const account = docs.find((doc) => doc.kind === "ServiceAccount" && doc.metadata.name === pod.serviceAccountName);
  check(account?.metadata.namespace === "redis", "workload ServiceAccount is not supplied");
  const redis = pod.containers.find((container) => container.name === "redis");
  check(redis, "Redis container missing");
  check(/@sha256:[a-f0-9]{64}$/.test(redis.image), "successor image is not digest-pinned");
  for (const name of ["REDIS_PASSWORD", "REDISCLI_AUTH"]) {
    const env = redis.env.filter((item) => item.name === name);
    check(env.length === 1 && !Object.hasOwn(env[0], "value"), `${name} is missing, duplicated, or inline`);
    const ref = env[0].valueFrom?.secretKeyRef;
    check(ref?.name === expected.secret && ref?.key === expected.key && ref?.optional !== true, `${name} does not use the mapped required Secret key`);
  }
  return { objectCount: docs.length, renderedSecrets: 0, image: redis.image, replicas: 1, requiredSecret: { namespace: "redis", name: expected.secret, key: expected.key }, mappedEnvironmentVariables: ["REDIS_PASSWORD", "REDISCLI_AUTH"] };
}

function summary(receipt) {
  return `# Redis successor existing-secret switch map

This static witness maps two reviewed Bitnami Redis 25.5.3 values to
CloudPirates Redis 0.34.11. Both keep their names:

| Source value | Successor value | Effect checked |
| --- | --- | --- |
| auth.existingSecret | auth.existingSecret | Required Secret name for REDIS_PASSWORD and REDISCLI_AUTH |
| auth.existingSecretPasswordKey | auth.existingSecretPasswordKey | Required key for both environment variables |

The source values come from the retained reuse-existing-secret base. A second
render uses a different name and a non-default key to prove that both settings
take effect. Committed captures strip trailing line whitespace; the receipt
records that normalization. The chart archive must match the existing successor SourceLock
SHA before it is rendered. Each case is rendered twice and must be identical.

| Case | Required Secret | Required key | Objects | Rendered Secrets |
| --- | --- | --- | ---: | ---: |
${receipt.cases.map((row) => `| ${row.name} | ${row.observation.requiredSecret.name} | ${row.observation.requiredSecret.key} | ${row.observation.objectCount} | ${row.observation.renderedSecrets} |`).join("\n")}

## Boundary

The target is explicitly standalone, one replica in namespace redis, with
serviceAccount.create=true. The target keeps its own digest-pinned image.
The old image.digest value is not transferable to the successor image schema.
This maps credential references only: replication, Sentinel, persistence,
storage data, service names, and other overrides need their own migration work.
The required Secret must already exist at installation; no password is copied.

This does not certify a workload migration, package equivalence, installation,
live readiness, or supported status. The retiring and successor catalog
statuses are unchanged. See #1380 and #1757.

## Evidence

- [Receipt](receipt.json), with input and render digests and observations.
- [Retained-values render](retained-values.yaml).
- [Alternate-values render](alternate-values.yaml).

Generate with \`node scripts/prove-redis-successor-secret-map.mjs --generate\`.
Verify committed evidence with \`--verify\`; run negative checks with \`--self-test\`.
`;
}

function verify() {
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  const current = inputs();
  check(receipt.kind === "RedisSuccessorSecretSwitchMap", "wrong switch-map receipt kind");
  check(receipt.renderNormalization === "trim-trailing-line-whitespace", "render normalization changed");
  check(JSON.stringify(receipt.sources) === JSON.stringify(current.sources), "switch-map input digests changed");
  check(JSON.stringify(receipt.mappings) === JSON.stringify(mappings), "switch-map fields changed");
  check(receipt.cases.length === current.cases.length, "switch-map case count changed");
  for (const expected of current.cases) {
    const row = receipt.cases.find((item) => item.name === expected.name);
    const text = readFileSync(join(output, `${expected.name}.yaml`), "utf8");
    check(row?.renderSHA256 === sha256(text) && row.deterministicAcrossTwoRenders === true, "render digest or determinism witness changed");
    check(JSON.stringify(row.observation) === JSON.stringify(inspect(text, expected)), "render does not support switch-map observation");
  }
  check(readFileSync(join(output, "summary.md"), "utf8") === summary(receipt), "switch-map summary is stale");
  console.log("verified Redis successor switch map: two credential fields, two rendered cases");
}

if (mode === "--generate") {
  const lock = readYaml(join(repoRoot, targetLock)).spec;
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-secret-map-"));
  try {
    command("helm", ["pull", lock.repositoryURL, "--version", String(lock.version), "--destination", temp]);
    const archive = join(temp, `redis-${lock.version}.tgz`);
    check(sha256File(archive) === lock.packageSHA256, "successor chart archive differs from its pinned SourceLock");
    const current = inputs();
    const receipt = { kind: "RedisSuccessorSecretSwitchMap", sources: current.sources, mappings, renderNormalization: "trim-trailing-line-whitespace", helmVersion: command("helm", ["version", "--short"]).trim(), cases: [] };
    for (const expected of current.cases) {
      const args = ["template", "redis", archive, ...flags, "--set", "architecture=standalone", "--set", "serviceAccount.create=true", "--set-string", `auth.existingSecret=${expected.secret}`, "--set-string", `auth.existingSecretPasswordKey=${expected.key}`];
      const raw = command("helm", args);
      check(raw === command("helm", args), "successor credential render is nondeterministic");
      const first = raw.split("\n").map((line) => line.trimEnd()).join("\n");
      const observation = inspect(first, expected);
      write(join(output, `${expected.name}.yaml`), first);
      receipt.cases.push({ name: expected.name, renderSHA256: sha256(first), deterministicAcrossTwoRenders: true, observation });
    }
    write(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    write(join(output, "summary.md"), summary(receipt));
  } finally { rmSync(temp, { recursive: true, force: true }); }
  verify();
} else if (mode === "--verify") verify();
else if (mode === "--self-test") {
  const expected = inputs().cases[1];
  const text = readFileSync(join(output, `${expected.name}.yaml`), "utf8");
  inspect(text, expected);
  for (const changed of [text.replaceAll(expected.key, "wrong-key"), text.replaceAll(expected.secret, "wrong-secret"), `${text}\n---\napiVersion: v1\nkind: Secret\nmetadata:\n  name: unexpected\n`]) {
    let rejected = false;
    try { inspect(changed, expected); } catch { rejected = true; }
    check(rejected, "switch-map accepted a wrong credential reference or rendered Secret");
  }
  console.log("self-test passed: wrong key, wrong Secret name, and emitted Secret are rejected");
} else throw new Error("use --generate, --verify, or --self-test");
