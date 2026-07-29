#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(
  repoRoot,
  "runs",
  "redis-public-walkthrough-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "redis-public-walkthrough-proof",
  "summary.md",
);
const pluginSource = join(homedir(), ".confighub", "plugins", "installer");
const base = "reuse-existing-secret";
const namespace = "redis";
const packageRecords = [
  {
    version: "25.5.3",
    appVersion: "8.6.3",
    ref: "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3",
    publicationReceipt: join(
      repoRoot,
      "runs",
      "installer-oci",
      "bitnami-redis",
      "25.5.3",
      "installer-package-publication-receipt.yaml",
    ),
  },
  {
    version: "27.0.0",
    appVersion: "8.8.0",
    ref: "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:27.0.0",
    publicationReceipt: join(
      repoRoot,
      "runs",
      "installer-oci",
      "bitnami-redis",
      "27.0.0",
      "installer-package-publication-receipt.yaml",
    ),
  },
];

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)}: ${receipt.status.result}`);
  if (receipt.status.result !== "pass") process.exitCode = 1;
} else if (mode === "--verify") {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run npm run redis-public-walkthrough:run`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    existsSync(summaryPath)
      && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run redis-public-walkthrough:run`,
  );
  console.log("verified the public Redis 25.5.3 to 27.0.0 walkthrough");
} else {
  console.log(`Usage:
  node scripts/run-redis-public-walkthrough-proof.mjs --run
  node scripts/run-redis-public-walkthrough-proof.mjs --verify`);
}

function runProof() {
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-walkthrough-"));
  const installRoot = join(workRoot, "redis");
  const isolated = prepareAnonymousEnvironment(workRoot);
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "RedisPublicWalkthroughProofReceipt",
    metadata: {
      name: "redis-25-5-3-to-27-0-0",
    },
    spec: {
      observedAt: new Date().toISOString(),
      chart: "bitnami/redis",
      execution: {
        configHubAccountUsed: false,
        registryLoginUsed: false,
        kubernetesClusterUsed: false,
        isolatedHome: true,
      },
      selectedBase: base,
      namespace,
      versions: [],
      retainedChoice: {
        field: "Selection.spec.base",
        before: "",
        after: "",
        result: "not-run",
      },
      managedContinuation: {
        summary: "data/redis-upgrade-app-proof/summary.md",
        receipt: "runs/redis-upgrade-app-proof/receipt.yaml",
      },
      limits: [
        "This public run proves anonymous package pulls, local rendering, local OCI output, OCI pull-back verification, and retention of the selected base across a package upgrade.",
        "The selected existing-Secret base keeps credential bytes out of the rendered files and OCI. A deployer still has to create or bind redis/redis-existing-secret.",
        "The no-account run does not keep arbitrary edits to rendered Kubernetes objects. The separate ConfigHub proof covers a post-render replica edit, promotion, two-cluster rollout, and rollback.",
        "This run does not apply either version to Kubernetes. The separate serverless install parity proof covers live Helm and cub installs.",
      ],
    },
    status: {
      result: "blocked",
      claim: "",
      error: "",
    },
  };

  try {
    for (const [index, record] of packageRecords.entries()) {
      const publication = readYaml(record.publicationReceipt);
      const expectedSourceDigest = publicationManifestDigest(publication);
      check(
        publication.spec?.ref === record.ref,
        `${relativeRepo(record.publicationReceipt)} ref changed`,
      );
      check(
        /^sha256:[0-9a-f]{64}$/.test(expectedSourceDigest),
        `${relativeRepo(record.publicationReceipt)} has no manifest digest`,
      );

      const descriptor = JSON.parse(
        command(
          "oras",
          ["manifest", "fetch", "--descriptor", stripOci(record.ref)],
          isolated.env,
        ),
      );
      check(
        descriptor.digest === expectedSourceDigest,
        `${record.version} anonymous source digest differs from its publication receipt`,
      );

      const outputRoot = join(workRoot, `redis-${record.version}.oci`);
      const setupArgs = [
        "installer",
        "setup",
        "--pull",
        record.ref,
        "--work-dir",
        installRoot,
        "--non-interactive",
        "--namespace",
        namespace,
        "--output-oci",
        outputRoot,
      ];
      if (index === 0) setupArgs.push("--base", base);
      else setupArgs.push("--reuse");

      const output = command("cub", setupArgs, isolated.env);
      const selection = readYaml(join(installRoot, "out", "spec", "selection.yaml"));
      const docs = readManifestDocs(join(installRoot, "out", "manifests"));
      const workload = docs.find(
        (doc) =>
          doc.kind === "StatefulSet"
          && doc.metadata?.name === "redis-master",
      );
      check(Boolean(workload), `${record.version} has no redis-master StatefulSet`);

      const chartLabel = workload.metadata?.labels?.["helm.sh/chart"] ?? "";
      const appVersion = workload.metadata?.labels?.["app.kubernetes.io/version"] ?? "";
      check(
        chartLabel === `redis-${record.version}`,
        `${record.version} rendered chart label is ${chartLabel || "missing"}`,
      );
      check(
        appVersion === record.appVersion,
        `${record.version} rendered app version is ${appVersion || "missing"}`,
      );
      check(
        selection.spec?.base === base,
        `${record.version} selected ${selection.spec?.base ?? "no base"}`,
      );
      check(docs.length === 14, `${record.version} rendered ${docs.length} objects, not 14`);
      check(
        docs.every((doc) => doc.kind !== "Secret"),
        `${record.version} rendered a Secret into the public object set`,
      );

      const manifestDigest = matchDigest(output, "manifest");
      const objectSetDigest = matchDigest(output, "objects");
      check(
        /pull-back:\s*verified/.test(output),
        `${record.version} did not verify its rendered OCI by pulling it back`,
      );
      receipt.spec.versions.push({
        version: record.version,
        appVersion,
        packageReference: record.ref,
        publicationReceipt: relativeRepo(record.publicationReceipt),
        sourceManifestDigest: expectedSourceDigest,
        anonymousPull: "pass",
        selectedBase: selection.spec.base,
        objectCount: docs.length,
        secretObjectCount: 0,
        renderedOci: {
          destination: "temporary local OCI layout",
          manifestDigest,
          objectSetDigest,
          pullBack: "pass",
        },
      });
    }

    receipt.spec.retainedChoice.before = receipt.spec.versions[0].selectedBase;
    receipt.spec.retainedChoice.after = receipt.spec.versions[1].selectedBase;
    receipt.spec.retainedChoice.result =
      receipt.spec.retainedChoice.before === base
      && receipt.spec.retainedChoice.after === base
        ? "pass"
        : "fail";
    check(
      receipt.spec.retainedChoice.result === "pass",
      "the selected existing-Secret base was not retained across the package upgrade",
    );

    receipt.status.result = "pass";
    receipt.status.claim =
      "With no ConfigHub account, registry login, or Kubernetes cluster, cub installer anonymously pulled Redis 25.5.3, rendered the existing-Secret base as 14 non-secret objects, wrote and verified a local OCI, upgraded the same work directory to 27.0.0, retained the selected base, and wrote and verified the newer 14-object OCI.";
  } catch (error) {
    receipt.status.error = sanitizeError(error);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
  return receipt;
}

function prepareAnonymousEnvironment(workRoot) {
  check(
    existsSync(join(pluginSource, "cub-plugin.yaml"))
      && existsSync(join(pluginSource, "bin", "installer")),
    "cub installer plugin is not installed",
  );
  const home = join(workRoot, "anonymous-home");
  const pluginTarget = join(home, ".confighub", "plugins", "installer");
  const dockerRoot = join(workRoot, "anonymous-docker");
  mkdirSync(join(pluginTarget, "bin"), { recursive: true });
  mkdirSync(dockerRoot, { recursive: true });
  copyFileSync(
    join(pluginSource, "cub-plugin.yaml"),
    join(pluginTarget, "cub-plugin.yaml"),
  );
  copyFileSync(
    join(pluginSource, "bin", "installer"),
    join(pluginTarget, "bin", "installer"),
  );
  chmodSync(join(pluginTarget, "bin", "installer"), 0o755);
  writeFileSync(join(dockerRoot, "config.json"), '{"auths":{}}\n');

  const env = {
    ...process.env,
    HOME: home,
    DOCKER_CONFIG: dockerRoot,
  };
  for (const name of [
    "CONFIGHUB_ACCESS_TOKEN",
    "CONFIGHUB_CONTEXT",
    "CONFIGHUB_TOKEN",
    "CUB_CONTEXT",
  ]) {
    delete env[name];
  }
  return { env };
}

function readManifestDocs(root) {
  return readdirSync(root)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .flatMap((name) => parseDocs(readFileSync(join(root, name), "utf8")))
    .filter((doc) => doc && doc.kind && doc.metadata?.name);
}

function command(name, args, env) {
  return execFileSync(name, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function stripOci(ref) {
  return ref.replace(/^oci:\/\//, "");
}

function publicationManifestDigest(receipt) {
  return String(receipt.spec?.outputs?.push ?? "").match(
    /manifest:\s*(sha256:[0-9a-f]{64})/,
  )?.[1] ?? "";
}

function matchDigest(output, label) {
  const digest = output.match(
    new RegExp(`${label}:\\s*(sha256:[0-9a-f]{64})`),
  )?.[1] ?? "";
  check(Boolean(digest), `cub installer output has no ${label} digest`);
  return digest;
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "RedisPublicWalkthroughProofReceipt",
    "Redis public walkthrough receipt kind changed",
  );
  check(receipt.status?.result === "pass", "Redis public walkthrough did not pass");
  check(
    receipt.spec?.execution?.configHubAccountUsed === false
      && receipt.spec?.execution?.registryLoginUsed === false
      && receipt.spec?.execution?.kubernetesClusterUsed === false,
    "Redis public walkthrough execution boundary changed",
  );
  check(
    receipt.spec?.selectedBase === base
      && receipt.spec?.retainedChoice?.result === "pass",
    "Redis public walkthrough did not retain the selected base",
  );
  check(
    Array.isArray(receipt.spec?.versions)
      && receipt.spec.versions.length === packageRecords.length,
    "Redis public walkthrough must record both package versions",
  );
  for (const [index, record] of packageRecords.entries()) {
    const step = receipt.spec.versions[index];
    const publication = readYaml(record.publicationReceipt);
    check(step.version === record.version, `Redis step ${index + 1} version changed`);
    check(step.appVersion === record.appVersion, `${record.version} app version changed`);
    check(step.packageReference === record.ref, `${record.version} package ref changed`);
    check(
      step.sourceManifestDigest === publicationManifestDigest(publication),
      `${record.version} proof no longer matches its publication receipt`,
    );
    check(step.anonymousPull === "pass", `${record.version} anonymous pull did not pass`);
    check(step.selectedBase === base, `${record.version} selected base changed`);
    check(
      step.objectCount === 14 && step.secretObjectCount === 0,
      `${record.version} object boundary changed`,
    );
    check(
      /^sha256:[0-9a-f]{64}$/.test(step.renderedOci?.manifestDigest ?? "")
        && /^sha256:[0-9a-f]{64}$/.test(step.renderedOci?.objectSetDigest ?? "")
        && step.renderedOci?.pullBack === "pass",
      `${record.version} rendered OCI evidence is incomplete`,
    );
  }
}

function renderSummary(receipt) {
  const rows = receipt.spec.versions.map((step) =>
    `| \`${step.version}\` | \`${step.appVersion}\` | \`${step.selectedBase}\` | ${step.objectCount} | ${step.secretObjectCount} | \`${step.sourceManifestDigest}\` | \`${step.renderedOci.objectSetDigest}\` | ${step.renderedOci.pullBack} |`,
  ).join("\n");
  return `# Redis public walkthrough proof

This run exercises the public part of the Redis walkthrough without a
ConfigHub account, a registry login, or a Kubernetes cluster.

It pulls the published Redis \`25.5.3\` installer package, selects the
\`reuse-existing-secret\` base, writes the 14 rendered Kubernetes objects to
files and a local OCI layout, and pulls that OCI back for comparison. It then
pulls Redis \`27.0.0\` into the same work directory with \`--reuse\`. The
installer retains the selected existing-Secret base and verifies a second
14-object OCI.

## Result

**${receipt.status.result}.** ${receipt.status.claim}

| Chart | App | Selected base | Objects | Secrets in output | Public package digest | Rendered object digest | OCI pull-back |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
${rows}

The package and output OCI contain no Secret object. A deployment still needs
\`redis/redis-existing-secret\`, key \`redis-password\`, supplied through the
operator's normal secret-management path.

## Where ConfigHub starts

The public run keeps a package choice. It does not claim to keep an arbitrary
edit to a rendered Kubernetes object.

The [managed Redis upgrade proof](../redis-upgrade-app-proof/summary.md) covers
that next step. It changes the rendered replica StatefulSet from three replicas
to two, upgrades the chart from \`25.5.3\` to \`27.0.0\` without resetting the
replica count, promotes the result through development and staging, reconciles
the same reviewed OCI on two Argo CD clusters, and restores the prior revisions
as a rollback.

## Limits

${receipt.spec.limits.map((item) => `- ${item}`).join("\n")}

Receipt:
[\`runs/redis-public-walkthrough-proof/receipt.yaml\`](../../runs/redis-public-walkthrough-proof/receipt.yaml).
`;
}

function sanitizeError(error) {
  return String(error?.stderr || error?.message || error)
    .replaceAll(repoRoot, "<repo>")
    .replaceAll(homedir(), "~")
    .replace(/\/(?:private\/)?var\/folders\/[^/\s]+\/[^/\s]+\/T\/[^/\s]+/g, "<tmp>")
    .slice(0, 4000);
}
