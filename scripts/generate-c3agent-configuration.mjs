#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  repoRoot,
  sha256,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const exampleRoot = join(repoRoot, "examples", "c3agent", "fleet-config");
const outputRoot = join(exampleRoot, "rendered");
const recordsRoot = join(exampleRoot, "records");
const layoutRoot = join(exampleRoot, "oci-layout");
const basePath = join(exampleRoot, "c3agent.yaml");
const overlays = {
  development: [],
  staging: [join(exampleRoot, "c3agent-staging.yaml")],
  production: [
    join(exampleRoot, "c3agent-staging.yaml"),
    join(exampleRoot, "c3agent-prod.yaml"),
  ],
};
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const deployableLayerType = "application/vnd.oci.image.layer.v1.tar+gzip";
const layoutTag = "development";
const archiveName = "c3agent-fleet-development.tar.gz";

if (mode === "--generate") {
  generate(exampleRoot);
  console.log("generated c3agent configuration example");
} else if (mode === "--verify") {
  verify();
  console.log("verified c3agent configuration example");
} else if (mode === "--self-test") {
  selfTest();
  console.log("verified c3agent configuration self-test");
} else {
  console.error(`Usage: node ${relative(repoRoot, import.meta.filename)} --generate|--verify|--self-test`);
  process.exitCode = 2;
}

function generate(root) {
  requireCommand("oras");
  const base = readYaml(join(root, "c3agent.yaml"));
  const environments = {};

  for (const [environment, overlayPaths] of Object.entries(overlays)) {
    const config = overlayPaths.reduce(
      (current, overlayPath) => deepMerge(current, readYaml(relocate(root, overlayPath))),
      structuredClone(base),
    );
    validateConfig(config, environment);
    const objects = renderObjects(config, environment);
    const manifest = serializeDocuments(objects);
    const objectSetSha256 = hashObjects(objects);
    const intent = renderIntent(config, environment, objects, objectSetSha256);
    environments[environment] = { config, objects, manifest, objectSetSha256, intent };

    write(
      join(root, "rendered", environment, "release-objects.yaml"),
      manifest,
    );
    writeYaml(join(root, "records", `${environment}-source-and-intent.yaml`), intent);
  }

  const changes = compareEnvironments(environments);
  write(
    join(root, "records", "environment-changes.json"),
    `${JSON.stringify(changes, null, 2)}\n`,
  );
  writeYaml(join(root, "records", "lifecycle.yaml"), lifecycleRecord(base));
  buildLayout(root, environments.development);
}

