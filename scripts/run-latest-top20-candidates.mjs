import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputRoot = join(repoRoot, "data", "latest-top20-refresh", "candidates");
const summaryPath = join(outputRoot, "README.md");
const statusPath = join(outputRoot, "candidate-status.csv");
const mode = process.argv[2] ?? "--verify";

const candidates = [
  {
    chart: "argo-cd/argo-cd",
    currentVersion: "9.5.15",
    latestVersion: "9.5.17",
    script: "scripts/argo-cd-proof.mjs",
    output: "argo-cd-9.5.17",
    variants: "default;no-crds",
  },
  {
    chart: "bitnami/mongodb",
    currentVersion: "19.0.7",
    latestVersion: "19.0.9",
    script: "scripts/mongodb-proof.mjs",
    output: "mongodb-19.0.9",
    variants: "generated-passwords;existing-secret-replicaset",
  },
  {
    chart: "bitnami/nginx",
    currentVersion: "24.0.2",
    latestVersion: "24.0.4",
    script: "scripts/nginx-proof.mjs",
    output: "nginx-24.0.4",
    variants: "http-clusterip;existing-tls-ingress",
  },
  {
    chart: "bitnami/postgresql",
    currentVersion: "18.6.7",
    latestVersion: "18.6.10",
    script: "scripts/postgresql-proof.mjs",
    output: "postgresql-18.6.10",
    variants: "generated-passwords;existing-secret",
  },
  {
    chart: "bitnami/redis",
    currentVersion: "25.5.3",
    latestVersion: "27.0.0",
    output: "redis-27.0.0",
    variants: "default;reuse-existing-secret",
    commands: {
      "--generate-proof": { script: "scripts/generate-redis-proof.mjs", args: [] },
      "--generate-package": { script: "scripts/generate-redis-installer-package.mjs", args: [] },
      "--verify-proof": { script: "scripts/verify-redis-proof.mjs", args: [] },
      "--verify-package": { script: "scripts/verify-redis-installer-package.mjs", args: [] },
    },
  },
  {
    chart: "prometheus-community/kube-prometheus-stack",
    currentVersion: "85.3.3",
    latestVersion: "86.1.0",
    script: "scripts/kube-prometheus-stack-proof.mjs",
    output: "kube-prometheus-stack-86.1.0",
    variants: "default;no-crds",
  },
  {
    chart: "prometheus-community/prometheus",
    currentVersion: "29.8.0",
    latestVersion: "29.9.0",
    script: "scripts/prometheus-proof.mjs",
    output: "prometheus-29.9.0",
    variants: "default;server-only-ephemeral",
  },
];

if (mode === "--generate") {
  runAll(["--generate-proof", "--generate-package"]);
  writeStatus();
  verify({ writeOutputs: false });
} else if (mode === "--verify") {
  verify({ writeOutputs: false });
} else {
  console.log(`Usage:
  node scripts/run-latest-top20-candidates.mjs --generate
  node scripts/run-latest-top20-candidates.mjs --verify`);
}

function runAll(commands) {
  for (const candidate of candidates) {
    for (const command of commands) {
      runCandidate(candidate, command);
    }
  }
}

function verify({ writeOutputs }) {
  const rows = candidates.map((candidate) => {
    runCandidate(candidate, "--verify-proof");
    runCandidate(candidate, "--verify-package");
    const paths = pathsFor(candidate);
    check(existsSync(paths.recipe), `${relative(paths.recipe)} is missing`);
    check(existsSync(paths.package), `${relative(paths.package)} is missing`);
    const counts = variantCounts(paths.recipe);
    return {
      ...candidate,
      recipePath: relative(paths.recipe),
      packagePath: relative(paths.package),
      variantCount: counts.length,
      objectCounts: counts.map((count) => `${count.variant}:${count.objects}`).join(";"),
      status: "candidate-proof-generated",
    };
  });

  if (writeOutputs) writeCandidateOutputs(rows);
  check(existsSync(summaryPath), `${relative(summaryPath)} is missing`);
  check(existsSync(statusPath), `${relative(statusPath)} is missing`);
  console.log(`verified ${rows.length} latest top-20 candidate proof(s)`);
}

function writeStatus() {
  const rows = candidates.map((candidate) => {
    const paths = pathsFor(candidate);
    const counts = variantCounts(paths.recipe);
    return {
      ...candidate,
      recipePath: relative(paths.recipe),
      packagePath: relative(paths.package),
      variantCount: counts.length,
      objectCounts: counts.map((count) => `${count.variant}:${count.objects}`).join(";"),
      status: "candidate-proof-generated",
    };
  });
  writeCandidateOutputs(rows);
}

function writeCandidateOutputs(rows) {
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(statusPath, csv(rows), "utf8");
  writeFileSync(summaryPath, summary(rows), "utf8");
}

function runCandidate(candidate, command) {
  const commandSpec = candidate.commands?.[command] ?? { script: candidate.script, args: [command] };
  check(commandSpec.script, `${candidate.chart} has no script for ${command}`);
  execFileSync("node", [commandSpec.script, ...commandSpec.args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      HELM_EXPT_CHART_VERSION: candidate.latestVersion,
      HELM_EXPT_PROOF_OUTPUT_ROOT: `data/latest-top20-refresh/candidates/${candidate.output}`,
    },
  });
}

function pathsFor(candidate) {
  const [repo, chart] = candidate.chart.split("/");
  return {
    recipe: join(outputRoot, candidate.output, "recipes", repo, chart, candidate.latestVersion),
    package: join(outputRoot, candidate.output, "packages", repo, chart, candidate.latestVersion),
  };
}

function variantCounts(recipePath) {
  const variantsRoot = join(recipePath, "revisions");
  const files = execFileSync("find", [variantsRoot, "-path", "*/rendered/object-inventory.yaml", "-type", "f"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  return files.map((file) => {
    const text = readFileSync(file, "utf8");
    const objectCount = text.match(/objectCount:\s*(\d+)/)?.[1] ?? "unknown";
    const variant = file.split("/revisions/")[1]?.split("/")[0] ?? "unknown";
    return { variant, objects: objectCount };
  });
}

function csv(rows) {
  const headers = [
    "chart",
    "current_version",
    "latest_version",
    "status",
    "variants",
    "variant_count",
    "object_counts",
    "recipe_path",
    "package_path",
  ];
  return `${headers.join(",")}\n${rows
    .map((row) =>
      [
        row.chart,
        row.currentVersion,
        row.latestVersion,
        row.status,
        row.variants,
        row.variantCount,
        row.objectCounts,
        row.recipePath,
        row.packagePath,
      ]
        .map(csvCell)
        .join(","),
    )
    .join("\n")}\n`;
}

function summary(rows) {
  return `# Latest Top-20 Candidate Proofs

These are latest-version candidate proofs for top-20 charts whose
upstream Helm chart versions moved after the current supported catalog proofs.

They are **not** catalog-supported replacements yet. They are candidate
artifacts that prove the new chart version can still go through the
recipe/package/render/compare path. Promotion requires ConfigHub proof receipts,
live e2e receipts, catalog status, production disposition, and regenerated
top-100/top-500 outputs.

| Chart | Current proof | Candidate version | Variants | Object counts | Status |
| --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| \`${row.chart}\` | \`${row.currentVersion}\` | \`${row.latestVersion}\` | \`${row.variants}\` | ${row.objectCounts} | ${row.status} |`,
  )
  .join("\n")}

## Verify

\`\`\`sh
npm run top20:latest-candidates:verify
\`\`\`
`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function relative(path) {
  return path.slice(repoRoot.length + 1);
}
