#!/usr/bin/env node
// Record the before-and-after examples under examples/before-after/, or check
// a recorded set offline.
//
//   node scripts/generate-before-after.mjs --generate [id ...]   needs the network, helm,
//       kustomize, oras, git and cub with the workshop, argo and flux plugins
//   node scripts/generate-before-after.mjs --screenshots   records the ConfigHub
//       screenshots under <id>/confighub/ in each receipt
//   node scripts/generate-before-after.mjs --verify     offline
//
// Each example keeps the files a person has today under before/, what the
// Workshop gives them under after/, and the output of the commands that read
// both under transcripts/. receipt.json records where each input came from,
// the tool versions, the commands, and the SHA-256 of every file. The site
// pages read these files and nothing else, so a page cannot show an output that
// was not recorded here.

import { fetchRepositoryURL } from "./lib/upstream-availability.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { check, py, readYamlText, repoRoot, sha256 } from "./lib/proof-common.mjs";

export const BEFORE_AFTER_ROOT = "examples/before-after";
export const EXAMPLES_REPO = "https://github.com/confighub/examples";
export const EXAMPLES_COMMIT = "7f1b8f2fc849bb6488bc2c58f1469172018fc9dd";

// Screenshots of each example as ConfigHub holds it, taken in a browser and
// cropped by hand, so they are recorded here rather than made by --generate.
// Each was loaded with the commands its page prints. A Helm picture shows the
// image line of the object the page's template excerpt renders; a GitOps or
// Kustomize picture shows the graph of the base and its variants beside the
// settings prod changes. A crop leaves out the activity feed and the account
// menu, which name the person signed in.
export const SCREENSHOTS = {
  "helm-redis": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the redis-replicas StatefulSet, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the Redis base with its dev and prod variants, and the label, requests and limits prod sets on the Redis master" } },
  "helm-postgresql": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the PostgreSQL StatefulSet, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the PostgreSQL base with its dev and prod variants, and the label and three replicas prod sets on its StatefulSet" } },
  "helm-ingress-nginx": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the ingress-nginx controller Deployment, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the ingress-nginx base with its dev and prod variants, and the label and three replicas prod sets on the controller" } },
  "helm-cert-manager": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the cert-manager controller Deployment, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the cert-manager base with a prod variant, and the label and three replicas prod sets on the controller" }, crds: { file: "confighub/crds.png", takenOn: "2026-10-26", shows: "the 6 cert-manager CRDs as Units in the base" } },
  "helm-kube-prometheus-stack": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the Prometheus object, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the kube-prometheus-stack base with its dev and prod variants, and the label and three replicas prod sets on the operator" }, crds: { file: "confighub/crds.png", takenOn: "2026-10-26", shows: "the 10 Prometheus Operator CRDs as Units in the base" } },
  "helm-argo-cd": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the Argo CD repo-server Deployment, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the Argo CD base with its dev and prod variants, and the label and three replicas prod sets on the server" }, crds: { file: "confighub/crds.png", takenOn: "2026-10-26", shows: "the 3 Argo CD CRDs as Units in the base" } },
  "helm-external-secrets": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the External Secrets Deployment, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the External Secrets base with its dev and prod variants, and the label and three replicas prod sets on the controller" }, crds: { file: "confighub/crds.png", takenOn: "2026-10-26", shows: "the External Secrets CRDs among the base's Units" } },
  "helm-metrics-server": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the metrics-server Deployment, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the metrics-server base with its dev and prod variants, and the label and three replicas prod sets on its Deployment" } },
  "helm-gatekeeper": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the Gatekeeper controller-manager Deployment, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the Gatekeeper base with its dev and prod variants, and the label and three replicas prod sets on the audit Deployment" }, crds: { file: "confighub/crds.png", takenOn: "2026-10-26", shows: "the 17 Gatekeeper CRDs among the base's Units" } },
  "helm-gpu-operator": { file: "confighub/object.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the GPU Operator Deployment, at its image line",
    graph: { file: "confighub/graph.png", takenOn: "2026-10-26", shows: "the GPU Operator base with its dev and prod variants, and the label and three replicas prod sets on the operator" }, crds: { file: "confighub/crds.png", takenOn: "2026-10-26", shows: "the 5 GPU Operator CRDs as Units in the base" } },
  "kustomize-apptique": { file: "confighub/overrides.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the base with its dev and prod variants, and the settings prod changes" },
  "kustomize-helm-chart": { file: "confighub/overrides.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the base with its dev, staging and prod variants, and the settings prod changes" },
  "argo-app-of-apps": { file: "confighub/overrides.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the apptique-prod base with its in-cluster variant, and the prod Deployment's settings" },
  "argo-applicationset": { file: "confighub/overrides.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the base with the two variants the ApplicationSet generates, and the settings prod changes" },
  "flux-beginner": { file: "confighub/overrides.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the apps layer's base with its dev and prod variants, and the settings prod changes" },
  "app-shop-web": { file: "confighub/overrides.png", organization: "helm-catalog", takenOn: "2026-10-26", shows: "the shop-web base with its dev and prod variants, and the label and five replicas prod sets" },
  "flux-expert-fleet": { file: "confighub/overrides.png", organization: "helm-catalog", takenOn: "2026-10-25", shows: "the apps layer's base with a variant for each cluster, and the settings prod-1 changes" },
};

