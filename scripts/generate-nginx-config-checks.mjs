#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, parseDocs, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "nginx-config-checks");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  csv: join(outputRoot, "checks.csv"),
};

const variants = [
  {
    name: "http-clusterip",
    allowedKinds: new Set(["NetworkPolicy", "PodDisruptionBudget", "ServiceAccount", "Service", "Deployment"]),
    allowedVolumes: new Set(["empty-dir"]),
    expectedIngress: false,
  },
  {
    name: "existing-tls-ingress",
    allowedKinds: new Set(["NetworkPolicy", "PodDisruptionBudget", "ServiceAccount", "Service", "Deployment", "Ingress"]),
    allowedVolumes: new Set(["empty-dir", "certificate"]),
    expectedIngress: true,
  },
];

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run nginx:config-checks`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run nginx:config-checks`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run nginx:config-checks`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run nginx:config-checks`);
  console.log(`verified NGINX config checks for ${variants.length} supported variant(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-nginx-config-checks.mjs --generate
  node scripts/generate-nginx-config-checks.mjs --verify`);
}

function buildReport() {
  const rows = variants.flatMap(checkVariant);
  const failures = rows.filter((row) => row.result !== "pass");
  const csv = toCsv(rows);
  const summary = `# NGINX Config Extension Checks

This generated report checks the two supported NGINX base variants for the
specific extension-slot risk described in the user docs: custom NGINX config
text, raw manifests, git-cloned content, metrics add-ons, and sidecars should
not appear silently in the supported bases.

This is not an \`nginx -t\` semantic config validation. The current supported
bases use the chart's default NGINX config from the image, so there is no custom
\`nginx.conf\` or \`conf.d\` content to validate. If a future base fills
\`serverBlock\`, \`streamServerBlock\`, \`extraDeploy\`, metrics, sidecars, or
git-clone values, it should add an NGINX-specific config validation receipt.

## Result

~~~text
variants checked: ${variants.length}
checks:           ${rows.length}
pass:             ${rows.length - failures.length}
fail:             ${failures.length}
~~~

| Variant | Check | Result | Evidence |
| --- | --- | --- | --- |
${rows.map((row) => `| ${row.variant} | ${row.check} | ${row.result} | ${row.evidence} |`).join("\n")}

## Routing Rule

| Change | Route |
| --- | --- |
| Leave NGINX extension slots empty. | Use the supported catalog base. |
| Fill NGINX config text, raw manifests, sidecars, metrics, or git-clone values. | Create a new reviewed \`cub installer\` base variant and add NGINX config validation. |
| Change target, region, labels, gates, or observation policy after render. | Use a derived ConfigHub variant. |

Regenerate:

~~~sh
npm run nginx:config-checks
npm run nginx:config-checks:verify
~~~
`;

  return { rows, csv, summary };
}

function checkVariant(variant) {
  const renderedPath = join(repoRoot, "recipes", "bitnami", "nginx", "24.0.2", "revisions", variant.name, "r001", "rendered", "release-objects.yaml");
  const docs = parseDocs(readFileSync(renderedPath, "utf8"));
  const deployment = docs.find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "nginx");
  check(deployment, `${variant.name} Deployment missing`);
  const podSpec = deployment.spec?.template?.spec ?? {};
  const containers = podSpec.containers ?? [];
  const initContainers = podSpec.initContainers ?? [];
  const volumes = podSpec.volumes ?? [];
  const serviceNames = docs.filter((doc) => doc.kind === "Service").map((doc) => doc.metadata?.name).filter(Boolean);
  const kinds = new Set(docs.map((doc) => doc.kind).filter(Boolean));

  return [
    row(
      variant,
      "no ConfigMap-backed nginx.conf or conf.d content",
      !kinds.has("ConfigMap") && !hasConfigMapVolume(volumes),
      "rendered objects contain no ConfigMap and no configMap volume",
    ),
    row(
      variant,
      "no raw extraDeploy object kinds",
      [...kinds].every((kind) => variant.allowedKinds.has(kind)),
      `rendered kinds: ${[...kinds].sort().join(", ")}`,
    ),
    row(
      variant,
      "no sidecars",
      containers.length === 1 && containers[0]?.name === "nginx",
      `containers: ${containers.map((container) => container.name).join(", ")}`,
    ),
    row(
      variant,
      "no git-clone init container",
      initContainers.map((container) => container.name).join(",") === "preserve-logs-symlinks",
      `initContainers: ${initContainers.map((container) => container.name).join(", ") || "(none)"}`,
    ),
    row(
      variant,
      "no metrics add-on service or ServiceMonitor",
      !kinds.has("ServiceMonitor") && !serviceNames.some((name) => /metrics/i.test(name)),
      `services: ${serviceNames.join(", ")}`,
    ),
    row(
      variant,
      "only expected volumes are mounted",
      volumes.every((volume) => variant.allowedVolumes.has(volume.name)),
      `volumes: ${volumes.map((volume) => volume.name).join(", ")}`,
    ),
    row(
      variant,
      "ingress shape matches variant",
      docs.some((doc) => doc.kind === "Ingress") === variant.expectedIngress,
      variant.expectedIngress ? "Ingress expected and rendered" : "Ingress not expected and not rendered",
    ),
  ];
}

function hasConfigMapVolume(volumes) {
  return volumes.some((volume) => Boolean(volume.configMap));
}

function row(variant, name, result, evidence) {
  return {
    variant: variant.name,
    check: name,
    result: result ? "pass" : "fail",
    evidence,
  };
}

function toCsv(rows) {
  const headers = ["variant", "check", "result", "evidence"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
