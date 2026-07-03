import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import {
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
import { join } from "node:path";
import { promisify } from "node:util";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const execFileP = promisify(execFile);
const repoRoot = "$HOME/code/helm-expt";
const outputDir = join(repoRoot, "outputs", "helm_top500_matrix");
const outputPath = join(outputDir, "helm_top500_import_feature_matrix.xlsx");
const rawRowsPath = join(outputDir, "helm_top500_import_feature_matrix.raw.json");
const workRoot = mkdtempSync(join(tmpdir(), "helm-top500-workbook-"));
const helmEnv = {
  ...process.env,
  HELM_CACHE_HOME: join(workRoot, "helm-cache"),
  HELM_CONFIG_HOME: join(workRoot, "helm-config"),
  HELM_DATA_HOME: join(workRoot, "helm-data"),
};

const MAX = 500;
const CONCURRENCY = 6;
const MAX_BUFFER = 1024 * 1024 * 90;
const searchBase =
  "https://artifacthub.io/api/v1/packages/search?kind=0&sort=stars&limit=60&deprecated=false";
const sourceURL =
  "https://artifacthub.io/api/v1/packages/search?kind=0&sort=stars&limit=60&offset=0..480&deprecated=false";
const ua = "confighub-helm-top500-workbook/0.1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const yn = (v) => (v ? "Y" : "");
const num = (v) => (Number.isFinite(v) && v !== 0 ? v : "");
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "chart";

function colName(n) {
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

async function fetchWithRetry(url, as = "json", attempts = 8) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": ua } });
    if (res.status === 429) {
      const waitMs = Math.min(90_000, 10_000 * (i + 1));
      console.error(`Artifact Hub 429; waiting ${Math.round(waitMs / 1000)}s for ${url}`);
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
    return as === "buffer" ? Buffer.from(await res.arrayBuffer()) : await res.json();
  }
  throw new Error(`${url}: still rate-limited after retries`);
}

async function run(cmd, args, cwd = workRoot) {
  return await execFileP(cmd, args, { cwd, env: helmEnv, maxBuffer: MAX_BUFFER });
}

function walk(p, out = []) {
  if (!existsSync(p)) return out;
  const st = statSync(p);
  if (st.isFile()) out.push(p);
  if (st.isDirectory()) {
    for (const entry of readdirSync(p)) walk(join(p, entry), out);
  }
  return out;
}

async function getTop500() {
  const all = [];
  for (let offset = 0; all.length < MAX; offset += 60) {
    const page = await fetchWithRetry(`${searchBase}&offset=${offset}`);
    all.push(...(page.packages ?? []));
    console.error(`fetched top-list ${Math.min(all.length, MAX)}/${MAX}`);
    await sleep(1200);
  }
  return all.slice(0, MAX);
}

async function getVersionDetails(pkg) {
  const url = `https://artifacthub.io/api/v1/packages/helm/${encodeURIComponent(
    pkg.repository.name,
  )}/${encodeURIComponent(pkg.normalized_name)}/${encodeURIComponent(pkg.version)}`;
  return await fetchWithRetry(url);
}

function findOneTgz(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".tgz"))
    .map((f) => join(dir, f));
  if (files.length !== 1) throw new Error(`expected one tgz in ${dir}, found ${files.length}`);
  return files[0];
}

async function pullArchive(pkg, dir) {
  mkdirSync(dir, { recursive: true });
  let directError = "";
  try {
    await run("helm", [
      "pull",
      pkg.name,
      "--repo",
      pkg.repository.url,
      "--version",
      pkg.version,
      "--destination",
      dir,
    ]);
    const archive = findOneTgz(dir);
    return {
      archive,
      acquisitionMode: "helm repo+version",
      contentURL: "",
      artifactHubDigest: "",
      archiveSHA256: sha256(readFileSync(archive)),
      directError,
    };
  } catch (error) {
    directError = String(error.stderr || error.message || error).slice(0, 800);
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".tgz")) rmSync(join(dir, f), { force: true });
    }
  }

  if (pkg.repository.url === "https://charts.bitnami.com/bitnami") {
    const directURL = `https://charts.bitnami.com/bitnami/${pkg.name}-${pkg.version}.tgz`;
    try {
      const buf = await fetchWithRetry(directURL, "buffer");
      const archive = join(dir, `${slug(pkg.repository.name)}-${slug(pkg.normalized_name)}-${pkg.version}.tgz`);
      writeFileSync(archive, buf);
      return {
        archive,
        acquisitionMode: "Bitnami direct tgz",
        contentURL: directURL,
        artifactHubDigest: "",
        archiveSHA256: sha256(buf),
        directError,
      };
    } catch {
      // Fall through to Artifact Hub details/OCI handling below.
    }
  }

  const details = await getVersionDetails(pkg);
  const contentURL = details.content_url;
  if (contentURL?.startsWith("http://") || contentURL?.startsWith("https://")) {
    const buf = await fetchWithRetry(contentURL, "buffer");
    const archive = join(dir, `${slug(pkg.repository.name)}-${slug(pkg.normalized_name)}-${pkg.version}.tgz`);
    writeFileSync(archive, buf);
    return {
      archive,
      acquisitionMode: "Artifact Hub content_url",
      contentURL,
      artifactHubDigest: details.digest ?? "",
      archiveSHA256: sha256(buf),
      directError,
    };
  }
  if (contentURL?.startsWith("oci://")) {
    const ref = contentURL.endsWith(`:${pkg.version}`)
      ? contentURL.slice(0, -1 * (`:${pkg.version}`).length)
      : contentURL;
    await run("helm", ["pull", ref, "--version", pkg.version, "--destination", dir]);
    const archive = findOneTgz(dir);
    return {
      archive,
      acquisitionMode: "Artifact Hub OCI content_url",
      contentURL,
      artifactHubDigest: details.digest ?? "",
      archiveSHA256: sha256(readFileSync(archive)),
      directError,
    };
  }
  throw new Error(`helm pull failed and no usable content_url. ${directError}`);
}

