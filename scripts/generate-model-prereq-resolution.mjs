import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const generate = args.includes("--generate");
const verify = args.includes("--verify");

if (!generate && !verify) {
  console.log(`Usage:
  node scripts/generate-model-prereq-resolution.mjs --generate
  node scripts/generate-model-prereq-resolution.mjs --verify`);
  process.exit(1);
}

const outDir = join(repoRoot, "data", "model-prereq-resolution");
const outputPaths = {
  csv: join(outDir, "resolution.csv"),
  json: join(outDir, "resolution.json"),
  summary: join(outDir, "summary.md"),
};

const modelRows = readCsv(join(repoRoot, "data", "model-gap-workdown", "workdown.csv"));
const prereqRows = readCsv(join(repoRoot, "data", "target-prerequisite-workdown", "workdown.csv"));
const targetActionRows = readCsv(join(repoRoot, "data", "target-prerequisite-actions", "actions.csv"));
const targetActionByKey = new Map(targetActionRows.map((row) => [rowKey(row), row]));

function legacyNamespaceNormalization(label) {
  return {
    resolutionPath: "semantic-normalization",
    variantRole: "legacy image-retention base",
    recommended: `keep ${label} as the retained-image base; normalize the installer Namespace support object before treating K parity as green`,
    firstStep: "record the Namespace support object as expected installer scaffolding rather than a Helm semantic difference",
    evidenceNeeded: "fresh K receipt with the Namespace support object normalized, or an explicit watch disposition if that normalization is not accepted",
  };
}

function modelResolution(row) {
  const manual = MODEL_RESOLUTIONS[`${row.chart}@${row.version}#${row.base}#${row.lane}`];
  check(Boolean(manual), `missing model resolution for ${row.chart}@${row.version} ${row.base} ${row.lane}`);
  const existingOffRamp = row.sibling_base_passes && row.sibling_base_passes !== "none" ? row.sibling_base_passes : "";
  return {
    source_queue: "model-gap",
    chart: row.chart,
    version: row.version,
    base: row.base,
    lane: row.lane,
    current_result: row.result,
    gap_kind: row.model_gap_kind,
    resolution_path: manual.resolutionPath,
    variant_role: manual.variantRole,
    recommended_variant_or_action: manual.recommended,
    existing_off_ramp: existingOffRamp,
    first_step: manual.firstStep,
    evidence_needed: manual.evidenceNeeded,
    rerun_command: row.rerun_command,
    source_evidence: row.evidence_path,
  };
}

function prereqResolution(row) {
  const action = targetActionByKey.get(rowKey(row));
  check(Boolean(action), `missing target-prerequisite action packet for ${row.chart}@${row.version} ${row.base} ${row.lane}`);
  const path = targetResolutionPath(row, action);
  return {
    source_queue: "target-prerequisite",
    chart: row.chart,
    version: row.version,
    base: row.base,
    lane: row.lane,
    current_result: row.result,
    gap_kind: row.prerequisite_kind,
    resolution_path: path.resolutionPath,
    variant_role: path.variantRole,
    recommended_variant_or_action: path.recommended,
    existing_off_ramp: "",
    first_step: path.firstStep,
    evidence_needed: action.evidence_required,
    rerun_command: row.rerun_command,
    source_evidence: row.evidence_path,
  };
}

