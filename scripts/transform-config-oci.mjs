#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  check,
  identityFor,
  parseDocs,
  repoRoot,
  sha256,
  toYaml,
  workloadPodSpec,
} from "./lib/proof-common.mjs";

const artifactType = "application/vnd.confighub.kubernetes.config.v1";

export function transformConfigOci(options) {
  requireCommand("oras");
  const source = parseReference(options.source);
  const output = parseOutputReference(options.output);
  const workspace = prepareWorkspace(options.workDir);
  const registryConfig = prepareRegistryConfig(options.registryConfig, workspace.path);
  let keepWorkspace = Boolean(options.workDir);

  try {
    const descriptor = JSON.parse(
      command(
        "oras",
        orasArgs(source, ["manifest", "fetch", "--descriptor"], registryConfig),
      ),
    );
    const manifest = JSON.parse(
      command(
        "oras",
        orasArgs(source, ["manifest", "fetch"], registryConfig),
      ),
    );
    check(
      isLiteralConfig(manifest),
      "the input is not a supported literal Kubernetes configuration OCI; render source packages first",
    );

    const inputRoot = join(workspace.path, "input");
    mkdirSync(inputRoot, { recursive: true });
    command(
      "oras",
      orasArgs(
        source,
        ["pull", "--no-tty", "--output", inputRoot],
        registryConfig,
      ),
    );
    const input = readInput(inputRoot);
    check(input.objects.length, "the input OCI contains no readable Kubernetes objects");
    const sourceObjectSetSha256 = objectSetSha256(input.objects);

    const changedObjects = structuredClone(input.objects);
    const change = applyFieldChange(changedObjects, options);
    const changedObjectSetSha256 = objectSetSha256(changedObjects);
    check(
      sourceObjectSetSha256 !== changedObjectSetSha256,
      "the requested change did not alter the object set",
    );
    const checks = runChecks(input.objects, changedObjects, change);
    check(
      !checks.some((item) => item.result === "fail"),
      `checks failed: ${checks
        .filter((item) => item.result === "fail")
        .map((item) => item.detail)
        .join("; ")}`,
    );

    const stagingRoot = join(workspace.path, "output");
    const manifestsRoot = join(stagingRoot, "manifests");
    const recordsRoot = join(stagingRoot, "records");
    mkdirSync(manifestsRoot, { recursive: true });
    mkdirSync(recordsRoot, { recursive: true });
    const orderedObjects = [...changedObjects].sort((left, right) =>
      identityFor(left).localeCompare(identityFor(right))
    );
    const renderedObjectsPath = join(manifestsRoot, "release-objects.yaml");
    writeFileSync(
      renderedObjectsPath,
      `${orderedObjects.map((object) => toYaml(object)).join("\n---\n")}\n`,
    );

    const sourceRecord = {
      schemaVersion: 1,
      input: {
        reference: options.source,
        resolvedDigest: descriptor.digest ?? "",
        artifactType: manifest.artifactType ?? "",
        title: manifest.annotations?.["org.opencontainers.image.title"] ?? "",
        annotations: manifest.annotations ?? {},
        objectCount: input.objects.length,
        objectSetSha256: sourceObjectSetSha256,
      },
      context: Object.fromEntries(
        Object.entries(options.context ?? {}).sort(([left], [right]) =>
          left.localeCompare(right)
        ),
      ),
      preservedCompanionFiles: input.companionFiles.map((item) => item.relativePath),
    };
    const changeRecord = {
      schemaVersion: 1,
      sourceObjectSetSha256,
      outputObjectSetSha256: changedObjectSetSha256,
      changes: [change],
    };
    const checkRecord = {
      schemaVersion: 1,
      decision: checks.some((item) => item.result === "warn")
        ? "allow-with-warnings"
        : "allow",
      checks,
    };
    writeJson(join(recordsRoot, "source.json"), sourceRecord);
    writeJson(join(recordsRoot, "change.json"), changeRecord);
    writeJson(join(recordsRoot, "checks.json"), checkRecord);

    const preservedRoot = join(recordsRoot, "input");
    for (const companion of input.companionFiles) {
      const destination = join(preservedRoot, companion.relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(companion.path, destination);
    }

    prepareOutputLayout(output, options.replaceOutput);
    const layerArgs = [
      "manifests/release-objects.yaml:application/yaml",
      "records/source.json:application/vnd.confighub.source-record.v1+json",
      "records/change.json:application/vnd.confighub.change-record.v1+json",
      "records/checks.json:application/vnd.confighub.check-results.v1+json",
      ...input.companionFiles.map(
        (item) =>
          `records/input/${item.relativePath}:${mediaTypeFor(item.relativePath)}`,
      ),
    ];
    const pushed = JSON.parse(
      command(
        "oras",
        [
          "push",
          "--oci-layout",
          `${output.path}:${output.tag}`,
          ...layerArgs,
          "--artifact-type",
          artifactType,
          "--annotation",
          "org.opencontainers.image.created=1970-01-01T00:00:00Z",
          "--annotation",
          `org.opencontainers.image.base.name=${source.target}`,
          "--annotation",
          `org.opencontainers.image.base.digest=${descriptor.digest ?? ""}`,
          "--annotation",
          `org.opencontainers.image.source=${options.source}`,
          "--annotation",
          `org.opencontainers.image.description=${options.description || "Changed Kubernetes configuration"}`,
          "--format",
          "json",
        ],
        { cwd: stagingRoot },
      ),
    );

    const pulledRoot = join(workspace.path, "pulled-output");
    command("oras", [
      "pull",
      "--oci-layout",
      `${output.path}:${output.tag}`,
      "--output",
      pulledRoot,
      "--no-tty",
    ]);
    const pulled = readInput(pulledRoot);
    const pulledSourceRecord = readJson(join(pulledRoot, "records", "source.json"));
    const pulledChangeRecord = readJson(join(pulledRoot, "records", "change.json"));
    const pulledCheckRecord = readJson(join(pulledRoot, "records", "checks.json"));
    check(
      objectSetSha256(pulled.objects) === changedObjectSetSha256,
      "pull-back object set differs from the reviewed output",
    );
    check(
      stableJson(pulledSourceRecord) === stableJson(sourceRecord),
      "pull-back source record changed",
    );
    check(
      stableJson(pulledChangeRecord) === stableJson(changeRecord),
      "pull-back change record changed",
    );
    check(
      stableJson(pulledCheckRecord) === stableJson(checkRecord),
      "pull-back check record changed",
    );
    verifyPreservedCompanions(input.companionFiles, pulledRoot);

    const outputManifest = JSON.parse(
      command("oras", [
        "manifest",
        "fetch",
        "--oci-layout",
        `${output.path}:${output.tag}`,
      ]),
    );
    check(
      outputManifest.annotations?.["org.opencontainers.image.base.digest"]
        === descriptor.digest,
      "output manifest lost the input digest",
    );

    const warnings = checks.filter((item) => item.result === "warn");
    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "OciTransformationReport",
      input: {
        reference: options.source,
        resolvedDigest: descriptor.digest ?? "",
        artifactType: manifest.artifactType ?? "",
        objectCount: input.objects.length,
        objectSetSha256: sourceObjectSetSha256,
        anonymousPull: registryConfig.anonymous,
        companionFiles: input.companionFiles.map((item) => item.relativePath),
      },
      change,
      checks: {
        decision: checkRecord.decision,
        results: checks,
      },
      output: {
        reference: `oci-layout:${relative(process.cwd(), output.path) || "."}:${output.tag}`,
        path: output.path,
        tag: output.tag,
        artifactType,
        manifestDigest: pushed.digest ?? "",
        objectCount: changedObjects.length,
        objectSetSha256: changedObjectSetSha256,
        pullBack: "pass",
        sourceRecord: "records/source.json",
        changeRecord: "records/change.json",
        checkRecord: "records/checks.json",
      },
      limits: [
        "The output is a local OCI image layout. Publishing it to a registry is a separate authenticated action.",
        "The checks do not prove cluster admission, controller reconciliation, workload health, or provenance signatures.",
        "No ConfigHub command, account, server, Space, Unit, variant, approval, or release is used.",
      ],
      status: {
        result: warnings.length ? "pass-with-warnings" : "pass",
        warningCount: warnings.length,
      },
    };
  } catch (error) {
    keepWorkspace = true;
    throw new Error(`${error.message}\nwork files kept at ${workspace.path}`);
  } finally {
    if (workspace.temporary && !keepWorkspace) {
      rmSync(workspace.path, { recursive: true, force: true });
    }
  }
}

