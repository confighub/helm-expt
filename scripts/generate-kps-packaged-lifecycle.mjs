#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  writeYaml,
} from "./lib/proof-common.mjs";

const supportedVersions = ["85.3.3", "86.1.0"];
const mode =
  process.argv.find((arg) => ["--generate", "--verify"].includes(arg))
  ?? "--verify";
if (!["--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-kps-packaged-lifecycle.mjs --generate [--version <version>]
  node scripts/generate-kps-packaged-lifecycle.mjs --verify [--version <version>]`);
  process.exit(2);
}
const versionIndex = process.argv.indexOf("--version");
const requestedVersion =
  versionIndex >= 0 ? process.argv[versionIndex + 1] : "";
if (!requestedVersion) {
  for (const supportedVersion of supportedVersions) {
    const result = spawnSync(
      process.execPath,
      [process.argv[1], mode, "--version", supportedVersion],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "inherit",
      },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(
    `${mode === "--generate" ? "generated and verified" : "verified"} packaged kube-prometheus-stack lifecycle files for ${supportedVersions.join(" and ")}`,
  );
  process.exit(0);
}
check(
  supportedVersions.includes(requestedVersion),
  `unsupported kube-prometheus-stack lifecycle version ${requestedVersion}`,
);

const chart = "prometheus-community/kube-prometheus-stack";
const version = requestedVersion;
const versionSlug = version.replaceAll(".", "-");
const release = "kube-prometheus-stack";
const namespace = "monitoring";
const routeRoot = join(
  repoRoot,
  "config-catalog",
  "package-extras",
  "prometheus-community",
  "kube-prometheus-stack",
  version,
);
const sourceLockPath = join(
  repoRoot,
  "recipes",
  "prometheus-community",
  "kube-prometheus-stack",
  version,
  "source-lock.yaml",
);
const receiptPath = join(routeRoot, "generation-receipt.yaml");
const generatedFiles = {
  crds: join(routeRoot, "default-crds.yaml"),
  support: join(routeRoot, "hook-support.yaml"),
  createJob: join(routeRoot, "admission-create-job.yaml"),
  patchJob: join(routeRoot, "admission-patch-job.yaml"),
};
const readmePath = join(routeRoot, "README.md");
const preparePath = join(routeRoot, "prepare.sh");
const finishPath = join(routeRoot, "finish.sh");
const lifecycleActionsPath = join(routeRoot, "lifecycle-actions.yaml");
const maintainedTemplateRoot = join(
  repoRoot,
  "config-catalog",
  "package-extras",
  "prometheus-community",
  "kube-prometheus-stack",
  supportedVersions[0],
);
const createJobName = "kube-prometheus-stack-admission-create";
const patchJobName = "kube-prometheus-stack-admission-patch";
const sourceImage = "ghcr.io/jkroepke/kube-webhook-certgen:1.8.3";
const pinnedImage =
  "ghcr.io/jkroepke/kube-webhook-certgen@sha256:8ce13c365c8e9ced0aad5ef350a53c50b7ca5817f99d856b9eec895db1056728";

if (mode === "--generate") generate();
verify();
console.log("verified the packaged kube-prometheus-stack lifecycle files");

function generate() {
  const sourceLock = readYaml(sourceLockPath);
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kps-package-route-"));
  const archive = join(workRoot, `kube-prometheus-stack-${version}.tgz`);
  try {
    must("helm", [
      "pull",
      chart,
      "--version",
      version,
      "--destination",
      workRoot,
    ]);
    check(existsSync(archive), "helm pull did not produce the locked chart archive");
    check(
      sha256File(archive) === sourceLock.spec?.packageSHA256,
      "the downloaded chart archive differs from source-lock.yaml",
    );
    check(
      statSync(archive).size === Number(sourceLock.spec?.packageBytes),
      "the downloaded chart archive byte count differs from source-lock.yaml",
    );

    const rendered = must(
      "helm",
      [
        "template",
        release,
        archive,
        "--namespace",
        namespace,
        "--include-crds",
        "--skip-tests",
        "--set",
        "grafana.adminPassword=confighub-grafana-admin-password",
      ],
      { maxBuffer: 256 * 1024 * 1024 },
    ).stdout;
    const docs = parseDocs(rendered);
    const hookDocs = docs.filter(isHook);
    const ordinaryDocs = docs.filter((doc) => !isHook(doc));
    const crds = ordinaryDocs.filter(
      (doc) => doc.kind === "CustomResourceDefinition",
    );
    const createJobs = hookDocs.filter(
      (doc) => doc.kind === "Job" && doc.metadata?.name === createJobName,
    );
    const patchJobs = hookDocs.filter(
      (doc) => doc.kind === "Job" && doc.metadata?.name === patchJobName,
    );
    const support = hookDocs.filter((doc) => doc.kind !== "Job");

    check(docs.length === 131, `expected 131 chart objects, found ${docs.length}`);
    check(crds.length === 10, `expected ten CRDs, found ${crds.length}`);
    check(support.length === 5, `expected five support objects, found ${support.length}`);
    check(createJobs.length === 1, "expected one admission-create Job");
    check(patchJobs.length === 1, "expected one admission-patch Job");

    for (const job of [...createJobs, ...patchJobs]) {
      const container = job.spec?.template?.spec?.containers?.[0];
      check(container?.image === sourceImage, "the upstream hook image changed");
      container.image = pinnedImage;
    }

    mkdirSync(routeRoot, { recursive: true });
    materializeMaintainedFiles();
    writeDocuments(generatedFiles.crds, crds);
    writeDocuments(generatedFiles.support, support);
    writeDocuments(generatedFiles.createJob, createJobs);
    writeDocuments(generatedFiles.patchJob, patchJobs);
    writeYaml(receiptPath, {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "PackagedLifecycleGenerationReceipt",
      metadata: {
        name: `prometheus-community-kube-prometheus-stack-${versionSlug}`,
      },
      spec: {
        chart,
        version,
        sourceLock: relativeRepo(sourceLockPath),
        chartPackageSha256: sourceLock.spec.packageSHA256,
        totalChartObjects: docs.length,
        ordinaryObjects: ordinaryDocs.length,
        hookObjects: hookDocs.length,
        sourceImage,
        pinnedImage,
        files: Object.fromEntries(
          Object.entries(generatedFiles).map(([name, path]) => [
            name,
            {
              path: relativeRepo(path),
              sha256: sha256File(path),
              objects: parseDocs(readFileSync(path, "utf8"))
                .map(objectIdentity)
                .sort(),
            },
          ]),
        ),
      },
    });
    console.log(`wrote ${relativeRepo(receiptPath)}`);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function materializeMaintainedFiles() {
  if (version === supportedVersions[0]) return;
  for (const name of [
    "README.md",
    "prepare.sh",
    "finish.sh",
    "lifecycle-actions.yaml",
  ]) {
    const template = readFileSync(join(maintainedTemplateRoot, name), "utf8");
    writeFileSync(
      join(routeRoot, name),
      template
        .replaceAll(supportedVersions[0], version)
        .replaceAll(supportedVersions[0].replaceAll(".", "-"), versionSlug),
    );
  }
}

function verify() {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing`);
  const receipt = readYaml(receiptPath);
  const sourceLock = readYaml(sourceLockPath);
  const spec = receipt.spec;
  check(
    receipt.kind === "PackagedLifecycleGenerationReceipt"
      && spec?.chart === chart
      && spec?.version === version,
    "the packaged lifecycle receipt source changed",
  );
  check(
    spec.chartPackageSha256 === sourceLock.spec?.packageSHA256,
    "the packaged lifecycle receipt is not tied to the current source lock",
  );
  check(
    spec.totalChartObjects === 131
      && spec.ordinaryObjects === 124
      && spec.hookObjects === 7,
    "the recorded chart object counts changed",
  );
  check(
    spec.sourceImage === sourceImage && spec.pinnedImage === pinnedImage,
    "the hook image hardening record changed",
  );

  for (const [name, path] of Object.entries(generatedFiles)) {
    check(existsSync(path), `${relativeRepo(path)} is missing`);
    const record = spec.files?.[name];
    check(record?.path === relativeRepo(path), `${name} route path changed`);
    check(record.sha256 === sha256File(path), `${name} route file changed`);
    const docs = parseDocs(readFileSync(path, "utf8"));
    check(
      sameSet(
        docs.map(objectIdentity).sort(),
        [...(record.objects ?? [])].sort(),
      ),
      `${name} route object set changed`,
    );
  }

  const crds = parseDocs(readFileSync(generatedFiles.crds, "utf8"));
  const support = parseDocs(readFileSync(generatedFiles.support, "utf8"));
  const createJob = parseDocs(readFileSync(generatedFiles.createJob, "utf8"));
  const patchJob = parseDocs(readFileSync(generatedFiles.patchJob, "utf8"));
  check(crds.length === 10, "the packaged CRD set must contain ten objects");
  check(support.length === 5, "the packaged hook support set must contain five objects");
  check(
    createJob.length === 1
      && createJob[0].kind === "Job"
      && createJob[0].metadata?.name === createJobName,
    "the packaged admission-create Job changed",
  );
  check(
    patchJob.length === 1
      && patchJob[0].kind === "Job"
      && patchJob[0].metadata?.name === patchJobName,
    "the packaged admission-patch Job changed",
  );
  for (const job of [...createJob, ...patchJob]) {
    check(
      job.spec?.template?.spec?.containers?.[0]?.image === pinnedImage,
      `${job.metadata.name} is not pinned to the recorded multi-platform digest`,
    );
  }

  for (const path of [readmePath, preparePath, finishPath, lifecycleActionsPath]) {
    check(existsSync(path), `${relativeRepo(path)} is missing`);
  }
  check(must("bash", ["-n", preparePath]).stdout === "", "prepare.sh failed bash syntax validation");
  check(must("bash", ["-n", finishPath]).stdout === "", "finish.sh failed bash syntax validation");
  const actions = readYaml(lifecycleActionsPath);
  check(
    actions.kind === "PackagedLifecycleActions"
      && actions.spec?.chart === chart
      && actions.spec?.version === version,
    "the packaged lifecycle action contract source changed",
  );
  const bases = actions.spec?.bases ?? [];
  check(
    sameSet(bases.map((base) => base.name), ["default", "no-crds"]),
    "the packaged lifecycle action bases changed",
  );
  for (const base of bases) {
    const actionRows = base.actions ?? [];
    check(actionRows.length === 3, `${base.name} must record three ordered actions`);
    check(
      actionRows[0].phase === "pre-apply"
        && actionRows[1].phase === "pre-apply"
        && actionRows[2].phase === "post-apply",
      `${base.name} lifecycle action order changed`,
    );
    check(
      actionRows.every((action) => action.automatic === false),
      `${base.name} packaged actions must remain explicit until product execution is proved`,
    );
  }
}

function isHook(doc) {
  return Boolean(doc.metadata?.annotations?.["helm.sh/hook"]);
}

function writeDocuments(path, docs) {
  writeFileSync(path, `${docs.map((doc) => toYaml(doc)).join("\n---\n")}\n`);
}

function objectIdentity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function sameSet(left, right) {
  return left.length === right.length
    && left.every((item) => right.includes(item));
}

function must(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: options.timeout ?? 180_000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  check(
    result.status === 0,
    `${file} ${args.join(" ")} failed: ${String(result.stderr || result.stdout).replace(/\s+/g, " ").trim().slice(0, 500)}`,
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
