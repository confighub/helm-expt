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

const menuGuidePages = [
  "site/index.html",
  "site/try.html",
  "site/charts/index.html",
  "site/variants.html",
  "site/journey.html",
  "site/operations.html",
  "site/docs.html",
  "site/hard-questions.html",
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

for (const file of menuGuidePages) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, "utf8");
  const header = text.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  if (/Generated at:\s*\d{4}-\d{2}-\d{2}T/.test(header)) {
    failures.push(`${file}: generated timestamp appears in the hero/header`);
  }
  const bannerIndex = header.indexOf("THIS IS AN EXPERIMENTAL TEST PAGE AND NOT REAL");
  const navIndex = header.indexOf("class=\"topbar\"");
  if (bannerIndex < 0) failures.push(`${file}: missing experimental banner in the hero/header`);
  else if (navIndex >= 0 && bannerIndex > navIndex) failures.push(`${file}: experimental banner must appear before the home/menu row`);
  const rawPathLinks = [...text.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .filter(([, , label]) => label.includes("../") || /\.md(#.*)?$/.test(label.trim()));
  for (const [, href, label] of rawPathLinks.slice(0, 5)) {
    failures.push(`${file}: raw file path shown as link text ${JSON.stringify(label)} for href ${JSON.stringify(href)}`);
  }
}

if (failures.length) {
  console.error("site UX contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`verified site UX contract: ${checks.length} page(s)`);
