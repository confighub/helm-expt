#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";

import {
  check,
  normalizeYaml,
  parseDocs,
  parseObjects,
  readYaml,
  repoRoot,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--live-verify"].includes(mode)) {
  console.error("Usage: node scripts/generate-kubara-example.mjs [--generate|--verify|--live-verify]");
  process.exit(1);
}

const root = join(repoRoot, "examples", "kubara", "local-platform");
const sourceRoot = join(root, "source");
const generatedRoot = join(root, "generated");
const renderedRoot = join(root, "rendered");
const renderedPath = join(renderedRoot, "release-objects.yaml");
const inventoryPath = join(renderedRoot, "object-inventory.json");
const generatedChecksumsPath = join(generatedRoot, "checksums.txt");
const renderedChecksumsPath = join(renderedRoot, "checksums.txt");
const layoutRoot = join(root, "oci-layout");
const manifestPath = join(root, "local-config-oci-manifest.json");
const factsPath = join(root, "generated-facts.json");
const sourceLockPath = join(root, "source-lock.yaml");
const routePath = join(root, "route-intent.yaml");
const receiptPath = join(root, "generation-receipt.yaml");
const uploadReceiptPath = join(root, "confighub-upload-receipt.yaml");
const configPath = join(sourceRoot, "config.yaml");
const valuesOverridePath = join(sourceRoot, "values-helm-expt-paths.yaml");
const homerValuesOverridePath = join(sourceRoot, "values-homer-links.yaml");
const generatedHomerValuesPath = join(
  generatedRoot,
  "platform-configs",
  "test-cluster",
  "helm",
  "homer-dashboard",
  "values.generated.yaml",
);
const generatedHomerOverridePath = join(
  generatedRoot,
  "platform-configs",
  "test-cluster",
  "helm",
  "homer-dashboard",
  basename(homerValuesOverridePath),
);

const expected = {
  kubaraVersion: "v0.12.0",
  kubaraCommit: "ad039dd3e038c8580592b3b9134c2165a426344d",
  releaseAssetSha256: "5ef36e275818940aa25dfe59c9fc90ee625653229a9cb40dafa16afa6573b2cf",
  kubeVersion: "1.34.0",
  releaseName: "kubara-platform",
  namespace: "argocd",
  publicOci: "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/kubara-local-platform-config:0.12.0",
};

if (mode === "--generate") generate();
verify();
if (mode === "--live-verify") verifyLive();