export function objectSetSha256(objects) {
  const ordered = objects
    .map((object) => [identityFor(object), object])
    .sort(([left], [right]) => left.localeCompare(right));
  return sha256(JSON.stringify(ordered));
}

export function applyFieldChange(objects, options) {
  const [kind, name] = String(options.object ?? "").split("/");
  check(kind && name, "--object must use KIND/NAME");
  const matches = objects.filter(
    (object) =>
      object.kind === kind
      && object.metadata?.name === name
      && (!options.namespace || object.metadata?.namespace === options.namespace),
  );
  check(
    matches.length === 1,
    `expected one ${kind}/${name}${options.namespace ? ` in ${options.namespace}` : ""}, found ${matches.length}`,
  );
  const object = matches[0];
  const path = String(options.field ?? "").split(".").filter(Boolean);
  check(path.length, "--field must be a dot-separated object path");
  let parent = object;
  for (const segment of path.slice(0, -1)) {
    check(
      parent && typeof parent === "object" && segment in parent,
      `${options.field} does not exist on ${kind}/${name}`,
    );
    parent = parent[segment];
  }
  const finalSegment = path.at(-1);
  check(
    parent && typeof parent === "object" && finalSegment in parent,
    `${options.field} does not exist on ${kind}/${name}`,
  );
  const before = structuredClone(parent[finalSegment]);
  const after = structuredClone(options.value);
  check(
    stableJson(before) !== stableJson(after),
    `${options.field} already has the requested value`,
  );
  parent[finalSegment] = after;
  return {
    object: `${kind}/${name}`,
    namespace: object.metadata?.namespace ?? "",
    field: options.field,
    before,
    after,
  };
}

