#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const expectedOrg = "helm-catalog";
const targetRef = "bitnami-redis-27-0-0-stage-pilot-live-20260705/oci-target";
const baselineFilterRef = "platform/helm-catalog-checks";
const approvalFilterRef = "platform/helm-catalog-prod-gates";
const receiptPath = join(
  repoRoot,
  "runs",
  "config-catalog-policy-functional-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "apply-policy-functional-proof",
  "summary.md",
);
const lifecycleReceiptPath = join(
  repoRoot,
  "data",
  "hooks-crds-app",
  "live-receipt.yaml",
);

const gates = {
  placeholder: "platform/vet-placeholders/vet-placeholders",
  schema: "platform/vet-schemas/vet-schemas",
  lifecycle: "platform/lifecycle-route-evidence/vet-cel",
  approval: "platform/require-approval/vet-approvedby",
};
const warnings = [
  "platform/digest-pinned-images/vet-cel",
  "platform/probes-declared/vet-cel",
];

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run the generator`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run config-catalog:policy:generate`,
  );
  console.log("verified the ConfigHub apply-policy functional proof");
} else {
  console.error(
    `Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify`,
  );
  process.exitCode = 2;
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_POLICY_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_POLICY_PROOF=1 to confirm this live-org proof",
  );
  check(context, "set CUB_CONTEXT to an authenticated helm-catalog context");
  check(tryCommand("cub", ["version"]).ok, "cub is required for the policy proof");

  const contextInfo = jsonCommand("cub", ["context", "get", context, "-o", "json"], {
    env: cubEnv(context),
  });
  check(
    contextInfo.metadata?.organizationName === expectedOrg,
    `refusing to run in organization ${contextInfo.metadata?.organizationName ?? "unknown"}; expected ${expectedOrg}`,
  );

  const topology = readTopology(context);
  const lifecycleReceipt = readYaml(lifecycleReceiptPath);
  verifyLifecycleReceipt(lifecycleReceipt);

  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const spaces = {
    baseline: `hx-policy-baseline-${runId}`,
    approval: `hx-policy-approval-${runId}`,
  };
  const cleanup = {
    baselineSpace: "not-created",
    approvalSpace: "not-created",
  };
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-policy-proof-"));
  let receipt;

  try {
    for (const slug of Object.values(spaces)) {
      check(
        !cubTry(context, ["space", "get", slug, "-o", "json"]).ok,
        `refusing to reuse existing proof Space ${slug}`,
      );
    }

    createSpace(context, {
      slug: spaces.baseline,
      filter: baselineFilterRef,
      labels: {
        ApplyPolicyProfile: "catalog-standard",
        Proof: "config-catalog-policy-functional",
        ResourceClass: "user-workload",
      },
    });
    cleanup.baselineSpace = "pending";

    createSpace(context, {
      slug: spaces.approval,
      filter: approvalFilterRef,
      labels: {
        ApplyPolicyProfile: "catalog-standard",
        Proof: "config-catalog-policy-functional",
        ResourceClass: "system-configuration",
      },
    });
    cleanup.approvalSpace = "pending";

    assertSpaceTriggers(context, spaces.baseline, topology.baseline.triggerIds);
    assertSpaceTriggers(context, spaces.approval, topology.approvalRequired.triggerIds);

    const fixtures = writeFixtures(tempRoot);
    const placeholder = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "placeholder-fixture",
      path: fixtures.placeholder,
      expectedGate: gates.placeholder,
    });
    const schema = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "schema-fixture",
      path: fixtures.schema,
      expectedGate: gates.schema,
    });
    const warning = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "warning-fixture",
      path: fixtures.warning,
      expectedWarnings: warnings,
    });
    const approval = createAndReadFixture(context, {
      space: spaces.approval,
      slug: "approval-fixture",
      path: fixtures.approval,
      expectedGate: gates.approval,
    });

    const placeholderApply = blockedDryRun(context, spaces.baseline, "placeholder-fixture", gates.placeholder);
    const schemaApply = blockedDryRun(context, spaces.baseline, "schema-fixture", gates.schema);
    const warningApply = allowedDryRun(context, spaces.baseline, "warning-fixture");
    const approvalApply = blockedDryRun(context, spaces.approval, "approval-fixture", gates.approval);

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "ConfigCatalogApplyPolicyFunctionalProofReceipt",
      metadata: {
        name: "catalog-standard-live-functional",
      },
      spec: {
        recordedAt: new Date().toISOString(),
        context: {
          name: context,
          organization: expectedOrg,
          purpose: "temporary live policy fixtures",
        },
        target: {
          ref: targetRef,
          id: warning.unit.TargetID,
          dryRunOnly: true,
        },
        filters: {
          baseline: topology.baseline,
          approvalRequired: topology.approvalRequired,
        },
        checks: {
          placeholder: checkRecord(placeholder, placeholderApply, {
            effect: "block",
            gate: gates.placeholder,
            finding: "unresolved ConfigHub placeholder",
          }),
          schema: checkRecord(schema, schemaApply, {
            effect: "block",
            gate: gates.schema,
            finding: "invalid Kubernetes field type",
          }),
          warnings: {
            effect: "warn",
            findings: [
              "workload image is not pinned by digest",
              "workload container has no liveness or readiness probe",
            ],
            triggers: warnings,
            space: spaces.baseline,
            unit: "warning-fixture",
            unitId: warning.unit.UnitID,
            validationKeys: Object.keys(warning.unit.ValidationResults ?? {}).sort(),
            applyGates: Object.keys(warning.unit.ApplyGates ?? {}).sort(),
            dryRunApply: warningApply,
          },
          approval: checkRecord(approval, approvalApply, {
            effect: "block",
            gate: gates.approval,
            finding: "system configuration has no recorded approval",
          }),
          lifecycleRoute: {
            effect: "block",
            finding: "automatic lifecycle route has no observed evidence",
            gate: gates.lifecycle,
            result: "blocked",
            receipt: relativeRepo(lifecycleReceiptPath),
            testedAt: lifecycleReceipt.spec.negativeGateTest.testedAt,
          },
        },
        cleanup,
        limits: [
          "Every apply command used --dry-run. No fixture configuration was applied to Kubernetes.",
          "The target was used only to exercise ConfigHub's apply boundary; this run does not test workload health or controller convergence.",
          "The fixtures prove the recorded checks for these exact inputs. They do not prove that every possible invalid configuration is detected.",
          "The lifecycle-route result comes from the separately recorded Hooks and CRDs App fixture.",
        ],
      },
      status: {
        result: "pass",
        claim: "The live catalog policy blocked a placeholder, invalid Kubernetes data, and unapproved system configuration; reported two advisory workload findings without blocking a dry run; and separately blocked an unsupported automatic lifecycle route.",
      },
    };
  } finally {
    for (const [key, slug] of [
      ["approvalSpace", spaces.approval],
      ["baselineSpace", spaces.baseline],
    ]) {
      const exists = cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      if (!exists) {
        cleanup[key] = cleanup[key] === "pending" ? "fail" : "not-created";
        continue;
      }
      const deleted = cubTry(context, [
        "space",
        "delete",
        slug,
        "--recursive-force",
        "--quiet",
      ]);
      const absent = !cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      cleanup[key] = deleted.ok && absent ? "pass" : "fail";
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }

  check(receipt, "the policy proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `policy proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function createSpace(context, { slug, filter, labels }) {
  cub(context, [
    "space",
    "create",
    slug,
    ...Object.entries(labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]),
    "--trigger-filter",
    filter,
    "--where-trigger",
    "-",
    "--quiet",
  ]);
  cub(context, ["space", "update", "--patch", slug, "--refresh-triggers", "--quiet"]);
}

