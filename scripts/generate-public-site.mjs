import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const siteRoot = join(repoRoot, "site");
const indexPath = join(siteRoot, "index.html");
const catalogJsonPath = join(siteRoot, "catalog.json");
const readmePath = join(siteRoot, "README.md");
const top100Path = join(repoRoot, "data", "top100-catalog-analysis", "raw.json");
const top500Path = join(repoRoot, "data", "top500-catalog-analysis", "raw.json");
const latestReadinessPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
const runtimeWavePath = join(repoRoot, "data", "runtime-gitops", "wave1.csv");
const imageDigestSubjectsPath = join(repoRoot, "data", "image-digest-workdown", "all-subjects.csv");
const nextTenGapsPath = join(repoRoot, "data", "next-ten-waves", "gap-review-wave.csv");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const site = buildSite();
  write(indexPath, site.indexHtml);
  write(catalogJsonPath, site.catalogJson);
  write(readmePath, site.readme);
  console.log("wrote site/index.html, site/catalog.json, and site/README.md");
} else if (mode === "--verify") {
  const site = buildSite();
  check(existsSync(indexPath), "site/index.html is missing; run npm run site:generate");
  check(existsSync(catalogJsonPath), "site/catalog.json is missing; run npm run site:generate");
  check(existsSync(readmePath), "site/README.md is missing; run npm run site:generate");
  check(readFileSync(indexPath, "utf8") === site.indexHtml, "site/index.html is stale");
  check(readFileSync(catalogJsonPath, "utf8") === site.catalogJson, "site/catalog.json is stale");
  check(readFileSync(readmePath, "utf8") === site.readme, "site/README.md is stale");
  console.log("verified generated public site outputs");
} else {
  console.log(`Usage:
  node scripts/generate-public-site.mjs --generate
  node scripts/generate-public-site.mjs --verify`);
}

function buildSite() {
  const top100 = JSON.parse(readFileSync(top100Path, "utf8"));
  const top500 = JSON.parse(readFileSync(top500Path, "utf8"));
  const readiness = parseCsv(readFileSync(latestReadinessPath, "utf8"));
  const runtimeWave = parseCsv(readFileSync(runtimeWavePath, "utf8"));
  const imageSubjects = parseCsv(readFileSync(imageDigestSubjectsPath, "utf8"));
  const nextTenGaps = parseCsv(readFileSync(nextTenGapsPath, "utf8"));
  const catalogEntries = top100.entries.filter((entry) => entry.proof_surface === "top20-catalog-supported");
  const proofGrade = top100.entries.filter((entry) => entry.proof_surface === "next80-proof-grade");
  const latestCandidates = readiness.map((row) => ({
    chart: row.chart,
    currentVersion: row.current_version,
    candidateVersion: row.candidate_version,
    readiness: row.promotion_readiness,
    nextAction: row.next_action,
  }));
  const catalog = {
    generatedBy: "scripts/generate-public-site.mjs",
    source: {
      top100: "data/top100-catalog-analysis/raw.json",
      top500: "data/top500-catalog-analysis/raw.json",
      latestCandidates: "data/latest-top20-refresh/promotion-readiness.csv",
      runtimeWave: "data/runtime-gitops/wave1.csv",
      imageDigestSubjects: "data/image-digest-workdown/all-subjects.csv",
      nextTenGaps: "data/next-ten-waves/gap-review-wave.csv",
    },
    summary: {
      catalogSupported: catalogEntries.length,
      proofGrade: proofGrade.length,
      top500Rows: top500.summary.rows,
      top500MatchedProofs: top500.summary.currentRecipeRows,
      latestCandidates: latestCandidates.length,
      runtimeGitopsWave: runtimeWave.length,
      imageSubjectsNeedingResolution: imageSubjects.filter((row) => row.needs_resolution === "yes").length,
      nextTenGapRows: nextTenGaps.length,
    },
    catalogEntries,
    proofGradeEntries: proofGrade,
    latestCandidates,
  };
  return {
    catalogJson: `${JSON.stringify(catalog, null, 2)}\n`,
    indexHtml: html(catalog),
    readme: readme(),
  };
}

