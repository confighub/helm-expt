#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const scenarioPath = join(
  repoRoot,
  "config-catalog",
  "demonstrations",
  "ai-change-review.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-change-review");
const outputs = {
  proposal: join(outputRoot, "proposal.yaml"),
  reviewed: join(outputRoot, "reviewed.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-change-review.mjs --generate
  node scripts/generate-ai-change-review.mjs --verify
  node scripts/generate-ai-change-review.mjs --self-test`);
  process.exit(1);
}

const report = build();

if (mode === "--generate") {
  writeYaml(outputs.proposal, report.proposal);
  writeYaml(outputs.reviewed, report.reviewed);
  writeYaml(outputs.receipt, report.receipt);
  write(outputs.summary, report.summary);
  console.log(`wrote AI change review example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  verifyFile(outputs.proposal, `${toYaml(report.proposal)}\n`);
  verifyFile(outputs.reviewed, `${toYaml(report.reviewed)}\n`);
  verifyFile(outputs.receipt, `${toYaml(report.receipt)}\n`);
  verifyFile(outputs.summary, report.summary);
  console.log("verified AI change review example");
} else {
  const brokenScenario = structuredClone(report.scenario);
  brokenScenario.spec.reviewed.operations[1].value[0].value =
    "confighubplaceholder";
  expectFailure(
    () => build(brokenScenario),
    "reviewed placeholder fixture unexpectedly passed",
  );

  const overCapacity = structuredClone(report.scenario);
  overCapacity.spec.reviewed.operations[0].value = 5;
  expectFailure(
    () => build(overCapacity),
    "reviewed over-capacity fixture unexpectedly passed",
  );

  console.log("verified AI change review self-test");
}

function build(scenarioOverride) {
  const scenario = scenarioOverride ?? readYaml(scenarioPath);
  check(
    scenario.kind === "AIChangeReviewScenario",
    "AI change review scenario kind is invalid",
  );
  check(
    scenario.spec?.policyProfile === "catalog-standard",
    "AI change review must use catalog-standard",
  );
  const sourceRelative = scenario.spec?.source?.object;
  const sourcePath = join(repoRoot, sourceRelative);
  check(existsSync(sourcePath), `AI change review source is missing: ${sourceRelative}`);
  const source = readYaml(sourcePath);
  check(
    source.kind === "ClusterTrainingRuntime",
    "AI change review source must be a ClusterTrainingRuntime",
  );

  const proposal = applyOperations(source, scenario.spec.proposal.operations);
  const reviewed = applyOperations(source, scenario.spec.reviewed.operations);
  const proposalChecks = inspectCandidate(
    proposal,
    scenario.spec.targetFacts.maxTrainingNodes,
  );
  const reviewedChecks = inspectCandidate(
    reviewed,
    scenario.spec.targetFacts.maxTrainingNodes,
  );

  check(
    proposalChecks.placeholders.result === "fail",
    "unchecked proposal must contain the recorded placeholder",
  );
  check(
    proposalChecks.imagesPinned.result === "fail",
    "unchecked proposal must contain the recorded mutable image",
  );
  check(
    proposalChecks.targetCapacity.result === "fail",
    "unchecked proposal must exceed the recorded target capacity",
  );
  check(
    reviewedChecks.placeholders.result === "pass",
    "reviewed candidate must remove placeholders",
  );
  check(
    reviewedChecks.imagesPinned.result === "pass",
    "reviewed candidate must keep images pinned by digest",
  );
  check(
    reviewedChecks.targetCapacity.result === "pass",
    "reviewed candidate must stay within the recorded target capacity",
  );
  check(
    secretReference(reviewed) ===
      `${scenario.spec.targetFacts.credentialSecret}/${scenario.spec.targetFacts.credentialKey}`,
    "reviewed candidate must use the recorded credential Secret",
  );
  check(
    scenario.status?.proposalDecision === "rejected",
    "proposal decision must remain rejected",
  );
  check(
    scenario.status?.reviewedDecision === "awaiting-human-approval",
    "reviewed candidate must remain awaiting approval",
  );
  for (const field of ["configHubFunctions", "apply", "liveObservation"]) {
    check(
      scenario.status?.[field] === "not-run",
      `AI change review must keep ${field} as not-run`,
    );
  }

  const proposalText = `${toYaml(proposal)}\n`;
  const reviewedText = `${toYaml(reviewed)}\n`;
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AIChangeReviewReceipt",
    metadata: {
      name: scenario.metadata.name,
    },
    spec: {
      source: {
        object: sourceRelative,
        sha256: sha256File(sourcePath),
        baseRecord: scenario.spec.source.baseRecord,
      },
      request: scenario.spec.request,
      targetFacts: scenario.spec.targetFacts,
      proposal: {
        object: relativeRepo(outputs.proposal),
        sha256: hash(proposalText),
        operations: changeRows(source, scenario.spec.proposal.operations),
        checks: proposalChecks,
        decision: scenario.status.proposalDecision,
      },
      reviewed: {
        object: relativeRepo(outputs.reviewed),
        sha256: hash(reviewedText),
        operations: changeRows(source, scenario.spec.reviewed.operations),
        checks: reviewedChecks,
        decision: scenario.status.reviewedDecision,
      },
      policy: {
        profile: scenario.spec.policyProfile,
        effects: {
          placeholders: "block",
          imagesPinned: "warn",
          targetCapacity: "app-specific-block",
          productionApproval: "block",
        },
      },
    },
    status: {
      result: "partial",
      configHubFunctions: scenario.status.configHubFunctions,
      approval: "not-run",
      apply: scenario.status.apply,
      liveObservation: scenario.status.liveObservation,
      limits: [
        "The proposal is a deterministic fixture, not a transcript from a named AI model.",
        "The repository checks ran locally. ConfigHub Functions did not run against this candidate.",
        "The reviewed candidate has not been approved, applied, or observed on a cluster.",
      ],
    },
  };

  return {
    scenario,
    proposal,
    reviewed,
    receipt,
    summary: renderSummary(scenario, receipt),
  };
}