function verify() {
  for (const path of [basePath, ...new Set(Object.values(overlays).flat())]) {
    check(existsSync(path), `${relative(repoRoot, path)} is missing`);
  }
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-c3agent-"));
  try {
    for (const name of ["c3agent.yaml", "c3agent-staging.yaml", "c3agent-prod.yaml"]) {
      writeFileSync(join(tempRoot, name), readFileSync(join(exampleRoot, name)));
    }
    generate(tempRoot);
    for (const path of listFiles(tempRoot)) {
      const rel = relative(tempRoot, path);
      const committed = join(exampleRoot, rel);
      check(existsSync(committed), `${relative(repoRoot, committed)} is missing`);
      check(
        readFileSync(path).equals(readFileSync(committed)),
        `${relative(repoRoot, committed)} is stale; run npm run c3agent-config:generate`,
      );
    }
    for (const path of listFiles(exampleRoot)) {
      const rel = relative(exampleRoot, path);
      if (rel === "README.md") continue;
      check(existsSync(join(tempRoot, rel)), `${relative(repoRoot, path)} is not generated`);
    }

    const development = parseDocs(
      readFileSync(join(outputRoot, "development", "release-objects.yaml"), "utf8"),
    );
    check(development.length === 10, "development must contain ten Kubernetes objects");
    check(!development.some((object) => object.kind === "Secret"), "portable output must not contain a Secret");
    check(
      JSON.stringify(development).includes("secretKeyRef")
        && JSON.stringify(development).includes("c3agent-runtime-secrets"),
      "portable output must retain its Secret reference",
    );
    check(
      !/REPLACE_ME|sk-ant-|xox[bap]-|github_pat_/i.test(JSON.stringify(development)),
      "portable output contains credential material or a credential placeholder",
    );
    verifyLayout(development);

    const changes = JSON.parse(readFileSync(join(recordsRoot, "environment-changes.json"), "utf8"));
    check(
      sameStrings(changes.developmentToStaging.paths, [
        "spec.fleet.maxBudgetUsd",
        "spec.fleet.maxConcurrentTasks",
      ]),
      "staging changes an unexpected source field",
    );
    check(
      sameStrings(changes.stagingToProduction.paths, [
        "spec.fleet.maxBudgetUsd",
        "spec.fleet.maxConcurrentTasks",
        "spec.fleet.scheduleIntervalSeconds",
      ]),
      "production changes an unexpected source field",
    );
    for (const transition of Object.values(changes)) {
      check(
        sameStrings(transition.changedObjects, ["v1|ConfigMap|c3agent|coding-fleet-config"]),
        "an environment transition changes more than the fleet ConfigMap",
      );
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function selfTest() {
  const base = readYaml(basePath);
  for (const mutation of [
    (value) => { value.spec.images.agent = "ghcr.io/confighubai/c3agent/agent:latest"; },
    (value) => { value.spec.credentials.inlineValue = "not-allowed"; },
    (value) => { value.spec.activation.controlplaneReplicas = 1; },
  ]) {
    const candidate = structuredClone(base);
    mutation(candidate);
    let rejected = false;
    try {
      validateConfig(candidate, "development");
    } catch {
      rejected = true;
    }
    check(rejected, "an unsafe c3agent fixture mutation was accepted");
  }
}

function renderObjects(config, environment) {
  const name = config.metadata.name;
  const namespace = config.spec.namespace;
  const labels = { app: "c3agent", fleet: name };
  const secretName = config.spec.credentials.secretName;
  const configName = `${name}-config`;
  const serviceAccount = `${name}-controlplane`;

  return [
    {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: namespace, labels: { "app.kubernetes.io/part-of": "c3agent" } },
    },
    {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { name: configName, namespace, labels },
      data: {
        AGENT_IMAGE: config.spec.images.agent,
        AGENT_MODEL: config.spec.fleet.model,
        MAX_BUDGET_USD: String(config.spec.fleet.maxBudgetUsd),
        MAX_CONCURRENT_TASKS: String(config.spec.fleet.maxConcurrentTasks),
        SCHEDULE_INTERVAL_SECONDS: String(config.spec.fleet.scheduleIntervalSeconds),
      },
    },
    {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: { name: serviceAccount, namespace, labels },
    },
    {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "Role",
      metadata: { name: `${name}-job-manager`, namespace, labels },
      rules: [
        { apiGroups: ["batch"], resources: ["jobs"], verbs: ["create", "get", "list", "delete"] },
        { apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] },
      ],
    },
    {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "RoleBinding",
      metadata: { name: `${name}-job-manager`, namespace, labels },
      subjects: [{ kind: "ServiceAccount", name: serviceAccount, namespace }],
      roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "Role", name: `${name}-job-manager` },
    },
    deployment({
      name: `${name}-controlplane`,
      namespace,
      labels,
      image: config.spec.images.controlplane,
      replicas: config.spec.activation.controlplaneReplicas,
      serviceAccount,
      configName,
      secretName,
      ports: [{ name: "grpc", containerPort: 50050 }, { name: "http", containerPort: 8080 }],
    }),
    service(`${name}-controlplane`, namespace, labels, [
      { name: "grpc", port: 50050, targetPort: 50050 },
      { name: "http", port: 8080, targetPort: 8080 },
    ]),
    deployment({
      name: `${name}-gateway`,
      namespace,
      labels,
      image: config.spec.images.gateway,
      replicas: config.spec.activation.gatewayReplicas,
      serviceAccount,
      configName,
      secretName,
      ports: [{ name: "grpc", containerPort: 50052 }],
    }),
    service(`${name}-gateway`, namespace, labels, [
      { name: "grpc", port: 50052, targetPort: 50052 },
    ]),
    {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { name: `${name}-job-template`, namespace, labels },
      data: {
        image: config.spec.images.agent,
        secretName,
        note: "The control plane creates agent Jobs from this recorded runtime selection.",
      },
    },
  ];
}

