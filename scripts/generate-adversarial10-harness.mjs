import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
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
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const corpusPath = join(repoRoot, "data", "adversarial10", "corpus.yaml");
const outputRoot = join(repoRoot, "data", "adversarial10");
const chartsRoot = join(outputRoot, "charts");
const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify");
const selfTest = args.includes("--self-test");

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function cleanDir(path) {
  rmSync(path, { recursive: true, force: true });
  ensureDir(path);
}

function parseYamlText(text) {
  const script = `
import json
import sys
import yaml

docs = list(yaml.safe_load_all(sys.stdin.read()))
docs = [doc for doc in docs if doc is not None]
print(json.dumps(docs[0] if len(docs) == 1 else docs, sort_keys=True))
`;
  const result = spawnSync("python3", ["-c", script], {
    input: text,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `python YAML parse failed with status ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

function parseYamlFile(path) {
  return parseYamlText(readFileSync(path, "utf8"));
}

function parseRenderedObjects(text) {
  const script = `
import json
import sys
import yaml

docs = []
for doc in yaml.load_all(sys.stdin.read(), Loader=yaml.BaseLoader):
    if not isinstance(doc, dict):
        continue
    metadata = doc.get("metadata") or {}
    api_version = str(doc.get("apiVersion", ""))
    kind = str(doc.get("kind", ""))
    namespace = str(metadata.get("namespace", ""))
    name = str(metadata.get("name", ""))
    if not api_version or not kind or not name:
        continue
    spec = doc.get("spec") or {}
    pod_spec = None
    template_labels = {}
    if kind in ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet"]:
        template = spec.get("template") or {}
        pod_spec = template.get("spec") or {}
        template_labels = (template.get("metadata") or {}).get("labels") or {}
    elif kind == "Job":
        template = spec.get("template") or {}
        pod_spec = template.get("spec") or {}
        template_labels = (template.get("metadata") or {}).get("labels") or {}
    elif kind == "CronJob":
        template = (((spec.get("jobTemplate") or {}).get("spec") or {}).get("template") or {})
        pod_spec = template.get("spec") or {}
        template_labels = (template.get("metadata") or {}).get("labels") or {}
    docs.append({
        "apiVersion": api_version,
        "kind": kind,
        "namespace": namespace,
        "name": name,
        "identity": "|".join([api_version, kind, namespace, name]),
        "hasVolumeClaimTemplates": bool(spec.get("volumeClaimTemplates")),
        "podServiceAccountName": pod_spec.get("serviceAccountName") if isinstance(pod_spec, dict) else None,
        "templateLabels": template_labels,
    })
docs.sort(key=lambda item: item["identity"])
print(json.dumps(docs, sort_keys=True))
`;
  const result = spawnSync("python3", ["-c", script], {
    input: text,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `python rendered object parse failed with status ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value
      .map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const nested = toYaml(item, indent + 2);
          return `${pad}- ${nested.startsWith(" ".repeat(indent + 2)) ? `\n${nested}` : nested}`;
        }
        if (Array.isArray(item)) return `${pad}-\n${toYaml(item, indent + 2)}`;
        return `${pad}- ${toYaml(item, 0)}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return `${pad}{}`;
    return entries
      .map(([key, item]) => {
        if (item && typeof item === "object") {
          return `${pad}${key}:\n${toYaml(item, indent + 2)}`;
        }
        return `${pad}${key}: ${toYaml(item, 0)}`;
      })
      .join("\n");
  }
  return JSON.stringify(value);
}

function writeYaml(path, value) {
  writeFileSync(path, `${toYaml(value)}\n`);
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(path, rows) {
  const headers = [
    "rank",
    "id",
    "chart",
    "version",
    "render_status",
    "proof_readiness",
    "deterministic",
    "resource_count",
    "crd_count",
    "has_hooks",
    "uses_lookup",
    "uses_generated_facts",
    "uses_capabilities",
    "uses_tpl",
    "has_extension_slots",
    "dependency_count",
    "has_cluster_rbac",
    "has_webhooks",
    "has_api_service",
    "has_stateful",
    "has_pvc",
    "primary_control_point",
    "next_action",
    "helm_plan_path",
    "render_receipt_path",
    "rendered_manifest_sha256",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 200,
    cwd: options.cwd ?? repoRoot,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    signal: result.signal,
  };
}

function mustRun(command, commandArgs, options = {}) {
  const result = run(command, commandArgs, options);
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function helmVersion() {
  return mustRun("helm", ["version", "--short"]).trim();
}

function chartRef(chart) {
  return `${chart.repository}/${chart.chart}`;
}

function renderArgs(corpus, chart) {
  const args = [
    "template",
    chart.releaseName,
    chartRef(chart),
    "--version",
    chart.version,
    "--namespace",
    chart.namespace,
    "--kube-version",
    corpus.spec.kubeVersion,
  ];
  if (corpus.spec.renderPolicy.includeCRDs) args.push("--include-crds");
  if (corpus.spec.renderPolicy.skipTests) args.push("--skip-tests");
  if (corpus.spec.renderPolicy.noHooks) args.push("--no-hooks");
  return args;
}

function recursiveFiles(root) {
  const result = [];
  if (!existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...recursiveFiles(path));
    } else if (entry.isFile()) {
      result.push(path);
    }
  }
  return result;
}

function findExtractedChartRoot(tempRoot, chartName) {
  const direct = join(tempRoot, chartName);
  if (existsSync(direct)) return direct;
  const dirs = readdirSync(tempRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (dirs.length === 1) return join(tempRoot, dirs[0].name);
  throw new Error(`could not find extracted chart root for ${chartName}`);
}

function pullChartSource(chart) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-adversarial10-"));
  const ref = chartRef(chart);
  try {
    mustRun("helm", ["pull", ref, "--version", chart.version, "--destination", tempRoot]);
    const packagePath = recursiveFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    if (!packagePath) throw new Error(`helm pull did not produce a package for ${ref}@${chart.version}`);
    const packageSHA256 = sha256File(packagePath);
    mustRun("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = findExtractedChartRoot(tempRoot, chart.chart);
    const chartYamlPath = join(chartRoot, "Chart.yaml");
    const valuesPath = join(chartRoot, "values.yaml");
    const chartYaml = existsSync(chartYamlPath) ? parseYamlFile(chartYamlPath) : {};
    const valuesText = existsSync(valuesPath) ? readFileSync(valuesPath, "utf8") : "";
    const files = recursiveFiles(chartRoot).filter((path) => !path.endsWith(".tgz"));
    const templateText = files
      .filter((path) => relative(chartRoot, path).startsWith("templates/"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const allText = files.map((path) => readFileSync(path, "utf8")).join("\n");
    const crdFiles = files.filter((path) => relative(chartRoot, path).startsWith("crds/"));
    const sourceFeatures = detectSourceFeatures({
      allText,
      templateText,
      valuesText,
      chartYaml,
      crdFiles,
    });
    return {
      chartYaml,
      valuesTextSHA256: valuesText ? sha256(valuesText) : null,
      packageSHA256,
      packageBytes: statSync(packagePath).size,
      sourceFeatures,
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function detectSourceFeatures({ allText, templateText, valuesText, chartYaml, crdFiles }) {
  const generatedFactsPatterns = [
    /\brandAlpha\b/,
    /\brandAlphaNum\b/,
    /\brandAscii\b/,
    /\brandNumeric\b/,
    /\buuidv4\b/,
    /\bgenCA\b/,
    /\bgenSelfSignedCert\b/,
    /\bgenSignedCert\b/,
    /\bderivePassword\b/,
  ];
  const templateActions = [...templateText.matchAll(/{{[\s\S]*?}}/g)].map((match) => match[0]).join("\n");
  const extensionSlotPatterns = [
    /extraDeploy/i,
    /extraObjects/i,
    /extraManifests/i,
    /extraResources/i,
    /extraTemplates/i,
    /raw/i,
    /additionalManifest/i,
  ];
  return {
    lookup: /\blookup\b/.test(templateActions),
    generatedFacts: generatedFactsPatterns.some((pattern) => pattern.test(templateActions)),
    capabilities: /\.Capabilities/.test(templateText),
    tpl: /\btpl\b/.test(templateActions),
    hooks: /helm\.sh\/hook/.test(templateText),
    required: /\brequired\b/.test(templateActions),
    extensionSlots: extensionSlotPatterns.some((pattern) => pattern.test(valuesText) || pattern.test(templateText)),
    crdFiles: crdFiles.length,
    crdTemplates: (templateText.match(/kind:\s*CustomResourceDefinition/g) ?? []).length,
    dependencyCount: Array.isArray(chartYaml.dependencies) ? chartYaml.dependencies.length : 0,
  };
}

function detectRenderedFeatures(objects) {
  const kinds = new Map();
  for (const object of objects) kinds.set(object.kind, (kinds.get(object.kind) ?? 0) + 1);
  const hasKind = (kind) => kinds.has(kind);
  const clusterRBAC = hasKind("ClusterRole") || hasKind("ClusterRoleBinding");
  const webhooks = hasKind("MutatingWebhookConfiguration") || hasKind("ValidatingWebhookConfiguration");
  const stateful = hasKind("StatefulSet");
  const pvc = hasKind("PersistentVolumeClaim") || objects.some((object) => object.hasVolumeClaimTemplates);
  return {
    crdCount: kinds.get("CustomResourceDefinition") ?? 0,
    clusterRBAC,
    webhooks,
    apiService: hasKind("APIService"),
    stateful,
    pvc,
    kindCounts: Object.fromEntries([...kinds.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function controlPoints(chart, sourceFeatures, renderedFeatures, renderStatus, deterministic) {
  const points = [];
  const add = (id, severity, controlPoint, evidence, mitigation) => {
    points.push({ id, severity, controlPoint, evidence, mitigation });
  };
  if (renderStatus !== "rendered") {
    add(
      "render-failed",
      "P0",
      "recipe-import",
      "Helm could not render the chart default values profile.",
      "Create a minimal Install Variant with required values or mark the chart blocked for this corpus.",
    );
  }
  if (renderStatus === "rendered" && !deterministic) {
    add(
      "nondeterministic-render",
      "P0",
      "generated-facts",
      "Two local Helm renders produced different manifest bytes.",
      "Generate once, persist the generated fact binding, and render the approved variant revision from that binding.",
    );
  }
  if (sourceFeatures.generatedFacts) {
    add(
      "generated-fact-candidates",
      "P0",
      "generated-facts",
      "Chart source contains random, cert, password, UUID, or time helpers.",
      "Record generated fact requirements in the recipe and bind generated facts before publication.",
    );
  }
  if (sourceFeatures.lookup) {
    add(
      "lookup-target-facts",
      "P0",
      "recipe-target-facts",
      "Chart source calls Helm lookup.",
      "Declare target fact requirements in the recipe and bind collected or synthetic facts per variant revision.",
    );
  }
  if (sourceFeatures.capabilities) {
    add(
      "capability-branching",
      "P0",
      "capability-profile",
      "Chart source branches on .Capabilities.",
      "Render against a named, digest-bound Kubernetes capability profile.",
    );
  }
  if (sourceFeatures.hooks) {
    add(
      "helm-hooks",
      "P0",
      "lifecycle-policy",
      "Chart source defines Helm hook annotations.",
      "Classify hooks as lifecycle phases, tests, GitOps-compatible hooks, or unsupported blockers.",
    );
  }
  if (sourceFeatures.crdFiles || sourceFeatures.crdTemplates || renderedFeatures.crdCount) {
    add(
      "crds",
      "P0",
      "crd-policy",
      `${sourceFeatures.crdFiles} CRD source file(s), ${sourceFeatures.crdTemplates} CRD template(s), ${renderedFeatures.crdCount} rendered CRD object(s).`,
      "Split CRD readiness, ordering, schema validation, and upgrade compatibility from ordinary object apply.",
    );
  }
  if (sourceFeatures.tpl || sourceFeatures.extensionSlots) {
    add(
      "template-extension-slots",
      "P1",
      "extension-slot-policy",
      "Chart exposes tpl/raw/extra manifest behavior.",
      "Treat extension inputs as explicit slots with provenance, scan coverage, and rendered-object diff checks.",
    );
  }
  if (sourceFeatures.dependencyCount > 0) {
    add(
      "dependencies",
      "P1",
      "dependency-lock",
      `Chart declares ${sourceFeatures.dependencyCount} dependenc${sourceFeatures.dependencyCount === 1 ? "y" : "ies"}.`,
      "Lock dependency names, versions, repositories, and package digests before variant publication.",
    );
  }
  if (renderedFeatures.webhooks || renderedFeatures.apiService) {
    add(
      "admission-or-apiservice",
      "P1",
      "operate-policy",
      "Rendered objects include admission webhooks or APIService resources.",
      "Require readiness observations and freshness receipts after apply.",
    );
  }
  if (renderedFeatures.clusterRBAC) {
    add(
      "cluster-rbac",
      "P1",
      "rendered-manifest-scan",
      "Rendered objects include cluster-scoped RBAC.",
      "Scan exact rendered objects for least privilege and policy violations.",
    );
  }
  if (renderedFeatures.stateful || renderedFeatures.pvc) {
    add(
      "stateful-storage",
      "P1",
      "storage-and-upgrade-policy",
      "Rendered objects include stateful workloads or PVC claims/templates.",
      "Record storage policy, retention expectations, and upgrade/rollback simulation receipts.",
    );
  }
  if (!points.length) {
    add(
      "plain-render",
      "P2",
      "rendered-manifest-scan",
      "No first-pass source or object hazards found.",
      "Run schema, policy, misconfiguration, diff, and publish checks on the exact rendered objects.",
    );
  }
  return points;
}

function readinessFor(renderStatus, deterministic, points) {
  if (renderStatus !== "rendered") return "blocked-needs-values-or-policy";
  if (!deterministic) return "needs-generated-fact-binding";
  if (points.some((point) => point.severity === "P0")) return "rendered-needs-control-points";
  return "rendered-scan-ready";
}

function renderChart(corpus, chart) {
  const args = renderArgs(corpus, chart);
  const first = run("helm", args, { encoding: "buffer" });
  const second = first.status === 0 ? run("helm", args, { encoding: "buffer" }) : null;
  const firstOutput = first.stdout ?? Buffer.from("");
  const secondOutput = second?.stdout ?? Buffer.from("");
  const renderStatus = first.status === 0 ? "rendered" : "render-failed";
  const deterministic = renderStatus === "rendered" && sha256(firstOutput) === sha256(secondOutput);
  const objects = renderStatus === "rendered" ? parseRenderedObjects(firstOutput.toString("utf8")) : [];
  return {
    command: ["helm", ...args],
    renderStatus,
    deterministic,
    firstRenderSHA256: renderStatus === "rendered" ? sha256(firstOutput) : null,
    secondRenderSHA256: renderStatus === "rendered" ? sha256(secondOutput) : null,
    firstRenderBytes: renderStatus === "rendered" ? firstOutput.length : 0,
    resourceCount: objects.length,
    objects,
    firstOutput,
    error: renderStatus === "rendered" ? null : String(first.stderr || first.stdout || "").slice(0, 12000),
    errorSHA256: renderStatus === "rendered" ? null : sha256(String(first.stderr || first.stdout || "")),
  };
}

function relativeToRepo(path) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function chartOutputDir(chart) {
  return join(chartsRoot, `${chart.id}-${chart.version.replaceAll("/", "_")}`);
}

function generate() {
  const corpus = parseYamlFile(corpusPath);
  const helm = helmVersion();
  cleanDir(chartsRoot);
  const lockRows = [];
  const csvRows = [];
  const summaryRows = [];

  for (const chart of corpus.spec.charts) {
    const dir = chartOutputDir(chart);
    const renderedDir = join(dir, "rendered");
    ensureDir(renderedDir);
    const source = pullChartSource(chart);
    const render = renderChart(corpus, chart);
    const renderedFeatures = detectRenderedFeatures(render.objects);
    const points = controlPoints(chart, source.sourceFeatures, renderedFeatures, render.renderStatus, render.deterministic);
    const readiness = readinessFor(render.renderStatus, render.deterministic, points);
    const primary = points[0];
    const renderedPath = join(renderedDir, "default.yaml");
    const inventoryPath = join(renderedDir, "object-inventory.yaml");

    if (render.renderStatus === "rendered") {
      writeFileSync(renderedPath, render.firstOutput);
    }
    writeYaml(inventoryPath, {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "RenderedObjectInventory",
      metadata: { name: `${chart.id}-${chart.version}` },
      spec: {
        chart: `${chart.repository}/${chart.chart}`,
        version: chart.version,
        objectCount: render.objects.length,
        kindCounts: renderedFeatures.kindCounts,
        objects: render.objects.map(({ apiVersion, kind, namespace, name, identity }) => ({
          apiVersion,
          kind,
          namespace,
          name,
          identity,
        })),
      },
    });

    const receipt = {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "HarnessRenderReceipt",
      metadata: { name: `${chart.id}-${chart.version}-default` },
      spec: {
        corpus: "../corpus.yaml",
        chartRef: {
          rank: chart.rank,
          repository: chart.repository,
          repositoryURL: chart.repositoryURL,
          chart: chart.chart,
          version: chart.version,
          appVersion: source.chartYaml.appVersion ?? "",
          releaseName: chart.releaseName,
          namespace: chart.namespace,
          packageSHA256: source.packageSHA256,
          packageBytes: source.packageBytes,
        },
        renderer: {
          name: "helm",
          version: helm,
          command: render.command,
        },
        renderContext: {
          kubeVersion: corpus.spec.kubeVersion,
          includeCRDs: corpus.spec.renderPolicy.includeCRDs,
          skipTests: corpus.spec.renderPolicy.skipTests,
          noHooks: corpus.spec.renderPolicy.noHooks,
          valuesProfile: corpus.spec.renderPolicy.valuesProfile,
        },
        outputs: {
          status: render.renderStatus,
          deterministicAcrossTwoLocalRenders: render.deterministic,
          firstRenderSHA256: render.firstRenderSHA256,
          secondRenderSHA256: render.secondRenderSHA256,
          renderedManifestPath: render.renderStatus === "rendered" ? "rendered/default.yaml" : null,
          renderedManifestBytes: render.firstRenderBytes,
          objectInventoryPath: "rendered/object-inventory.yaml",
          resourceCount: render.resourceCount,
          errorSHA256: render.errorSHA256,
          errorExcerpt: render.error ? render.error.split("\n").slice(0, 12).join("\n") : null,
        },
        sourceFeatures: source.sourceFeatures,
        renderedFeatures,
        proofReadiness: readiness,
        controlPoints: points,
      },
    };
    writeYaml(join(dir, "render-receipt.yaml"), receipt);

    const plan = {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "HelmPlan",
      metadata: { name: `${chart.id}-${chart.version}` },
      spec: {
        summary: {
          chart: `${chart.repository}/${chart.chart}`,
          version: chart.version,
          releaseName: chart.releaseName,
          namespace: chart.namespace,
          status: readiness,
          primaryControlPoint: primary.controlPoint,
          nextAction: primary.mitigation,
        },
        sourceLock: {
          repositoryURL: chart.repositoryURL,
          packageSHA256: source.packageSHA256,
          packageBytes: source.packageBytes,
          dependencies: source.sourceFeatures.dependencyCount,
        },
        renderAttempt: {
          status: render.renderStatus,
          deterministicAcrossTwoLocalRenders: render.deterministic,
          resourceCount: render.resourceCount,
          renderedManifestSHA256: render.firstRenderSHA256,
          renderedManifestPath: render.renderStatus === "rendered" ? "rendered/default.yaml" : null,
        },
        featureSummary: {
          source: source.sourceFeatures,
          rendered: renderedFeatures,
        },
        painReport: points,
        receipts: ["render-receipt.yaml"],
      },
    };
    writeYaml(join(dir, "helm-plan.yaml"), plan);

    lockRows.push({
      rank: chart.rank,
      id: chart.id,
      repository: chart.repository,
      repositoryURL: chart.repositoryURL,
      chart: chart.chart,
      version: chart.version,
      appVersion: source.chartYaml.appVersion ?? "",
      releaseName: chart.releaseName,
      namespace: chart.namespace,
      packageSHA256: source.packageSHA256,
      packageBytes: source.packageBytes,
      renderStatus: render.renderStatus,
      proofReadiness: readiness,
      helmPlan: relativeToRepo(join(dir, "helm-plan.yaml")),
      renderReceipt: relativeToRepo(join(dir, "render-receipt.yaml")),
    });
    csvRows.push({
      rank: chart.rank,
      id: chart.id,
      chart: `${chart.repository}/${chart.chart}`,
      version: chart.version,
      render_status: render.renderStatus,
      proof_readiness: readiness,
      deterministic: render.renderStatus === "rendered" ? render.deterministic : "",
      resource_count: render.resourceCount,
      crd_count: renderedFeatures.crdCount,
      has_hooks: source.sourceFeatures.hooks,
      uses_lookup: source.sourceFeatures.lookup,
      uses_generated_facts: source.sourceFeatures.generatedFacts,
      uses_capabilities: source.sourceFeatures.capabilities,
      uses_tpl: source.sourceFeatures.tpl,
      has_extension_slots: source.sourceFeatures.extensionSlots,
      dependency_count: source.sourceFeatures.dependencyCount,
      has_cluster_rbac: renderedFeatures.clusterRBAC,
      has_webhooks: renderedFeatures.webhooks,
      has_api_service: renderedFeatures.apiService,
      has_stateful: renderedFeatures.stateful,
      has_pvc: renderedFeatures.pvc,
      primary_control_point: primary.controlPoint,
      next_action: primary.mitigation,
      helm_plan_path: relativeToRepo(join(dir, "helm-plan.yaml")),
      render_receipt_path: relativeToRepo(join(dir, "render-receipt.yaml")),
      rendered_manifest_sha256: render.firstRenderSHA256 ?? "",
    });
    summaryRows.push({ chart, readiness, render, renderedFeatures, sourceFeatures: source.sourceFeatures, primary });
  }

  writeYaml(join(outputRoot, "corpus.lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AdversarialCorpusLock",
    metadata: { name: "public-helm-adversarial-10" },
    spec: {
      source: "corpus.yaml",
      helmVersion: helm,
      kubeVersion: corpus.spec.kubeVersion,
      chartCount: lockRows.length,
      charts: lockRows,
    },
  });
  writeCsv(join(outputRoot, "proof-readiness.csv"), csvRows);
  writeSummary(join(outputRoot, "summary.md"), summaryRows, helm, corpus);
  console.log(`generated adversarial10 harness for ${lockRows.length} chart(s)`);
}

function writeSummary(path, rows, helm, corpus) {
  const counts = new Map();
  for (const row of rows) counts.set(row.readiness, (counts.get(row.readiness) ?? 0) + 1);
  const lines = [
    "# Public Helm Adversarial 10 Harness",
    "",
    "This is the first scale-out harness after the Redis proof slice. It uses",
    "real public Helm charts and records either a rendered default-values object",
    "set or an explicit blocker receipt.",
    "",
    "It is not a certification table. It is the first generated evidence map for",
    "where Helm pain appears and which ConfigHub control point absorbs it.",
    "",
    "## Render Context",
    "",
    `- Helm: \`${helm}\``,
    `- Kubernetes capability version: \`${corpus.spec.kubeVersion}\``,
    "- Flags: `--include-crds --skip-tests --no-hooks`",
    "- Values profile: chart defaults",
    "",
    "## Readiness Counts",
    "",
  ];
  for (const [status, count] of [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`- \`${status}\`: ${count}`);
  }
  lines.push("", "## Charts", "");
  lines.push("| Rank | Chart | Version | Status | Deterministic | Objects | CRDs | Primary Control Point |");
  lines.push("| --- | --- | --- | --- | --- | ---: | ---: | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.chart.rank} | \`${row.chart.repository}/${row.chart.chart}\` | \`${row.chart.version}\` | ${row.readiness} | ${row.render.renderStatus === "rendered" ? row.render.deterministic : ""} | ${row.render.resourceCount} | ${row.renderedFeatures.crdCount} | ${row.primary.controlPoint} |`,
    );
  }
  lines.push(
    "",
    "## Doctrine",
    "",
    "Rows marked as blocked or not deterministic are not failures of the mission.",
    "They are the point of the harness: the chart's Helm pain must become visible",
    "before ConfigHub turns it into a recipe control point, variant input, scan,",
    "gate, or receipt.",
    "",
    "The next proof step is to turn selected rows into full recipe/variant/revision",
    "artifacts, starting from the hazards this harness identified.",
    "",
  );
  writeFileSync(path, lines.join("\n"));
}

