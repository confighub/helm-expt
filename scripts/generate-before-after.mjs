#!/usr/bin/env node
// Record the before-and-after examples under examples/before-after/, or check
// a recorded set offline.
//
//   node scripts/generate-before-after.mjs --generate   needs the network, helm,
//       kustomize, oras, git and cub with the workshop and argo plugins
//   node scripts/generate-before-after.mjs --verify     offline
//
// Each example keeps the files a person has today under before/, what the
// Workshop gives them under after/, and the output of the commands that read
// both under transcripts/. receipt.json records where each input came from,
// the tool versions, the commands, and the SHA-256 of every file. The site
// pages read these files and nothing else, so a page cannot show an output that
// was not recorded here.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { check, repoRoot, sha256 } from "./lib/proof-common.mjs";

export const BEFORE_AFTER_ROOT = "examples/before-after";
export const EXAMPLES_REPO = "https://github.com/confighub/examples";
export const EXAMPLES_COMMIT = "7f1b8f2fc849bb6488bc2c58f1469172018fc9dd";

const GPU_LISTING = "site/listings/nvidia-gpu-operator-v26-3-3-default.json";
const GPU_SOURCE_LOCK = "recipes/nvidia/gpu-operator/v26.3.3/source-lock.yaml";
const GPU_RETAINED = "recipes/nvidia/gpu-operator/v26.3.3/revisions/default/r001/rendered/release-objects.yaml";
const KUSTOMIZE_PATH = "gitops/argo/intermediate-ci-to-gitops/gitops-repo/environments/apptique";
const ARGO_PATH = "gitops/argo/beginner-app-of-apps";

const sha = (bytes) => `sha256:${sha256(bytes)}`;
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
// cub prints its result on stdout and its notes on stderr, so a transcript
// keeps both, in the order a terminal shows them.
const transcript = (args, cwd) => run("sh", ["-c", `cub ${args.map((arg) => `'${arg}'`).join(" ")} 2>&1`], { cwd });

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  }).sort();
}

function copyYaml(from, to) {
  for (const file of filesUnder(from).filter((path) => /\.ya?ml$/.test(path))) {
    const target = join(to, relative(from, file));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(file, target);
  }
}

function toolVersions() {
  const plugin = (name) => readFileSync(join(process.env.HOME, ".confighub/plugins", name, "cub-plugin.yaml"), "utf8").match(/^version:\s*(\S+)/m)?.[1];
  return {
    cub: run("cub", ["version"]).match(/^\s+Version:[ \t]+(v\S+)/m)?.[1],
    workshopPlugin: plugin("workshop"),
    argoPlugin: plugin("argo"),
    helm: run("helm", ["version", "--short"]).trim(),
    kustomize: run("kustomize", ["version"]).trim(),
    fluxSchemaPlugin: run("flux", ["plugin", "list"]).match(/^schema\s+(\S+)/m)?.[1],
  };
}

function checkoutExamples(work) {
  const dir = join(work, "examples");
  mkdirSync(dir);
  run("git", ["init", "-q"], { cwd: dir });
  run("git", ["fetch", "-q", "--depth", "1", `${EXAMPLES_REPO}.git`, EXAMPLES_COMMIT], { cwd: dir });
  run("git", ["checkout", "-q", "FETCH_HEAD"], { cwd: dir });
  return dir;
}

