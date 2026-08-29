#!/usr/bin/env node
// The entry-to-spine seam, checked against a real promotion.
//
// The gated upgrade-risk review approved redis 25.5.3 -> 27.0.0 as low-risk,
// anonymously, from committed renders. This proof checks that the governed
// ConfigHub promotion recorded in the live Upgrade App carried that exact reviewed
// upgrade through base -> development -> staging, in dependency order, and that the
// promotion bore out the review's verdict by adding and deleting nothing. So it uses
// a real ConfigHub promotion, deterministically, by reading its committed receipt.
// The review is the anonymous front door; the promotion is the governed spine.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  trackedExists,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const scenarioPath = join(
  repoRoot,
  "config-catalog",
  "demonstrations",
  "ai-promotion-handoff.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-promotion-handoff");
const outputs = {
  facts: join(outputRoot, "handoff-facts.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-promotion-handoff.mjs --generate
  node scripts/generate-ai-promotion-handoff.mjs --verify
  node scripts/generate-ai-promotion-handoff.mjs --self-test`);
  process.exit(1);
}

// Read the committed live promotion receipt and pull out the facts the handoff is
// gated on.
function derivePromotion(receiptPath) {
  check(
    trackedExists(receiptPath),
    `promotion receipt is committed: ${relativeRepo(receiptPath)}`,
  );
  const receipt = readYaml(receiptPath);
  const hub = receipt.spec?.configHub ?? {};
  const impact = hub.impact?.spaces ?? [];
  const waveFor = (space) => impact.find((s) => s.space === space)?.wave ?? null;
  return {
    currentVersion: receipt.spec?.source?.current?.version ?? null,
    candidateVersion: receipt.spec?.source?.candidate?.version ?? null,
    candidateDigest: receipt.spec?.source?.candidate?.digest ?? "",
    path: hub.chain?.path ?? "",
    developmentSpace: hub.chain?.development?.space ?? "",
    stagingSpace: hub.chain?.staging?.space ?? "",
    developmentWave: waveFor(hub.chain?.development?.space ?? ""),
    stagingWave: waveFor(hub.chain?.staging?.space ?? ""),
    planAdd: hub.candidatePlan?.add ?? null,
    planDelete: hub.candidatePlan?.delete ?? null,
    developmentResult: hub.promotions?.development?.result ?? "",
    stagingResult: hub.promotions?.staging?.result ?? "",
  };
}

// The gate. The review and the promotion must be about the same reviewed bytes, the
// promotion must run in dependency order, and its outcome must bear out the review.
function gate(scenario, promo) {
  const review = scenario.spec.review;
  const expected = scenario.spec.promotion;

  check(
    promo.currentVersion === review.fromVersion,
    `promotion's current version (${promo.currentVersion}) is the review's from version (${review.fromVersion})`,
  );
  check(
    promo.candidateVersion === review.toVersion,
    `promotion's candidate version (${promo.candidateVersion}) is the review's to version (${review.toVersion})`,
  );
  check(
    promo.candidateDigest.startsWith("sha256:"),
    "the promoted candidate is an immutable digest",
  );
  // Low-risk borne out: a low verdict means the promotion adds and deletes nothing.
  check(
    review.verdict === "low",
    `the review verdict is "low" (${review.verdict})`,
  );
  check(
    promo.planAdd === 0 && promo.planDelete === 0,
    `the promotion added and deleted nothing, bearing out the low-risk verdict (add=${promo.planAdd}, delete=${promo.planDelete})`,
  );
  // Ordered, governed promotion.
  check(
    promo.path === expected.expectedPath,
    `the promotion path (${promo.path}) matches the expected path (${expected.expectedPath})`,
  );
  check(
    typeof promo.developmentWave === "number" &&
      typeof promo.stagingWave === "number" &&
      promo.developmentWave < promo.stagingWave,
    `development promotes before staging (dev wave ${promo.developmentWave} < staging wave ${promo.stagingWave})`,
  );
  check(
    promo.developmentResult === "pass" && promo.stagingResult === "pass",
    "both the development and staging promotions passed",
  );
}

function buildSummary(scenario, promo) {
  const review = scenario.spec.review;
  return `# The review approved it. Does a governed promotion carry the same bytes?

The gated upgrade-risk review approved ${review.chart} ${review.fromVersion} to
${review.toVersion} as ${review.verdict}-risk, anonymously, from committed renders.
This proof checks that the governed ConfigHub promotion recorded in the live Upgrade
App carried that exact reviewed upgrade through the environments in order, and that
the promotion bore out the verdict. It reads a real promotion receipt, so the spine
is real, not modelled.

## The handoff

- The promotion moved ${promo.currentVersion} to ${promo.candidateVersion}, the same
  upgrade the review approved.
- The promoted candidate is an immutable digest (${promo.candidateDigest.slice(0, 19)}...).
- The path is ${promo.path}, and development promotes first (wave
  ${promo.developmentWave}) with staging behind it (wave ${promo.stagingWave}).
- Both promotions passed, and the candidate plan added nothing and deleted nothing,
  which is what a low-risk verdict predicts.

So the anonymous review is the front door and the governed promotion is the spine,
and they carry the same reviewed bytes from one to the other.

## The gate

- The promotion's from and to versions are the review's from and to versions.
- The promoted candidate is an immutable digest.
- The low verdict is borne out: the promotion added and deleted nothing.
- The promotion ran base to development to staging, development before staging, both
  passing.

The self-test mutates the claim three ways, a wrong candidate version, a flipped
verdict, and a reversed path, and confirms the gate rejects each. So the claim is the
handoff, and the live promotion receipt is the authority.

## The limit

This reads the committed receipt of a promotion that already ran on throwaway
clusters. It does not run a new promotion. The live run and its evidence are the
Upgrade App proof this one points to.

## Open the evidence

- [The handoff facts the gate derived](./handoff-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-promotion-handoff.yaml)
- [The gated upgrade-risk review](../ai-upgrade-risk/summary.md)
- [The live Upgrade App promotion](../redis-upgrade-app-proof/summary.md)

Run:

\`\`\`bash
npm run ai-promotion-handoff:verify
npm run ai-promotion-handoff:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const receiptPath = join(repoRoot, s.spec.promotion.receipt);
  const promo = derivePromotion(receiptPath);
  gate(s, promo);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiPromotionHandoffReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      review: s.spec.review,
      promotion: {
        receipt: s.spec.promotion.receipt,
        receiptSha256: sha256File(receiptPath),
        path: promo.path,
        candidateVersion: promo.candidateVersion,
        candidateDigest: promo.candidateDigest,
        developmentWave: promo.developmentWave,
        stagingWave: promo.stagingWave,
      },
      gate: {
        sameUpgrade: true,
        immutableDigest: true,
        verdictBorneOut: true,
        orderedAndPassed: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiPromotionHandoffFacts",
      metadata: { name: s.metadata.name },
      spec: promo,
    },
    receipt,
    summary: buildSummary(s, promo),
  };
}

function expectFailure(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  check(threw, message);
}

const report = build();

if (mode === "--generate") {
  writeYaml(outputs.facts, report.facts);
  writeYaml(outputs.receipt, report.receipt);
  write(outputs.summary, report.summary);
  console.log(`wrote AI promotion-handoff example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI promotion-handoff example");
} else {
  const scenario = readYaml(scenarioPath);

  const wrongVersion = structuredClone(scenario);
  wrongVersion.spec.review.toVersion = "28.0.0";
  expectFailure(
    () => build(wrongVersion),
    "wrong candidate version fixture unexpectedly passed the gate",
  );

  const flippedVerdict = structuredClone(scenario);
  flippedVerdict.spec.review.verdict = "elevated";
  expectFailure(
    () => build(flippedVerdict),
    "flipped verdict fixture unexpectedly passed the gate",
  );

  const reversedPath = structuredClone(scenario);
  reversedPath.spec.promotion.expectedPath = "base -> staging -> development";
  expectFailure(
    () => build(reversedPath),
    "reversed path fixture unexpectedly passed the gate",
  );

  console.log("ai promotion-handoff self-test passed");
}