export function runChecks(beforeObjects, afterObjects, expectedChange) {
  const checks = [];
  const shapeFailures = afterObjects.filter(
    (object) =>
      !object?.apiVersion
      || !object?.kind
      || !object?.metadata?.name,
  );
  checks.push({
    id: "kubernetes-object-shape",
    result: shapeFailures.length ? "fail" : "pass",
    detail: shapeFailures.length
      ? `${shapeFailures.length} object(s) lack apiVersion, kind, or metadata.name.`
      : `${afterObjects.length} object(s) have apiVersion, kind, and metadata.name.`,
  });

  const identities = afterObjects.map(identityFor);
  const duplicates = [
    ...new Set(
      identities.filter((identity, index) => identities.indexOf(identity) !== index),
    ),
  ];
  checks.push({
    id: "unique-object-identities",
    result: duplicates.length ? "fail" : "pass",
    detail: duplicates.length
      ? `Duplicate object identities: ${duplicates.join(", ")}`
      : "Object identities are unique.",
  });

  const placeholders = [];
  for (const object of afterObjects) {
    findPlaceholders(object, `${object.kind}/${object.metadata?.name}`, placeholders);
  }
  checks.push({
    id: "no-obvious-placeholders",
    result: placeholders.length ? "fail" : "pass",
    detail: placeholders.length
      ? `Unfinished-value markers found in ${[...new Set(placeholders)].join(", ")}.`
      : "No common unfinished-value markers were found.",
  });

  const images = [];
  const containersWithoutProbes = [];
  const externalSecrets = [];
  const providedSecrets = new Set(
    afterObjects
      .filter((object) => object.kind === "Secret")
      .map((object) =>
        `${object.metadata?.namespace ?? "default"}/${object.metadata?.name}`
      ),
  );
  for (const object of afterObjects) {
    const podSpec = workloadPodSpec(object);
    if (!podSpec) continue;
    for (const container of [
      ...(podSpec.initContainers ?? []),
      ...(podSpec.containers ?? []),
    ]) {
      if (container.image) images.push({
        object: `${object.kind}/${object.metadata?.name}`,
        container: container.name ?? "",
        image: container.image,
      });
      if (
        (podSpec.containers ?? []).includes(container)
        && (!container.livenessProbe || !container.readinessProbe)
      ) {
        containersWithoutProbes.push(
          `${object.kind}/${object.metadata?.name}:${container.name ?? "unnamed"}`,
        );
      }
      for (const envFrom of container.envFrom ?? []) {
        if (envFrom.secretRef?.name) {
          externalSecrets.push(
            `${object.metadata?.namespace ?? "default"}/${envFrom.secretRef.name}`,
          );
        }
      }
      for (const env of container.env ?? []) {
        if (env.valueFrom?.secretKeyRef?.name) {
          externalSecrets.push(
            `${object.metadata?.namespace ?? "default"}/${env.valueFrom.secretKeyRef.name}`,
          );
        }
      }
    }
    for (const imagePullSecret of podSpec.imagePullSecrets ?? []) {
      if (imagePullSecret.name) {
        externalSecrets.push(
          `${object.metadata?.namespace ?? "default"}/${imagePullSecret.name}`,
        );
      }
    }
    for (const volume of podSpec.volumes ?? []) {
      if (volume.secret?.secretName) {
        externalSecrets.push(
          `${object.metadata?.namespace ?? "default"}/${volume.secret.secretName}`,
        );
      }
      for (const source of volume.projected?.sources ?? []) {
        if (source.secret?.name) {
          externalSecrets.push(
            `${object.metadata?.namespace ?? "default"}/${source.secret.name}`,
          );
        }
      }
    }
  }
  const unpinnedImages = images.filter((item) => !/@sha256:[a-f0-9]{64}$/.test(item.image));
  checks.push({
    id: "digest-pinned-images",
    result: unpinnedImages.length ? "warn" : "pass",
    detail: unpinnedImages.length
      ? `${unpinnedImages.length} container image(s) are not pinned by digest.`
      : `${images.length} container image(s) are pinned by digest.`,
  });
  checks.push({
    id: "workload-probes",
    result: containersWithoutProbes.length ? "warn" : "pass",
    detail: containersWithoutProbes.length
      ? `Containers without both probes: ${containersWithoutProbes.join(", ")}`
      : "Every workload container declares liveness and readiness probes.",
  });
  const secretsNeededFromTarget = [
    ...new Set(externalSecrets.filter((item) => !providedSecrets.has(item))),
  ].sort();
  checks.push({
    id: "external-secret-references",
    result: secretsNeededFromTarget.length ? "warn" : "pass",
    detail: secretsNeededFromTarget.length
      ? `Create or otherwise supply these Secrets before deployment: ${[
          ...secretsNeededFromTarget,
        ].join(", ")}.`
      : "No workload container refers to an external Secret.",
  });

  const lifecycleObjects = afterObjects
    .filter((object) =>
      object.kind === "CustomResourceDefinition"
      || object.kind === "Job"
      || object.metadata?.annotations?.["helm.sh/hook"]
    )
    .map((object) => `${object.kind}/${object.metadata?.name}`)
    .sort();
  checks.push({
    id: "lifecycle-work",
    result: lifecycleObjects.length ? "warn" : "pass",
    detail: lifecycleObjects.length
      ? `Review install order and execution for: ${lifecycleObjects.join(", ")}.`
      : "No CRDs, Jobs, or Helm hook annotations were found.",
  });

  const differences = objectDifferences(beforeObjects, afterObjects);
  const expectedPath = [
    expectedChange.object,
    expectedChange.namespace,
    expectedChange.field,
  ].join("|");
  const actualPaths = differences.map((item) =>
    [item.object, item.namespace, item.field].join("|")
  );
  checks.push({
    id: "exact-change-scope",
    result:
      differences.length === 1 && actualPaths[0] === expectedPath
        ? "pass"
        : "fail",
    detail:
      differences.length === 1 && actualPaths[0] === expectedPath
        ? `Only ${expectedChange.object} ${expectedChange.field} changed.`
        : `Expected one field change; observed ${differences.length}: ${actualPaths.join(", ")}`,
  });
  return checks;
}

