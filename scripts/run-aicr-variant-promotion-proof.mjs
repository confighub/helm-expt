#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const exampleRoot = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");
const layoutRef = join(exampleRoot, "oci-layouts", "argocd-config") + ":0.14.0";
const sourceDigest = "sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010";
const repository = "aicr-eks-h100-training-kubeflow-argocd-config";
const receiptPath = join(repoRoot, "runs", "aicr-variant-promotion-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-variant-promotion-proof", "summary.md");
const oldGrafanaValue = "  adminPassword: admin";
const newGrafanaValue = [
  "  admin:",
  "    existingSecret: aicr-grafana-admin",
  "    userKey: admin-user",
  "    passwordKey: admin-password",
].join("\n");
const expectedWaves = Array.from({ length: 16 }, (_, index) => index);

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run the generator`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-variant-promotion:generate`,
  );
  console.log("verified AICR ConfigHub variant and promotion proof");
} else {
  console.error(`Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify`);
  process.exitCode = 2;
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to confirm this live scratch run",
  );
  check(context, "set CUB_CONTEXT to an authenticated scratch ConfigHub context");
  check(context !== "river-bear", "refusing to run the scratch proof in the persistent helm-catalog context");
  for (const tool of ["cub", "docker", "oras"]) {
    const result = tryCommand(tool, ["version"]);
    check(result.ok, `${tool} is required for the AICR variant proof`);
  }

  const contextInfo = jsonCommand("cub", ["context", "get", context, "-o", "json"]);
  const committedDocs = committedApplicationDocs();
  verifyApplicationSet(committedDocs, "committed AICR output");
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const component = `hx-aicr-proof-${runId}`;
  const spaces = {
    base: `${component}-base`,
    dev: `${component}-dev`,
    staging: `${component}-staging`,
  };
  const container = `helm-expt-aicr-proof-${runId}`;
  const createdSpaces = [];
  let registryStarted = false;
  let receipt;
  const cleanup = {
    stagingSpace: "not-created",
    devSpace: "not-created",
    baseSpace: "not-created",
    registry: "not-started",
  };

  try {
    for (const slug of Object.values(spaces)) {
      check(
        !cubTry(context, ["space", "get", slug, "-o", "json"]).ok,
        `refusing to reuse existing scratch Space ${slug}`,
      );
    }

    command("docker", [
      "run",
      "-d",
      "--rm",
      "--name",
      container,
      "-p",
      "127.0.0.1::5000",
      "registry:2",
    ]);
    registryStarted = true;
    cleanup.registry = "pending";
    const portOutput = command("docker", ["port", container, "5000/tcp"]).trim();
    const registryPort = portOutput.match(/:(\d+)$/)?.[1] ?? "";
    check(registryPort, `could not determine the temporary registry port from ${portOutput}`);
    const registry = `localhost:${registryPort}`;
    waitForRegistry(registry);

    const registryRef = `${registry}/${repository}:0.14.0`;
    command("oras", [
      "cp",
      "--from-oci-layout",
      layoutRef,
      "--to-plain-http",
      registryRef,
    ]);
    const resolvedDigest = command("oras", ["resolve", "--plain-http", registryRef]).trim();
    check(resolvedDigest === sourceDigest, `temporary registry resolved ${resolvedDigest}, expected ${sourceDigest}`);

    cub(context, [
      "variant",
      "upload",
      "--component",
      component,
      "--variant",
      "base",
      "--space",
      spaces.base,
      "--granularity",
      "minimal",
      "--label",
      "SourceType=aicr",
      "--label",
      "ResourceClass=system-configuration",
      "--layer",
      "Platform",
      "--owner",
      "Platform",
      "--change-desc",
      "Upload the AICR v0.14.0 promotion proof base",
      `oci://${registryRef}`,
    ], { timeout: 420_000 });
    createdSpaces.push(spaces.base);
    cleanup.baseSpace = "pending";

    const baseBefore = inspectVariant(context, spaces.base, component);
    verifyApplicationSet(baseBefore.docs, "base");
    check(
      canonicalDocs(baseBefore.docs) === canonicalDocs(committedDocs),
      "ConfigHub base Unit differs from the committed AICR Application files",
    );
    check(
      baseBefore.space.Annotations?.ExternalSourceDigest === sourceDigest,
      "ConfigHub base Space did not record the exact AICR OCI digest",
    );
    check(
      baseBefore.space.Annotations?.ExternalSource === `oci://${registryRef}`,
      "ConfigHub base Space did not record the temporary OCI source",
    );
    check(grafanaState(baseBefore.docs).adminPassword === "admin", "base Grafana password fixture changed");

    cub(context, [
      "variant",
      "create",
      "dev",
      spaces.base,
      "--space-pattern",
      `template:${spaces.dev}`,
      "--environment",
      "Dev",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { timeout: 660_000 });
    createdSpaces.push(spaces.dev);
    cleanup.devSpace = "pending";

    cub(context, [
      "variant",
      "create",
      "staging",
      spaces.dev,
      "--space-pattern",
      `template:${spaces.staging}`,
      "--environment",
      "Staging",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { timeout: 660_000 });
    createdSpaces.push(spaces.staging);
    cleanup.stagingSpace = "pending";

    const devBefore = inspectVariant(context, spaces.dev, component);
    const stagingBefore = inspectVariant(context, spaces.staging, component);
    const baseToDevChanges = changedDocs(baseBefore.docs, devBefore.docs);
    const devToStagingChanges = changedDocs(devBefore.docs, stagingBefore.docs);
    const firstCloneDifference = baseToDevChanges[0]
      ? differencePaths(
        docByIdentity(baseBefore.docs, baseToDevChanges[0]),
        docByIdentity(devBefore.docs, baseToDevChanges[0]),
      ).slice(0, 8)
      : [];
    check(
      canonicalDocs(baseBefore.docs) === canonicalDocs(devBefore.docs)
        && canonicalDocs(devBefore.docs) === canonicalDocs(stagingBefore.docs),
      `new environment variants do not match the uploaded base (base->dev: ${baseToDevChanges.join(", ") || "none"}; dev->staging: ${devToStagingChanges.join(", ") || "none"}; first difference: ${firstCloneDifference.join(", ") || "none"})`,
    );

    const changeArgs = [
      "run",
      "search-replace",
      "--space",
      spaces.dev,
      "--unit",
      component,
      "--search-value",
      oldGrafanaValue,
      "--replace-value",
      newGrafanaValue,
    ];
    const dryRunOutput = cub(context, [...changeArgs, "--dry-run", "-o", "mutations"]);
    check(
      dryRunOutput.includes("kube-prometheus-stack"),
      "ConfigHub dry run did not name the kube-prometheus-stack Application",
    );
    const devAfterDryRun = inspectVariant(context, spaces.dev, component);
    check(
      canonicalDocs(devAfterDryRun.docs) === canonicalDocs(devBefore.docs),
      "ConfigHub search-replace dry run changed the dev Unit",
    );

    cub(context, [
      ...changeArgs,
      "--change-desc",
      "Use an existing Secret for the AICR Grafana administrator",
      "--wait",
    ], { timeout: 660_000 });
    const devChanged = inspectVariant(context, spaces.dev, component);
    const changedIdentities = changedDocs(devBefore.docs, devChanged.docs);
    check(
      JSON.stringify(changedIdentities) === JSON.stringify([
        "argoproj.io/v1alpha1|Application|argocd|kube-prometheus-stack",
      ]),
      `expected one changed Application, found ${changedIdentities.join(", ") || "none"}`,
    );
    assertExistingSecret(devChanged.docs, "dev");

    const stagingBeforePromotion = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingBeforePromotion.docs) === canonicalDocs(stagingBefore.docs),
      "staging changed before promotion",
    );
    const promotionDryRunOutput = cub(context, [
      "variant",
      "promote",
      spaces.staging,
      "--dry-run",
    ]);
    check(
      /1\s+unit/i.test(promotionDryRunOutput),
      `promotion dry run did not report one Unit: ${promotionDryRunOutput.trim()}`,
    );
    const stagingAfterPromotionDryRun = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingAfterPromotionDryRun.docs) === canonicalDocs(stagingBeforePromotion.docs),
      "promotion dry run changed staging",
    );

    cub(context, [
      "variant",
      "promote",
      spaces.staging,
      "--change-desc",
      "Promote the reviewed Grafana Secret change to staging",
    ], { timeout: 660_000 });
    const stagingPromoted = inspectVariant(context, spaces.staging, component);
    assertExistingSecret(stagingPromoted.docs, "staging");
    check(
      canonicalDocs(stagingPromoted.docs) === canonicalDocs(devChanged.docs),
      "promoted staging Unit does not match the reviewed dev Unit",
    );
    verifyApplicationSet(stagingPromoted.docs, "promoted staging");

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrVariantPromotionProofReceipt",
      metadata: {
        name: "aicr-eks-h100-training-kubeflow-v0-14-0",
      },
      spec: {
        recordedAt: new Date().toISOString(),
        context: {
          name: context,
          organization: contextInfo.metadata?.organizationName ?? "unknown",
          purpose: "temporary scratch proof",
        },
        source: {
          format: "AICR Argo CD literal configuration OCI",
          committedLayout: relativeRepo(join(exampleRoot, "oci-layouts", "argocd-config")),
          temporaryReference: `oci://${registryRef}`,
          digest: sourceDigest,
          applicationCount: 17,
          syncWaves: expectedWaves,
          exactSourceObjectsMatched: true,
          canonicalDataSha256: sha256(canonicalDocs(committedDocs)),
        },
        variants: {
          base: variantRecord(baseBefore),
          dev: variantRecord(devChanged),
          staging: variantRecord(stagingPromoted),
        },
        change: {
          resource: "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack",
          path: "spec.source.helm.values.grafana",
          before: {
            adminPassword: "admin",
          },
          after: {
            admin: {
              existingSecret: "aicr-grafana-admin",
              userKey: "admin-user",
              passwordKey: "admin-password",
            },
          },
          changedApplicationCount: changedIdentities.length,
          changedApplications: changedIdentities,
          devDryRun: "pass",
          devDryRunLeftDataUnchanged: true,
          devUpdate: "pass",
        },
        promotion: {
          path: "base -> dev -> staging",
          dryRun: "pass",
          dryRunReportedUnitCount: 1,
          dryRunLeftStagingUnchanged: true,
          result: "pass",
          stagingMatchesReviewedDev: true,
        },
        cleanup,
        limits: [
          "This run used a temporary local registry; it does not prove public Google Artifact Registry publication.",
          "This run started no Kubernetes cluster. It does not prove Argo CD delivery, application health, or GPU workload health.",
          "The scratch organization did not run the helm-catalog apply-policy Triggers, so this receipt does not prove policy execution.",
          "This receipt proves one AICR bundle, one reviewed field change, and one dev-to-staging promotion.",
        ],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactApplicationSet: "pass",
        derivedVariants: "pass",
        changeDryRun: "pass",
        promotionDryRun: "pass",
        promotion: "pass",
        claim: "ConfigHub imported the 17 exact AICR Argo CD Applications, kept one reviewed Grafana Secret change in dev, previewed the promotion without changing staging, and then promoted the same configuration to staging.",
      },
    };
  } finally {
    for (const [key, slug] of [
      ["stagingSpace", spaces.staging],
      ["devSpace", spaces.dev],
      ["baseSpace", spaces.base],
    ]) {
      const exists = cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      if (!exists) {
        cleanup[key] = createdSpaces.includes(slug) ? "fail" : "not-created";
        continue;
      }
      const deleted = cubTry(context, [
        "space",
        "delete",
        slug,
        "--recursive-force",
        "--quiet",
      ]);
      const absent = !cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      cleanup[key] = deleted.ok && absent ? "pass" : "fail";
    }
    if (registryStarted) {
      const stopped = tryCommand("docker", ["stop", container]);
      const absent = waitForContainerRemoval(container);
      cleanup.registry = stopped.ok && absent ? "pass" : "fail";
    }
  }

  check(receipt, "AICR variant proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `AICR variant proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function inspectVariant(context, spaceSlug, unitSlug) {
  const spaceResponse = cubJson(context, ["space", "get", spaceSlug, "-o", "json"]);
  const unitResponse = cubJson(context, [
    "unit",
    "get",
    unitSlug,
    "--space",
    spaceSlug,
    "-o",
    "json",
  ]);
  const data = cub(context, ["unit", "data", unitSlug, "--space", spaceSlug]);
  const docs = parseDocs(data).map(stripCommentMetadata);
  return {
    space: spaceResponse.Space,
    unit: unitResponse.Unit,
    fromLink: unitResponse.FromLink?.[0] ?? null,
    docs,
    dataSha256: sha256(canonicalDocs(docs)),
  };
}