function deployment({ name, namespace, labels, image, replicas, serviceAccount, configName, secretName, ports }) {
  const podLabels = { app: name, fleet: labels.fleet };
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name, namespace, labels },
    spec: {
      replicas,
      selector: { matchLabels: podLabels },
      template: {
        metadata: { labels: podLabels },
        spec: {
          serviceAccountName: serviceAccount,
          containers: [{
            name: name.endsWith("gateway") ? "gateway" : "controlplane",
            image,
            envFrom: [{ configMapRef: { name: configName } }],
            env: [
              {
                name: "ANTHROPIC_API_KEY",
                valueFrom: { secretKeyRef: { name: secretName, key: "anthropic-api-key" } },
              },
              {
                name: "GH_TOKEN",
                valueFrom: { secretKeyRef: { name: secretName, key: "gh-token", optional: true } },
              },
            ],
            ports,
            resources: {
              requests: { cpu: "10m", memory: "64Mi" },
              limits: { cpu: "500m", memory: "512Mi" },
            },
          }],
        },
      },
    },
  };
}

function service(name, namespace, labels, ports) {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name, namespace, labels },
    spec: { selector: { app: name, fleet: labels.fleet }, ports },
  };
}

function renderIntent(config, environment, objects, objectSetSha256) {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "SourceAndIntentRecord",
    metadata: { name: `${config.metadata.name}-${environment}` },
    spec: {
      purpose: "Keep model, budget, concurrency, image, and Secret-reference changes reviewable across environments.",
      environment,
      source: config.spec.source,
      inputFiles: [
        "c3agent.yaml",
        ...(environment === "staging" ? ["c3agent-staging.yaml"] : []),
        ...(environment === "production" ? ["c3agent-staging.yaml", "c3agent-prod.yaml"] : []),
      ],
      runtimeImages: Object.entries(config.spec.images).map(([role, reference]) => ({ role, reference })),
      secret: {
        name: config.spec.credentials.secretName,
        requiredKeys: config.spec.credentials.requiredKeys,
        optionalKeys: config.spec.credentials.optionalKeys,
        valuesIncluded: false,
      },
      activation: {
        controlplaneReplicas: config.spec.activation.controlplaneReplicas,
        gatewayReplicas: config.spec.activation.gatewayReplicas,
        agentTaskExecuted: false,
      },
      output: {
        objectCount: objects.length,
        objectSetSha256,
        path: `rendered/${environment}/release-objects.yaml`,
      },
      ownership: [
        { fields: ["spec.fleet.model", "spec.fleet.maxConcurrentTasks", "spec.fleet.maxBudgetUsd"], owner: "application-team" },
        { fields: ["spec.images", "spec.credentials", "spec.activation"], owner: "platform-team" },
      ],
    },
  };
}

function lifecycleRecord(config) {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "LifecycleWorkRecord",
    metadata: { name: `${config.metadata.name}-runtime-boundary` },
    spec: {
      automatic: false,
      beforeActivation: [
        "Grant the target cluster access to the three private c3agent images.",
        `Create Secret ${config.spec.credentials.secretName} with the required keys through the team's secret manager.`,
        "Choose and configure the PostgreSQL and persistent-storage services used by the real deployment.",
        "Review the Job RBAC against the repositories and namespaces the agents may change.",
      ],
      proofBoundary: {
        configurationGeneration: "tested",
        localConfigurationOciRoundTrip: "tested",
        configHubVariantsAndPromotion: "tested by the separate live receipt",
        argoObjectReconciliation: "tested by the separate live receipt",
        kubernetesWorkloadReadiness: "not-run",
        agentTask: "not-run",
      },
    },
  };
}