async function extractArchive(archive, dir) {
  const extractRoot = join(dir, "extract");
  mkdirSync(extractRoot, { recursive: true });
  await run("tar", ["-xzf", archive, "-C", extractRoot]);
  const rawPaths = walk(extractRoot).map((p) => p.slice(extractRoot.length + 1));
  const roots = [extractRoot];
  let i = 0;
  for (const nested of walk(extractRoot).filter((p) => p.endsWith(".tgz"))) {
    const out = join(dir, "nested", String(i++));
    mkdirSync(out, { recursive: true });
    try {
      await run("tar", ["-xzf", nested, "-C", out]);
      roots.push(out);
    } catch {
      // Leave malformed nested charts as source evidence in rawPaths.
    }
  }
  return { roots, rawPaths };
}

function collectFiles(roots) {
  const files = [];
  for (const root of roots) {
    for (const f of walk(root)) {
      const rel = f.slice(root.length + 1);
      const lower = rel.toLowerCase();
      if (f.endsWith(".tgz")) continue;
      const interesting =
        lower.includes("/templates/") ||
        lower.includes("/crds/") ||
        lower.endsWith("/values.yaml") ||
        lower.endsWith("/values.yml") ||
        lower.endsWith("/values.schema.json") ||
        lower.endsWith("/chart.yaml") ||
        lower.endsWith("/chart.lock") ||
        lower.endsWith("/requirements.yaml") ||
        lower.endsWith("/requirements.lock");
      if (!interesting) continue;
      try {
        const buf = readFileSync(f);
        if (buf.length <= 3 * 1024 * 1024) files.push({ path: rel, lower, text: buf.toString("utf8") });
      } catch {
        // Ignore unreadable source sidecars.
      }
    }
  }
  return files;
}

