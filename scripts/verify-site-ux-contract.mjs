#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "site/index.html",
    terms: ["What Is ConfigHub?", "Helm is good.", "ConfigHub helps you run Helm at scale", "Component", "base variant is a render-time Helm/recipe install shape"],
  },
  {
    file: "site/variants.html",
    terms: ["Component And Variant Model", "payments-api/prod-us", "One named configuration instance of a Component"],
  },
  {
    file: "site/try.html",
    terms: ["You should see something like this", "Expected Results And Clusters", "out/secrets"],
  },
  {
    file: "site/charts/index.html",
    terms: ["id=\"chart-filter\"", "Helm Catalog", "chart versions shown"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["Redis Teaching Path", "How Do I Run This Chart With cub?", "Adoption Caveats Versus Plain Helm", "redis-existing-secret"],
  },
  {
    file: "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html",
    terms: ["Serious Chart Example", "CRDs", "target facts"],
  },
  {
    file: "site/hard-questions.html",
    terms: ["My Helm chart broke", "What is safe for AI to change?", "SSA conflict gap"],
  },
  {
    file: "site/known-gaps.html",
    terms: ["Known Gaps We Surface", "Fixed placeholder credentials", "SSA conflict ergonomics"],
  },
  {
    file: "site/docs.html",
    terms: ["AI-assisted changes", "Broken chart triage", "Known gaps we surface", "Expected results and clusters", "Per-chart cub adoption caveats"],
  },
  {
    file: "site/how-it-works.html",
    terms: ["Three adoption caveats we manage", "managed cub-direct applier", "cub adoption caveats"],
  },
];

const failures = [];

for (const check of checks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.file}: missing file`);
    continue;
  }
  const text = fs.readFileSync(fullPath, "utf8");
  for (const term of check.terms) {
    if (!text.includes(term)) failures.push(`${check.file}: missing ${JSON.stringify(term)}`);
  }
}

if (failures.length) {
  console.error("site UX contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`verified site UX contract: ${checks.length} page(s)`);