function readInput(root) {
  const objects = [];
  const companionFiles = [];
  for (const path of walkFiles(root)) {
    const relativePath = relative(root, path).replaceAll("\\", "/");
    if (!isStructuredText(path)) {
      companionFiles.push({ path, relativePath });
      continue;
    }
    let docs;
    try {
      docs = parseDocs(readFileSync(path, "utf8"));
    } catch {
      companionFiles.push({ path, relativePath });
      continue;
    }
    const kubernetesDocs = docs.filter(
      (doc) => doc?.apiVersion && doc?.kind && doc?.metadata?.name,
    );
    if (kubernetesDocs.length === docs.length && docs.length) {
      objects.push(...kubernetesDocs);
    } else {
      companionFiles.push({ path, relativePath });
    }
  }
  return { objects, companionFiles };
}

function objectDifferences(beforeObjects, afterObjects) {
  const before = new Map(beforeObjects.map((object) => [identityFor(object), object]));
  const after = new Map(afterObjects.map((object) => [identityFor(object), object]));
  check(
    sameStrings([...before.keys()], [...after.keys()]),
    "the transformation added or removed Kubernetes objects",
  );
  const differences = [];
  for (const identity of [...before.keys()].sort()) {
    const beforeObject = before.get(identity);
    const afterObject = after.get(identity);
    collectDifferences(beforeObject, afterObject, "", differences, afterObject);
  }
  return differences;
}