function variantRecord(variant) {
  return {
    space: variant.space.Slug,
    spaceId: variant.space.SpaceID,
    variant: variant.space.Labels?.Variant ?? "",
    environment: variant.space.Labels?.Environment ?? "",
    unit: variant.unit.Slug,
    unitId: variant.unit.UnitID,
    headRevision: variant.unit.HeadRevisionNum,
    upstreamRevision: variant.unit.UpstreamRevisionNum ?? null,
    upstreamUnitId: variant.unit.UpstreamUnitID ?? null,
    upgradeLinkId: variant.fromLink?.LinkID ?? null,
    dataHash: variant.unit.DataHash,
    canonicalDataSha256: variant.dataSha256,
  };
}

function verifyApplicationSet(docs, label) {
  check(docs.length === 17, `${label} must contain 17 Argo CD Applications`);
  check(
    docs.every(
      (doc) => doc.apiVersion === "argoproj.io/v1alpha1"
        && doc.kind === "Application"
        && doc.metadata?.namespace === "argocd",
    ),
    `${label} contains an object that is not an Argo CD Application in argocd`,
  );
  const waves = docs
    .filter((doc) => doc.metadata?.name !== "aicr-stack")
    .map((doc) => Number(doc.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]))
    .sort((left, right) => left - right);
  check(JSON.stringify(waves) === JSON.stringify(expectedWaves), `${label} sync waves changed`);
}