function html(catalog) {
  const entries = catalog.catalogEntries;
  const counters = [
    ["Catalog-supported charts", catalog.summary.catalogSupported],
    ["Proof-grade recipes", catalog.summary.proofGrade],
    ["Top-500 rows analyzed", catalog.summary.top500Rows],
    ["Latest candidates", catalog.summary.latestCandidates],
    ["Runtime/GitOps wave", catalog.summary.runtimeGitopsWave],
    ["Image subjects to pin", catalog.summary.imageSubjectsNeedingResolution],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ConfigHub Helm Catalog</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172026;
      --muted: #5b6872;
      --line: #d9e0e6;
      --panel: #f7f9fb;
      --accent: #0b6bcb;
      --good: #16794c;
      --warn: #a05a00;
      --surface: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--surface);
      line-height: 1.45;
    }
    header, main, footer { max-width: 1180px; margin: 0 auto; padding: 28px 20px; }
    header { padding-top: 44px; border-bottom: 1px solid var(--line); }
    h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 4rem); line-height: 1.02; letter-spacing: 0; }
    h2 { margin: 36px 0 12px; font-size: 1.45rem; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 1.02rem; letter-spacing: 0; }
    p { max-width: 820px; color: var(--muted); }
    a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre {
      overflow-x: auto;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #0f1720;
      color: #e9f2ff;
    }
    .tagline { font-size: 1.2rem; color: var(--ink); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .card, .metric, .lane {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      padding: 14px;
    }
    .metric strong { display: block; font-size: 2rem; line-height: 1; color: var(--accent); }
    .metric span { display: block; margin-top: 8px; color: var(--muted); font-size: .92rem; }
    .catalog { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card dl { display: grid; grid-template-columns: 9.5rem 1fr; gap: 6px 10px; margin: 12px 0 0; }
    .card dt { color: var(--muted); }
    .card dd { margin: 0; }
    .status { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .82rem; border: 1px solid var(--line); }
    .status.good { color: var(--good); border-color: #9bd3b8; background: #f0fbf5; }
    .status.warn { color: var(--warn); border-color: #efca92; background: #fff8ed; }
    .lanes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .lane { background: var(--panel); }
    .bar { height: 8px; border-radius: 999px; background: #dfe7ee; overflow: hidden; margin-top: 12px; }
    .bar span { display: block; height: 100%; background: var(--accent); }
    footer { color: var(--muted); border-top: 1px solid var(--line); margin-top: 36px; }
    @media (max-width: 900px) {
      .grid, .catalog, .lanes { grid-template-columns: 1fr; }
      .card dl { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Use Helm charts. Ship ConfigHub variants.</h1>
    <p class="tagline">The catalog turns popular public Helm charts into reviewed cub installer packages, named variants, rendered objects, checks, and proof receipts.</p>
    <pre>cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir .tmp/redis --non-interactive --namespace redis</pre>
  </header>
  <main>
    <section aria-labelledby="proof-counters">
      <h2 id="proof-counters">Proof Counters</h2>
      <div class="grid">
        ${counters.map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works">How It Works</h2>
      <div class="lanes">
        <div class="lane">
          <h3>1. Render</h3>
          <p>Helm output is captured as a cub installer package and compared with regular Helm output.</p>
          <div class="bar"><span style="width: 100%"></span></div>
        </div>
        <div class="lane">
          <h3>2. Vary</h3>
          <p>Supported variants make common choices explicit: default, existing Secret, no CRDs, local storage, ingress, and similar paths.</p>
          <div class="bar"><span style="width: 100%"></span></div>
        </div>
        <div class="lane">
          <h3>3. Prove</h3>
          <p>Receipts record equivalence, scans, gates, ConfigHub upload, local live evidence, and latest-version promotion readiness.</p>
          <div class="bar"><span style="width: 100%"></span></div>
        </div>
      </div>
    </section>

    <section aria-labelledby="catalog">
      <h2 id="catalog">Catalog-Supported Charts</h2>
      <p>These entries are supported for the declared local-test scope. Production support remains blocked until the listed dispositions are closed.</p>
      <div class="catalog">
        ${entries.map(chartCard).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="latest">
      <h2 id="latest">Latest-Version Candidates</h2>
      <p>New upstream versions are candidates until their ConfigHub proof, live e2e, catalog status, production disposition, top-100, and top-500 lanes are regenerated.</p>
      ${markdownLikeTable([
        ["Chart", "Supported", "Candidate", "Status"],
        ...catalog.latestCandidates.map((row) => [row.chart, row.currentVersion, row.candidateVersion, row.readiness]),
      ])}
    </section>

    <section aria-labelledby="variants">
      <h2 id="variants">Variant Examples</h2>
      <p>These generated goldens show how catalog bases become downstream ConfigHub variants without hiding a Helm rerender.</p>
      <div class="catalog">
        <article class="card">
          <h3>Redis production variant</h3>
          <dl>
            <dt>From</dt><dd>redis/default</dd>
            <dt>Creates</dt><dd>redis/prod-us-east</dd>
            <dt>Model</dt><dd>Spaces, Units, labels, upstream links</dd>
            <dt>Proof</dt><dd><a href="../data/variant-goldens/redis-prod-us-east/README.md">Redis Creator golden</a></dd>
          </dl>
        </article>
        <article class="card">
          <h3>Managed overlay</h3>
          <dl>
            <dt>Chart</dt><dd>external-dns/external-dns</dd>
            <dt>Input</dt><dd>wrapper chart + platform values + customer overlay</dd>
            <dt>Model</dt><dd>render-time choices route to cub installer; post-render choices route to Creator</dd>
            <dt>Proof</dt><dd><a href="../data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md">ExternalDNS overlay golden</a></dd>
          </dl>
        </article>
      </div>
    </section>

    <section aria-labelledby="data">
      <h2 id="data">Generated Data</h2>
      <p>This static view is generated from repo artifacts. The machine-readable catalog is <a href="./catalog.json">catalog.json</a>.</p>
      <ul>
        <li><a href="../CATALOG.md">Root catalog</a></li>
        <li><a href="../data/top100-catalog-analysis/summary.md">Top-100 catalog analysis</a></li>
        <li><a href="../data/top500-catalog-analysis/summary.md">Top-500 catalog analysis</a></li>
        <li><a href="../data/latest-top20-refresh/promotion-readiness.md">Latest candidate promotion readiness</a></li>
        <li><a href="../data/runtime-gitops/summary.md">Runtime/GitOps first wave</a></li>
        <li><a href="../data/image-digest-workdown/summary.md">Image digest workdown</a></li>
        <li><a href="../data/next-ten-waves/summary.md">Next-ten execution waves</a></li>
      </ul>
    </section>
  </main>
  <footer>
    Generated from helm-expt proof data. Latest available chart versions and supported proof versions are intentionally shown separately.
  </footer>
</body>
</html>
`;
}

function chartCard(entry) {
  const latestStatus = entry.latest_status === "update-available" ? "warn" : "good";
  const latestLabel =
    entry.latest_status === "update-available"
      ? `candidate ${entry.latest_version}`
      : entry.latest_status === "current"
        ? "current"
        : "not checked";
  return `<article class="card">
          <h3>${escapeHtml(entry.chart)}</h3>
          <span class="status good">${escapeHtml(entry.catalog_status)}</span>
          <span class="status ${latestStatus}">${escapeHtml(latestLabel)}</span>
          <dl>
            <dt>Supported version</dt><dd>${escapeHtml(entry.version)}</dd>
            <dt>Start variant</dt><dd>${escapeHtml(entry.start_variant)}</dd>
            <dt>Variants</dt><dd>${escapeHtml(entry.supported_variants || entry.candidate_variants)}</dd>
            <dt>Package</dt><dd><a href="../${escapeHtml(entry.package_path)}">${escapeHtml(entry.package_path)}</a></dd>
            <dt>Chart proof</dt><dd><a href="../${escapeHtml(entry.catalog_path)}">CATALOG.md</a></dd>
          </dl>
        </article>`;
}

function markdownLikeTable(rows) {
  const [headers, ...body] = rows;
  return `<div class="card"><table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border-bottom: 1px solid var(--line); text-align: left; padding: 8px; vertical-align: top; }
        th { color: var(--muted); font-weight: 600; }
      </style>`;
}

function readme() {
  return `# Generated Public Site

This directory is generated from helm-expt catalog data.

\`\`\`sh
npm run site:generate
npm run site:verify
\`\`\`

Open \`site/index.html\` directly in a browser for the static catalog view.

Data source:

- \`data/top100-catalog-analysis/raw.json\`
- \`data/top500-catalog-analysis/raw.json\`
- \`data/latest-top20-refresh/promotion-readiness.csv\`
- \`data/runtime-gitops/wave1.csv\`
- \`data/image-digest-workdown/all-subjects.csv\`
- \`data/next-ten-waves/gap-review-wave.csv\`
- \`data/variant-goldens/redis-prod-us-east/\`
- \`data/managed-overlay-goldens/external-dns-customer-acme-prod/\`

Do not edit generated files in this directory by hand.
`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