function assertSpaceTriggers(context, slug, expectedTriggerIds) {
  const space = cubJson(context, ["space", "get", slug, "-o", "json"]).Space;
  check(
    sameSet(space.TriggerIDs ?? [], expectedTriggerIds),
    `${slug} received the wrong Trigger set`,
  );
}

function writeFixtures(root) {
  const fixtures = {
    placeholder: {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "policy-placeholder-fixture",
        namespace: "default",
      },
      data: {
        "required-value": "confighubplaceholder",
      },
    },
    schema: {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "policy-schema-fixture",
        namespace: "default",
      },
      spec: {
        replicas: "many",
        selector: {
          matchLabels: {
            app: "policy-schema-fixture",
          },
        },
        template: {
          metadata: {
            labels: {
              app: "policy-schema-fixture",
            },
          },
          spec: {
            containers: [
              {
                name: "fixture",
                image: `example.invalid/fixture@sha256:${"0".repeat(64)}`,
                livenessProbe: {
                  httpGet: {
                    path: "/",
                    port: 8080,
                  },
                },
                readinessProbe: {
                  httpGet: {
                    path: "/",
                    port: 8080,
                  },
                },
              },
            ],
          },
        },
      },
    },
    warning: {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "policy-warning-fixture",
        namespace: "default",
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: "policy-warning-fixture",
          },
        },
        template: {
          metadata: {
            labels: {
              app: "policy-warning-fixture",
            },
          },
          spec: {
            containers: [
              {
                name: "fixture",
                image: "nginx:1.27",
              },
            ],
          },
        },
      },
    },
    approval: {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "policy-approval-fixture",
        namespace: "default",
      },
      data: {
        purpose: "prove that system configuration requires approval",
      },
    },
  };

  return Object.fromEntries(
    Object.entries(fixtures).map(([name, value]) => {
      const path = join(root, `${name}.yaml`);
      writeFileSync(path, `${toYaml(value)}\n`);
      return [name, path];
    }),
  );
}

