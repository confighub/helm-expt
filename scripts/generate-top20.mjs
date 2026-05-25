import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const verifyOnly = process.argv.includes("--verify");
const renderAndVendorRoot = join(repoRoot, "archive", "render-and-vendor-top20");
const chartsRoot = join(renderAndVendorRoot, "charts");

const artifactHubSearchURL =
  "https://artifacthub.io/api/v1/packages/search?kind=0&sort=stars&limit=20&deprecated=false";
const kubeVersion = "1.30.0";
const renderFlags = ["--include-crds", "--skip-tests", "--no-hooks"];

const helmHome = {
  HELM_CACHE_HOME: join(repoRoot, ".helm/cache"),
  HELM_CONFIG_HOME: join(repoRoot, ".helm/config"),
  HELM_DATA_HOME: join(repoRoot, ".helm/data"),
};

function shasum(textOrBuffer) {
  return createHash("sha256").update(textOrBuffer).digest("hex");
}

function yamlQuote(value) {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(String(value));
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    cwd: repoRoot,
    env: { ...process.env, ...helmHome },
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function tryRun(cmd, args) {
  try {
    return { ok: true, stdout: run(cmd, args), stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? error.message,
    };
  }
}

function ensureCleanDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

async function fetchTop20() {
  const response = await fetch(artifactHubSearchURL, {
    headers: { "User-Agent": "confighub-helm-expt/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Artifact Hub search failed: ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  return body.packages;
}

async function fetchDetails(pkg) {
  const url = `https://artifacthub.io/api/v1/packages/helm/${encodeURIComponent(
    pkg.repository.name,
  )}/${encodeURIComponent(pkg.normalized_name)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "confighub-helm-expt/0.1" },
  });
  if (!response.ok) {
    return { url, details: null, error: `${response.status} ${response.statusText}` };
  }
  return { url, details: await response.json(), error: null };
}

async function fetchVersionDetails(pkg) {
  const url = `https://artifacthub.io/api/v1/packages/helm/${encodeURIComponent(
    pkg.repository.name,
  )}/${encodeURIComponent(pkg.normalized_name)}/${encodeURIComponent(pkg.version)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "confighub-helm-expt/0.1" },
  });
  if (!response.ok) {
    return { url, details: null, error: `${response.status} ${response.statusText}` };
  }
  return { url, details: await response.json(), error: null };
}

function writeFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function helmVersion() {
  return run("helm", ["version", "--template", "{{.Version}} {{.GitCommit}} {{.GoVersion}}\n"]).trim();
}