// Helm charts shown from a Catalog entry. "before" is what a person renders
// today: "base" uses the same values as the entry's base, "defaults" uses the
// chart's own defaults, which is how most people start. The listing names the
// render inputs, the retained objects and the plan.
export const HELM_EXAMPLES = [
  { id: "helm-redis", listing: "bitnami-redis-25-5-3-reuse-existing-secret", before: "defaults" },
  { id: "helm-postgresql", listing: "bitnami-postgresql-18-7-0-existing-secret", before: "defaults" },
  { id: "helm-ingress-nginx", listing: "ingress-nginx-ingress-nginx-4-15-1-default", before: "base" },
  { id: "helm-cert-manager", listing: "jetstack-cert-manager-v1-21-1-crds-enabled", before: "base" },
  { id: "helm-kube-prometheus-stack", listing: "prometheus-community-kube-prometheus-stack-88-6-3-default", before: "base" },
  { id: "helm-argo-cd", listing: "argo-cd-argo-cd-10-7-0-default", before: "base" },
  { id: "helm-external-secrets", listing: "external-secrets-external-secrets-2-8-0-default", before: "base" },
  { id: "helm-metrics-server", listing: "metrics-server-metrics-server-3-14-0-default", before: "base" },
  { id: "helm-gatekeeper", listing: "gatekeeper-gatekeeper-3-22-2-default", before: "base" },
];

const GPU_LISTING = "site/listings/nvidia-gpu-operator-v26-3-3-default.json";
const GPU_SOURCE_LOCK = "recipes/nvidia/gpu-operator/v26.3.3/source-lock.yaml";
const GPU_RETAINED = "recipes/nvidia/gpu-operator/v26.3.3/revisions/default/r001/rendered/release-objects.yaml";
const KUSTOMIZE_PATH = "gitops/argo/intermediate-ci-to-gitops/gitops-repo/environments/apptique";
const ARGO_PATH = "gitops/argo/beginner-app-of-apps";
const FLUX_PATH = "gitops/flux/beginner";
const APPSET_PATH = "gitops/argo/beginner-applicationset";
const FLUX_FLEET_PATH = "gitops/flux/expert-fleet";
const KUSTOMIZE_HELM_PATH = "gitops/argo/expert-app-of-apps/apps/checkout-cache";