function collectDifferences(before, after, path, differences, object) {
  if (stableJson(before) === stableJson(after)) return;
  if (
    Array.isArray(before)
    || Array.isArray(after)
    || !before
    || !after
    || typeof before !== "object"
    || typeof after !== "object"
  ) {
    differences.push({
      object: `${object.kind}/${object.metadata?.name}`,
      namespace: object.metadata?.namespace ?? "",
      field: path,
      before,
      after,
    });
    return;
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    collectDifferences(
      before[key],
      after[key],
      path ? `${path}.${key}` : key,
      differences,
      object,
    );
  }
}

function findPlaceholders(value, path, findings) {
  if (typeof value === "string") {
    if (
      /confighubplaceholder|change[-_ ]?me|replace[-_ ]?me|your_org|your_repo/i.test(
        value,
      )
    ) {
      findings.push(path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findPlaceholders(item, `${path}[${index}]`, findings));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      findPlaceholders(item, `${path}.${key}`, findings);
    }
  }
}

function verifyPreservedCompanions(companionFiles, pulledRoot) {
  for (const companion of companionFiles) {
    const pulledPath = join(pulledRoot, "records", "input", companion.relativePath);
    check(existsSync(pulledPath), `pull-back lost ${companion.relativePath}`);
    check(
      sha256(readFileSync(pulledPath)) === sha256(readFileSync(companion.path)),
      `pull-back changed ${companion.relativePath}`,
    );
  }
}

function isLiteralConfig(manifest) {
  return [
    "application/vnd.confighub.kubernetes.config.v1",
    "application/vnd.confighub.config.v1",
  ].includes(manifest.artifactType)
    || (manifest.layers ?? []).some((layer) =>
      /yaml|yml|kubernetes/i.test(layer.mediaType ?? "")
    );
}