function inspectCandidate(object, maxTrainingNodes) {
  const placeholders = findValues(
    object,
    (value) =>
      typeof value === "string" && value.includes("confighubplaceholder"),
  );
  const images = findKeys(object, "image");
  const mutableImages = images.filter(
    ({ value }) =>
      typeof value !== "string" || !/@sha256:[a-f0-9]{64}$/.test(value),
  );
  const numNodes = object.spec?.mlPolicy?.numNodes;
  return {
    structuralParse: {
      result:
        object.apiVersion && object.kind && object.metadata?.name && object.spec
          ? "pass"
          : "fail",
      note: "The file parses and has the required top-level Kubernetes fields. A ConfigHub schema check has not run.",
    },
    placeholders: {
      result: placeholders.length ? "fail" : "pass",
      paths: placeholders.map(({ path }) => path),
    },
    imagesPinned: {
      result: mutableImages.length ? "fail" : "pass",
      paths: mutableImages.map(({ path }) => path),
    },
    targetCapacity: {
      result:
        Number.isInteger(numNodes) && numNodes <= maxTrainingNodes
          ? "pass"
          : "fail",
      requestedNodes: numNodes,
      maxTrainingNodes,
    },
    probesDeclared: {
      result: "not-applicable",
      note: "This object is a training runtime template, not a Deployment.",
    },
  };
}

function applyOperations(source, operations) {
  const result = structuredClone(source);
  for (const operation of operations) {
    check(["add", "replace"].includes(operation.op), `unsupported patch op ${operation.op}`);
    const { parent, key } = pointerParent(result, operation.path);
    if (operation.op === "replace") {
      check(
        Object.hasOwn(parent, key) || (Array.isArray(parent) && Number(key) < parent.length),
        `replace path is missing: ${operation.path}`,
      );
    }
    parent[key] = structuredClone(operation.value);
  }
  return result;
}

function changeRows(source, operations) {
  return operations.map((operation) => ({
    op: operation.op,
    path: operation.path,
    before: valueAtPointer(source, operation.path) ?? null,
    after: operation.value,
  }));
}