const MODEL_RESOLUTIONS = {
  "autoscaler/cluster-autoscaler@9.57.0#controller-default-reviewed#K": {
    resolutionPath: "target-fact-generator-on-existing-base",
    variantRole: "existing values-profile base",
    recommended: "keep controller-default-reviewed; add a generator or explicit target-fact binding for autoDiscovery.clusterName and awsRegion",
    firstStep: "teach the recipe how the cluster name and AWS region are supplied for this target profile",
    evidenceNeeded: "fresh K receipt showing the rendered controller base reaches semantic parity after target facts are generated or bound",
  },
  "aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1#default#K": {
    resolutionPath: "target-scoped-base-or-normalization",
    variantRole: "target-scoped platform base",
    recommended: "add an eks-managed target scope or semantic normalization for the installer Namespace support object",
    firstStep: "separate vanilla-kind parity from the AWS/EKS topology claim recorded in target-topology.yaml",
    evidenceNeeded: "fresh K or target-profile receipt that names the AWS/EKS topology and explains any support object normalization",
  },
  "bitnami/apache@11.4.29#legacy#K": legacyNamespaceNormalization("apache legacy"),
  "bitnami/contour@21.1.4#no-crds#K": {
    resolutionPath: "external-crds-base",
    variantRole: "CRD ownership base",
    recommended: "treat no-crds as an external-crds base, or add an explicit external-crds alias with CRD target prerequisites",
    firstStep: "make the CRD ownership choice visible in the base name and target-prerequisite action packet",
    evidenceNeeded: "fresh K receipt after CRDs are staged, or a CRD-rendering sibling selected as the supported base",
  },
  "bitnami/elasticsearch@22.1.6#legacy#K": legacyNamespaceNormalization("elasticsearch legacy"),
  "bitnami/opensearch@2.0.10#legacy#K": legacyNamespaceNormalization("opensearch legacy"),
  "bitnami/opensearch@2.0.10#default#K": {
    resolutionPath: "semantic-normalization",
    variantRole: "existing base with normalization",
    recommended: "normalize installer support objects and target-served defaulted fields before deciding whether a smaller single-node base is needed",
    firstStep: "inspect the K receipt diffs and add only justified semantic normalization, not a blind variant",
    evidenceNeeded: "fresh K receipt with zero unexplained semantic diffs, or a new single-node base with its own render receipt",
  },
  "bitnami/opensearch@2.0.10#ha#K": {
    resolutionPath: "semantic-normalization-or-smaller-base",
    variantRole: "HA base after normalization",
    recommended: "keep ha as the topology base, but normalize support objects and decide whether a single-node-local base is needed",
    firstStep: "inspect the HA K receipt diffs and split target topology from semantic noise",
    evidenceNeeded: "fresh K receipt for ha, or a new single-node-local base plus receipts if HA is too target-specific",
  },
  "bitnami/phpmyadmin@20.0.0#legacy#K": legacyNamespaceNormalization("phpmyadmin legacy"),
  "bitnami/spark@10.0.3#legacy#K": legacyNamespaceNormalization("spark legacy"),
  "bitnami/zookeeper@13.8.7#legacy#K": legacyNamespaceNormalization("zookeeper legacy"),
  "grafana/pyroscope@2.0.2#ha#K": {
    resolutionPath: "use-existing-sibling-or-split-crds",
    variantRole: "HA base with CRD ownership boundary",
    recommended: "prefer default or no-crds where HA is not required; keep ha only after CRD lifecycle is split or staged",
    firstStep: "route HA users to the existing K-pass siblings unless the HA topology itself is needed",
    evidenceNeeded: "existing default/no-crds K pass receipt, or fresh ha K receipt after CRD lifecycle handling",
  },
  "hashicorp/terraform@1.1.2#default#K": {
    resolutionPath: "crd-ownership-base-or-target-action",
    variantRole: "CRD ownership base plus target prerequisite",
    recommended: "prefer no-crds with required Secrets staged, or keep default as the CRD-rendering base with lifecycle review",
    firstStep: "separate Terraform Workspace CRD ownership from the Secret prerequisites needed by the controller",
    evidenceNeeded: "fresh K receipt for no-crds after Secrets are staged, or a CRD lifecycle receipt for default",
  },
  "nats/nack@0.34.0#default#K": {
    resolutionPath: "use-existing-sibling-base",
    variantRole: "CRD ownership off-ramp",
    recommended: "prefer no-crds for K parity; keep default as the CRD-rendering base with lifecycle review",
    firstStep: "mark no-crds as the first K-safe base and keep default scoped to CRD-owning targets",
    evidenceNeeded: "existing no-crds K pass receipt plus any future default CRD lifecycle receipt",
  },
  "nats/nats@2.14.0#ha#K": {
    resolutionPath: "use-existing-sibling-or-normalize-ha",
    variantRole: "HA topology base",
    recommended: "prefer default where HA is not required; normalize ha only if HA remains a supported user choice",
    firstStep: "decide whether HA is a supported public base for this chart or a target-scoped advanced base",
    evidenceNeeded: "existing default K pass receipt, or fresh ha K receipt after normalization",
  },
  "nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18#default#G/P": {
    resolutionPath: "new-storage-base-variant",
    variantRole: "storage target base",
    recommended: "add storage-default-reviewed with nfs.server and nfs.path modeled as render-time inputs or target facts",
    firstStep: "replace the implicit default with a base that names the NFS server contract before render and before delivery",
    evidenceNeeded: "Helm equivalence, scan/gate, target-prerequisite action, and fresh G/P receipt for the storage-default-reviewed base",
  },
  "prometheus-community/kube-prometheus-stack@86.1.0#default#K": {
    resolutionPath: "use-existing-sibling-base",
    variantRole: "CRD ownership off-ramp",
    recommended: "prefer no-crds for K parity; keep default as the CRD-rendering base with CRD lifecycle review",
    firstStep: "make no-crds the first K-safe base for 86.1.0 and leave default scoped to CRD-owning targets",
    evidenceNeeded: "existing no-crds K pass receipt plus CRD lifecycle receipts for default",
  },
  "prometheus-community/prometheus-adapter@5.3.0#cluster-metrics-readonly#G/P": {
    resolutionPath: "use-existing-capability-base",
    variantRole: "capability-profile base",
    recommended: "prefer apiservice-v1-capability on targets that serve apiregistration.k8s.io/v1",
    firstStep: "route users from cluster-metrics-readonly to apiservice-v1-capability when APIService v1 is required",
    evidenceNeeded: "existing apiservice-v1-capability G/P pass receipt and a catalog note that explains the off-ramp",
  },
  "prometheus-community/prometheus-adapter@5.3.0#default#G/P": {
    resolutionPath: "use-existing-capability-base",
    variantRole: "capability-profile base",
    recommended: "prefer apiservice-v1-capability on targets that serve apiregistration.k8s.io/v1",
    firstStep: "route users from default to apiservice-v1-capability when APIService v1 is required",
    evidenceNeeded: "existing apiservice-v1-capability G/P pass receipt and a catalog note that explains the off-ramp",
  },
  "traefik/traefik@40.2.0#default#K": {
    resolutionPath: "use-existing-sibling-base",
    variantRole: "CRD ownership off-ramp",
    recommended: "prefer no-crds for K parity; add external-crds as the user-facing name if the current no-crds label is too implementation-shaped",
    firstStep: "align the Traefik CRD ownership vocabulary with the wave-2 real variant work order",
    evidenceNeeded: "existing no-crds K pass receipt, plus a renamed or aliased external-crds base if chosen",
  },
  "velero/velero@12.0.1#default#G/P": {
    resolutionPath: "new-provider-base-variant",
    variantRole: "provider and credential base",
    recommended: "add aws-s3-existing-secret, azure-blob-existing-secret, or filesystem-backup-node-agent as real rendered bases",
    firstStep: "implement the first Velero provider base from catalog-promotion-wave2 and bind backup credentials as target facts",
    evidenceNeeded: "Helm equivalence, scan/gate, ConfigHub proof, and fresh G/P receipt for the chosen provider base",
  },
  "velero/velero@12.0.1#default#K": {
    resolutionPath: "new-provider-base-variant",
    variantRole: "provider and credential base",
    recommended: "add aws-s3-existing-secret, azure-blob-existing-secret, or filesystem-backup-node-agent as real rendered bases",
    firstStep: "implement the first Velero provider base from catalog-promotion-wave2 and bind backup credentials as target facts",
    evidenceNeeded: "Helm equivalence, scan/gate, ConfigHub proof, and fresh K receipt for the chosen provider base",
  },
  "velero/velero@12.0.1#no-crds#G/P": {
    resolutionPath: "new-provider-base-variant",
    variantRole: "provider and credential base with external CRDs",
    recommended: "add a provider-specific no-crds base only after the provider base is rendered and proved",
    firstStep: "start with a provider base, then split CRD ownership if the target supplies Velero CRDs",
    evidenceNeeded: "provider base proof first, then fresh no-crds G/P receipt with CRDs staged",
  },
};

