#!/usr/bin/env node
// The fleet journey, driven by the assistant, with a gate.
//
// A platform SRE asks "where does this vulnerable image run, and how can I update it
// safely?" An assistant answers by naming, per environment, whether an image-digest
// change reaches the workloads or is shielded by an environment override. This proof
// gates that answer against the committed fleet blast-radius matrix, so it cannot
// misplace where the image runs or miss an environment. The reading is the easy
// part; the gate is the safe part. Deterministic, no live cluster.

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
  "ai-fleet-image.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-fleet-image");
const outputs = {
  facts: join(outputRoot, "fleet-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-fleet-image.mjs --generate
  node scripts/generate-ai-fleet-image.mjs --verify
  node scripts/generate-ai-fleet-image.mjs --self-test`);
  process.exit(1);
}

// A small quote-aware CSV parser, so an affected-objects field can hold commas.
function parseCsv(text) {
  const parseLine = (line) => {
    const fields = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') inQuote = !inQuote;
      else if (c === "," && !inQuote) {
        fields.push(cur);
        cur = "";
      } else cur += c;
    }
    fields.push(cur);
    return fields;
  };
  const lines = text.replace(/\r/g, "").trim().split("\n");
  const header = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = fields[i] ?? "";
    });
    return row;
  });
}

const splitObjects = (value) =>
  String(value ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();

// Read the committed fleet matrix and derive, per environment, whether the named
// image-digest change reaches the workloads or is shielded. This is the ground truth
// the answer is gated on.
function deriveFleet(matrixPath, changePath) {
  check(trackedExists(matrixPath), `fleet matrix is committed: ${relativeRepo(matrixPath)}`);
  const rows = parseCsv(readFileSync(matrixPath, "utf8")).filter(
    (r) => r.change_value_path === changePath,
  );
  check(rows.length > 0, `the matrix has rows for change path "${changePath}"`);
  return rows
    .map((r) => ({
      environment: r.environment,
      status: r.status,
      affectedObjects: splitObjects(r.affected_objects),
      shieldedBy: r.shielded_by ?? "",
    }))
    .sort((a, b) => a.environment.localeCompare(b.environment));
}

// The gate. Every environment the answer places the image in, and every one it calls
// shielded, must match the matrix, and every environment in the matrix must be
// answered.
function gate(answer, fleet) {
  const byEnv = new Map(fleet.map((f) => [f.environment, f]));
  for (const claim of answer.fleet ?? []) {
    const truth = byEnv.get(claim.environment);
    check(truth, `environment "${claim.environment}" exists in the matrix`);
    check(
      claim.status === truth.status,
      `environment "${claim.environment}" status "${claim.status}" matches the matrix "${truth.status}"`,
    );
    check(
      JSON.stringify([...(claim.affectedObjects ?? [])].sort()) ===
        JSON.stringify(truth.affectedObjects),
      `environment "${claim.environment}" affected objects match the matrix`,
    );
    if (truth.status === "shielded") {
      check(
        (claim.shieldedBy ?? "") === truth.shieldedBy,
        `environment "${claim.environment}" is shielded by "${truth.shieldedBy}"`,
      );
    }
  }
  const answered = new Set((answer.fleet ?? []).map((c) => c.environment));
  for (const f of fleet) {
    check(
      answered.has(f.environment),
      `the answer covers environment "${f.environment}" from the matrix`,
    );
  }
}

function buildSummary(scenario, fleet) {
  const runs = fleet.filter((f) => f.status === "propagates");
  const shielded = fleet.filter((f) => f.status === "shielded");
  const envList = (list) => list.map((f) => f.environment).sort().join(", ");
  return `# Where does this vulnerable image run, and how can I update it safely?

A platform SRE asks a keystone question about ${scenario.spec.image.chart}. The
assistant does the easy part, placing the image across the fleet; the gate does the
safe part, refusing to misplace it or miss an environment, by checking every claim
against the committed fleet blast-radius matrix.

## Where the image runs

Changing ${scenario.spec.image.changePath} reaches the workloads in
**${envList(runs)}**, ${runs[0]?.affectedObjects.length ?? 0} objects each, the Redis
StatefulSets.

## Where it is shielded

**${envList(shielded)}** ${shielded.length === 1 ? "is" : "are"} shielded: an
environment override pins ${scenario.spec.image.changePath} there, so a fleet-wide
change does not reach it. That is the trap the question is about, and it is why a safe
update rolls out to the reachable environments and handles the shielded one on its
own.

## The safe update

Change the digest at the base. It propagates to the reachable environments, two
objects each. The shielded environment keeps its pinned digest and needs a separate,
deliberate change, so nothing silently reverts or is silently missed.

## The gate

- Every environment the answer places the image in matches the matrix status.
- Every affected object list matches the matrix.
- Every shielded environment matches, including what shields it.
- Every environment in the matrix is answered, so none is dropped.

The self-test mutates the answer three ways, a shielded environment called reachable,
a wrong affected-object list, and a dropped environment, and confirms the gate rejects
each. So the answer is the assistant, and the fleet matrix is the authority.

## The limit

This reads a committed desired-configuration blast-radius matrix. It reports where a
digest change reaches or is shielded across recorded environments; it does not scan a
live cluster or a live registry for the running image.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The fleet facts the gate derived](./fleet-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-fleet-image.yaml)
- [The fleet blast-radius matrix](../../${scenario.spec.image.matrix})

Run:

\`\`\`bash
npm run ai-fleet-image:verify
npm run ai-fleet-image:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const matrixPath = join(repoRoot, s.spec.image.matrix);
  const fleet = deriveFleet(matrixPath, s.spec.image.changePath);
  gate(s.spec.answer, fleet);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiFleetImageReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      image: {
        chart: s.spec.image.chart,
        changePath: s.spec.image.changePath,
        matrix: s.spec.image.matrix,
        matrixSha256: sha256File(matrixPath),
      },
      counts: {
        environments: fleet.length,
        reachable: fleet.filter((f) => f.status === "propagates").length,
        shielded: fleet.filter((f) => f.status === "shielded").length,
      },
      gate: {
        statusMatch: true,
        affectedObjectsMatch: true,
        shieldingMatch: true,
        allEnvironmentsCovered: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiFleetImageFleetFacts",
      metadata: { name: s.metadata.name },
      spec: { fleet },
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiFleetImageAnswer",
      metadata: { name: s.metadata.name },
      spec: s.spec.answer,
    },
    receipt,
    summary: buildSummary(s, fleet),
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
  writeYaml(outputs.answer, report.answer);
  writeYaml(outputs.receipt, report.receipt);
  write(outputs.summary, report.summary);
  console.log(`wrote AI fleet-image example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI fleet-image example");
} else {
  const scenario = readYaml(scenarioPath);

  const unshield = structuredClone(scenario);
  const shieldedClaim = unshield.spec.answer.fleet.find((f) => f.status === "shielded");
  shieldedClaim.status = "propagates";
  expectFailure(
    () => build(unshield),
    "shielded-called-reachable fixture unexpectedly passed the gate",
  );

  const wrongObjects = structuredClone(scenario);
  const reachableClaim = wrongObjects.spec.answer.fleet.find(
    (f) => f.status === "propagates",
  );
  reachableClaim.affectedObjects = ["v1|ConfigMap|redis|invented"];
  expectFailure(
    () => build(wrongObjects),
    "wrong affected-objects fixture unexpectedly passed the gate",
  );

  const dropped = structuredClone(scenario);
  dropped.spec.answer.fleet = dropped.spec.answer.fleet.slice(1);
  expectFailure(
    () => build(dropped),
    "dropped-environment fixture unexpectedly passed the gate",
  );

  console.log("ai fleet-image self-test passed");
}