function buildLayout(root, development) {
  const layout = join(root, "oci-layout");
  rmSync(layout, { recursive: true, force: true });
  const staging = join(root, ".oci-staging");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(staging, "manifests"), { recursive: true });
  mkdirSync(join(staging, "records"), { recursive: true });
  writeFileSync(join(staging, "manifests", "release-objects.yaml"), development.manifest);
  writeFileSync(
    join(staging, "records", "source-and-intent.json"),
    `${JSON.stringify(companionRecord("source-and-intent", development.intent), null, 2)}\n`,
  );
  writeFileSync(
    join(staging, "records", "lifecycle.json"),
    `${JSON.stringify(companionRecord("lifecycle-work", lifecycleRecord(development.config)), null, 2)}\n`,
  );
  const packagedFiles = [
    "manifests/release-objects.yaml",
    "records/source-and-intent.json",
    "records/lifecycle.json",
  ];
  for (const path of packagedFiles) utimesSync(join(staging, path), 0, 0);
  const tar = execFileSync("tar", [
    "--uid", "0",
    "--gid", "0",
    "--numeric-owner",
    "--format", "ustar",
    "-cf", "-",
    ...packagedFiles,
  ], { cwd: staging, maxBuffer: 1024 * 1024 * 20 });
  const compressed = execFileSync("gzip", ["-n"], {
    input: tar,
    maxBuffer: 1024 * 1024 * 20,
  });
  writeFileSync(join(staging, archiveName), compressed);
  execFileSync("oras", [
    "push",
    "--oci-layout",
    `${layout}:${layoutTag}`,
    `${archiveName}:${deployableLayerType}`,
    "--artifact-type",
    artifactType,
    "--annotation",
    "org.opencontainers.image.created=1970-01-01T00:00:00Z",
    "--annotation",
    "org.opencontainers.image.title=c3agent-fleet-development",
    "--annotation",
    "org.opencontainers.image.description=Disabled c3agent fleet configuration for review and promotion",
  ], { cwd: staging, stdio: "ignore" });
  const descriptor = JSON.parse(execFileSync(
    "oras",
    ["manifest", "fetch", "--descriptor", "--oci-layout", `${layout}:${layoutTag}`],
    { encoding: "utf8" },
  ));
  writeYaml(join(root, "records", "local-oci-receipt.yaml"), {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "LocalConfigurationOciReceipt",
    metadata: { name: "c3agent-fleet-development" },
    spec: {
      reference: "oci-layout:examples/c3agent/fleet-config/oci-layout:development",
      digest: descriptor.digest,
      artifactType,
      objectCount: development.objects.length,
      objectSetSha256: development.objectSetSha256,
      companionRecordCount: 2,
      runtimeImagesPublic: false,
      secretValuesIncluded: false,
    },
    status: { result: "pass", pulledBackAndCompared: true },
  });
  rmSync(staging, { recursive: true, force: true });
}

function verifyLayout(expectedObjects) {
  const extractRoot = mkdtempSync(join(tmpdir(), "helm-expt-c3agent-pull-"));
  try {
    execFileSync("oras", [
      "pull",
      "--oci-layout",
      `${layoutRoot}:${layoutTag}`,
      "--output",
      extractRoot,
      "--no-tty",
    ], { stdio: "ignore" });
    const unpacked = join(extractRoot, "unpacked");
    mkdirSync(unpacked, { recursive: true });
    execFileSync("tar", [
      "-xzf",
      join(extractRoot, archiveName),
      "-C",
      unpacked,
    ], { stdio: "ignore" });
    const pulled = parseDocs(readFileSync(join(unpacked, "manifests", "release-objects.yaml"), "utf8"));
    check(hashObjects(pulled) === hashObjects(expectedObjects), "c3agent OCI object set differs from development");
    const manifest = JSON.parse(execFileSync(
      "oras",
      ["manifest", "fetch", "--oci-layout", `${layoutRoot}:${layoutTag}`],
      { encoding: "utf8" },
    ));
    check(manifest.artifactType === artifactType, "c3agent OCI has the wrong artifact type");
    check(manifest.layers.length === 1, "c3agent OCI must have one portable content layer");
    check(manifest.layers[0].mediaType === deployableLayerType, "c3agent OCI content layer is not portable");
    const sourceRecord = JSON.parse(readFileSync(join(unpacked, "records", "source-and-intent.json"), "utf8"));
    const lifecycle = JSON.parse(readFileSync(join(unpacked, "records", "lifecycle.json"), "utf8"));
    check(sourceRecord.recordType === "source-and-intent", "c3agent OCI lost its source-and-intent record");
    check(lifecycle.recordType === "lifecycle-work", "c3agent OCI lost its lifecycle-work record");
    check(
      !sourceRecord.apiVersion && !sourceRecord.kind && !sourceRecord.metadata,
      "a companion record must not look like a deployable Kubernetes resource",
    );
    check(
      sourceRecord.record.source.revision === readYaml(basePath).spec.source.revision,
      "c3agent OCI companion record has the wrong source revision",
    );
  } finally {
    rmSync(extractRoot, { recursive: true, force: true });
  }
}