function generate() {
  const kubaraBin = process.env.KUBARA_BIN;
  check(kubaraBin, "set KUBARA_BIN to a verified Kubara v0.12.0 binary");
  check(existsSync(kubaraBin), `Kubara binary does not exist: ${kubaraBin}`);
  const version = run(kubaraBin, ["--version"]).trim();
  check(version === `kubara version ${expected.kubaraVersion}`, `expected Kubara ${expected.kubaraVersion}, found ${version}`);

  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-kubara-"));
  try {
    writeFileSync(
      join(tempRoot, ".env"),
      [
        'PROJECT_NAME="test-cluster"',
        'PROJECT_STAGE="local"',
        'ARGOCD_WIZARD_ACCOUNT_PASSWORD="local-evaluation-not-a-secret"',
        'ARGOCD_GIT_HTTPS_URL="https://github.com/confighub/helm-expt.git"',
        'ARGOCD_GIT_USERNAME=""',
        'ARGOCD_GIT_PAT_OR_PASSWORD=""',
        'ARGOCD_HELM_REPO_USERNAME=""',
        'ARGOCD_HELM_REPO_PASSWORD=""',
        'ARGOCD_HELM_REPO_URL=""',
        'DOCKERCONFIG_BASE64=""',
        "",
      ].join("\n"),
    );
    cpSync(configPath, join(tempRoot, "config.yaml"));
    run(kubaraBin, ["--work-dir", tempRoot, "generate", "--helm"], { stdio: "inherit" });

    rmSync(generatedRoot, { recursive: true, force: true });
    mkdirSync(generatedRoot, { recursive: true });
    cpSync(join(tempRoot, "platform-components"), join(generatedRoot, "platform-components"), { recursive: true });
    cpSync(join(tempRoot, "platform-configs"), join(generatedRoot, "platform-configs"), { recursive: true });

    const generatedOverride = join(
      generatedRoot,
      "platform-configs",
      "test-cluster",
      "helm",
      "argo-cd",
      basename(valuesOverridePath),
    );
    cpSync(valuesOverridePath, generatedOverride);
    cpSync(homerValuesOverridePath, generatedHomerOverridePath);

    const argoChart = join(generatedRoot, "platform-components", "helm", "argo-cd");
    run("helm", ["dependency", "build", argoChart], { stdio: "inherit" });
    const chartLockPath = join(argoChart, "Chart.lock");
    const chartLock = readFileSync(chartLockPath, "utf8").replace(
      /^generated:.*$/m,
      'generated: "1970-01-01T00:00:00Z"',
    );
    writeFileSync(chartLockPath, chartLock);
    const generatedValues = join(
      generatedRoot,
      "platform-configs",
      "test-cluster",
      "helm",
      "argo-cd",
      "values.generated.yaml",
    );
    const render = run("helm", [
      "template",
      expected.releaseName,
      argoChart,
      "--namespace",
      expected.namespace,
      "--kube-version",
      expected.kubeVersion,
      "-f",
      generatedValues,
      "-f",
      generatedOverride,
    ]);
    rmSync(join(argoChart, "charts"), { recursive: true, force: true });

    rmSync(renderedRoot, { recursive: true, force: true });
    mkdirSync(renderedRoot, { recursive: true });
    writeFileSync(renderedPath, normalizeYaml(render));

    const objects = parseObjects(render);
    const kinds = countBy(objects, (object) => object.kind);
    writeFileSync(
      inventoryPath,
      `${JSON.stringify({ objectCount: objects.length, kinds, objects }, null, 2)}\n`,
    );
    writeChecksums(generatedRoot, generatedChecksumsPath);
    writeChecksums(renderedRoot, renderedChecksumsPath);

    const manifest = writeOciLayout(renderedPath);
    const docs = parseDocs(render);
    const hookObjects = docs.filter((doc) => doc.metadata?.annotations?.["helm.sh/hook"]);
    const facts = {
      kubaraVersion: expected.kubaraVersion,
      helmVersion: run("helm", ["version", "--short"]).trim(),
      kubeVersion: expected.kubeVersion,
      generatedFileCount: listFiles(generatedRoot).filter((path) => path !== generatedChecksumsPath).length,
      objectCount: objects.length,
      kinds,
      crdCount: objects.filter((object) => object.kind === "CustomResourceDefinition").length,
      applicationSetCount: objects.filter((object) => object.kind === "ApplicationSet").length,
      hookObjectCount: hookObjects.length,
      secretCount: objects.filter((object) => object.kind === "Secret").length,
      literalConfigOciDigest: `sha256:${hash(Buffer.from(JSON.stringify(manifest)))}`,
    };
    writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verify() {
  for (const path of [
    configPath,
    valuesOverridePath,
    homerValuesOverridePath,
    generatedHomerValuesPath,
    generatedHomerOverridePath,
    sourceLockPath,
    routePath,
    receiptPath,
    uploadReceiptPath,
    generatedChecksumsPath,
    renderedChecksumsPath,
    renderedPath,
    inventoryPath,
    manifestPath,
    factsPath,
    join(layoutRoot, "index.json"),
  ]) {
    check(existsSync(path), `missing Kubara evidence: ${relative(repoRoot, path)}`);
  }

  const sourceLock = readYaml(sourceLockPath);
  check(sourceLock.spec?.source?.version === expected.kubaraVersion, "Kubara source version changed");
  check(sourceLock.spec?.source?.commit === expected.kubaraCommit, "Kubara source commit changed");
  check(sourceLock.spec?.release?.sha256 === expected.releaseAssetSha256, "Kubara release asset checksum changed");
  check(String(sourceLock.spec?.generation?.helmKubeVersion) === expected.kubeVersion, "Kubara Helm Kubernetes version changed");

  verifyChecksums(generatedRoot, generatedChecksumsPath, "generated Kubara source");
  verifyChecksums(renderedRoot, renderedChecksumsPath, "rendered Kubara configuration");

  const render = readFileSync(renderedPath, "utf8");
  const objects = parseObjects(render);
  const docs = parseDocs(render);
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const facts = JSON.parse(readFileSync(factsPath, "utf8"));
  const receipt = readYaml(receiptPath);
  const uploadReceipt = readYaml(uploadReceiptPath);
  check(objects.length === receipt.spec?.outputs?.objectCount, "Kubara receipt object count changed");
  check(objects.length === inventory.objectCount, "Kubara inventory object count changed");
  check(objects.length === facts.objectCount, "Kubara generated facts object count changed");
  check(facts.generatedFileCount === receipt.spec?.outputs?.generatedFileCount, "Kubara receipt generated file count changed");
  check(JSON.stringify(countBy(objects, (object) => object.kind)) === JSON.stringify(inventory.kinds), "Kubara kind inventory changed");

  const crds = objects.filter((object) => object.kind === "CustomResourceDefinition");
  check(crds.length === 3, `expected three Argo CD CRDs, found ${crds.length}`);
  check(objects.filter((object) => object.kind === "ApplicationSet").length === 17, "expected 17 Kubara ApplicationSets");
  const hooks = docs.filter((doc) => doc.metadata?.annotations?.["helm.sh/hook"]);
  check(hooks.length === 4, `expected four Argo CD hook objects, found ${hooks.length}`);
  check(hooks.every((doc) => doc.metadata.annotations["helm.sh/hook"] === "pre-install,pre-upgrade"), "Kubara hook phases changed");

  const secrets = docs.filter((doc) => doc.kind === "Secret");
  check(secrets.length === 2, `expected two rendered Secrets, found ${secrets.length}`);
  const argoSecret = secrets.find((doc) => doc.metadata?.name === "argocd-secret");
  check(argoSecret && !argoSecret.data && !argoSecret.stringData, "argocd-secret unexpectedly contains data");
  const clusterSecret = secrets.find((doc) => doc.metadata?.name === "cluster-kubernetes.default.svc");
  check(clusterSecret && Object.keys(clusterSecret.data ?? {}).sort().join(",") === "config,name,server", "in-cluster Secret shape changed");

  const applicationSets = docs.filter((doc) => doc.kind === "ApplicationSet");
  const expectedComponentPath = "examples/kubara/local-platform/generated/platform-components/helm";
  const expectedConfigPath = "examples/kubara/local-platform/generated/platform-configs";
  const serializedApplicationSets = JSON.stringify(applicationSets);
  check(serializedApplicationSets.includes(expectedComponentPath), "ApplicationSets do not point at the committed component path");
  check(serializedApplicationSets.includes(expectedConfigPath), "ApplicationSets do not point at the committed config path");
  check(!render.includes("/Users/"), "Kubara render contains a workstation path");
  check(!render.includes("local-evaluation-not-a-secret"), "temporary Kubara password leaked into the render");
  check(!listFiles(root).some((path) => basename(path) === ".env"), "Kubara example contains a committed .env file");
  check(
    readFileSync(generatedHomerOverridePath, "utf8") === readFileSync(homerValuesOverridePath, "utf8"),
    "generated Homer values override differs from its source",
  );
  const homerTempRoot = mkdtempSync(join(tmpdir(), "helm-expt-kubara-homer-"));
  let homerRender;
  try {
    const homerComponents = join(homerTempRoot, "platform-components", "helm");
    mkdirSync(homerComponents, { recursive: true });
    cpSync(
      join(generatedRoot, "platform-components", "helm", "homer-dashboard"),
      join(homerComponents, "homer-dashboard"),
      { recursive: true },
    );
    cpSync(
      join(generatedRoot, "platform-components", "helm", "template-library"),
      join(homerComponents, "template-library"),
      { recursive: true },
    );
    const homerChart = join(homerComponents, "homer-dashboard");
    run("helm", ["dependency", "build", homerChart]);
    homerRender = run("helm", [
      "template",
      "kubara-homer",
      homerChart,
      "--namespace",
      "homer-dashboard",
      "-f",
      generatedHomerValuesPath,
      "-f",
      generatedHomerOverridePath,
    ]);
  } finally {
    rmSync(homerTempRoot, { recursive: true, force: true });
  }
  check(!/replace-me|CHANGE_ME/i.test(homerRender), "effective Homer render contains a placeholder");
  check(
    homerRender.includes("https://github.com/external-secrets/external-secrets"),
    "effective Homer render omits the configured project link",
  );
  for (const path of listFiles(root)) {
    const contents = readFileSync(path);
    if (contents.includes(0)) continue;
    const text = contents.toString("utf8");
    if (path !== generatedHomerValuesPath) {
      check(!/replace-me|CHANGE_ME/i.test(text), `Kubara example contains a placeholder: ${relative(repoRoot, path)}`);
    }
    check(!text.includes("/Users/"), `Kubara example contains a workstation path: ${relative(repoRoot, path)}`);
  }

  const route = readYaml(routePath);
  check(route.spec?.routes?.length === 4, "Kubara route intent must contain four routes");
  check(route.spec.routes.find((item) => item.id === "argocd-crds-first")?.objects?.length === 3, "Kubara CRD route changed");
  check(route.spec.routes.find((item) => item.id === "argocd-redis-secret-init")?.objects?.length === 4, "Kubara hook route changed");
  check(route.spec.routes.find((item) => item.id === "rendered-secrets")?.objects?.length === 2, "Kubara Secret route changed");

  const manifest = verifyOciLayout();
  check(manifest.artifactType === "application/vnd.confighub.kubernetes.config.v1", "Kubara OCI artifact type changed");
  check(manifest.layers?.length === 1, "Kubara OCI must contain one YAML layer");
  check(manifest.layers[0]?.mediaType === "application/yaml", "Kubara OCI layer must be YAML");
  check(manifest.layers[0]?.digest === `sha256:${hash(readFileSync(renderedPath))}`, "Kubara OCI layer digest changed");
  check(manifest.layers[0]?.annotations?.["org.opencontainers.image.title"] === "release-objects.yaml", "Kubara OCI layer title changed");

  check(receipt.spec?.source?.version === expected.kubaraVersion, "Kubara receipt version changed");
  check(receipt.spec?.outputs?.literalConfigOciDigest === `sha256:${hash(readFileSync(manifestPath))}`, "Kubara receipt OCI digest changed");
  check(receipt.status?.kubaraGenerate === "pass", "Kubara generation must stay recorded as pass");
  check(receipt.status?.helmTemplate === "pass", "Kubara Helm render must stay recorded as pass");
  check(receipt.status?.downstreamHomerTemplate === "pass", "Kubara downstream Homer render must stay recorded as pass");
  check(receipt.status?.localOciLayout === "pass", "Kubara local OCI layout must stay recorded as pass");
  check(uploadReceipt.kind === "ConfigHubUploadReceipt", "Kubara ConfigHub upload receipt kind changed");
  check(uploadReceipt.status?.result === "pass", "Kubara ConfigHub upload receipt must stay recorded as pass");
  check(uploadReceipt.spec?.source?.digest === receipt.spec.outputs.literalConfigOciDigest, "Kubara upload source digest changed");
  check(uploadReceipt.spec?.source?.renderedObjectCount === objects.length, "Kubara upload source count changed");
  check(uploadReceipt.spec?.unit?.uploadedObjectCount === objects.length - secrets.length, "Kubara uploaded object count changed");
  check(uploadReceipt.spec?.unit?.sourceIdentitiesMatched === true, "Kubara upload identity comparison must pass");
  check(uploadReceipt.spec?.secretsNotUploaded?.length === secrets.length, "Kubara omitted Secret count changed");
  check(uploadReceipt.spec?.policy?.profile === "catalog-standard", "Kubara upload policy profile changed");
  check(uploadReceipt.spec?.policy?.checks?.length === 4, "Kubara upload must record four baseline checks");
  for (const field of [
    "publicOciPush",
    "publicOciPull",
    "configHubUpload",
    "routeExecution",
    "liveArgoReconciliation",
    "livePlatformHealth",
  ]) {
    check(["not-run", "pass"].includes(receipt.status?.[field]), `Kubara receipt has invalid ${field} status`);
  }

  console.log(
    `verified Kubara ${expected.kubaraVersion} local platform (${objects.length} objects, ${crds.length} CRDs, ${hooks.length} hook resources, ${secrets.length} Secrets, 1 OCI layout)`,
  );
}

function verifyLive() {
  const receipt = readYaml(uploadReceiptPath);
  const spaceSlug = receipt.spec.space.slug;
  const unitSlug = receipt.spec.unit.slug;
  const spaceResult = JSON.parse(run("cub", ["space", "get", spaceSlug, "-o", "json"]));
  const space = spaceResult.Space;
  check(space.SpaceID === receipt.spec.space.id, "live Kubara Space ID changed");
  check(space.Annotations?.ExternalSource === receipt.spec.space.externalSource, "live Kubara external source changed");
  check(
    space.Annotations?.ExternalSourceDigest === receipt.spec.space.externalSourceDigest,
    "live Kubara external source digest changed",
  );
  check(space.TriggerFilterID === receipt.spec.policy.filterId, "live Kubara apply-policy filter changed");
  for (const [key, value] of Object.entries(receipt.spec.space.labels)) {
    check(space.Labels?.[key] === value, `live Kubara Space label changed: ${key}`);
  }

  const unitResult = JSON.parse(run("cub", ["unit", "get", unitSlug, "--space", spaceSlug, "-o", "json"]));
  const unit = unitResult.Unit;
  check(unit.UnitID === receipt.spec.unit.id, "live Kubara Unit ID changed");
  check(unit.Labels?.SourceType === "kubara", "live Kubara Unit source label changed");
  const liveYaml = Buffer.from(unit.Data, "base64").toString("utf8");
  const sourceYaml = readFileSync(renderedPath, "utf8");
  const liveObjects = parseObjects(liveYaml);
  const sourceObjects = parseObjects(sourceYaml).filter((object) => object.kind !== "Secret");
  const liveIdentities = liveObjects.map((object) => object.identity).sort();
  const sourceIdentities = sourceObjects.map((object) => object.identity).sort();
  check(
    JSON.stringify(liveIdentities) === JSON.stringify(sourceIdentities),
    "live Kubara Unit object identities differ from the non-Secret render",
  );
  const liveDocs = canonicalDocMap(liveYaml);
  const sourceDocs = canonicalDocMap(sourceYaml, { excludeSecrets: true });
  check(
    JSON.stringify([...liveDocs]) === JSON.stringify([...sourceDocs]),
    "live Kubara Unit objects differ from the non-Secret render",
  );
  console.log(
    `verified live ConfigHub Kubara upload (${spaceSlug}/${unitSlug}, ${liveObjects.length} non-Secret objects, catalog-standard baseline policy)`,
  );
}

function canonicalDocMap(text, { excludeSecrets = false } = {}) {
  return new Map(
    parseDocs(text)
      .filter((doc) => !excludeSecrets || doc.kind !== "Secret")
      .map((doc) => {
        const metadata = doc.metadata ?? {};
        const identity = [
          doc.apiVersion ?? "",
          doc.kind ?? "",
          metadata.namespace ?? "",
          metadata.name ?? "",
        ].join("|");
        return [identity, JSON.stringify(doc)];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function writeOciLayout(yamlPath) {
  rmSync(layoutRoot, { recursive: true, force: true });
  mkdirSync(join(layoutRoot, "blobs", "sha256"), { recursive: true });
  writeFileSync(join(layoutRoot, "oci-layout"), '{"imageLayoutVersion":"1.0.0"}\n');

  const config = Buffer.from("{}");
  const configDigest = hash(config);
  writeFileSync(join(layoutRoot, "blobs", "sha256", configDigest), config);
  const layer = readFileSync(yamlPath);
  const layerDigest = hash(layer);
  writeFileSync(join(layoutRoot, "blobs", "sha256", layerDigest), layer);

  const manifest = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.confighub.kubernetes.config.v1",
    config: {
      mediaType: "application/vnd.oci.empty.v1+json",
      digest: `sha256:${configDigest}`,
      size: config.length,
      data: config.toString("base64"),
    },
    layers: [
      {
        mediaType: "application/yaml",
        digest: `sha256:${layerDigest}`,
        size: layer.length,
        annotations: {
          "org.opencontainers.image.title": "release-objects.yaml",
        },
      },
    ],
    annotations: {
      "org.opencontainers.image.created": "1970-01-01T00:00:00Z",
      "org.opencontainers.image.source": "https://github.com/kubara-io/kubara",
      "org.opencontainers.image.title": "Kubara local platform rendered configuration",
      "org.opencontainers.image.version": "0.12.0",
    },
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const manifestDigest = hash(manifestBytes);
  writeFileSync(manifestPath, manifestBytes);
  writeFileSync(join(layoutRoot, "blobs", "sha256", manifestDigest), manifestBytes);
  const index = {
    schemaVersion: 2,
    manifests: [
      {
        mediaType: manifest.mediaType,
        digest: `sha256:${manifestDigest}`,
        size: manifestBytes.length,
        annotations: {
          "org.opencontainers.image.ref.name": "0.12.0-local",
        },
      },
    ],
  };
  writeFileSync(join(layoutRoot, "index.json"), `${JSON.stringify(index)}\n`);
  return manifest;
}

function verifyOciLayout() {
  const manifestBytes = readFileSync(manifestPath);
  const manifestDigest = `sha256:${hash(manifestBytes)}`;
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, "Kubara OCI layout must contain one manifest");
  check(index.manifests[0]?.digest === manifestDigest, "Kubara OCI index digest changed");
  const layoutManifest = readFileSync(join(layoutRoot, "blobs", "sha256", manifestDigest.slice(7)));
  check(layoutManifest.equals(manifestBytes), "Kubara standalone manifest differs from OCI layout");
  const manifest = JSON.parse(manifestBytes);
  for (const descriptor of [manifest.config, ...(manifest.layers ?? [])]) {
    const blob = readFileSync(join(layoutRoot, "blobs", "sha256", descriptor.digest.slice(7)));
    check(`sha256:${hash(blob)}` === descriptor.digest, `Kubara OCI blob digest changed: ${descriptor.digest}`);
    check(blob.length === descriptor.size, `Kubara OCI blob size changed: ${descriptor.digest}`);
  }
  return manifest;
}

function writeChecksums(directory, checksumsPath) {
  const files = listFiles(directory)
    .filter((path) => path !== checksumsPath)
    .map((path) => relative(directory, path).replaceAll("\\", "/"))
    .sort();
  writeFileSync(
    checksumsPath,
    `${files.map((path) => `${hash(readFileSync(join(directory, path)))}  ${path}`).join("\n")}\n`,
  );
}

function verifyChecksums(directory, checksumsPath, label) {
  const expectedFiles = new Map(
    readFileSync(checksumsPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64})  ([^/].*)$/);
        check(match, `invalid ${label} checksum: ${line}`);
        check(!match[2].includes(".."), `${label} checksum escapes its root: ${match[2]}`);
        return [match[2], match[1]];
      }),
  );
  const actualFiles = listFiles(directory)
    .filter((path) => path !== checksumsPath)
    .map((path) => relative(directory, path).replaceAll("\\", "/"))
    .sort();
  check(actualFiles.length === expectedFiles.size, `${label} checksum inventory size changed`);
  for (const path of actualFiles) {
    check(expectedFiles.has(path), `${label} checksum omits ${path}`);
    check(hash(readFileSync(join(directory, path))) === expectedFiles.get(path), `${label} checksum differs for ${path}`);
  }
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function countBy(items, getKey) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const key = getKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function hash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
    stdio: options.stdio ?? ["ignore", "pipe", "inherit"],
  });
}