function generateHelm(work, out) {
  const listing = JSON.parse(readFileSync(join(repoRoot, GPU_LISTING), "utf8"));
  const lock = readFileSync(join(repoRoot, GPU_SOURCE_LOCK), "utf8");
  const url = lock.match(/^\s+url:\s*"([^"]+)"/m)[1];
  const chartSha = lock.match(/^\s+packageSHA256:\s*"([0-9a-f]{64})"/m)[1];
  const bundle = listing.oci.bundles.find((row) => row.role === "literal-config").reference;
  const dir = join(work, "helm");
  mkdirSync(join(dir, "bundle"), { recursive: true });

  run("curl", ["-fsSL", "-o", join(dir, "chart.tgz"), url]);
  check(sha256(readFileSync(join(dir, "chart.tgz"))) === chartSha, `${url} no longer has the SHA-256 that ${GPU_SOURCE_LOCK} records`);
  const before = run("helm", ["template", "gpu-operator", join(dir, "chart.tgz"), "--namespace", "gpu-operator"]);
  writeFileSync(join(dir, "before.yaml"), before);

  run("oras", ["pull", bundle.replace(/^oci:\/\//, ""), "-o", join(dir, "bundle")]);
  const archive = filesUnder(join(dir, "bundle")).find((path) => path.endsWith(".tar.gz"));
  mkdirSync(join(dir, "unpacked"));
  run("tar", ["-xzf", archive, "-C", join(dir, "unpacked")]);
  const after = readFileSync(join(dir, "unpacked/upstream.yaml"));
  check(sha256(after) === sha256(readFileSync(join(repoRoot, GPU_RETAINED))), `the bundle's upstream.yaml differs from ${GPU_RETAINED}`);
  writeFileSync(join(dir, "after.yaml"), after);

  mkdirSync(join(out, "before"), { recursive: true });
  writeFileSync(join(out, "before/before.yaml"), before);
  for (const file of ["README.md", "routes/crd-ordering.yaml", "routes/lifecycle-actions.yaml", "requirements/target-requirements.yaml"]) {
    mkdirSync(dirname(join(out, "after/bundle", file)), { recursive: true });
    cpSync(join(dir, "unpacked", file), join(out, "after/bundle", file));
  }
  mkdirSync(join(out, "transcripts"));
  writeFileSync(join(out, "transcripts/check-before.txt"), transcript(["config", "check", "before.yaml"], dir));
  writeFileSync(join(out, "transcripts/check-after.txt"), transcript(["config", "check", "after.yaml"], dir));
  return {
    sources: [
      { what: "the chart", url, sha256: `sha256:${chartSha}`, recordedIn: GPU_SOURCE_LOCK },
      { what: "the published bundle", reference: bundle, recordedIn: GPU_LISTING },
    ],
    repoFiles: { [GPU_RETAINED]: sha(after) },
    commands: [
      "helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v26.3.3 --namespace gpu-operator > before.yaml",
      `oras pull ${bundle.replace(/^oci:\/\//, "")}`,
      "cub config check before.yaml",
      "cub config check after.yaml",
    ],
    notes: [
      "before.yaml was rendered from the chart file above. Rendering with --repo gives the same bytes.",
      `after.yaml is the bundle's upstream.yaml. It is byte for byte ${GPU_RETAINED}, so it is not stored twice.`,
    ],
  };
}

function generateKustomize(examples, out) {
  copyYaml(join(examples, KUSTOMIZE_PATH), join(out, "before"));
  mkdirSync(join(out, "after"), { recursive: true });
  mkdirSync(join(out, "transcripts"), { recursive: true });
  for (const env of ["dev", "prod"]) {
    writeFileSync(join(out, `after/${env}.yaml`), run("kustomize", ["build", join(out, "before", env)]));
    writeFileSync(join(out, `transcripts/check-${env}.txt`), transcript(["config", "check", `${env}.yaml`], join(out, "after")));
  }
  return {
    sources: [{ what: "the dev and prod overlays", repository: EXAMPLES_REPO, commit: EXAMPLES_COMMIT, path: KUSTOMIZE_PATH }],
    commands: ["kustomize build dev > dev.yaml", "kustomize build prod > prod.yaml", "cub config check dev.yaml", "cub config check prod.yaml"],
    notes: ["dev.yaml and prod.yaml are built from the files under before/, so the stored inputs give the stored outputs."],
  };
}

function generateArgo(examples, work, out) {
  const source = join(examples, ARGO_PATH);
  copyYaml(source, join(out, "before"));
  mkdirSync(join(out, "transcripts"), { recursive: true });
  writeFileSync(join(out, "transcripts/argo-plan.txt"), transcript(["argo", "plan", "."], source));
  const onboard = join(work, "argo-onboard");
  run("cub", ["argo", "apply", ".", "--out", onboard], { cwd: source });
  for (const part of ["control", "repointed"]) cpSync(join(onboard, part), join(out, "after", part), { recursive: true });
  return {
    sources: [{ what: "the app of apps", repository: EXAMPLES_REPO, commit: EXAMPLES_COMMIT, path: ARGO_PATH }],
    commands: ["cub argo plan .", "cub argo apply . --out onboard"],
    notes: [
      "Both commands ran inside a checkout of the repository at the commit above, because the plugin reads the source paths from it.",
      "after/ keeps the Applications as Argo CD has them today (control/) and as they read after the handover (repointed/). The scripts that apply also writes are left out, because they name the directory they were written to.",
    ],
  };
}

function writeReceipt(id, out, recorded, tools) {
  const files = Object.fromEntries(filesUnder(out).map((path) => [relative(out, path), sha(readFileSync(path))]));
  for (const [path, text] of Object.entries(files)) check(!/\/private\/|\/tmp\/|\/Users\//.test(path + text), `${id}/${path} names a local path`);
  for (const path of filesUnder(join(out, "transcripts"))) {
    check(!/\/private\/|\/tmp\/|\/Users\//.test(readFileSync(path, "utf8")), `${relative(repoRoot, path)} names a local path`);
  }
  const receipt = { id, generatedBy: "scripts/generate-before-after.mjs", recordedOn: new Date().toISOString().slice(0, 10), tools, ...recorded, files };
  writeFileSync(join(out, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
}

function generate() {
  const tools = toolVersions();
  const work = mkdtempSync(join(tmpdir(), "before-after-"));
  try {
    const examples = checkoutExamples(work);
    const build = {
      "helm-gpu-operator": (out) => generateHelm(work, out),
      "kustomize-apptique": (out) => generateKustomize(examples, out),
      "argo-app-of-apps": (out) => generateArgo(examples, work, out),
    };
    for (const [id, make] of Object.entries(build)) {
      const out = join(repoRoot, BEFORE_AFTER_ROOT, id);
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      writeReceipt(id, out, make(out), tools);
      console.log(`recorded ${BEFORE_AFTER_ROOT}/${id}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function verifyBeforeAfter() {
  const root = join(repoRoot, BEFORE_AFTER_ROOT);
  const ids = readdirSync(root).filter((name) => statSync(join(root, name)).isDirectory()).sort();
  check(ids.length > 0, `${BEFORE_AFTER_ROOT} holds no example`);
  for (const id of ids) {
    const dir = join(root, id);
    const receiptPath = join(dir, "receipt.json");
    check(existsSync(receiptPath), `${BEFORE_AFTER_ROOT}/${id} has no receipt.json`);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    check(receipt.id === id, `${BEFORE_AFTER_ROOT}/${id}/receipt.json names ${receipt.id}`);
    const present = filesUnder(dir).map((path) => relative(dir, path)).filter((path) => path !== "receipt.json");
    for (const path of present) {
      check(receipt.files[path], `${BEFORE_AFTER_ROOT}/${id}/${path} is not in its receipt`);
      check(receipt.files[path] === sha(readFileSync(join(dir, path))), `${BEFORE_AFTER_ROOT}/${id}/${path} changed since it was recorded`);
    }
    for (const path of Object.keys(receipt.files)) check(present.includes(path), `${BEFORE_AFTER_ROOT}/${id}/${path} is in the receipt and missing`);
    for (const [path, digest] of Object.entries(receipt.repoFiles ?? {})) {
      check(digest === sha(readFileSync(join(repoRoot, path))), `${path} changed, and ${BEFORE_AFTER_ROOT}/${id} recorded it as its after file`);
    }
  }
  return ids;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  if (mode === "--generate") generate();
  else if (mode === "--verify") console.log(`before-after: ${verifyBeforeAfter().length} examples match their receipts`);
  else {
    console.error("usage: node scripts/generate-before-after.mjs --generate | --verify");
    process.exit(2);
  }
}