function createAndReadFixture(
  context,
  {
    space,
    slug,
    path,
    expectedGate = "",
    expectedWarnings = [],
  },
) {
  cub(context, [
    "unit",
    "create",
    "--space",
    space,
    slug,
    path,
    "--label",
    "Proof=config-catalog-policy-functional",
    "--change-desc",
    "Create a temporary apply-policy proof fixture",
    "--quiet",
  ]);
  cub(context, ["unit", "set-target", "--space", space, slug, targetRef, "--quiet"]);
  const unit = waitForResult(context, {
    space,
    slug,
    expectedGate,
    expectedWarnings,
  });
  check(unit.TargetID, `${space}/${slug} has no target`);
  return { space, slug, unit };
}

function waitForResult(
  context,
  {
    space,
    slug,
    expectedGate,
    expectedWarnings,
  },
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const unit = cubJson(context, ["unit", "get", slug, "--space", space, "-o", "json"]).Unit;
    const gateFound = !expectedGate || unit.ApplyGates?.[expectedGate] === true;
    const validationKeys = Object.keys(unit.ValidationResults ?? {});
    const warningsFound = expectedWarnings.every((key) => validationKeys.includes(key));
    const waiting = unit.ApplyGates?.["awaiting/triggers"] === true;
    if (gateFound && warningsFound && !waiting) return unit;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`${space}/${slug} did not receive its expected policy result within 60 seconds`);
}

function blockedDryRun(context, space, slug, expectedGate) {
  const result = spawnCub(context, [
    "unit",
    "apply",
    "--space",
    space,
    slug,
    "--dry-run",
    "--wait",
    "-o",
    "json",
  ]);
  const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim();
  check(result.status !== 0, `${space}/${slug} was not blocked`);
  check(
    output.includes(expectedGate),
    `${space}/${slug} failed without naming ${expectedGate}: ${output.slice(0, 500)}`,
  );
  return {
    result: "blocked",
    exitCode: result.status,
    gate: expectedGate,
    dryRun: true,
  };
}

