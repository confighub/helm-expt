#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";

const required = [
  {
    path: "docs/skills/README.md",
    phrases: ["not product proof tables", "do not make Pilot", "Keep live lanes serial"],
  },
  {
    path: "docs/skills/live-parity.md",
    phrases: ["Run only one live lane at a time", "cub installer", "runs/live-helm-confighub-compare"],
  },
  {
    path: "docs/skills/large-app-evidence-funnel.md",
    phrases: ["Units are rendered and uploaded", "Controller aggregate health is explained", "Consul"],
  },
  {
    path: "docs/skills/target-facts-and-lifecycle.md",
    phrases: ["existing Secrets", "minimum number of schedulable nodes", "not a ConfigHub worker requirement"],
  },
  {
    path: "docs/skills/hook-and-secret-lifecycle.md",
    phrases: ["Hooks are not proven by render parity", "Do not treat all Kubernetes Secrets the same", "data/secret-lifecycle/summary.md"],
  },
  {
    path: "docs/skills/serious-chart-playbooks.md",
    phrases: ["kube-prometheus-stack", "Consul", "Argo Workflows"],
  },
];

for (const item of required) {
  const absolute = join(repoRoot, item.path);
  check(existsSync(absolute), `${item.path} is missing`);
  const text = readFileSync(absolute, "utf8");
  for (const phrase of item.phrases) {
    check(text.includes(phrase), `${item.path} must mention ${phrase}`);
  }
  check(!/\bcub install\b/.test(text), `${item.path} must use cub installer, not cub install`);
}

console.log(`verified ${required.length} helm-expt skill document(s)`);