function parseReference(value) {
  check(value, "provide an input OCI reference");
  if (value.startsWith("oci-layout:")) {
    return {
      location: "local-layout",
      target: resolveLayoutTarget(value.slice("oci-layout:".length)),
    };
  }
  return {
    location: "registry",
    target: value.replace(/^oci:\/\//, ""),
  };
}

function parseOutputReference(value) {
  check(
    value?.startsWith("oci-layout:"),
    "--output must use oci-layout:PATH:TAG",
  );
  const target = value.slice("oci-layout:".length);
  const separator = target.lastIndexOf(":");
  check(separator > 0, "--output must end in :TAG");
  return {
    path: resolve(process.cwd(), target.slice(0, separator)),
    tag: target.slice(separator + 1),
  };
}

function resolveLayoutTarget(target) {
  const digestSeparator = target.lastIndexOf("@sha256:");
  if (digestSeparator > 0) {
    return `${resolve(process.cwd(), target.slice(0, digestSeparator))}${target.slice(digestSeparator)}`;
  }
  const separator = target.lastIndexOf(":");
  check(separator > 0, "local OCI layout reference must end in :TAG");
  return `${resolve(process.cwd(), target.slice(0, separator))}${target.slice(separator)}`;
}

function orasArgs(source, args, registryConfig) {
  return [
    ...args,
    ...(source.location === "local-layout" ? ["--oci-layout"] : []),
    ...(source.location === "registry"
      ? ["--registry-config", registryConfig.path]
      : []),
    source.target,
  ];
}

function prepareRegistryConfig(requested, workspace) {
  if (requested) {
    return { path: resolve(process.cwd(), requested), anonymous: false };
  }
  const path = join(workspace, "empty-registry-config.json");
  writeFileSync(path, '{"auths":{}}\n');
  return { path, anonymous: true };
}

function prepareWorkspace(requested) {
  if (!requested) {
    return {
      path: mkdtempSync(join(tmpdir(), "helm-expt-oci-transform-")),
      temporary: true,
    };
  }
  const path = resolve(process.cwd(), requested);
  if (existsSync(path)) {
    check(readdirSync(path).length === 0, `${path} is not empty`);
  } else {
    mkdirSync(path, { recursive: true });
  }
  return { path, temporary: false };
}

function prepareOutputLayout(output, replaceOutput) {
  if (existsSync(output.path)) {
    check(
      replaceOutput,
      `${output.path} already exists; pass --replace-output to replace it`,
    );
    rmSync(output.path, { recursive: true, force: true });
  }
  mkdirSync(dirname(output.path), { recursive: true });
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root).sort()) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walkFiles(path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

function isStructuredText(path) {
  return [".yaml", ".yml", ".json"].includes(extname(path).toLowerCase());
}

function mediaTypeFor(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") return "application/json";
  if (extension === ".yaml" || extension === ".yml") return "application/yaml";
  if (extension === ".md" || extension === ".txt") return "text/plain";
  return "application/octet-stream";
}

function command(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
  });
  if (result.status !== 0) {
    throw new Error(
      `${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function requireCommand(name) {
  const result = spawnSync(name, ["--help"], { encoding: "utf8" });
  check(result.error?.code !== "ENOENT", `${name} is required`);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stableJson(value));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sameStrings(left, right) {
  return [...left].sort().join("\n") === [...right].sort().join("\n");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseArgs(argv) {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }
  const options = {
    source: "",
    output: "",
    object: "",
    namespace: "",
    field: "",
    value: undefined,
    context: {},
    description: "",
    workDir: "",
    registryConfig: "",
    replaceOutput: false,
    json: false,
  };
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--replace-output") options.replaceOutput = true;
    else if (
      [
        "--output",
        "--object",
        "--namespace",
        "--field",
        "--value",
        "--context",
        "--description",
        "--work-dir",
        "--registry-config",
      ].includes(arg)
    ) {
      const value = argv[index + 1];
      check(value !== undefined && !value.startsWith("--"), `${arg} requires a value`);
      index += 1;
      if (arg === "--output") options.output = value;
      else if (arg === "--object") options.object = value;
      else if (arg === "--namespace") options.namespace = value;
      else if (arg === "--field") options.field = value;
      else if (arg === "--value") options.value = parseValue(value);
      else if (arg === "--context") {
        const separator = value.indexOf("=");
        check(separator > 0, "--context must use KEY=VALUE");
        options.context[value.slice(0, separator)] = value.slice(separator + 1);
      } else if (arg === "--description") options.description = value;
      else if (arg === "--work-dir") options.workDir = value;
      else options.registryConfig = value;
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  check(positionals.length === 1, "provide one input OCI reference");
  options.source = positionals[0];
  check(options.output, "provide --output oci-layout:PATH:TAG");
  check(options.object, "provide --object KIND/NAME");
  check(options.field, "provide --field PATH");
  check(options.value !== undefined, "provide --value JSON_VALUE");
  return options;
}

function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function renderHuman(report) {
  const lines = [
    "OCI transformation",
    "",
    `Input: ${report.input.reference}`,
    `Input digest: ${report.input.resolvedDigest}`,
    `Objects: ${report.input.objectCount}`,
    `Change: ${report.change.object} ${report.change.field} ${JSON.stringify(report.change.before)} -> ${JSON.stringify(report.change.after)}`,
    "",
    "Checks:",
    ...report.checks.results.map(
      (item) => `  ${item.result.toUpperCase()}: ${item.id} - ${item.detail}`,
    ),
    "",
    `Output: ${report.output.reference}`,
    `Output digest: ${report.output.manifestDigest}`,
    `Pull-back: ${report.output.pullBack}`,
    `Result: ${report.status.result}`,
    "",
  ];
  return lines.join("\n");
}

function printHelp() {
  console.log(`Change one field in a literal Kubernetes OCI and build a new OCI layout.

Usage:
  npm run oci:transform -- OCI_REFERENCE \\
    --object Deployment/nginx \\
    --namespace nginx \\
    --field spec.replicas \\
    --value 4 \\
    --output oci-layout:./changed-config:reviewed

Options:
  --context KEY=VALUE       Add a source-context fact; repeat as needed
  --description TEXT        Describe the reviewed output OCI
  --registry-config FILE    Use registry credentials; anonymous pull is the default
  --work-dir DIR            Keep pulled files and generated records
  --replace-output          Replace an existing output layout
  --json                    Print the machine-readable report

The command does not apply to Kubernetes or contact ConfigHub.`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const report = transformConfigOci(options);
  process.stdout.write(options.json ? stableJson(report) : renderHuman(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