function allowedDryRun(context, space, slug) {
  const result = spawnCub(context, [
    "unit",
    "apply",
    "--space",
    space,
    slug,
    "--dry-run",
    "--wait",
    "-o",
    "json",
  ]);
  check(
    result.status === 0,
    `${space}/${slug} warning-only dry run failed: ${result.stderr || result.stdout}`,
  );
  const operation = JSON.parse(result.stdout);
  check(operation.DryRun === true, `${space}/${slug} did not return a dry-run operation`);
  return {
    result: "allowed",
    exitCode: 0,
    dryRun: true,
    queuedOperationId: operation.QueuedOperationID,
  };
}

function checkRecord(fixture, dryRunApply, { effect, gate, finding }) {
  return {
    effect,
    finding,
    gate,
    space: fixture.space,
    unit: fixture.slug,
    unitId: fixture.unit.UnitID,
    validationKeys: Object.keys(fixture.unit.ValidationResults ?? {}).sort(),
    applyGates: Object.keys(fixture.unit.ApplyGates ?? {}).sort(),
    dryRunApply,
  };
}

function readTopology(context) {
  const refs = {
    baseline: {
      filter: baselineFilterRef,
      triggers: [
        "platform/digest-pinned-images",
        "platform/lifecycle-route-evidence",
        "platform/probes-declared",
        "platform/vet-placeholders",
        "platform/vet-schemas",
      ],
    },
    approvalRequired: {
      filter: approvalFilterRef,
      triggers: [
        "platform/digest-pinned-images",
        "platform/lifecycle-route-evidence",
        "platform/probes-declared",
        "platform/require-approval",
        "platform/vet-placeholders",
        "platform/vet-schemas",
      ],
    },
  };

  return Object.fromEntries(
    Object.entries(refs).map(([name, definition]) => {
      const filter = getByRef(context, "filter", definition.filter).Filter;
      const triggers = definition.triggers.map(
        (ref) => getByRef(context, "trigger", ref).Trigger,
      );
      return [name, {
        ref: definition.filter,
        id: filter.FilterID,
        hash: String(filter.Hash ?? "").trim(),
        triggerRefs: definition.triggers,
        triggerIds: triggers.map((trigger) => trigger.TriggerID).sort(),
      }];
    }),
  );
}

function getByRef(context, entity, ref) {
  const [space, slug] = ref.split("/");
  return cubJson(context, [entity, "get", "--space", space, slug, "-o", "json"]);
}