function fail(message) {
  throw new Error(message);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function parseCsv(path) {
  const text = readFileSync(path, "utf8").trimEnd();
  const lines = text.split("\n");
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function verify(root = outputRoot) {
  const corpus = parseYamlFile(resolve(root, "corpus.yaml"));
  const lock = parseYamlFile(resolve(root, "corpus.lock.yaml"));
  const csvRows = parseCsv(resolve(root, "proof-readiness.csv"));
  const failures = [];
  const failSoft = (message) => failures.push(message);
  const chartRows = corpus.spec.charts ?? [];
  const lockRows = lock.spec.charts ?? [];
  const csvById = new Map(csvRows.map((row) => [row.id, row]));
  const lockById = new Map(lockRows.map((row) => [row.id, row]));

  if (lock.kind !== "AdversarialCorpusLock") failSoft("corpus.lock.yaml kind must be AdversarialCorpusLock");
  if (lock.spec.chartCount !== chartRows.length) failSoft("corpus lock chartCount must match corpus");
  if (csvRows.length !== chartRows.length) failSoft("proof-readiness.csv row count must match corpus");

  for (const chart of chartRows) {
    const lockRow = lockById.get(chart.id);
    const csvRow = csvById.get(chart.id);
    if (!lockRow) {
      failSoft(`${chart.id}: missing corpus lock row`);
      continue;
    }
    if (!csvRow) {
      failSoft(`${chart.id}: missing CSV row`);
      continue;
    }
    const dir = resolve(root, "charts", `${chart.id}-${chart.version.replaceAll("/", "_")}`);
    const planPath = join(dir, "helm-plan.yaml");
    const receiptPath = join(dir, "render-receipt.yaml");
    const inventoryPath = join(dir, "rendered", "object-inventory.yaml");
    for (const path of [planPath, receiptPath, inventoryPath]) {
      if (!existsSync(path)) failSoft(`${chart.id}: missing ${relative(root, path)}`);
    }
    if (!existsSync(planPath) || !existsSync(receiptPath) || !existsSync(inventoryPath)) continue;

    const plan = parseYamlFile(planPath);
    const receipt = parseYamlFile(receiptPath);
    const inventory = parseYamlFile(inventoryPath);
    const outputs = receipt.spec.outputs ?? {};
    const sourceFeatures = receipt.spec.sourceFeatures ?? {};
    const renderedFeatures = receipt.spec.renderedFeatures ?? {};

    if (plan.kind !== "HelmPlan") failSoft(`${chart.id}: helm-plan.yaml kind must be HelmPlan`);
    if (receipt.kind !== "HarnessRenderReceipt") {
      failSoft(`${chart.id}: render-receipt.yaml kind must be HarnessRenderReceipt`);
    }
    if (inventory.kind !== "RenderedObjectInventory") {
      failSoft(`${chart.id}: object-inventory.yaml kind must be RenderedObjectInventory`);
    }
    if (receipt.spec.chartRef.repository !== chart.repository) failSoft(`${chart.id}: receipt repository mismatch`);
    if (receipt.spec.chartRef.chart !== chart.chart) failSoft(`${chart.id}: receipt chart mismatch`);
    if (receipt.spec.chartRef.version !== chart.version) failSoft(`${chart.id}: receipt version mismatch`);
    if (receipt.spec.renderContext.kubeVersion !== corpus.spec.kubeVersion) {
      failSoft(`${chart.id}: receipt kubeVersion mismatch`);
    }
    if (plan.spec.summary.status !== receipt.spec.proofReadiness) {
      failSoft(`${chart.id}: plan status must equal receipt proofReadiness`);
    }
    if (lockRow.renderStatus !== outputs.status) failSoft(`${chart.id}: lock render status mismatch`);
    if (lockRow.proofReadiness !== receipt.spec.proofReadiness) failSoft(`${chart.id}: lock readiness mismatch`);
    if (csvRow.render_status !== outputs.status) failSoft(`${chart.id}: CSV render status mismatch`);
    if (csvRow.proof_readiness !== receipt.spec.proofReadiness) failSoft(`${chart.id}: CSV readiness mismatch`);
    if (csvRow.primary_control_point !== receipt.spec.controlPoints?.[0]?.controlPoint) {
      failSoft(`${chart.id}: CSV primary control point mismatch`);
    }
    if (csvRow.helm_plan_path !== relativeToRepo(planPath)) failSoft(`${chart.id}: CSV helm_plan_path mismatch`);
    if (csvRow.render_receipt_path !== relativeToRepo(receiptPath)) {
      failSoft(`${chart.id}: CSV render_receipt_path mismatch`);
    }

    const renderedPath = join(dir, outputs.renderedManifestPath ?? "rendered/default.yaml");
    if (outputs.status === "rendered") {
      if (!existsSync(renderedPath)) {
        failSoft(`${chart.id}: rendered manifest missing`);
      } else {
        const renderedText = readFileSync(renderedPath);
        const renderedSHA = sha256(renderedText);
        const objects = parseRenderedObjects(renderedText.toString("utf8"));
        if (renderedSHA !== outputs.firstRenderSHA256) failSoft(`${chart.id}: rendered manifest SHA mismatch`);
        if (renderedText.length !== outputs.renderedManifestBytes) {
          failSoft(`${chart.id}: rendered manifest byte count mismatch`);
        }
        if (objects.length !== outputs.resourceCount) failSoft(`${chart.id}: rendered object count mismatch`);
        if (inventory.spec.objectCount !== outputs.resourceCount) {
          failSoft(`${chart.id}: inventory object count mismatch`);
        }
        if (String(outputs.resourceCount) !== String(csvRow.resource_count)) {
          failSoft(`${chart.id}: CSV resource count mismatch`);
        }
        if (csvRow.rendered_manifest_sha256 !== outputs.firstRenderSHA256) {
          failSoft(`${chart.id}: CSV rendered manifest SHA mismatch`);
        }
      }
      if (outputs.deterministicAcrossTwoLocalRenders && outputs.firstRenderSHA256 !== outputs.secondRenderSHA256) {
        failSoft(`${chart.id}: deterministic receipt has unequal render hashes`);
      }
      if (!outputs.deterministicAcrossTwoLocalRenders && outputs.firstRenderSHA256 === outputs.secondRenderSHA256) {
        failSoft(`${chart.id}: nondeterministic receipt has equal render hashes`);
      }
    } else if (outputs.status === "render-failed") {
      if (existsSync(renderedPath)) failSoft(`${chart.id}: render-failed chart must not store rendered/default.yaml`);
      if (!outputs.errorSHA256) failSoft(`${chart.id}: render-failed chart must record errorSHA256`);
      if (outputs.resourceCount !== 0) failSoft(`${chart.id}: render-failed resourceCount must be 0`);
      if (csvRow.rendered_manifest_sha256 !== "") failSoft(`${chart.id}: render-failed CSV SHA must be empty`);
    } else {
      failSoft(`${chart.id}: unsupported output status ${outputs.status}`);
    }

    const boolChecks = [
      ["has_hooks", sourceFeatures.hooks],
      ["uses_lookup", sourceFeatures.lookup],
      ["uses_generated_facts", sourceFeatures.generatedFacts],
      ["uses_capabilities", sourceFeatures.capabilities],
      ["uses_tpl", sourceFeatures.tpl],
      ["has_extension_slots", sourceFeatures.extensionSlots],
      ["has_cluster_rbac", renderedFeatures.clusterRBAC],
      ["has_webhooks", renderedFeatures.webhooks],
      ["has_api_service", renderedFeatures.apiService],
      ["has_stateful", renderedFeatures.stateful],
      ["has_pvc", renderedFeatures.pvc],
    ];
    for (const [field, expected] of boolChecks) {
      if (String(expected) !== csvRow[field]) failSoft(`${chart.id}: CSV ${field} mismatch`);
    }
    if (String(renderedFeatures.crdCount) !== csvRow.crd_count) failSoft(`${chart.id}: CSV crd_count mismatch`);
    if (String(sourceFeatures.dependencyCount) !== csvRow.dependency_count) {
      failSoft(`${chart.id}: CSV dependency_count mismatch`);
    }
  }

  if (failures.length) {
    throw new Error(`adversarial10 harness verification failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }
  return { chartCount: chartRows.length };
}

function runSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-adversarial10-verify-"));
  try {
    cpSync(outputRoot, tempRoot, { recursive: true });
    const corpus = parseYamlFile(join(tempRoot, "corpus.yaml"));
    const renderedChart = corpus.spec.charts.find((chart) => {
      const renderedPath = join(tempRoot, "charts", `${chart.id}-${chart.version.replaceAll("/", "_")}`, "rendered", "default.yaml");
      return existsSync(renderedPath);
    });
    if (!renderedChart) throw new Error("self-test needs at least one rendered chart fixture");
    const renderedPath = join(
      tempRoot,
      "charts",
      `${renderedChart.id}-${renderedChart.version.replaceAll("/", "_")}`,
      "rendered",
      "default.yaml",
    );
    writeFileSync(renderedPath, `${readFileSync(renderedPath, "utf8")}\n# tampered\n`);
    let failed = false;
    try {
      verify(tempRoot);
    } catch (error) {
      failed = String(error.message).includes("rendered manifest SHA mismatch");
    }
    if (!failed) throw new Error("self-test did not catch rendered manifest tampering");
    console.log("self-test passed: adversarial10 rendered manifest tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (selfTest) {
  runSelfTest();
} else if (verifyOnly) {
  const result = verify();
  console.log(`verified adversarial10 harness for ${result.chartCount} chart(s)`);
} else {
  generate();
}