const sha = (bytes) => `sha256:${sha256(bytes)}`;
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
// cub prints its result on stdout and its notes on stderr, so a transcript
// keeps both, in the order a terminal shows them.
// A note about the machine's own ConfigHub sign-in is left out: these commands
// read local files only, and the note says nothing about the example.
// A command that reports a failure is recorded as it printed, with its exit
// code, because the failure is part of what the page shows.
const transcript = (args, cwd) => {
  const result = spawnSync("sh", ["-c", `cub ${args.map((arg) => `'${arg}'`).join(" ")} 2>&1`], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const text = result.stdout.split("\n").filter((line) => !/^Warning: the session for context /.test(line)).join("\n");
  return result.status === 0 ? text : `${text.replace(/\n*$/, "\n")}[exit ${result.status}]\n`;
};

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
    // cub version also asks the server, and exits 1 when the selected
    // context's sign-in has expired; the client version is printed either way.
    cub: spawnSync("cub", ["version"], { encoding: "utf8" }).stdout.match(/^\s+Version:[ \t]+(v\S+)/m)?.[1],
    workshopPlugin: plugin("workshop"),
    argoPlugin: plugin("argo"),
    fluxPlugin: plugin("flux"),
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

// What the page's laptop command writes: the installer's manifests for the
// listing's base. Loading uploads one Unit per manifest and one installer
// record, so the page counts Units from this number.
function installerManifests(listingPath, work, id) {
  const listing = JSON.parse(readFileSync(join(repoRoot, listingPath), "utf8"));
  const setup = (listing.nextSteps ?? []).find((step) => step.id === "get-objects")?.commands.find((command) => command.command.startsWith("cub installer setup"));
  check(setup, `${listingPath} has no cub installer setup command`);
  check(!/["'$\\|;&]/.test(setup.command), `${listingPath}: the setup command needs a shell, and this runs it without one`);
  const dir = join(work, `${id}-installer`);
  mkdirSync(dir, { recursive: true });
  const args = setup.command.replace(/--work-dir \S+/, "--work-dir ./pkg").split(/\s+/).slice(1);
  run("cub", args, { cwd: dir });
  return { manifests: readdirSync(join(dir, "pkg/out/manifests")).filter((name) => /\.ya?ml$/.test(name)).length };
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
  recordTemplateExcerpt(join(dir, "chart.tgz"), before, dir, out);
  for (const file of ["README.md", "routes/crd-ordering.yaml", "routes/lifecycle-actions.yaml", "requirements/target-requirements.yaml"]) {
    mkdirSync(dirname(join(out, "after/bundle", file)), { recursive: true });
    cpSync(join(dir, "unpacked", file), join(out, "after/bundle", file));
  }
  mkdirSync(join(out, "transcripts"));
  writeFileSync(join(out, "transcripts/check-before.txt"), transcript(["config", "check", "before.yaml"], dir));
  writeFileSync(join(out, "transcripts/check-after.txt"), transcript(["config", "check", "after.yaml"], dir));
  const installer = installerManifests(GPU_LISTING, work, "helm-gpu-operator");
  return {
    installer,
    listing: listing.identity.id,
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

const yamlDump = (value) => py("import json, sys, yaml\nprint(json.dumps(yaml.safe_dump(json.load(sys.stdin), sort_keys=False)))", JSON.stringify(value));

// The picture of "before": the 16 lines of the chart's main workload template
// with the most template expressions, as a person opening the chart sees them.
// Only templates the render used are candidates.
function recordTemplateExcerpt(chart, before, dir, out) {
  mkdirSync(join(dir, "chart-unpacked"));
  run("tar", ["-xzf", chart, "-C", join(dir, "chart-unpacked")]);
  const templates = filesUnder(join(dir, "chart-unpacked")).filter((path) => /\/templates\/.+\.ya?ml$/.test(path) && !/\/charts\/.+\/templates\//.test(relative(join(dir, "chart-unpacked"), path).replace(/^[^/]+\//, "x/")));
  const rendered = new Set([...before.matchAll(/^# Source: (.+)$/gm)].map((m) => m[1].trim()));
  const workload = templates.filter((path) => rendered.has(relative(join(dir, "chart-unpacked"), path))).filter((path) => /^\s+containers:\s*$/m.test(readFileSync(path, "utf8")) && !/kind:\s*(Job|CronJob)\b/.test(readFileSync(path, "utf8")));
  const count = (text) => (text.match(/\{\{/g) ?? []).length;
  // The main container's image, not one of an optional helper container.
  const imageAt = (path) => readFileSync(path, "utf8").split("\n").findIndex((line) => /^\s+image:\s*\S/.test(line) && !/\.(volumePermissions|metrics|exporter|sidecar|init)/i.test(line));
  // The workload template that sets an image, with the most template
  // expressions; the excerpt is the 16 lines around its first image line, so
  // the ConfigHub picture can show the same line, resolved.
  const pick = [...(workload.length ? workload : templates)].filter((path) => imageAt(path) >= 0).sort((a, b) => count(readFileSync(b, "utf8")) - count(readFileSync(a, "utf8")))[0];
  check(pick, `${chart}: no rendered workload template sets an image`);
  const lines = readFileSync(pick, "utf8").split("\n");
  const best = Math.max(0, Math.min(imageAt(pick) - 6, lines.length - 16));
  writeFileSync(join(out, "before/template-excerpt.json"), `${JSON.stringify({ file: relative(join(dir, "chart-unpacked"), pick), firstLine: best + 1, lines: lines.slice(best, best + 16) }, null, 2)}\n`);
}

function generateHelmListing(work, out, spec) {
  const intentPath = `data/helm-render-intents/intents/${spec.listing}.yaml`;
  const intent = readYamlText(readFileSync(join(repoRoot, intentPath), "utf8")).spec;
  const ri = intent.renderInputs;
  const lock = readYamlText(readFileSync(join(repoRoot, ri.sourceLock), "utf8")).spec;
  const dir = join(work, spec.id);
  mkdirSync(join(dir, "chart"), { recursive: true });
  const url = lock.exactArtifact?.url?.startsWith("http") ? lock.exactArtifact.url : "";
  if (url) run("curl", ["-fsSL", "-o", join(dir, "chart", "chart.tgz"), url]);
  else run("helm", ["pull", lock.chart, "--repo", fetchRepositoryURL(ri.sourceLock, lock), "--version", String(lock.version), "-d", join(dir, "chart")]);
  const chart = filesUnder(join(dir, "chart"))[0];
  const chartSha = sha256(readFileSync(chart));
  if (lock.packageSHA256) check(chartSha === lock.packageSHA256, `${spec.listing}: the downloaded chart differs from ${ri.sourceLock}`);
  const baseValues = readYamlText(readFileSync(join(repoRoot, ri.valuesProfile), "utf8")).spec.values ?? {};
  const beforeValues = spec.before === "base" ? baseValues : {};
  const kube = ri.capabilityProfile?.kubeVersion || "1.30.0";
  const valuesArgs = (values, path) => (Object.keys(values).length ? ["-f", path] : []);
  mkdirSync(join(out, "before"), { recursive: true });
  mkdirSync(join(out, "after"), { recursive: true });
  mkdirSync(join(out, "transcripts"), { recursive: true });
  if (Object.keys(beforeValues).length) writeFileSync(join(out, "before/values.yaml"), yamlDump(beforeValues));
  if (spec.before === "defaults" && Object.keys(baseValues).length) writeFileSync(join(out, "after/values.yaml"), yamlDump(baseValues));
  writeFileSync(join(dir, "values.yaml"), yamlDump(beforeValues));
  const template = ["template", ri.releaseName, chart, "--namespace", ri.namespace, ...valuesArgs(beforeValues, join(dir, "values.yaml")), "--kube-version", kube];
  const before = run("helm", template);
  writeFileSync(join(out, "before/before.yaml"), before);
  writeFileSync(join(dir, "before.yaml"), before);
  const again = run("helm", template);
  if (again !== before) {
    writeFileSync(join(out, "before/before-again.yaml"), again);
    writeFileSync(join(dir, "before-again.yaml"), again);
    writeFileSync(join(out, "transcripts/diff-rerender.txt"), transcript(["config", "diff", "before.yaml", "before-again.yaml", "--summary"], dir));
  }
  const crdsFolder = [].concat(readYamlText(run("helm", ["show", "crds", chart])) ?? []).filter((doc) => doc?.kind === "CustomResourceDefinition").length;
  recordTemplateExcerpt(chart, before, dir, out);
  const after = readFileSync(join(repoRoot, intent.renderOutput.renderedObjects));
  writeFileSync(join(dir, "after.yaml"), after);
  writeFileSync(join(out, "transcripts/check-before.txt"), transcript(["config", "check", "before.yaml"], dir));
  writeFileSync(join(out, "transcripts/check-after.txt"), transcript(["config", "check", "after.yaml"], dir));
  const repoFlag = `--repo ${lock.repositoryURL} --version ${lock.version}`;
  return {
    listing: spec.listing,
    before: spec.before,
    chart: { name: lock.chart, version: String(lock.version), repository: lock.repositoryURL, ...(url ? { url } : {}), sha256: `sha256:${chartSha}`, lockedSha256: lock.packageSHA256 ? `sha256:${lock.packageSHA256}` : null, crdsFolder },
    installer: installerManifests(`site/listings/${spec.listing}.json`, work, spec.id),
    render: { release: ri.releaseName, namespace: ri.namespace, kubeVersion: kube },
    sources: [{ what: "the render inputs", recordedIn: intentPath }],
    repoFiles: { [intent.renderOutput.renderedObjects]: sha(after) },
    commands: [
      `helm template ${ri.releaseName} ${lock.chart} ${repoFlag} --namespace ${ri.namespace}${Object.keys(beforeValues).length ? " -f values.yaml" : ""} --kube-version ${kube} > before.yaml`,
      "cub config check before.yaml",
      "cub config check after.yaml",
      ...(again !== before ? ["cub config diff before.yaml before-again.yaml --summary"] : []),
    ],
    notes: [
      `after.yaml is ${intent.renderOutput.renderedObjects}, the objects the Catalog keeps for this base, so it is not stored twice.`,
      ...(lock.packageSHA256 ? [] : [`${ri.sourceLock} records no SHA-256 for the chart, so the one downloaded is recorded here.`]),
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

function generateFlux(examples, work, out) {
  const source = join(examples, FLUX_PATH);
  copyYaml(source, join(out, "before"));
  mkdirSync(join(out, "transcripts"), { recursive: true });
  writeFileSync(join(out, "transcripts/flux-plan.txt"), transcript(["flux", "plan", ".", "--require", "Healthy"], source));
  const onboard = join(work, "flux-onboard");
  run("cub", ["flux", "apply", ".", "--require", "Healthy", "--out", onboard], { cwd: source });
  cpSync(join(onboard, "layers"), join(out, "after", "layers"), { recursive: true });
  return {
    sources: [{ what: "the Flux fleet", repository: EXAMPLES_REPO, commit: EXAMPLES_COMMIT, path: FLUX_PATH }],
    commands: ["cub flux plan . --require Healthy", "cub flux apply . --require Healthy --out onboard"],
    notes: [
      "Both commands ran inside a checkout of the repository at the commit above, because the plugin reads the source paths from it.",
      "after/layers/ keeps what Flux runs for each cluster and layer after the handover. __CONFIGHUB_OCI__ and __CONFIGHUB_OCI_INSECURE__ are placeholders the handover script fills. The scripts that apply also writes are left out, because they name the directory they were written to.",
    ],
  };
}

function generateAppSet(examples, work, out) {
  const source = join(examples, APPSET_PATH);
  copyYaml(source, join(out, "before"));
  mkdirSync(join(out, "transcripts"), { recursive: true });
  writeFileSync(join(out, "transcripts/argo-plan.txt"), transcript(["argo", "plan", "."], source));
  const onboard = join(work, "appset-onboard");
  run("cub", ["argo", "apply", ".", "--out", onboard], { cwd: source });
  cpSync(join(onboard, "apps"), join(out, "after", "apps"), { recursive: true });
  return {
    sources: [{ what: "the ApplicationSet", repository: EXAMPLES_REPO, commit: EXAMPLES_COMMIT, path: APPSET_PATH }],
    commands: ["cub argo plan .", "cub argo apply . --out onboard"],
    notes: [
      "Both commands ran inside a checkout of the repository at the commit above, because the plugin reads the source paths from it.",
      "after/apps/ keeps the Applications the ApplicationSet's template renders for each directory it selects, as cub argo apply writes them.",
    ],
  };
}

function generateFluxFleet(examples, work, out) {
  const source = join(examples, FLUX_FLEET_PATH);
  copyYaml(source, join(out, "before"));
  mkdirSync(join(out, "transcripts"), { recursive: true });
  writeFileSync(join(out, "transcripts/flux-plan.txt"), transcript(["flux", "plan", ".", "--require", "Healthy"], source));
  const onboard = join(work, "fleet-onboard");
  run("cub", ["flux", "apply", ".", "--require", "Healthy", "--out", onboard], { cwd: source });
  cpSync(join(onboard, "layers"), join(out, "after", "layers"), { recursive: true });
  return {
    sources: [{ what: "the Flux fleet", repository: EXAMPLES_REPO, commit: EXAMPLES_COMMIT, path: FLUX_FLEET_PATH }],
    commands: ["cub flux plan . --require Healthy", "cub flux apply . --require Healthy --out onboard"],
    notes: [
      "Both commands ran inside a checkout of the repository at the commit above, because the plugin reads the source paths from it.",
      "after/layers/ keeps what Flux runs for each cluster and layer after the handover.",
    ],
  };
}

// An app, not a chart: shop-web from the Workshop plugin's apps, at the commit
// data/workshop-apps/apps.yaml says was checked. The "after" is what ConfigHub
// says the app needs, and the check of a platform that carries it.
const APP_REPO = "https://github.com/confighub/cub-workshop";
function generateAppShopWeb(work, out) {
  const app = readYamlText(readFileSync(join(repoRoot, "data/workshop-apps/apps.yaml"), "utf8")).spec.apps.find((row) => row.id === "shop-web");
  check(app?.checkedCommit && app.path, "data/workshop-apps/apps.yaml has no checked commit for shop-web");
  const dir = join(work, "cub-workshop");
  mkdirSync(dir);
  run("git", ["init", "-q"], { cwd: dir });
  run("git", ["fetch", "-q", "--depth", "1", `${APP_REPO}.git`, app.checkedCommit], { cwd: dir });
  run("git", ["checkout", "-q", "FETCH_HEAD"], { cwd: dir });
  mkdirSync(join(out, "before"), { recursive: true });
  mkdirSync(join(out, "transcripts"), { recursive: true });
  cpSync(join(dir, app.path), join(out, "before/shop-web.yaml"));
  writeFileSync(join(out, "transcripts/app-check.txt"), transcript(["app", "check", "shop-web.yaml"], join(out, "before")));
  const sandbox = join(work, "sandbox");
  mkdirSync(sandbox);
  writeFileSync(join(out, "transcripts/stack-sandbox.txt"), transcript(["stack", "sandbox", "shop-platform"], sandbox));
  return {
    sources: [{ what: "the app's files", repository: APP_REPO, commit: app.checkedCommit, path: app.path }],
    commands: ["cub app check shop-web.yaml", "cub stack sandbox shop-platform"],
    notes: ["cub stack sandbox reads shop-platform, a stack the Workshop plugin ships, which places shop-web on ingress-nginx, cert-manager, kube-prometheus-stack and RabbitMQ."],
  };
}

function generateKustomizeHelm(examples, out) {
  copyYaml(join(examples, KUSTOMIZE_HELM_PATH), join(out, "before"));
  mkdirSync(join(out, "after"), { recursive: true });
  mkdirSync(join(out, "transcripts"), { recursive: true });
  const envs = readdirSync(join(out, "before/overlays")).sort();
  for (const env of envs) {
    writeFileSync(join(out, `after/${env}.yaml`), run("kustomize", ["build", "--enable-helm", join(out, "before/overlays", env)]));
    writeFileSync(join(out, `transcripts/check-${env}.txt`), transcript(["config", "check", `${env}.yaml`], join(out, "after")));
  }
  rmSync(join(out, "before/charts/checkout-cache/charts"), { recursive: true, force: true });
  return {
    sources: [{ what: "the overlays and the chart they inflate", repository: EXAMPLES_REPO, commit: EXAMPLES_COMMIT, path: KUSTOMIZE_HELM_PATH }],
    commands: [...envs.map((env) => `kustomize build --enable-helm overlays/${env} > ${env}.yaml`), ...envs.map((env) => `cub config check ${env}.yaml`)],
    notes: ["Each build ran from the files under before/, with the helm on this machine, which kustomize calls to inflate the chart."],
  };
}

function writeReceipt(id, out, recorded, tools) {
  const files = Object.fromEntries(filesUnder(out).map((path) => [relative(out, path), sha(readFileSync(path))]));
  for (const [path, text] of Object.entries(files).filter(([path]) => !path.endsWith(".png"))) check(!/\/private\/|\/tmp\/|\/Users\//.test(path + text), `${id}/${path} names a local path`);
  for (const path of filesUnder(join(out, "transcripts"))) {
    check(!/\/private\/|\/tmp\/|\/Users\//.test(readFileSync(path, "utf8")), `${relative(repoRoot, path)} names a local path`);
    check(!/session for context|cub auth login/.test(readFileSync(path, "utf8")), `${relative(repoRoot, path)} carries a note about this machine's ConfigHub sign-in`);
  }
  const receipt = { id, generatedBy: "scripts/generate-before-after.mjs", recordedOn: new Date().toISOString().slice(0, 10), tools, ...recorded, ...(SCREENSHOTS[id] && existsSync(join(out, SCREENSHOTS[id].file)) ? { confighub: SCREENSHOTS[id] } : {}), files };
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
      "flux-beginner": (out) => generateFlux(examples, work, out),
      "argo-applicationset": (out) => generateAppSet(examples, work, out),
      "flux-expert-fleet": (out) => generateFluxFleet(examples, work, out),
      "kustomize-helm-chart": (out) => generateKustomizeHelm(examples, out),
      "app-shop-web": (out) => generateAppShopWeb(work, out),
      ...Object.fromEntries(HELM_EXAMPLES.map((spec) => [spec.id, (out) => generateHelmListing(work, out, spec)])),
    };
    const only = process.argv.slice(3);
    for (const [id, make] of Object.entries(build).filter(([name]) => only.length === 0 || only.includes(name))) {
      const out = join(repoRoot, BEFORE_AFTER_ROOT, id);
      // The screenshots under confighub/ are not made here, so they stay.
      for (const name of existsSync(out) ? readdirSync(out) : []) if (name !== "confighub") rmSync(join(out, name), { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      writeReceipt(id, out, make(out), tools);
      console.log(`recorded ${BEFORE_AFTER_ROOT}/${id}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// Record the screenshots in each receipt without running anything else again.
function recordScreenshots() {
  for (const [id, shot] of Object.entries(SCREENSHOTS)) {
    const out = join(repoRoot, BEFORE_AFTER_ROOT, id);
    check(existsSync(join(out, shot.file)), `${BEFORE_AFTER_ROOT}/${id}/${shot.file} is missing`);
    if (shot.graph) check(existsSync(join(out, shot.graph.file)), `${BEFORE_AFTER_ROOT}/${id}/${shot.graph.file} is missing`);
    if (shot.crds) check(existsSync(join(out, shot.crds.file)), `${BEFORE_AFTER_ROOT}/${id}/${shot.crds.file} is missing`);
    const receipt = JSON.parse(readFileSync(join(out, "receipt.json"), "utf8"));
    const { files, ...rest } = receipt;
    delete rest.confighub;
    const all = Object.fromEntries(filesUnder(out).filter((path) => !path.endsWith("receipt.json")).map((path) => [relative(out, path), sha(readFileSync(path))]));
    // The screenshots under confighub/ are this mode's to change; every other
    // file must be as --generate recorded it.
    for (const [path, digest] of Object.entries(files)) if (!path.startsWith("confighub/")) check(all[path] === digest, `${BEFORE_AFTER_ROOT}/${id}/${path} changed since it was recorded; run --generate instead`);
    for (const path of Object.keys(all)) if (!files[path]) check(path.startsWith("confighub/"), `${BEFORE_AFTER_ROOT}/${id}/${path} is new and not a screenshot; run --generate instead`);
    writeFileSync(join(out, "receipt.json"), `${JSON.stringify({ ...rest, confighub: shot, files: all }, null, 2)}\n`);
    console.log(`recorded ${BEFORE_AFTER_ROOT}/${id}/${shot.file}`);
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
    if (receipt.confighub) check(receipt.files[receipt.confighub.file] && JSON.stringify(receipt.confighub) === JSON.stringify(SCREENSHOTS[id]), `${BEFORE_AFTER_ROOT}/${id}/receipt.json records a screenshot this script does not name`);
    for (const [path, digest] of Object.entries(receipt.repoFiles ?? {})) {
      check(digest === sha(readFileSync(join(repoRoot, path))), `${path} changed, and ${BEFORE_AFTER_ROOT}/${id} recorded it as its after file`);
    }
  }
  return ids;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  if (mode === "--generate") generate();
  else if (mode === "--screenshots") recordScreenshots();
  else if (mode === "--verify") console.log(`before-after: ${verifyBeforeAfter().length} examples match their receipts`);
  else {
    console.error("usage: node scripts/generate-before-after.mjs --generate [id ...] | --screenshots | --verify");
    process.exit(2);
  }
}