function verifyLifecycleReceipt(receipt) {
  check(receipt.kind === "HooksCrdsAppLiveReceipt", "Hooks and CRDs receipt kind changed");
  check(
    receipt.spec?.negativeGateTest?.result === "blocked"
      && receipt.spec?.negativeGateTest?.gate === gates.lifecycle,
    "Hooks and CRDs receipt no longer proves the lifecycle-route gate",
  );
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "ConfigCatalogApplyPolicyFunctionalProofReceipt",
    "policy functional receipt kind changed",
  );
  check(receipt.status?.result === "pass", "policy functional proof is not pass");
  check(receipt.spec?.context?.organization === expectedOrg, "policy proof organization changed");
  check(receipt.spec?.target?.dryRunOnly === true, "policy proof must be dry-run only");
  check(receipt.spec?.target?.ref === targetRef, "policy proof target changed");

  for (const [name, gate] of [
    ["placeholder", gates.placeholder],
    ["schema", gates.schema],
    ["approval", gates.approval],
  ]) {
    const result = receipt.spec?.checks?.[name];
    check(result?.effect === "block", `${name} is no longer blocking`);
    check(result?.gate === gate, `${name} gate changed`);
    check(result?.applyGates?.includes(gate), `${name} gate was not recorded on the Unit`);
    check(
      result?.dryRunApply?.result === "blocked"
        && result?.dryRunApply?.dryRun === true
        && result?.dryRunApply?.gate === gate,
      `${name} dry-run block is incomplete`,
    );
  }

  const warning = receipt.spec?.checks?.warnings;
  check(warning?.effect === "warn", "workload findings are no longer advisory");
  check(sameSet(warning?.triggers ?? [], warnings), "warning Trigger set changed");
  check(sameSet(warning?.validationKeys ?? [], warnings), "warning results changed");
  check((warning?.applyGates ?? []).length === 0, "warning-only Unit gained an ApplyGate");
  check(
    warning?.dryRunApply?.result === "allowed"
      && warning?.dryRunApply?.dryRun === true
      && warning?.dryRunApply?.exitCode === 0,
    "warning-only dry-run apply did not pass",
  );

  const lifecycle = receipt.spec?.checks?.lifecycleRoute;
  check(
    lifecycle?.result === "blocked"
      && lifecycle?.gate === gates.lifecycle
      && lifecycle?.receipt === relativeRepo(lifecycleReceiptPath),
    "lifecycle-route proof reference changed",
  );
  verifyLifecycleReceipt(readYaml(lifecycleReceiptPath));
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "policy proof cleanup did not pass",
  );
  check(
    !JSON.stringify(receipt).includes(["cub", "lk"].join("-"))
      && !JSON.stringify(receipt).includes(["cub", "lk"].join(" ")),
    "policy proof contains an obsolete cluster command",
  );
}

function renderSummary(receipt) {
  const checks = receipt.spec.checks;
  return `# What the live catalog policy blocks

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from a committed live receipt. Rerun the isolated fixtures with \`npm run config-catalog:policy:run\`; check the committed result without contacting ConfigHub with \`npm run config-catalog:policy:verify\`.

The test created temporary configuration records in the live \`helm-catalog\` organization. It then asked ConfigHub to perform dry-run applies. No fixture configuration was sent to Kubernetes.

| Configuration tested | What ConfigHub did |
| --- | --- |
| A ConfigMap containing an unresolved placeholder | Blocked it |
| A Deployment whose replica count was text instead of a number | Blocked it |
| A Deployment with an unpinned image and no health probes | Reported both warnings and allowed the dry run |
| System configuration with no approval | Blocked it |
| A lifecycle route claiming automatic work without evidence | Blocked it in the separately recorded Hooks and CRDs test |

The first three fixtures used the five common checks. The system-configuration fixture used those checks plus required approval. This confirms that approval is added where it is needed without turning ordinary warnings into blockers.

All temporary Spaces were deleted. The target was used only to exercise ConfigHub's apply boundary with \`--dry-run\`; this did not test a Kubernetes rollout or application health.

- [Committed functional receipt](../../runs/config-catalog-policy-functional-proof/receipt.yaml)
- [Live filter and Space assignments](../apply-policy-profiles/live-helm-catalog.yaml)
- [Hooks and CRDs policy receipt](../hooks-crds-app/live-receipt.yaml)
- [Maintained policy definition](../../config-catalog/policies/catalog-standard.yaml)
`;
}

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: cubEnv(context),
  });
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnv(context),
  });
}

function cubJson(context, args) {
  return JSON.parse(cub(context, args));
}

function spawnCub(context, args) {
  return spawnSync("cub", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(context),
    maxBuffer: 1024 * 1024 * 100,
  });
}

function cubEnv(context) {
  return {
    ...process.env,
    CONFIGHUB_AGENT: "1",
    CUB_CONTEXT: context,
  };
}

function jsonCommand(file, args, options = {}) {
  return JSON.parse(command(file, args, options));
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, out: command(file, args, options) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
    };
  }
}

function safeRunId(value) {
  const compact = String(value)
    .replace(/\D/g, "")
    .slice(0, 14);
  check(compact.length >= 8, "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits");
  return compact;
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