function companionRecord(recordType, resource) {
  return {
    schemaVersion: 1,
    recordType,
    name: resource.metadata.name,
    record: resource.spec,
  };
}

function validateConfig(config, environment) {
  check(config.apiVersion === "workshop.confighub.com/v1alpha1", "unexpected c3agent config apiVersion");
  check(config.kind === "C3AgentFleetConfig", "unexpected c3agent config kind");
  check(config.metadata?.name, "c3agent config needs a name");
  check(config.spec?.namespace, "c3agent config needs a namespace");
  for (const [role, reference] of Object.entries(config.spec?.images ?? {})) {
    check(
      /^[a-z0-9.-]+\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(reference),
      `${environment} ${role} image must be digest-pinned`,
    );
  }
  check(Object.keys(config.spec.images).length === 3, "c3agent config needs agent, controlplane, and gateway images");
  check(
    config.spec.activation.controlplaneReplicas === 0 && config.spec.activation.gatewayReplicas === 0,
    "the public c3agent configuration fixture must remain disabled",
  );
  check(config.spec.credentials?.secretName, "c3agent config needs a Secret reference");
  check(!Object.hasOwn(config.spec.credentials, "inlineValue"), "inline credential values are forbidden");
  check(config.spec.credentials.requiredKeys.length >= 1, "c3agent config needs required Secret keys");
  check(Number(config.spec.fleet.maxBudgetUsd) > 0, "c3agent budget must be positive");
  check(Number(config.spec.fleet.maxConcurrentTasks) > 0, "c3agent concurrency must be positive");
}

function compareEnvironments(environments) {
  return {
    developmentToStaging: diffRecord(environments.development.config, environments.staging.config),
    stagingToProduction: diffRecord(environments.staging.config, environments.production.config),
  };
}

function diffRecord(before, after) {
  const changes = diffValues(before, after).sort((left, right) => left.path.localeCompare(right.path));
  const beforeObjects = renderObjects(before, "comparison");
  const afterObjects = renderObjects(after, "comparison");
  const beforeMap = new Map(beforeObjects.map((object) => [identity(object), stableJson(object)]));
  const afterMap = new Map(afterObjects.map((object) => [identity(object), stableJson(object)]));
  const changedObjects = [...new Set([...beforeMap.keys(), ...afterMap.keys()])]
    .filter((key) => beforeMap.get(key) !== afterMap.get(key))
    .sort();
  return {
    paths: changes.map((item) => item.path),
    changes,
    changedObjects,
    beforeObjectSetSha256: hashObjects(beforeObjects),
    afterObjectSetSha256: hashObjects(afterObjects),
  };
}

function diffValues(before, after, path = "") {
  if (stableJson(before) === stableJson(after)) return [];
  if (!isObject(before) || !isObject(after)) return [{ path, before, after }];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => diffValues(before[key], after[key], path ? `${path}.${key}` : key));
}

function deepMerge(base, overlay) {
  if (!isObject(base) || !isObject(overlay)) return structuredClone(overlay);
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = isObject(value) && isObject(result[key])
      ? deepMerge(result[key], value)
      : structuredClone(value);
  }
  return result;
}

function serializeDocuments(objects) {
  return `${objects.map((object) => toYaml(object)).join("\n---\n")}\n`;
}

function hashObjects(objects) {
  return `sha256:${sha256(stableJson([...objects].sort((left, right) => identity(left).localeCompare(identity(right)))))}`;
}

function identity(object) {
  return [object.apiVersion, object.kind, object.metadata?.namespace ?? "", object.metadata?.name ?? ""].join("|");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameStrings(left, right) {
  return [...left].sort().join("\n") === [...right].sort().join("\n");
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) result.push(...listFiles(path));
    else result.push(path);
  }
  return result.sort();
}

function relocate(root, originalPath) {
  return join(root, relative(exampleRoot, originalPath));
}

function requireCommand(name) {
  try {
    execFileSync(name, ["version"], { stdio: "ignore" });
  } catch {
    throw new Error(`${name} is required`);
  }
}