function targetResolutionPath(row, action) {
  if (action.action_kind === "stage-secret") {
    return {
      resolutionPath: "derived-target-variant",
      variantRole: "target-bound derived variant",
      recommended: `bind ${row.prerequisite_name} as a target fact on a derived ConfigHub variant`,
      firstStep: "create or reference the Secret in the target, then bind it through the target-prerequisite action packet",
    };
  }
  if (action.action_kind === "create-namespace") {
    return {
      resolutionPath: "derived-target-variant",
      variantRole: "target-bound derived variant",
      recommended: `stage ${humanPrereq(row)} before delivery and attach the namespace choice to the target variant`,
      firstStep: "create the Namespace or make namespace creation an explicit preflight step for this target",
    };
  }
  if (action.action_kind === "install-crds") {
    return {
      resolutionPath: "crd-ownership-base-or-target-action",
      variantRole: "CRD ownership base plus target prerequisite",
      recommended: `use a CRD-rendering base, or keep ${row.base} as external-crds with the CRDs staged first`,
      firstStep: "choose whether this target owns CRDs through the base or through an external prerequisite",
    };
  }
  if (action.action_kind === "provide-storage-or-topology") {
    return {
      resolutionPath: "target-scoped-base",
      variantRole: "platform topology base",
      recommended: `scope this base to targets that provide ${humanPrereq(row)}`,
      firstStep: "record the platform target shape and do not treat vanilla kind as the authoritative target for this base",
    };
  }
  if (action.action_kind === "provide-external-service") {
    return {
      resolutionPath: "stack-or-target-fact-variant",
      variantRole: "stack-derived variant",
      recommended: "bind the upstream endpoint as a target fact, or create a stack variant that includes the dependency",
      firstStep: "identify the upstream service or API the workload expects, then encode it as a target fact or stack dependency",
    };
  }
  if (action.action_kind === "unknown-preflight") {
    return {
      resolutionPath: "new-base-variant-after-input-identification",
      variantRole: "base variant if rendered objects change",
      recommended: "identify the missing input, then decide whether it belongs in a base variant or a target fact",
      firstStep: "replace the unknown prerequisite with a named chart value, Secret, namespace, CRD, or external dependency",
    };
  }
  return {
    resolutionPath: "operator-review-first",
    variantRole: "no variant until cause is known",
    recommended: "review the runtime residue before creating a variant",
    firstStep: "inspect pod events/logs and classify the missing condition before modeling a base or target fact",
  };
}