function stripTemplateComments(text) {
  return text.replace(/{{\/\*[\s\S]*?\*\/}}/g, "").replace(/^\s*#.*$/gm, "");
}

function match(files, regex, filter = () => true) {
  let count = 0;
  const examples = [];
  for (const file of files.filter(filter)) {
    const text = stripTemplateComments(file.text);
    regex.lastIndex = 0;
    const found = text.match(regex);
    if (found?.length) {
      count += found.length;
      if (examples.length < 3) examples.push(file.path);
    }
  }
  return { count, examples };
}

function chartDependencyMetrics(files, rawPaths) {
  const chartFiles = files.filter((f) => f.lower.endsWith("/chart.yaml") || f.lower === "chart.yaml");
  let dependenciesDeclared = 0;
  let remoteDependencyRepos = 0;
  let nonExactDependencyConstraints = 0;
  const exactSemver = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
  for (const file of chartFiles) {
    const lines = file.text.split(/\r?\n/);
    let inDeps = false;
    for (const line of lines) {
      if (/^dependencies:\s*$/.test(line)) {
        inDeps = true;
        continue;
      }
      if (inDeps && /^[A-Za-z0-9_-]+:\s*/.test(line)) inDeps = false;
      if (!inDeps) continue;
      if (/^\s*-\s*name:\s*/.test(line)) dependenciesDeclared += 1;
      const version = line.match(/^\s*version:\s*["']?([^"'\s]+)["']?/);
      if (version && !exactSemver.test(version[1])) nonExactDependencyConstraints += 1;
      const repo = line.match(/^\s*repository:\s*["']?([^"']+)["']?/);
      if (repo) {
        const value = repo[1].trim();
        if (value && !value.startsWith("file://") && value !== "@") remoteDependencyRepos += 1;
      }
    }
  }
  const lockPresent = files.some(
    (f) => f.lower.endsWith("/chart.lock") || f.lower.endsWith("/requirements.lock"),
  );
  const vendoredSubcharts = rawPaths.some(
    (p) => /\/charts\/[^/]+\.tgz$/i.test(p) || /\/charts\/[^/]+\/chart\.yaml$/i.test(p),
  );
  const dependencyUpdateNeededLikely = dependenciesDeclared > 0 && !vendoredSubcharts && !lockPresent;
  return {
    dependenciesDeclared,
    dependencyLockPresent: lockPresent,
    vendoredSubcharts,
    dependencyUpdateNeededLikely,
    remoteDependencyRepos,
    nonExactDependencyConstraints,
  };
}

function countKind(files, kind) {
  return match(files, new RegExp(`^\\s*kind:\\s*${kind}\\s*$`, "gm"), (f) => f.lower.includes("/templates/") || f.lower.includes("/crds/")).count;
}

function analyze(files, rawPaths, repoURL) {
  const tmpl = (f) => f.lower.includes("/templates/");
  const values = (f) => f.lower.endsWith("/values.yaml") || f.lower.endsWith("/values.yml");
  const deps = chartDependencyMetrics(files, rawPaths);
  const hookTypes = new Set();
  for (const file of files.filter(tmpl)) {
    for (const matchLine of stripTemplateComments(file.text).matchAll(/helm\.sh\/hook\s*:\s*["']?([^"'\n]+)/g)) {
      matchLine[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => hookTypes.add(s));
    }
  }
  const hookTypesText = [...hookTypes].sort().join(", ");
  const metrics = {
    httpRepositoryURL: /^http:\/\//i.test(repoURL),
    ...deps,
    hooks: match(files, /helm\.sh\/hook\s*:/g, tmpl),
    testHooks: match(files, /helm\.sh\/hook\s*:[^\n]*(test|test-success|test-failure)/g, tmpl),
    hookWeights: match(files, /helm\.sh\/hook-weight\s*:/g, tmpl),
    hookDeletePolicies: match(files, /helm\.sh\/hook-delete-policy\s*:/g, tmpl),
    lookup: match(files, /\blookup\s+(?:\(|"|\$|\.)/g, tmpl),
    randFuncs: match(files, /\b(randAlpha|randAlphaNum|randNumeric|randAscii)\b/g, tmpl),
    certFuncs: match(files, /\b(genCA|genSelfSignedCert|genSignedCert)\b/g, tmpl),
    hashPasswordFuncs: match(files, /\b(htpasswd|bcrypt)\b/g, tmpl),
    timeUuidFuncs: match(files, /\b(now|uuidv4)\b|\.Release\.Time\b/g, tmpl),
    requiredOrFail: match(files, /\b(required|fail)\s+(?:\(|"|`|\$|\.)/g, tmpl),
    tpl: match(files, /\btpl\s+(?:\(|\$|\.)/g, tmpl),
    capabilitiesAPIs: match(files, /\.Capabilities\.APIVersions\.Has\b/g, tmpl),
    capabilitiesKubeVersion: match(files, /\.Capabilities\.KubeVersion\b/g, tmpl),
    semverCompare: match(files, /\bsemverCompare\s+(?:\(|"|\$|\.)/g, tmpl),
    releaseModeBranching: match(files, /\.Release\.(IsInstall|IsUpgrade|Revision)\b/g, tmpl),
    extraManifestValues: match(
      files,
      /\b(extraDeploy|extraManifests|extraObjects|extraResources|rawManifests|additionalManifests)\b/g,
      values,
    ),
    filesGet: match(files, /\.Files\.(Get|Glob|Lines)\b/g, tmpl),
    valuesSchema: files.filter((f) => f.lower.endsWith("/values.schema.json")).length,
    valuesFiles: files.filter(values).length,
    notesFiles: files.filter((f) => f.lower.includes("/templates/notes.txt")).length,
    crdFiles: files.filter((f) => f.lower.includes("/crds/")).length,
    crdKinds: countKind(files, "CustomResourceDefinition"),
    clusterRoles: countKind(files, "ClusterRole"),
    clusterRoleBindings: countKind(files, "ClusterRoleBinding"),
    validatingWebhooks: countKind(files, "ValidatingWebhookConfiguration"),
    mutatingWebhooks: countKind(files, "MutatingWebhookConfiguration"),
    apiServices: countKind(files, "APIService"),
    namespaces: countKind(files, "Namespace"),
    storageClasses: countKind(files, "StorageClass") + countKind(files, "PriorityClass"),
    statefulSets: countKind(files, "StatefulSet"),
    persistentVolumeClaims: countKind(files, "PersistentVolumeClaim"),
    jobs: countKind(files, "Job"),
    daemonSets: countKind(files, "DaemonSet"),
    secrets: countKind(files, "Secret"),
    hookTypesText,
    sourceFileCount: files.length,
  };

  const preRecipeRiskCount =
    Number(metrics.httpRepositoryURL) +
    Number(metrics.dependencyUpdateNeededLikely) +
    Number(metrics.nonExactDependencyConstraints > 0);
  const lifecyclePolicyCount =
    Number(metrics.hooks.count > 0) + Number(metrics.hookWeights.count > 0) + Number(metrics.hookDeletePolicies.count > 0);
  const earlyPolicyCount =
    Number(metrics.lookup.count > 0) +
    Number(metrics.capabilitiesAPIs.count > 0) +
    Number(metrics.capabilitiesKubeVersion.count > 0) +
    Number(metrics.releaseModeBranching.count > 0) +
    Number(metrics.semverCompare.count > 0);
  const generatedFactsCount =
    metrics.randFuncs.count + metrics.certFuncs.count + metrics.hashPasswordFuncs.count + metrics.timeUuidFuncs.count;
  const lateLiteralPolicyCount =
    Number(metrics.tpl.count > 0) + Number(metrics.extraManifestValues.count > 0) + Number(metrics.filesGet.count > 0);
  const installOperateCount =
    Number(metrics.crdFiles > 0 || metrics.crdKinds > 0) +
    Number(metrics.clusterRoles > 0 || metrics.clusterRoleBindings > 0) +
    Number(metrics.validatingWebhooks > 0 || metrics.mutatingWebhooks > 0) +
    Number(metrics.apiServices > 0) +
    Number(metrics.statefulSets > 0 || metrics.persistentVolumeClaims > 0);

  const hardCompilerFeatureCount =
    lifecyclePolicyCount + Number(metrics.lookup.count > 0) + Number(generatedFactsCount > 0);
  let classification = "P3 plain/static-ish";
  if (preRecipeRiskCount > 0) classification = "P0 source/dependency risk";
  else if (hardCompilerFeatureCount > 0) classification = "P1 compiler policy needed";
  else if (
    earlyPolicyCount > 0 ||
    metrics.requiredOrFail.count > 0 ||
    lateLiteralPolicyCount > 0 ||
    installOperateCount > 0
  ) {
    classification = "P2 recipe/render/install policy";
  }

  const score =
    preRecipeRiskCount * 20 +
    hardCompilerFeatureCount * 8 +
    earlyPolicyCount * 4 +
    Number(metrics.requiredOrFail.count > 0) * 3 +
    lateLiteralPolicyCount * 2 +
    installOperateCount;

  return {
    ...metrics,
    preRecipeRiskCount,
    lifecyclePolicyCount,
    earlyPolicyCount,
    generatedFactsCount,
    lateLiteralPolicyCount,
    installOperateCount,
    hardCompilerFeatureCount,
    classification,
    problemScore: score,
  };
}

async function scanChart(pkg, rank) {
  const dir = join(workRoot, `rank-${String(rank).padStart(3, "0")}`);
  try {
    const archive = await pullArchive(pkg, dir);
    const { roots, rawPaths } = await extractArchive(archive.archive, dir);
    const files = collectFiles(roots);
    const analysis = analyze(files, rawPaths, pkg.repository.url);
    return {
      ok: true,
      rank,
      chart: `${pkg.repository.name}/${pkg.normalized_name}`,
      repository: pkg.repository.name,
      name: pkg.normalized_name,
      version: pkg.version,
      stars: pkg.stars,
      repoURL: pkg.repository.url,
      scanStatus: "scanned",
      acquisitionMode: archive.acquisitionMode,
      contentURL: archive.contentURL,
      artifactHubDigest: archive.artifactHubDigest,
      archiveSHA256: archive.archiveSHA256,
      directError: archive.directError,
      ...analysis,
    };
  } catch (error) {
    const errorText = String(error.stderr || error.message || error).slice(0, 1200);
    const registryRateLimited = /toomanyrequests|rate limit/i.test(errorText);
    return {
      ok: false,
      rank,
      chart: `${pkg.repository.name}/${pkg.normalized_name}`,
      repository: pkg.repository.name,
      name: pkg.normalized_name,
      version: pkg.version,
      stars: pkg.stars,
      repoURL: pkg.repository.url,
      scanStatus: registryRateLimited ? "registry rate-limited" : "failed",
      classification: registryRateLimited
        ? "P0 source throttled during scan"
        : "P0 blocked: archive unavailable/malformed",
      problemScore: 100,
      preRecipeRiskCount: 1,
      registryRateLimited,
      error: errorText,
    };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Scratch cleanup best effort.
    }
  }
}

async function scanTop500() {
  const pkgs = await getTop500();
  const queue = pkgs.map((pkg, i) => ({ pkg, rank: i + 1 }));
  const results = [];
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const result = await scanChart(item.pkg, item.rank);
      results.push(result);
      if (item.rank % 25 === 0 || !result.ok) {
        console.error(`${result.ok ? "scanned" : "failed"} ${item.rank}/${MAX} ${result.chart}`);
      }
      await sleep(150);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results.sort((a, b) => a.rank - b.rank);
}

function summarize(rows) {
  const scanned = rows.filter((r) => r.ok);
  const count = (pred) => rows.filter(pred).length;
  const scannedCount = (pred) => scanned.filter(pred).length;
  return {
    requested: rows.length,
    scanned: scanned.length,
    failed: rows.length - scanned.length,
    p0Blocked: count((r) => !r.ok && !r.registryRateLimited),
    p0RateLimited: count((r) => !r.ok && r.registryRateLimited),
    p0SourceRisk: scannedCount((r) => r.classification === "P0 source/dependency risk"),
    p1CompilerPolicy: scannedCount((r) => r.classification === "P1 compiler policy needed"),
    p2RecipePolicy: scannedCount((r) => r.classification === "P2 recipe/render/install policy"),
    p3Plain: scannedCount((r) => r.classification === "P3 plain/static-ish"),
    hooks: scannedCount((r) => r.hooks?.count > 0),
    lookup: scannedCount((r) => r.lookup?.count > 0),
    generatedFacts: scannedCount((r) => r.generatedFactsCount > 0),
    requiredFail: scannedCount((r) => r.requiredOrFail?.count > 0),
    tpl: scannedCount((r) => r.tpl?.count > 0),
    capabilities: scannedCount((r) => (r.capabilitiesAPIs?.count ?? 0) > 0 || (r.capabilitiesKubeVersion?.count ?? 0) > 0),
    crds: scannedCount((r) => (r.crdFiles ?? 0) > 0 || (r.crdKinds ?? 0) > 0),
    webhooks: scannedCount((r) => (r.validatingWebhooks ?? 0) > 0 || (r.mutatingWebhooks ?? 0) > 0),
    clusterRBAC: scannedCount((r) => (r.clusterRoles ?? 0) > 0 || (r.clusterRoleBindings ?? 0) > 0),
    dependencyUpdateLikely: scannedCount((r) => r.dependencyUpdateNeededLikely),
    nonExactDeps: scannedCount((r) => (r.nonExactDependencyConstraints ?? 0) > 0),
    httpRepoURL: scannedCount((r) => r.httpRepositoryURL),
  };
}

const matrixColumns = [
  ["Rank", (r) => r.rank],
  ["Chart", (r) => r.chart],
  ["Repository", (r) => r.repository],
  ["Name", (r) => r.name],
  ["Version", (r) => r.version],
  ["Stars", (r) => r.stars],
  ["Repo URL", (r) => r.repoURL],
  ["Scan status", (r) => r.scanStatus],
  ["Classification", (r) => r.classification],
  ["Problem score", (r) => r.problemScore],
  ["Pre-recipe risk count", (r) => r.preRecipeRiskCount],
  ["P0: archive unavailable/malformed", (r) => yn(!r.ok && !r.registryRateLimited)],
  ["P0: registry rate-limited during scan", (r) => yn(r.registryRateLimited)],
  ["P0: HTTP chart repo URL", (r) => yn(r.httpRepositoryURL)],
  ["P0: archive SHA captured", (r) => yn(r.ok && r.archiveSHA256)],
  ["P0: deps declared", (r) => num(r.dependenciesDeclared)],
  ["P0: dependency lock present", (r) => yn(r.dependencyLockPresent)],
  ["P0: vendored subcharts present", (r) => yn(r.vendoredSubcharts)],
  ["P0: dependency update likely needed", (r) => yn(r.dependencyUpdateNeededLikely)],
  ["P0: remote dependency repos", (r) => num(r.remoteDependencyRepos)],
  ["P0: non-exact dep constraints", (r) => num(r.nonExactDependencyConstraints)],
  ["P0 notes / error", (r) => r.error || r.directError || ""],
  ["Early: lookup", (r) => num(r.lookup?.count)],
  ["Early: Capabilities.APIVersions", (r) => num(r.capabilitiesAPIs?.count)],
  ["Early: Capabilities.KubeVersion", (r) => num(r.capabilitiesKubeVersion?.count)],
  ["Early: Release install/upgrade/revision", (r) => num(r.releaseModeBranching?.count)],
  ["Early: semverCompare", (r) => num(r.semverCompare?.count)],
  ["Early: required/fail", (r) => num(r.requiredOrFail?.count)],
  ["Lifecycle: hooks", (r) => num(r.hooks?.count)],
  ["Lifecycle: non-test hooks", (r) => num((r.hooks?.count ?? 0) - (r.testHooks?.count ?? 0))],
  ["Lifecycle: test hooks", (r) => num(r.testHooks?.count)],
  ["Lifecycle: hook types", (r) => r.hookTypesText || ""],
  ["Lifecycle: hook weights", (r) => num(r.hookWeights?.count)],
  ["Lifecycle: hook delete policies", (r) => num(r.hookDeletePolicies?.count)],
  ["Generated facts: rand funcs", (r) => num(r.randFuncs?.count)],
  ["Generated facts: cert funcs", (r) => num(r.certFuncs?.count)],
  ["Generated facts: hash/password funcs", (r) => num(r.hashPasswordFuncs?.count)],
  ["Generated facts: time/uuid funcs", (r) => num(r.timeUuidFuncs?.count)],
  ["Generated facts: total candidates", (r) => num(r.generatedFactsCount)],
  ["Generated facts: Secret manifests", (r) => num(r.secrets)],
  ["Late/literal: tpl", (r) => num(r.tpl?.count)],
  ["Late/literal: extra/raw manifest values", (r) => num(r.extraManifestValues?.count)],
  ["Late/literal: .Files access", (r) => num(r.filesGet?.count)],
  ["Late/literal: values.schema.json present", (r) => yn((r.valuesSchema ?? 0) > 0)],
  ["Late/literal: values files", (r) => num(r.valuesFiles)],
  ["Late/literal: NOTES.txt", (r) => num(r.notesFiles)],
  ["Operate: CRD files", (r) => num(r.crdFiles)],
  ["Operate: CRD manifests", (r) => num(r.crdKinds)],
  ["Operate: ClusterRole", (r) => num(r.clusterRoles)],
  ["Operate: ClusterRoleBinding", (r) => num(r.clusterRoleBindings)],
  ["Operate: ValidatingWebhook", (r) => num(r.validatingWebhooks)],
  ["Operate: MutatingWebhook", (r) => num(r.mutatingWebhooks)],
  ["Operate: APIService", (r) => num(r.apiServices)],
  ["Operate: Namespace", (r) => num(r.namespaces)],
  ["Operate: Storage/PriorityClass", (r) => num(r.storageClasses)],
  ["Operate: StatefulSet", (r) => num(r.statefulSets)],
  ["Operate: PVC", (r) => num(r.persistentVolumeClaims)],
  ["Operate: Job", (r) => num(r.jobs)],
  ["Operate: DaemonSet", (r) => num(r.daemonSets)],
  ["Source file count", (r) => num(r.sourceFileCount)],
  ["Acquisition mode", (r) => r.acquisitionMode || ""],
  ["Content URL", (r) => r.contentURL || ""],
  ["Artifact Hub digest", (r) => r.artifactHubDigest || ""],
  ["Archive SHA256", (r) => r.archiveSHA256 || ""],
];

function addValues(sheet, startCell, values) {
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const startCol = startCell.match(/[A-Z]+/)[0];
  const startRow = Number(startCell.match(/\d+/)[0]);
  const startColNum = startCol.split("").reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0);
  const end = `${colName(startColNum + cols - 1)}${startRow + rows - 1}`;
  sheet.getRange(`${startCell}:${end}`).values = values;
  return `${startCell}:${end}`;
}

function styleTitle(sheet, range, titleFill = "#123047") {
  const r = sheet.getRange(range);
  r.format.fill = titleFill;
  r.format.font = { color: "#FFFFFF", bold: true, size: 16 };
  r.format.horizontalAlignment = "center";
  r.format.verticalAlignment = "center";
}

function styleHeader(range, fill = "#2F5D62") {
  range.format = {
    fill,
    font: { color: "#FFFFFF", bold: true, size: 10 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#C7D2D6" },
  };
}

function styleBody(range) {
  range.format = {
    font: { size: 10, color: "#1F2933" },
    verticalAlignment: "top",
    borders: { preset: "outside", style: "thin", color: "#E5E7EB" },
  };
}

async function buildWorkbook(rows) {
  const workbook = Workbook.create();
  const summary = summarize(rows);
  const generatedAt = new Date();

  const summarySheet = workbook.worksheets.add("Summary");
  const matrixSheet = workbook.worksheets.add("Feature Matrix");
  const defsSheet = workbook.worksheets.add("Definitions");
  const failuresSheet = workbook.worksheets.add("Failures");

  styleTitle(summarySheet, "A1:H1");
  summarySheet.getRange("A1:H1").merge();
  summarySheet.getRange("A1").values = [["Helm Top 500 Import Feature Matrix"]];
  summarySheet.getRange("A2:H2").merge();
  summarySheet.getRange("A2").values = [[
    `Generated ${generatedAt.toISOString()} from Artifact Hub Helm packages sorted by stars. Static source scan; no hooks or templates were executed.`,
  ]];
  summarySheet.getRange("A2:H2").format = { fill: "#EFF6F7", font: { italic: true, color: "#334155" }, wrapText: true };

  const kpis = [
    ["Requested", summary.requested],
    ["Scanned", summary.scanned],
    ["Failed / unavailable", summary.failed],
    ["P0 source risk", summary.p0SourceRisk + summary.p0Blocked + summary.p0RateLimited],
    ["P1 compiler policy", summary.p1CompilerPolicy],
    ["P2 recipe policy", summary.p2RecipePolicy],
    ["P3 plain/static", summary.p3Plain],
    ["Needs any policy", summary.p0SourceRisk + summary.p1CompilerPolicy + summary.p2RecipePolicy],
  ];
  addValues(summarySheet, "A4", [kpis.slice(0, 4).map((x) => x[0]), kpis.slice(0, 4).map((x) => x[1])]);
  addValues(summarySheet, "A7", [kpis.slice(4).map((x) => x[0]), kpis.slice(4).map((x) => x[1])]);
  styleHeader(summarySheet.getRange("A4:D4"), "#123047");
  styleHeader(summarySheet.getRange("A7:D7"), "#123047");
  summarySheet.getRange("A5:D5").format = { fill: "#F8FAFC", font: { bold: true, size: 14 }, horizontalAlignment: "center" };
  summarySheet.getRange("A8:D8").format = { fill: "#F8FAFC", font: { bold: true, size: 14 }, horizontalAlignment: "center" };

  const featureCounts = [
    ["P0 blocked/unavailable", summary.p0Blocked, "Truly pre-recipe: archive cannot be fetched or unpacked."],
    ["P0 registry rate-limited", summary.p0RateLimited, "Chart archive was blocked by registry throttling during this scan."],
    ["P0 source/dependency risk", summary.p0SourceRisk, "HTTP repo, likely dependency update, or non-exact dependency constraints."],
    ["Hooks", summary.hooks, "Lifecycle/procedural behavior; map to phases/tests/unsupported policy."],
    ["lookup", summary.lookup, "Cluster-state dependent render; map to collector/facts/reuse policy."],
    ["Generated fact candidates", summary.generatedFacts, "Random strings, certs, hashes, time/uuid; map to generated facts."],
    ["required/fail", summary.requiredFail, "Map to recipe input validation and constraints."],
    ["Capabilities checks", summary.capabilities, "Map to named capability profiles."],
    ["tpl", summary.tpl, "Template-evaluated values; bound or reject as late/literal escape hatch."],
    ["CRDs", summary.crds, "Install/operate ordering and ownership."],
    ["Cluster RBAC", summary.clusterRBAC, "Cluster-scope permission footprint."],
    ["Webhooks", summary.webhooks, "Admission/control-plane operational footprint."],
    ["Dependency update likely", summary.dependencyUpdateLikely, "Source acquisition risk if chart package lacks vendored/locked dependencies."],
  ];
  addValues(summarySheet, "A11", [["Feature / risk", "Charts", "Interpretation"], ...featureCounts]);
  styleHeader(summarySheet.getRange("A11:C11"), "#2F5D62");
  styleBody(summarySheet.getRange(`A12:C${11 + featureCounts.length}`));
  summarySheet.getRange(`B12:B${11 + featureCounts.length}`).format.horizontalAlignment = "right";

  const classData = [
    ["P0 blocked/unavailable", summary.p0Blocked],
    ["P0 source throttled during scan", summary.p0RateLimited],
    ["P0 source/dependency risk", summary.p0SourceRisk],
    ["P1 compiler policy needed", summary.p1CompilerPolicy],
    ["P2 recipe/render/install policy", summary.p2RecipePolicy],
    ["P3 plain/static-ish", summary.p3Plain],
  ];
  addValues(summarySheet, "E11", [["Class", "Charts"], ...classData]);
  styleHeader(summarySheet.getRange("E11:F11"), "#2F5D62");
  styleBody(summarySheet.getRange(`E12:F${11 + classData.length}`));
  summarySheet.charts.add("bar", {
    title: "Charts by Import Class",
    categories: classData.map((r) => r[0]),
    series: [{ name: "Charts", values: classData.map((r) => r[1]) }],
    hasLegend: false,
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 80 },
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 9 } },
    from: { row: 17, col: 4 },
    extent: { widthPx: 620, heightPx: 310 },
  });

  addValues(summarySheet, "A26", [
    ["Source"],
    [sourceURL],
    ["Caveat"],
    [
      "This is a static source scan. It intentionally marks policy needs without executing chart templates, hooks, lookup, or generated functions.",
    ],
  ]);
  summarySheet.getRange("A26:A29").format.font = { bold: true };
  summarySheet.getRange("A27:H29").format.wrapText = true;
  summarySheet.getRange("A1:H30").format.autofitColumns();
  summarySheet.getRange("A1:H30").format.autofitRows();

  const matrixHeader = matrixColumns.map((c) => c[0]);
  const matrixRows = rows.map((r) => matrixColumns.map(([, getter]) => getter(r)));
  const matrixRange = addValues(matrixSheet, "A1", [matrixHeader, ...matrixRows]);
  styleHeader(matrixSheet.getRange(`A1:${colName(matrixColumns.length)}1`), "#123047");
  styleBody(matrixSheet.getRange(`A2:${colName(matrixColumns.length)}${rows.length + 1}`));
  matrixSheet.freezePanes.freezeRows(1);
  matrixSheet.freezePanes.freezeColumns(2);
  matrixSheet.getRange("A:A").format.columnWidthPx = 48;
  matrixSheet.getRange("B:B").format.columnWidthPx = 250;
  matrixSheet.getRange("C:G").format.columnWidthPx = 135;
  matrixSheet.getRange("H:K").format.columnWidthPx = 145;
  matrixSheet.getRange("L:T").format.columnWidthPx = 105;
  matrixSheet.getRange("U:U").format.columnWidthPx = 260;
  matrixSheet.getRange("V:BK").format.columnWidthPx = 95;
  matrixSheet.getRange("BL:BN").format.columnWidthPx = 190;
  matrixSheet.getRange("BO:BQ").format.columnWidthPx = 210;
  matrixSheet.getRange(matrixRange).format.wrapText = true;
  matrixSheet.getRange(`J2:K${rows.length + 1}`).format.horizontalAlignment = "right";
  matrixSheet.getRange(`V2:BK${rows.length + 1}`).format.horizontalAlignment = "right";
  matrixSheet.getRange(`I2:I${rows.length + 1}`).conditionalFormats.add("containsText", {
    text: "P0",
    format: { fill: "#FECACA", font: { color: "#7F1D1D", bold: true } },
  });
  matrixSheet.getRange(`I2:I${rows.length + 1}`).conditionalFormats.add("containsText", {
    text: "P1",
    format: { fill: "#FED7AA", font: { color: "#7C2D12", bold: true } },
  });
  matrixSheet.getRange(`I2:I${rows.length + 1}`).conditionalFormats.add("containsText", {
    text: "P2",
    format: { fill: "#FEF3C7", font: { color: "#78350F", bold: true } },
  });
  matrixSheet.getRange(`I2:I${rows.length + 1}`).conditionalFormats.add("containsText", {
    text: "P3",
    format: { fill: "#DCFCE7", font: { color: "#14532D", bold: true } },
  });

  const definitions = [
    ["Group", "Column / feature", "Meaning", "Install-config-operate interpretation"],
    ["P0 pre-recipe", "Archive unavailable/malformed", "The chart archive could not be fetched or unpacked.", "Real import blocker until source is mirrored, fixed, or skipped."],
    ["P0 pre-recipe", "HTTP repo URL", "The chart repository URL is plain HTTP.", "Pinning the archive hash helps, but source acquisition is weaker."],
    ["P0 pre-recipe", "Dependency update likely needed", "Chart declares dependencies but package lacks an obvious lock or vendored subchart.", "Importer should not run dependency update implicitly; require lock/digest or fail."],
    ["P0 pre-recipe", "Non-exact dependency constraints", "Dependency version does not look like a single exact semver.", "Require resolved dependency lock before deterministic import."],
    ["Early/rendered", "lookup", "Template reads live cluster state.", "Represent as collector/fact/reuse-existing-resource behavior, or fail if unsupported."],
    ["Early/rendered", "Capabilities.*", "Template branches on kube version or API availability.", "Represent as named capability profiles selected after recipe creation."],
    ["Early/rendered", "required/fail", "Template validates required values or incompatible combinations.", "Represent as recipe input constraints; execute after recipe creation."],
    ["Lifecycle", "Hooks", "Helm lifecycle resources annotated as hooks.", "Map to phases/actions/tests or explicitly unsupported procedural behavior."],
    ["Generated facts", "rand/cert/hash/time funcs", "Template can generate secrets, certs, hashes, or time/uuid values.", "Represent as generated facts; actual randomness happens at install time and is persisted."],
    ["Late/literal", "tpl", "Values can be evaluated as templates.", "Bound or reject as a late/literal escape hatch; not a pre-recipe blocker."],
    ["Late/literal", "extra/raw manifest values", "Values expose raw manifest injection knobs.", "Treat as bounded extension surface or unsupported depending on recipe policy."],
    ["Operate", "CRDs/RBAC/webhooks/APIService", "Cluster-scoped resources with install/operate implications.", "Need phase ordering, ownership, conflict detection, and uninstall policy."],
    ["Classification", "P0 blocked/unavailable", "Archive failure.", "Truly dangerous before recipe exists."],
    ["Classification", "P0 source throttled during scan", "Registry rate limit while fetching the archive.", "Real source acquisition risk, but not chart-template semantics."],
    ["Classification", "P0 source/dependency risk", "Potential source-acquisition nondeterminism.", "Fix with mirror, digest pinning, lockfiles, or fail-fast policy."],
    ["Classification", "P1 compiler policy needed", "Hooks, lookup, or generated facts.", "Importer can be deterministic only with explicit compiler rules."],
    ["Classification", "P2 recipe/render/install policy", "Checks/options/operate footprint.", "Usually safe to import symbolically and evaluate later."],
    ["Classification", "P3 plain/static-ish", "No scanned policy flags.", "Closest to direct static import."],
  ];
  addValues(defsSheet, "A1", definitions);
  styleHeader(defsSheet.getRange("A1:D1"), "#123047");
  styleBody(defsSheet.getRange(`A2:D${definitions.length}`));
  defsSheet.freezePanes.freezeRows(1);
  defsSheet.getRange("A:A").format.columnWidthPx = 150;
  defsSheet.getRange("B:B").format.columnWidthPx = 220;
  defsSheet.getRange("C:D").format.columnWidthPx = 430;
  defsSheet.getRange(`A1:D${definitions.length}`).format.wrapText = true;
  defsSheet.getRange(`A1:D${definitions.length}`).format.autofitRows();

  const failures = rows.filter((r) => !r.ok);
  const failureRows = failures.map((r) => [r.rank, r.chart, r.version, r.stars, r.scanStatus, r.repoURL, r.error]);
  addValues(failuresSheet, "A1", [["Rank", "Chart", "Version", "Stars", "Scan status", "Repo URL", "Error"], ...failureRows]);
  styleHeader(failuresSheet.getRange("A1:G1"), "#123047");
  if (failureRows.length) styleBody(failuresSheet.getRange(`A2:G${failureRows.length + 1}`));
  failuresSheet.freezePanes.freezeRows(1);
  failuresSheet.getRange("A:A").format.columnWidthPx = 55;
  failuresSheet.getRange("B:B").format.columnWidthPx = 250;
  failuresSheet.getRange("C:D").format.columnWidthPx = 90;
  failuresSheet.getRange("E:E").format.columnWidthPx = 150;
  failuresSheet.getRange("F:G").format.columnWidthPx = 420;
  failuresSheet.getRange(`A1:G${Math.max(2, failureRows.length + 1)}`).format.wrapText = true;

  const summaryCheck = await workbook.inspect({
    kind: "table",
    range: "Summary!A1:H18",
    include: "values,formulas",
    tableMaxRows: 20,
    tableMaxCols: 8,
  });
  console.log(summaryCheck.ndjson.split("\n").slice(0, 12).join("\n"));
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 300 },
    summary: "final formula error scan",
  });
  console.log(errors.ndjson);
  await workbook.render({ sheetName: "Summary", range: "A1:H32", scale: 1 });
  await workbook.render({ sheetName: "Feature Matrix", range: "A1:K25", scale: 1 });
  await workbook.render({ sheetName: "Definitions", range: "A1:D18", scale: 1 });
  await workbook.render({ sheetName: "Failures", range: "A1:G10", scale: 1 });

  await fs.mkdir(outputDir, { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  return outputPath;
}

const rows = await scanTop500();
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(rawRowsPath, JSON.stringify(rows, null, 2));
const saved = await buildWorkbook(rows);
console.log(`saved ${saved}`);