function pullChart(pkg, workDir) {
  const repoURL = pkg.repository.url;
  const candidates = [repoURL];
  if (repoURL?.startsWith("http://")) {
    candidates.push(repoURL.replace(/^http:\/\//, "https://"));
  }

  let last = null;
  for (const candidate of candidates) {
    const result = tryRun("helm", [
      "pull",
      pkg.name,
      "--repo",
      candidate,
      "--version",
      pkg.version,
      "--destination",
      workDir,
    ]);
    if (result.ok) {
      const archivePath = findChartArchive(workDir);
      return { archivePath, resolvedRepositoryURL: candidate, contentURL: null, pullStderr: result.stderr };
    }
    last = result;
  }

  throw new Error(last?.stderr || `helm pull failed for ${pkg.repository.name}/${pkg.name}`);
}

async function downloadChart(pkg, versionDetails, workDir) {
  const contentURL = versionDetails?.content_url;
  if (contentURL?.startsWith("http://") || contentURL?.startsWith("https://")) {
    const response = await fetch(contentURL, {
      redirect: "follow",
      headers: { "User-Agent": "confighub-helm-expt/0.1" },
    });
    if (!response.ok) {
      throw new Error(`chart download failed: ${response.status} ${response.statusText} ${contentURL}`);
    }
    const archivePath = join(workDir, `${pkg.normalized_name}-${pkg.version}.tgz`);
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
    return {
      archivePath,
      resolvedRepositoryURL: pkg.repository.url,
      contentURL,
      artifactHubDigest: versionDetails.digest ?? null,
    };
  }

  if (contentURL?.startsWith("oci://")) {
    const ref = contentURL.endsWith(`:${pkg.version}`)
      ? contentURL.slice(0, -1 * (`:${pkg.version}`).length)
      : contentURL;
    const result = tryRun("helm", ["pull", ref, "--version", pkg.version, "--destination", workDir]);
    if (!result.ok) {
      throw new Error(result.stderr || `helm pull failed for ${contentURL}`);
    }
    return {
      archivePath: findChartArchive(workDir),
      resolvedRepositoryURL: pkg.repository.url,
      contentURL,
      artifactHubDigest: versionDetails.digest ?? null,
    };
  }

  const pulled = pullChart(pkg, workDir);
  return {
    ...pulled,
    artifactHubDigest: versionDetails?.digest ?? null,
  };
}

function findChartArchive(workDir) {
  const files = execFileSync("find", [workDir, "-maxdepth", "1", "-type", "f", "-name", "*.tgz"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
  if (files.length !== 1) {
    throw new Error(`expected exactly one chart archive in ${workDir}, found ${files.length}`);
  }
  return files[0];
}

function renderChart(archivePath, releaseName, namespace, valuesPath) {
  return run("helm", [
    "template",
    releaseName,
    archivePath,
    "--namespace",
    namespace,
    "--values",
    valuesPath,
    "--kube-version",
    kubeVersion,
    ...renderFlags,
  ]);
}

function valuesForChart(pkg) {
  const id = `${pkg.repository.name}/${pkg.normalized_name}`;
  const dashboardCSRFKey = Buffer.alloc(256, "c").toString("base64");
  const deterministicValues = {
    "prometheus-community/kube-prometheus-stack": `grafana:
  adminPassword: "confighub-grafana-admin-password"
`,
    "bitnami/redis": `auth:
  password: "confighub-redis-password"
`,
    "bitnami/postgresql": `auth:
  postgresPassword: "confighub-postgresql-password"
`,
    "k8s-dashboard/kubernetes-dashboard": `app:
  security:
    csrfKey: "${dashboardCSRFKey}"
`,
    "grafana/loki": `deploymentMode: SingleBinary
loki:
  auth_enabled: false
  useTestSchema: true
  commonConfig:
    replication_factor: 1
  storage:
    type: filesystem
singleBinary:
  replicas: 1
read:
  replicas: 0
backend:
  replicas: 0
write:
  replicas: 0
`,
    "gitlab/gitlab": `certmanager-issuer:
  email: "helm-expt@example.invalid"
registry:
  storage:
    secret: "gitlab-registry-storage"
gitlab:
  toolbox:
    backups:
      objectStorage:
        config:
          secret: "gitlab-backup-storage"
          key: "connection"
global:
  hosts:
    domain: "example.invalid"
  redis:
    host: "redis.example.invalid"
    auth:
      secret: "gitlab-redis"
      key: "password"
  psql:
    host: "postgresql.example.invalid"
    password:
      secret: "gitlab-postgresql"
      key: "password"
  appConfig:
    object_store:
      enabled: true
      connection:
        secret: "gitlab-object-storage"
        key: "connection"
    backups:
      bucket: "gitlab-backups"
      tmpBucket: "gitlab-tmp"
`,
    "harbor/harbor": `expose:
  tls:
    certSource: none
harborAdminPassword: "confighub-harbor-admin-password"
secretKey: "confighub-harbor"
core:
  secret: "confighub-core--"
  secretName: "harbor-core-token"
  xsrfKey: "confighub-harbor-xsrf-key-000000"
jobservice:
  secret: "confighub-job---"
registry:
  secret: "confighub-reg---"
  credentials:
    htpasswdString: "harbor_registry_user:$2a$05$IPnI.TSgP8ek1/ESjkULVemA.A3nSXPdN80ljsmcun7FtE3ViSYUq"
`,
    "bitnami/keycloak": `auth:
  adminPassword: "confighub-keycloak-admin-password"
postgresql:
  auth:
    postgresPassword: "confighub-keycloak-postgresql-postgres-password"
    password: "confighub-keycloak-postgresql-password"
`,
    "jenkinsci/jenkins": `controller:
  admin:
    password: "confighub-jenkins-admin-password"
`,
    "bitnami/rabbitmq": `auth:
  password: "confighub-rabbitmq-password"
  erlangCookie: "confighub-rabbitmq-erlang-cookie"
`,
  };
  return deterministicValues[id] ?? "{}\n";
}

function resourceCount(manifest) {
  return manifest
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter((doc) => /^kind:\s+/m.test(doc) && /^metadata:\s*$/m.test(doc)).length;
}

function installerYaml(pkg, chartDirName) {
  return `apiVersion: installer.confighub.com/v1alpha1
kind: Package
metadata:
  name: ${yamlQuote(chartDirName)}
  version: ${yamlQuote(pkg.version)}
spec:
  bases:
    - name: default
      path: base
      default: true
      description: ${yamlQuote(`Imported Helm render for ${pkg.repository.name}/${pkg.name}`)}
`;
}

function importSpecYaml(pkg, chartDirName, resolvedRepositoryURL) {
  return `apiVersion: installer.confighub.com/v1alpha1
kind: HelmImportSpec
metadata:
  name: ${yamlQuote(chartDirName)}
spec:
  chart:
    repositoryName: ${yamlQuote(pkg.repository.name)}
    repositoryURL: ${yamlQuote(pkg.repository.url)}
    resolvedRepositoryURL: ${yamlQuote(resolvedRepositoryURL)}
    name: ${yamlQuote(pkg.name)}
    version: ${yamlQuote(pkg.version)}
  render:
    releaseName: ${yamlQuote(pkg.normalized_name)}
    namespace: ${yamlQuote(pkg.normalized_name)}
    kubeVersion: ${yamlQuote(kubeVersion)}
    apiVersions: []
    flags:
${renderFlags.map((flag) => `      - ${yamlQuote(flag)}`).join("\n")}
    valuesFiles:
      - values.yaml
`;
}

function receiptYaml({
  pkg,
  rank,
  generatedAt,
  detailsURL,
  detailsError,
  details,
  versionDetailsURL,
  versionDetailsError,
  versionDetails,
  chartDirName,
  resolvedRepositoryURL,
  contentURL,
  artifactHubDigest,
  chartArchiveSHA256,
  chartArchiveBytes,
  valuesSHA256,
  importSpecSHA256,
  upstreamSHA256,
  secondRenderSHA256,
  deterministic,
  manifestBytes,
  manifestResourceCount,
  renderError,
  helmVersionText,
}) {
  const dependencies = details?.data?.dependencies ?? [];
  const sourceLinks = details?.links ?? [];
  return `apiVersion: installer.confighub.com/v1alpha1
kind: HelmImportReceipt
metadata:
  name: ${yamlQuote(chartDirName)}
  generatedAt: ${yamlQuote(generatedAt)}
spec:
  ranking:
    source: ${yamlQuote("Artifact Hub packages/search")}
    sourceURL: ${yamlQuote(artifactHubSearchURL)}
    metric: ${yamlQuote("stars")}
    rank: ${rank}
    stars: ${pkg.stars}
    packageID: ${yamlQuote(pkg.package_id)}
  artifactHub:
    detailsURL: ${yamlQuote(detailsURL)}
    detailsError: ${yamlQuote(detailsError)}
    description: ${yamlQuote(pkg.description)}
    license: ${yamlQuote(pkg.license)}
    signed: ${Boolean(pkg.signed)}
    signatures:
${(pkg.signatures ?? []).map((sig) => `      - ${yamlQuote(sig)}`).join("\n") || "      []"}
  chart:
    repositoryName: ${yamlQuote(pkg.repository.name)}
    repositoryURL: ${yamlQuote(pkg.repository.url)}
    resolvedRepositoryURL: ${yamlQuote(resolvedRepositoryURL)}
    contentURL: ${yamlQuote(contentURL)}
    artifactHubDigest: ${yamlQuote(artifactHubDigest)}
    repositoryVerifiedPublisher: ${Boolean(pkg.repository.verified_publisher)}
    repositoryOfficial: ${Boolean(pkg.repository.official)}
    repositoryCNCF: ${Boolean(pkg.repository.cncf)}
    name: ${yamlQuote(pkg.name)}
    normalizedName: ${yamlQuote(pkg.normalized_name)}
    version: ${yamlQuote(pkg.version)}
    appVersion: ${yamlQuote(pkg.app_version)}
    archiveSHA256: ${yamlQuote(chartArchiveSHA256)}
    archiveBytes: ${chartArchiveBytes}
    kubeVersionConstraint: ${yamlQuote(details?.data?.kubeVersion)}
    dependencies:
${dependencies
  .map(
    (dep) => `      - name: ${yamlQuote(dep.name)}
        version: ${yamlQuote(dep.version)}
        repository: ${yamlQuote(dep.repository)}
        artifactHubRepositoryName: ${yamlQuote(dep.artifacthub_repository_name)}`,
  )
  .join("\n") || "      []"}
    links:
${sourceLinks.map((link) => `      - name: ${yamlQuote(link.name)}\n        url: ${yamlQuote(link.url)}`).join("\n") || "      []"}
  render:
    helmVersion: ${yamlQuote(helmVersionText)}
    command:
      - helm
      - template
      - ${yamlQuote(pkg.normalized_name)}
      - ${yamlQuote(`${pkg.name}-${pkg.version}.tgz`)}
      - --namespace
      - ${yamlQuote(pkg.normalized_name)}
      - --values
      - values.yaml
      - --kube-version
      - ${yamlQuote(kubeVersion)}
${renderFlags.map((flag) => `      - ${yamlQuote(flag)}`).join("\n")}
    releaseName: ${yamlQuote(pkg.normalized_name)}
    namespace: ${yamlQuote(pkg.normalized_name)}
    kubeVersion: ${yamlQuote(kubeVersion)}
    apiVersions: []
    values:
      files:
        - path: values.yaml
          sha256: ${yamlQuote(valuesSHA256)}
      mergedValuesCaptured: false
  outputs:
    importSpecSHA256: ${yamlQuote(importSpecSHA256)}
    upstreamYAMLSHA256: ${yamlQuote(upstreamSHA256)}
    upstreamYAMLBytes: ${manifestBytes}
    resourceCount: ${manifestResourceCount}
    secondRenderSHA256: ${yamlQuote(secondRenderSHA256)}
    deterministicAcrossTwoLocalRenders: ${Boolean(deterministic)}
  status:
    phase: ${yamlQuote(renderError ? "render-failed" : "rendered")}
    renderError: ${yamlQuote(renderError)}
  artifactHubVersion:
    detailsURL: ${yamlQuote(versionDetailsURL)}
    detailsError: ${yamlQuote(versionDetailsError)}
    digest: ${yamlQuote(versionDetails?.digest)}
    contentURL: ${yamlQuote(versionDetails?.content_url)}
`;
}

function readReceiptHash(chartPath) {
  const receiptPath = join(chartPath, "helm-import.receipt.yaml");
  if (!existsSync(receiptPath)) return null;
  const receipt = readFileSync(receiptPath, "utf8");
  return receipt.match(/upstreamYAMLSHA256:\s+"([^"]+)"/)?.[1] ?? null;
}

async function main() {
  if (verifyOnly) {
    const chartDirs = execFileSync("find", [chartsRoot, "-mindepth", "1", "-maxdepth", "1", "-type", "d"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
    for (const chartPath of chartDirs) {
      const upstreamPath = join(chartPath, "base/upstream.yaml");
      const expected = readReceiptHash(chartPath);
      const actual = existsSync(upstreamPath) ? shasum(readFileSync(upstreamPath)) : null;
      if (expected !== actual) {
        throw new Error(`${chartPath}: upstream hash mismatch expected=${expected} actual=${actual}`);
      }
    }
    console.log(`verified ${chartDirs.length} chart receipts`);
    return;
  }

  const generatedAt = new Date().toISOString();
  const packages = await fetchTop20();
  const helmVersionText = helmVersion();

  ensureCleanDir(chartsRoot);
  ensureCleanDir(join(repoRoot, ".tmp"));
  mkdirSync(join(repoRoot, ".helm"), { recursive: true });

  const rows = [];
  for (const [index, pkg] of packages.entries()) {
    const rank = index + 1;
    const chartDirName = `${String(rank).padStart(2, "0")}-${slugify(pkg.repository.name)}-${slugify(
      pkg.normalized_name,
    )}`;
    const chartPath = join(chartsRoot, chartDirName);
    const basePath = join(chartPath, "base");
    const workDir = join(repoRoot, ".tmp", chartDirName);
    ensureCleanDir(chartPath);
    ensureCleanDir(basePath);
    ensureCleanDir(workDir);

    console.log(`[${rank}/20] ${pkg.repository.name}/${pkg.name}@${pkg.version}`);
    const detailsResult = await fetchDetails(pkg);
    const versionDetailsResult = await fetchVersionDetails(pkg);
    const valuesText = valuesForChart(pkg);
    const valuesPath = join(chartPath, "values.yaml");
    writeFile(valuesPath, valuesText);

    let resolvedRepositoryURL = pkg.repository.url;
    let contentURL = null;
    let artifactHubDigest = null;
    let chartArchiveSHA256 = null;
    let chartArchiveBytes = 0;
    let upstreamText = "";
    let upstreamSHA256 = null;
    let secondRenderSHA256 = null;
    let deterministic = false;
    let manifestResourceCount = 0;
    let renderError = null;

    try {
      const pulled = await downloadChart(pkg, versionDetailsResult.details, workDir);
      resolvedRepositoryURL = pulled.resolvedRepositoryURL;
      contentURL = pulled.contentURL;
      artifactHubDigest = pulled.artifactHubDigest;
      const archive = readFileSync(pulled.archivePath);
      chartArchiveSHA256 = shasum(archive);
      chartArchiveBytes = archive.length;

      upstreamText = renderChart(pulled.archivePath, pkg.normalized_name, pkg.normalized_name, valuesPath);
      const second = renderChart(pulled.archivePath, pkg.normalized_name, pkg.normalized_name, valuesPath);
      upstreamSHA256 = shasum(upstreamText);
      secondRenderSHA256 = shasum(second);
      deterministic = upstreamSHA256 === secondRenderSHA256;
      manifestResourceCount = resourceCount(upstreamText);
    } catch (error) {
      renderError = error.stderr?.toString() || error.message;
      upstreamText = `# Helm render failed for ${pkg.repository.name}/${pkg.name}@${pkg.version}.
# See helm-import.receipt.yaml status.renderError for details.
`;
      upstreamSHA256 = shasum(upstreamText);
      secondRenderSHA256 = null;
    }

    const importSpec = importSpecYaml(pkg, chartDirName, resolvedRepositoryURL);
    const receipt = receiptYaml({
      pkg,
      rank,
      generatedAt,
      detailsURL: detailsResult.url,
      detailsError: detailsResult.error,
      details: detailsResult.details,
      versionDetailsURL: versionDetailsResult.url,
      versionDetailsError: versionDetailsResult.error,
      versionDetails: versionDetailsResult.details,
      chartDirName,
      resolvedRepositoryURL,
      contentURL,
      artifactHubDigest,
      chartArchiveSHA256,
      chartArchiveBytes,
      valuesSHA256: shasum(valuesText),
      importSpecSHA256: shasum(importSpec),
      upstreamSHA256,
      secondRenderSHA256,
      deterministic,
      manifestBytes: Buffer.byteLength(upstreamText),
      manifestResourceCount,
      renderError,
      helmVersionText,
    });

    writeFile(join(chartPath, "installer.yaml"), installerYaml(pkg, chartDirName));
    writeFile(join(chartPath, "helm-import.spec.yaml"), importSpec);
    writeFile(join(chartPath, "helm-import.receipt.yaml"), receipt);
    writeFile(
      join(basePath, "kustomization.yaml"),
      `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - upstream.yaml
`,
    );
    writeFile(join(basePath, "upstream.yaml"), upstreamText);

    rows.push({
      rank,
      chartDirName,
      repository: pkg.repository.name,
      name: pkg.name,
      version: pkg.version,
      stars: pkg.stars,
      resources: manifestResourceCount,
      deterministic,
      status: renderError ? "render-failed" : "rendered",
      hash: upstreamSHA256,
    });
  }

  const indexYaml = `apiVersion: installer.confighub.com/v1alpha1
kind: HelmImportIndex
metadata:
  name: top-20-artifacthub-helm
  generatedAt: ${yamlQuote(generatedAt)}
spec:
  sourceURL: ${yamlQuote(artifactHubSearchURL)}
  metric: "stars"
  charts:
${rows
  .map(
    (row) => `    - rank: ${row.rank}
      path: ${yamlQuote(`archive/render-and-vendor-top20/charts/${row.chartDirName}`)}
      repository: ${yamlQuote(row.repository)}
      name: ${yamlQuote(row.name)}
      version: ${yamlQuote(row.version)}
      stars: ${row.stars}
      status: ${yamlQuote(row.status)}
      deterministicAcrossTwoLocalRenders: ${Boolean(row.deterministic)}
      resourceCount: ${row.resources}
      upstreamYAMLSHA256: ${yamlQuote(row.hash)}`,
  )
  .join("\n")}
`;
  writeFile(join(chartsRoot, "index.yaml"), indexYaml);

  const readmeRows = rows
    .map(
      (row) =>
        `| ${row.rank} | \`${row.repository}/${row.name}\` | ${row.version} | ${row.stars} | ${row.status} | ${row.deterministic ? "yes" : "no"} | ${row.resources} | [${row.chartDirName}](charts/${row.chartDirName}/) |`,
    )
    .join("\n");

  writeFile(
    join(renderAndVendorRoot, "README.md"),
    `# Archived Top 20 Render-And-Vendor Artifacts

This archive is generated by \`npm run generate\`. It is supporting material,
not the main demo. The main demo is in the repository root \`README.md\` and
uses real \`cub\` commands against ConfigHub.

The chart set is the current top 20 Helm packages returned by Artifact Hub,
sorted by stars:

<${artifactHubSearchURL}>

Generated at: \`${generatedAt}\`

Helm used for this run: \`${helmVersionText}\`

Each chart directory contains:

- \`installer.yaml\`: a minimal ConfigHub package wrapper.
- \`helm-import.spec.yaml\`: the proposed first-class Helm import inputs.
- \`helm-import.receipt.yaml\`: the receipt with chart source, archive hash, render command, output hash, and two-render determinism check.
- \`values.yaml\`: the explicit values overlay used for the import. Most are \`{}\`; charts with required or randomly generated defaults use deterministic experiment placeholders.
- \`base/kustomization.yaml\`: a kustomize base that includes the rendered upstream manifest.
- \`base/upstream.yaml\`: the rendered Helm manifest captured as the package input.

## Top 20

| Rank | Chart | Version | Stars | Status | 2x deterministic | Resources | Path |
| ---: | --- | --- | ---: | --- | --- | ---: | --- |
${readmeRows}

## Regenerate

\`\`\`sh
npm run generate
\`\`\`

## Verify Stored Receipts

\`\`\`sh
npm run verify
\`\`\`

The verify command checks that each stored \`base/upstream.yaml\` still matches
the SHA256 in its receipt. It intentionally does not refetch Artifact Hub or
chart repositories.
`,
  );

  rmSync(join(repoRoot, ".tmp"), { recursive: true, force: true });
  console.log(`generated ${rows.length} chart imports`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
