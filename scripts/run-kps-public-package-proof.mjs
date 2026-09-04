#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, relative } from "node:path";

import { copyInstalledCubPlugin } from "./lib/installed-cub-plugin.mjs";

import {
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-kps-public-package-proof.mjs --run
  node scripts/run-kps-public-package-proof.mjs --verify`);
  process.exit(2);
}

const chart = "prometheus-community/kube-prometheus-stack";
const version = "85.3.3";
const base = "default";
const namespace = "monitoring";
const packageRoot = join(
  repoRoot,
  "packages",
  "prometheus-community",
  "kube-prometheus-stack",
  version,
);
const publicationReceiptPath = join(
  repoRoot,
  "runs",
  "installer-oci",
  "prometheus-community-kube-prometheus-stack",
  version,
  "installer-package-publication-receipt.yaml",
);
const receiptPath = join(
  repoRoot,
  "runs",
  "kps-public-package-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "kps-public-package-proof",
  "summary.md",
);
if (mode === "--run") {
  const receipt = runProof();
  verifyReceipt(receipt);
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(readYaml(receiptPath)));
  console.log(`wrote ${relativeRepo(receiptPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale`,
  );
  console.log("verified the anonymous kube-prometheus-stack package proof");
}

function runProof() {
  const publication = readYaml(publicationReceiptPath);
  const reference = String(publication.spec?.ref ?? "");
  const manifestDigest = publicationManifestDigest(publication);
  check(reference.startsWith("oci://"), "the publication receipt has no OCI reference");
  check(
    /^sha256:[0-9a-f]{64}$/.test(manifestDigest),
    "the publication receipt has no manifest digest",
  );

  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kps-public-"));
  try {
    const isolated = prepareAnonymousEnvironment(workRoot);
    const installRoot = join(workRoot, "install");
    check(
      listFiles(isolated.dockerRoot).length === 1,
      "the isolated Docker config must start with only an empty config.json",
    );
    command(
      join(homedir(), ".confighub", "bin", "cub"),
      [
        "installer",
        "setup",
        "--pull",
        reference,
        "--base",
        base,
        "--work-dir",
        installRoot,
        "--non-interactive",
        "--namespace",
        namespace,
      ],
      isolated.env,
    );

    const pulledPackageRoot = join(installRoot, "package");
    const localTree = packageTree(packageRoot);
    const pulledTree = packageTree(pulledPackageRoot);
    check(
      localTree.digest === pulledTree.digest
        && sameSet(localTree.files, pulledTree.files),
      "the anonymously pulled package differs from the published local package",
    );

    const manifests = readDocs(join(installRoot, "out", "manifests"));
    const secrets = readDocs(join(installRoot, "out", "secrets"));
    const lifecycleRoot = join(
      pulledPackageRoot,
      "prerequisites",
      "kube-prometheus-stack-lifecycle",
    );
    const lifecycleFiles = listFiles(lifecycleRoot)
      .map((path) => relative(lifecycleRoot, path))
      .sort();
    check(manifests.length === 123, "anonymous render must contain 123 manifests");
    check(secrets.length === 2, "anonymous render must contain two Secrets");
    check(lifecycleFiles.length === 9, "anonymous package must contain nine lifecycle files");
    check(
      listFiles(isolated.dockerRoot).length === 1
        && readFileSync(join(isolated.dockerRoot, "config.json"), "utf8") === '{"auths":{}}\n',
      "anonymous pull changed the empty Docker credential config",
    );

    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "KubePrometheusStackPublicPackageProofReceipt",
      metadata: {
        name: "prometheus-community-kube-prometheus-stack-85-3-3-default",
      },
      spec: {
        chart,
        version,
        base,
        namespace,
        recordedAt: new Date().toISOString(),
        result: "pass",
        source: {
          reference,
          manifestDigest,
          publicationReceipt: relativeRepo(publicationReceiptPath),
          packageLayerSha256: publication.spec?.package?.sha256,
        },
        client: {
          configHubAccountUsed: false,
          registryLoginUsed: false,
          isolatedHome: true,
          dockerConfig: "empty auths map before and after pull",
          command:
            `cub installer setup --pull ${reference} --base ${base} --work-dir <tmp>/install --non-interactive --namespace ${namespace}`,
        },
        package: {
          files: pulledTree.files.length,
          treeSha256: pulledTree.digest,
          matchesPublishedSource: true,
          lifecycleFiles,
        },
        render: {
          manifests: manifests.length,
          secrets: secrets.length,
          totalObjects: manifests.length + secrets.length,
          objectKinds: countKinds([...manifests, ...secrets]),
        },
        limits: [
          "This proof checks anonymous pull, package integrity, render output, and the presence of the chart-specific lifecycle files.",
          "The separate lifecycle route receipt records the fresh-cluster execution of those files.",
          "Argo CD and Flux execution remain separate controller proofs.",
        ],
      },
    };
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function prepareAnonymousEnvironment(workRoot) {
  const home = join(workRoot, "anonymous-home");
  const dockerRoot = join(workRoot, "anonymous-docker");
  copyInstalledCubPlugin({
    commandName: "installer",
    home,
    pluginName: "installer",
  });
  mkdirSync(dockerRoot, { recursive: true });
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
  return { dockerRoot, env };
}

function packageTree(root) {
  const rows = listFiles(root)
    .map((path) => ({
      path: relative(root, path),
      sha256: sha256File(path),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const digest = createHash("sha256")
    .update(rows.map((row) => `${row.sha256}  ${row.path}\n`).join(""))
    .digest("hex");
  return {
    digest,
    files: rows.map((row) => row.path),
  };
}

function readDocs(root) {
  return readdirSync(root)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
    .flatMap((name) => parseDocs(readFileSync(join(root, name), "utf8")));
}

function countKinds(docs) {
  return Object.fromEntries(
    [...docs.reduce((counts, doc) => {
      counts.set(doc.kind, (counts.get(doc.kind) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function command(file, args, env) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
    timeout: 300_000,
  });
}

function publicationManifestDigest(receipt) {
  return String(receipt.spec?.outputs?.push ?? "").match(
    /manifest:\s*(sha256:[0-9a-f]{64})/,
  )?.[1] ?? "";
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "KubePrometheusStackPublicPackageProofReceipt"
      && receipt.spec?.chart === chart
      && receipt.spec?.version === version
      && receipt.spec?.base === base
      && receipt.spec?.result === "pass",
    "the public package proof source or result changed",
  );
  const publication = readYaml(publicationReceiptPath);
  check(
    receipt.spec.source?.reference === publication.spec?.ref
      && receipt.spec.source?.manifestDigest
        === publicationManifestDigest(publication)
      && receipt.spec.source?.packageLayerSha256
        === publication.spec?.package?.sha256,
    "the public package proof no longer matches the publication receipt",
  );
  check(
    receipt.spec.client?.configHubAccountUsed === false
      && receipt.spec.client?.registryLoginUsed === false
      && receipt.spec.client?.isolatedHome === true,
    "the anonymous client boundary changed",
  );
  const tree = packageTree(packageRoot);
  check(
    receipt.spec.package?.files === tree.files.length
      && receipt.spec.package?.treeSha256 === tree.digest
      && receipt.spec.package?.matchesPublishedSource === true
      && receipt.spec.package?.lifecycleFiles?.length === 9,
    "the recorded public package no longer matches the source package",
  );
  check(
    receipt.spec.render?.manifests === 123
      && receipt.spec.render?.secrets === 2
      && receipt.spec.render?.totalObjects === 125,
    "the anonymous render object count changed",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  return `# Anonymous kube-prometheus-stack package proof

This test starts with a new local home directory and an empty Docker credential file. It pulls the public kube-prometheus-stack package without a ConfigHub account or registry login.

The pulled package matches the ${spec.package.files}-file source package exactly at tree digest \`${spec.package.treeSha256}\`. It renders ${spec.render.manifests} manifest objects and ${spec.render.secrets} Secret objects. It also contains all nine chart-specific lifecycle files: the ten CRDs, the admission certificate and patch Jobs, their temporary RBAC, the two runner scripts, and the action and generation records.

Public OCI manifest: \`${spec.source.manifestDigest}\`.

Result: **${spec.result}**.

## What this proves

- The published package can be pulled with no ConfigHub account and no Google registry login.
- The public package is the same package that was generated and checked in this repository.
- A user receives both the rendered configuration and the files needed for this chart's CRD and admission-webhook setup.

## What remains

${spec.limits.map((item) => `- ${item}`).join("\n")}

Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)}).
`;
}

function sameSet(left, right) {
  return left.length === right.length
    && left.every((item) => right.includes(item));
}