function humanPrereq(row) {
  return row.prerequisite_name && row.prerequisite_name !== "unknown" ? row.prerequisite_name : `the ${row.prerequisite_kind} prerequisite`;
}

function rowKey(row) {
  return `${row.chart}@${row.version}#${row.base}#${row.lane}`;
}

function rowSortKey(row) {
  return `${row.source_queue}#${row.chart}@${row.version}#${row.base}#${row.lane}`;
}

function summary(rows) {
  const lines = [];
  lines.push("# Model And Prerequisite Resolution Plan");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-model-prereq-resolution.mjs`. Do not hand-edit.");
  lines.push("Regenerate with `npm run model-prereq-resolution`.");
  lines.push("");
  lines.push("This is the execution bridge for current B1/B2 rows. It does not mark");
  lines.push("anything fixed. It assigns every model gap and target-prerequisite row to");
  lines.push("one product path: a new base variant, an existing sibling base, a derived");
  lines.push("target variant, a target-scoped platform policy, or operator review before");
  lines.push("any variant should be created.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Rows |");
  lines.push("| --- | ---: |");
  lines.push(`| Total rows | ${rows.length} |`);
  lines.push(`| Model-gap rows | ${rows.filter((row) => row.source_queue === "model-gap").length} |`);
  lines.push(`| Target-prerequisite rows | ${rows.filter((row) => row.source_queue === "target-prerequisite").length} |`);
  lines.push("");
  table(lines, "Rows by resolution path", countBy(rows, "resolution_path"));
  table(lines, "Rows by variant role", countBy(rows, "variant_role"));
  lines.push("## Rows");
  lines.push("");
  lines.push("| Queue | Chart | Base | Lane | Resolution | Variant role | First step |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.source_queue} | \`${row.chart}@${row.version}\` | ${row.base} | ${row.lane} | ${row.resolution_path} | ${row.variant_role} | ${escapeCell(row.first_step)} |`,
    );
  }
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- A row here is not fixed until its required evidence is recorded and the");
  lines.push("  source matrix cell changes through the normal generated surfaces.");
  lines.push("- A new base variant is recommended only when the Helm-rendered object shape");
  lines.push("  changes or the catalog needs a clear render-time fork.");
  lines.push("- A derived target variant is recommended only when the object shape is already");
  lines.push("  correct and the remaining work is target binding, such as a Secret,");
  lines.push("  Namespace, external endpoint, approval, or target profile.");
  lines.push("- Operator-review rows deliberately do not name a variant yet.");
  lines.push("");
  lines.push("Machine-readable form:");
  lines.push("");
  lines.push("- [resolution.csv](./resolution.csv)");
  lines.push("- [resolution.json](./resolution.json)");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function table(lines, title, counts) {
  lines.push(`### ${title}`);
  lines.push("");
  lines.push("| Value | Rows |");
  lines.push("| --- | ---: |");
  for (const [key, count] of Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`| \`${key}\` | ${count} |`);
  }
  lines.push("");
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function assertFresh(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing; run npm run model-prereq-resolution`);
  check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run model-prereq-resolution`);
}

function readCsv(path) {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  const header = rows.shift();
  return rows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function csv(rows, columns) {
  return `${[columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

const rows = [
  ...modelRows.map((row) => modelResolution(row)),
  ...prereqRows.map((row) => prereqResolution(row)),
].sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)));

const expected = {
  csv: csv(rows, [
    "source_queue",
    "chart",
    "version",
    "base",
    "lane",
    "current_result",
    "gap_kind",
    "resolution_path",
    "variant_role",
    "recommended_variant_or_action",
    "existing_off_ramp",
    "first_step",
    "evidence_needed",
    "rerun_command",
    "source_evidence",
  ]),
  json: `${JSON.stringify({ generatedBy: "scripts/generate-model-prereq-resolution.mjs", rows }, null, 2)}\n`,
  summary: summary(rows),
};

if (generate) {
  write(outputPaths.csv, expected.csv);
  write(outputPaths.json, expected.json);
  write(outputPaths.summary, expected.summary);
  console.log(`wrote model/prereq resolution plan for ${rows.length} row(s)`);
} else {
  assertFresh(outputPaths.csv, expected.csv);
  assertFresh(outputPaths.json, expected.json);
  assertFresh(outputPaths.summary, expected.summary);
  console.log(`verified model/prereq resolution plan for ${rows.length} row(s)`);
}