function pointerParent(object, pointer) {
  const tokens = pointerTokens(pointer);
  check(tokens.length > 0, "patch path must not be the document root");
  const key = tokens.pop();
  let parent = object;
  for (const token of tokens) {
    check(parent?.[token] !== undefined, `patch parent is missing: ${pointer}`);
    parent = parent[token];
  }
  return { parent, key };
}

function valueAtPointer(object, pointer) {
  let value = object;
  for (const token of pointerTokens(pointer)) {
    if (value?.[token] === undefined) return undefined;
    value = value[token];
  }
  return structuredClone(value);
}

function pointerTokens(pointer) {
  check(pointer.startsWith("/"), `invalid JSON pointer ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function findValues(value, predicate, path = "") {
  const matches = [];
  if (predicate(value)) matches.push({ path: path || "/", value });
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      matches.push(...findValues(item, predicate, `${path}/${index}`));
    });
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      matches.push(...findValues(item, predicate, `${path}/${key}`));
    }
  }
  return matches;
}

function findKeys(value, wantedKey, path = "") {
  const matches = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      matches.push(...findKeys(item, wantedKey, `${path}/${index}`));
    });
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = `${path}/${key}`;
      if (key === wantedKey) matches.push({ path: nextPath, value: item });
      matches.push(...findKeys(item, wantedKey, nextPath));
    }
  }
  return matches;
}

function secretReference(object) {
  const env =
    object.spec?.template?.spec?.replicatedJobs?.[0]?.template?.spec?.template
      ?.spec?.containers?.[0]?.env ?? [];
  const entry = env.find((item) => item.name === "AI_API_KEY");
  const ref = entry?.valueFrom?.secretKeyRef;
  return ref ? `${ref.name}/${ref.key}` : "";
}

function renderSummary(scenario, receipt) {
  const proposal = receipt.spec.proposal;
  const reviewed = receipt.spec.reviewed;
  return `# AI change review: stop a bad training change before it ships

This example starts with the AICR PyTorch training runtime already committed in
the catalog. The request is to increase the runtime to eight H100 nodes and
update its image.

The unchecked proposal does three concrete things: asks for more nodes than the
recorded target has, replaces a digest-pinned image with \`latest\`, and leaves
the API key as \`confighubplaceholder\`. The proposal is rejected before apply.

The reviewed candidate stays within the four-node target limit, keeps the pinned
image, and reads the API key from the existing
\`${scenario.spec.targetFacts.credentialSecret}\` Secret. It is ready for human
review; it has not been approved or applied.

This is a deterministic example of an agent-produced change. It is not a
transcript from a named model.

## What changed

| Check | Unchecked proposal | Reviewed candidate |
| --- | --- | --- |
| Requested training nodes | ${proposal.checks.targetCapacity.requestedNodes}; target limit is ${proposal.checks.targetCapacity.maxTrainingNodes} | ${reviewed.checks.targetCapacity.requestedNodes}; target limit is ${reviewed.checks.targetCapacity.maxTrainingNodes} |
| Image | mutable tag; warning | digest pinned; pass |
| API key | unresolved placeholder; block | existing Secret reference; pass |
| ConfigHub schema function | not run | not run |
| Production approval | not reached | required, not run |
| Apply and observation | not run | not run |

## Open the evidence

- [Unchecked proposal](./proposal.yaml)
- [Reviewed candidate](./reviewed.yaml)
- [Receipt](./receipt.yaml)
- [Maintained scenario](../../config-catalog/demonstrations/ai-change-review.yaml)
- [AICR source object](../../${scenario.spec.source.object})
- [Standard apply policy](../../config-catalog/policies/catalog-standard.yaml)

Run:

\`\`\`bash
npm run ai-change-review:verify
npm run ai-change-review:self-test
\`\`\`
`;
}

function verifyFile(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing; run npm run ai-change-review`);
  check(
    readFileSync(path, "utf8") === expected,
    `${relativeRepo(path)} is stale; run npm run ai-change-review`,
  );
}

function expectFailure(fn, message) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  check(failed, message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