function committedApplicationDocs() {
  const root = join(exampleRoot, "argocd-rendered");
  return listFiles(root)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")))
    .map(stripCommentMetadata);
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function grafanaState(docs) {
  const application = docs.find(
    (doc) => doc.kind === "Application" && doc.metadata?.name === "kube-prometheus-stack",
  );
  check(application, "kube-prometheus-stack Application is missing");
  const values = readYamlText(application.spec?.source?.helm?.values ?? "");
  return values.grafana ?? {};
}

function assertExistingSecret(docs, label) {
  const grafana = grafanaState(docs);
  check(grafana.adminPassword === undefined, `${label} still contains grafana.adminPassword`);
  check(
    grafana.admin?.existingSecret === "aicr-grafana-admin"
      && grafana.admin?.userKey === "admin-user"
      && grafana.admin?.passwordKey === "admin-password",
    `${label} does not contain the reviewed Grafana existing-Secret configuration`,
  );
}

function changedDocs(before, after) {
  const left = docMap(before);
  const right = docMap(after);
  const identities = [...new Set([...left.keys(), ...right.keys()])].sort();
  return identities.filter((identity) => left.get(identity) !== right.get(identity));
}

function docMap(docs) {
  return new Map(docs.map((doc) => [identity(doc), JSON.stringify(doc)]));
}

function docByIdentity(docs, wanted) {
  return docs.find((doc) => identity(doc) === wanted);
}

function differencePaths(left, right, prefix = "") {
  if (JSON.stringify(left) === JSON.stringify(right)) return [];
  if (
    left === null
    || right === null
    || typeof left !== "object"
    || typeof right !== "object"
    || Array.isArray(left) !== Array.isArray(right)
  ) {
    return [`${prefix || "<root>"}=${JSON.stringify(left)} -> ${JSON.stringify(right)}`];
  }
  const keys = [...new Set([
    ...Object.keys(left ?? {}),
    ...Object.keys(right ?? {}),
  ])].sort();
  return keys.flatMap((key) => differencePaths(
    left?.[key],
    right?.[key],
    prefix ? `${prefix}.${key}` : key,
  ));
}

function stripCommentMetadata(value) {
  if (Array.isArray(value)) return value.map(stripCommentMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("$comment$"))
      .map(([key, child]) => [key, stripCommentMetadata(child)]),
  );
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({ identity: identity(doc), document: doc }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function verifyReceipt(receipt) {
  check(receipt.kind === "AicrVariantPromotionProofReceipt", "AICR promotion receipt kind changed");
  check(receipt.status?.result === "pass", "AICR promotion proof is not pass");
  check(receipt.spec?.source?.digest === sourceDigest, "AICR promotion source digest changed");
  check(receipt.spec?.source?.applicationCount === 17, "AICR promotion Application count changed");
  check(
    receipt.spec?.source?.exactSourceObjectsMatched === true,
    "AICR promotion source-object comparison did not pass",
  );
  check(
    JSON.stringify(receipt.spec?.source?.syncWaves) === JSON.stringify(expectedWaves),
    "AICR promotion sync waves changed",
  );
  check(
    receipt.spec?.change?.changedApplicationCount === 1
      && receipt.spec?.change?.changedApplications?.[0]
        === "argoproj.io/v1alpha1|Application|argocd|kube-prometheus-stack",
    "AICR promotion must change only kube-prometheus-stack",
  );
  check(
    receipt.spec?.change?.after?.admin?.existingSecret === "aicr-grafana-admin",
    "AICR promotion no longer uses the existing Grafana Secret",
  );
  check(
    receipt.spec?.change?.devDryRun === "pass"
      && receipt.spec?.change?.devDryRunLeftDataUnchanged === true
      && receipt.spec?.change?.devUpdate === "pass",
    "AICR dev change evidence is incomplete",
  );
  check(
    receipt.spec?.promotion?.path === "base -> dev -> staging"
      && receipt.spec?.promotion?.dryRun === "pass"
      && receipt.spec?.promotion?.dryRunReportedUnitCount === 1
      && receipt.spec?.promotion?.dryRunLeftStagingUnchanged === true
      && receipt.spec?.promotion?.result === "pass"
      && receipt.spec?.promotion?.stagingMatchesReviewedDev === true,
    "AICR promotion evidence is incomplete",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "AICR promotion cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("started no Kubernetes cluster")),
    "AICR promotion receipt must say that no cluster delivery was tested",
  );
  check(
    !JSON.stringify(receipt).includes(["cub", "lk"].join("-"))
      && !JSON.stringify(receipt).includes(["cub", "lk"].join(" ")),
    "AICR promotion receipt contains an obsolete cluster command",
  );
}

function renderSummary(receipt) {
  const source = receipt.spec.source;
  const change = receipt.spec.change;
  return `# AICR change promoted from development to staging

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live receipt. Rerun the scratch proof with \`npm run aicr-variant-promotion:run\`; verify it without external access with \`npm run aicr-variant-promotion:verify\`.

This test imported the AICR v0.14.0 Argo CD configuration into ConfigHub. The OCI contained ${source.applicationCount} exact Argo CD \`Application\` objects, including the component order recorded as sync waves 0 through 15.

The base was copied into development and staging variants. In development, the Grafana setting was changed from the example \`adminPassword: admin\` value to an existing Secret named \`aicr-grafana-admin\`. ConfigHub's dry run named one affected Application and left the stored configuration unchanged.

The staging promotion was also previewed first. Staging stayed unchanged during the preview. The real promotion then copied the reviewed development configuration to staging, and the two variants had the same recorded data hash.

| Check | Result |
| --- | --- |
| OCI digest imported | \`${source.digest}\` |
| Argo CD Applications | ${source.applicationCount} |
| Applications changed | ${change.changedApplicationCount}: \`kube-prometheus-stack\` |
| Development dry run changed stored data | no |
| Staging promotion dry run changed stored data | no |
| Staging matched reviewed development after promotion | yes |
| Scratch cleanup | pass |

The proof used three temporary Spaces for the base, development, and staging variants. All three were deleted after the checks.

No Kubernetes cluster was started. This receipt proves ConfigHub import, variants, an exact field change, a promotion preview, and a dev-to-staging promotion. It does not prove public Google Artifact Registry publication, Argo CD delivery, application health, GPU workload health, or the live \`helm-catalog\` apply policy.

- [AICR walkthrough](../../docs/demo/aicr/eks-h100-training-kubeflow.md)
- [Committed live receipt](../../runs/aicr-variant-promotion-proof/receipt.yaml)
`;
}

function waitForRegistry(registry) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (tryCommand("curl", ["-fsS", `http://${registry}/v2/`]).ok) return;
    command("sleep", ["0.25"]);
  }
  throw new Error(`temporary registry ${registry} did not become ready`);
}

function waitForContainerRemoval(container) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = command("docker", [
      "ps",
      "-a",
      "--filter",
      `name=^/${container}$`,
      "--format",
      "{{.Names}}",
    ]).trim();
    if (!name) return true;
    command("sleep", ["0.1"]);
  }
  return false;
}

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: {
      ...process.env,
      CONFIGHUB_AGENT: "1",
      CUB_CONTEXT: context,
    },
  });
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: {
      ...process.env,
      CONFIGHUB_AGENT: "1",
      CUB_CONTEXT: context,
    },
  });
}

function cubJson(context, args) {
  return JSON.parse(cub(context, args));
}

function jsonCommand(file, args) {
  return JSON.parse(command(file, args));
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, out: command(file, args, options) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
    };
  }
}

function safeRunId(value) {
  const compact = String(value)
    .replace(/\D/g, "")
    .slice(0, 14);
  check(compact.length >= 8, "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits");
  return compact;
}
