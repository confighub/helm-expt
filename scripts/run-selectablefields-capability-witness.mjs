#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, parseDocs, readYaml, relativeRepo, repoRoot, sha256File, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--summary";
const all = process.argv.includes("--all");
const chartOption = optionValue("--chart");
const outputRoot = join(repoRoot, "data", "capability-profile-witnesses", "selectablefields");
const summaryCsvPath = join(outputRoot, "summary.csv");
const summaryMdPath = join(outputRoot, "summary.md");

const targets = [
  {
    chart: "jetstack/cert-manager",
    version: "v1.20.2",
    base: "crds-enabled",
    renderedPath: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml",
    olderWatchlistProfile: "kind-kubernetes-1.30",
    olderWatchlistIssue: "Kubernetes 1.30 omitted spec.versions[0].selectableFields on four rendered cert-manager CRDs after apply.",
  },
  {
    chart: "external-secrets/external-secrets",
    version: "2.5.0",
    base: "default",
    renderedPath: "recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/rendered/release-objects.yaml",
    olderWatchlistProfile: "kind-kubernetes-1.30",
    olderWatchlistIssue: "Kubernetes 1.30 omitted spec.versions[0].selectableFields on the rendered ExternalSecret CRD after apply.",
  },
];

if (mode === "--run") {
  for (const target of selectedTargets()) runTarget(target);
  writeSummary();
} else if (mode === "--summary") {
  writeSummary();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-selectablefields-capability-witness.mjs --run --all
  node scripts/run-selectablefields-capability-witness.mjs --run --chart external-secrets/external-secrets
  node scripts/run-selectablefields-capability-witness.mjs --summary
  node scripts/run-selectablefields-capability-witness.mjs --verify`);
}

function selectedTargets() {
  if (all) return targets;
  check(chartOption, "--chart is required unless --all is set");
  const target = targets.find((item) => item.chart === chartOption);
  check(Boolean(target), `unknown selectableFields target ${chartOption}`);
  return [target];
}

function runTarget(target) {
  const runRoot = mkdtempSync(join(tmpdir(), "helm-expt-selectablefields-"));
  const cluster = `hx-select-${slug(target.chart).slice(0, 12)}-${Date.now().toString(36).slice(-5)}`;
  const kubeconfig = join(runRoot, "kubeconfig");
  const context = `kind-${cluster}`;
  const renderedPath = join(repoRoot, target.renderedPath);
  const renderedDocs = parseDocs(readFileSync(renderedPath, "utf8"));
  const renderedCrds = renderedDocs.filter((doc) => doc.kind === "CustomResourceDefinition");
  const selectableCrds = renderedCrds
    .map((doc) => selectableSummary(doc))
    .filter((item) => item.versions.some((version) => version.selectableFields.length > 0));
  check(selectableCrds.length > 0, `${target.chart} rendered set has no selectableFields CRDs`);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CapabilityProfileWitnessReceipt",
    metadata: { name: `${slug(target.chart)}-${target.base}-selectablefields-kind-v1-35` },
    spec: {
      chart: target.chart,
      version: target.version,
      base: target.base,
      observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      result: "blocked",
      capabilityProfile: {
        name: "kind-kubernetes-1.35",
        kindNodeImage: "kindest/node:v1.35.0",
        serverVersion: "",
      },
      olderWatchlistProfile: target.olderWatchlistProfile,
      olderWatchlistIssue: target.olderWatchlistIssue,
      renderedObjectSet: {
        path: target.renderedPath,
        sha256: sha256File(renderedPath),
      },
      run: {
        mode: "single-kind-cluster-crd-server-apply-witness",
        cluster,
        kubeContext: context,
        cleanup: { result: "not-run" },
      },
      renderedSelectableFields: selectableCrds,
      liveSelectableFields: [],
      comparison: [],
      checks: [],
      notClaimed: [
        "strict rendered/live parity on Kubernetes 1.30",
        "all Kubernetes distributions preserve selectableFields",
        "workload runtime health; this witness only checks the CRD capability/profile behavior",
      ],
    },
  };

  const record = (name, fn) => {
    try {
      const detail = fn();
      receipt.spec.checks.push({ name, result: "pass", detail: String(detail ?? "pass").slice(0, 2000) });
      return true;
    } catch (error) {
      receipt.spec.checks.push({ name, result: "blocked", detail: errorText(error) });
      return false;
    }
  };

  let clusterCreated = false;
  try {
    record("kind-create", () => {
      must("kind", ["create", "cluster", "--name", cluster, "--image", "kindest/node:v1.35.0", "--kubeconfig", kubeconfig, "--wait", "300s"], 720);
      clusterCreated = true;
      const version = JSON.parse(kubectl(kubeconfig, context, ["version", "-o", "json"], 60));
      receipt.spec.capabilityProfile.serverVersion = version.serverVersion?.gitVersion ?? "";
      check(receipt.spec.capabilityProfile.serverVersion.startsWith("v1.35."), `expected v1.35 server, got ${receipt.spec.capabilityProfile.serverVersion}`);
      return `created ${cluster} with ${receipt.spec.capabilityProfile.serverVersion}`;
    });

    if (clusterCreated) {
      record("apply-selectablefields-crds", () => {
        const crdPath = join(runRoot, "selectablefields-crds.yaml");
        writeYaml(crdPath, { apiVersion: "v1", kind: "List", items: renderedCrds.filter((doc) => selectableCrds.some((item) => item.name === doc.metadata?.name)) });
        kubectl(kubeconfig, context, ["apply", "--server-side", "--force-conflicts", "-f", crdPath], 300);
        for (const crd of selectableCrds) kubectl(kubeconfig, context, ["wait", "--for=condition=Established", `crd/${crd.name}`, "--timeout=180s"], 210);
        return `applied and established ${selectableCrds.length} selectableFields CRD(s)`;
      });
    }

    if (clusterCreated) {
      record("compare-live-selectablefields", () => {
        const live = [];
        const comparison = [];
        for (const expected of selectableCrds) {
          const doc = JSON.parse(kubectl(kubeconfig, context, ["get", "crd", expected.name, "-o", "json"], 60));
          const actual = selectableSummary(doc);
          live.push(actual);
          const expectedMap = new Map(expected.versions.map((version) => [version.name, version.selectableFields.join("\n")]));
          const actualMap = new Map(actual.versions.map((version) => [version.name, version.selectableFields.join("\n")]));
          for (const [version, expectedFields] of expectedMap.entries()) {
            const actualFields = actualMap.get(version) ?? "";
            comparison.push({
              crd: expected.name,
              version,
              result: expectedFields === actualFields ? "pass" : "blocked",
              renderedSelectableFields: expectedFields.split("\n").filter(Boolean),
              liveSelectableFields: actualFields.split("\n").filter(Boolean),
            });
          }
        }
        receipt.spec.liveSelectableFields = live;
        receipt.spec.comparison = comparison;
        const blocked = comparison.filter((item) => item.result !== "pass");
        check(blocked.length === 0, `${blocked.length} selectableFields comparison(s) blocked`);
        return `${comparison.length} CRD version selectableFields comparison(s) passed`;
      });
    }
  } finally {
    if (clusterCreated) {
      const cleanup = run("kind", ["delete", "cluster", "--name", cluster, "--kubeconfig", kubeconfig], 300);
      receipt.spec.run.cleanup = {
        result: cleanup.status === 0 ? "pass" : "blocked",
        detail: `${cleanup.stdout}\n${cleanup.stderr}`.trim(),
      };
    }
    receipt.spec.result = receipt.spec.checks.every((item) => item.result === "pass") && receipt.spec.run.cleanup.result === "pass" ? "pass" : "blocked";
    writeYaml(join(repoRoot, receiptPath(target)), receipt);
    rmSync(runRoot, { recursive: true, force: true });
    console.log(`wrote ${receiptPath(target)} result=${receipt.spec.result}`);
  }
}

function writeSummary() {
  const rows = targets.map((target) => {
    const path = join(repoRoot, receiptPath(target));
    if (!existsSync(path)) {
      return {
        chart: target.chart,
        version: target.version,
        base: target.base,
        capability_profile: "kind-kubernetes-1.35",
        result: "not-run",
        selectable_crds: "",
        comparisons: "",
        receipt: receiptPath(target),
      };
    }
    const receipt = readYaml(path);
    return {
      chart: target.chart,
      version: target.version,
      base: target.base,
      capability_profile: receipt.spec?.capabilityProfile?.name ?? "",
      result: receipt.spec?.result ?? "",
      selectable_crds: String(receipt.spec?.renderedSelectableFields?.length ?? 0),
      comparisons: String(receipt.spec?.comparison?.length ?? 0),
      receipt: receiptPath(target),
    };
  });
  const counts = new Map();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1);
  write(summaryCsvPath, toCsv(rows));
  write(
    summaryMdPath,
    `# SelectableFields Capability Witness

This lane reruns the strict CRD capability question behind the Kubernetes 1.30
watchlist rows. It applies only the rendered CRDs that author
\`spec.versions[].selectableFields\` to a fresh \`kindest/node:v1.35.0\`
cluster, then reads the live CRDs back and compares those fields.

\`\`\`text
pass: ${counts.get("pass") ?? 0}
blocked: ${counts.get("blocked") ?? 0}
not-run: ${counts.get("not-run") ?? 0}
\`\`\`

| Chart | Base | Profile | Result | Selectable CRDs | Comparisons | Receipt |
| --- | --- | --- | --- | ---: | ---: | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.capability_profile} | ${row.result} | ${row.selectable_crds} | ${row.comparisons} | ${row.receipt} |`).join("\n")}

This does not erase the Kubernetes 1.30 watchlist rows. It proves that the same
rendered CRDs preserve \`selectableFields\` on the named Kubernetes 1.35 kind
profile. Broader production support still needs target-scoped evidence for the
target profile being claimed.
`,
  );
  console.log(`wrote ${relativeRepo(summaryMdPath)}`);
}

function verify() {
  const expectedSummary = captureSummary();
  check(existsSync(summaryCsvPath), `${relativeRepo(summaryCsvPath)} missing; run npm run capability:selectablefields:summary`);
  check(existsSync(summaryMdPath), `${relativeRepo(summaryMdPath)} missing; run npm run capability:selectablefields:summary`);
  check(readFileSync(summaryCsvPath, "utf8") === expectedSummary.csv, `${relativeRepo(summaryCsvPath)} is stale`);
  check(readFileSync(summaryMdPath, "utf8") === expectedSummary.md, `${relativeRepo(summaryMdPath)} is stale`);
  for (const target of targets) {
    const path = join(repoRoot, receiptPath(target));
    check(existsSync(path), `${receiptPath(target)} missing; run npm run capability:selectablefields -- --all`);
    const receipt = readYaml(path);
    check(receipt.kind === "CapabilityProfileWitnessReceipt", `${receiptPath(target)} kind mismatch`);
    check(receipt.spec?.chart === target.chart, `${receiptPath(target)} chart mismatch`);
    check(receipt.spec?.version === target.version, `${receiptPath(target)} version mismatch`);
    check(receipt.spec?.base === target.base, `${receiptPath(target)} base mismatch`);
    check(receipt.spec?.capabilityProfile?.name === "kind-kubernetes-1.35", `${receiptPath(target)} profile mismatch`);
    check(receipt.spec?.capabilityProfile?.serverVersion?.startsWith("v1.35."), `${receiptPath(target)} server version mismatch`);
    check(receipt.spec?.result === "pass", `${receiptPath(target)} result must pass`);
    check(receipt.spec?.run?.cleanup?.result === "pass", `${receiptPath(target)} cleanup must pass`);
    check((receipt.spec?.renderedSelectableFields ?? []).length > 0, `${receiptPath(target)} has no rendered selectableFields`);
    check((receipt.spec?.comparison ?? []).length > 0, `${receiptPath(target)} has no comparisons`);
    check(receipt.spec.comparison.every((item) => item.result === "pass"), `${receiptPath(target)} has blocked comparison`);
  }
  console.log(`verified selectableFields capability witness for ${targets.length} chart(s)`);
}

function captureSummary() {
  const rows = targets.map((target) => {
    const path = join(repoRoot, receiptPath(target));
    const receipt = existsSync(path) ? readYaml(path) : null;
    return {
      chart: target.chart,
      version: target.version,
      base: target.base,
      capability_profile: receipt?.spec?.capabilityProfile?.name ?? "kind-kubernetes-1.35",
      result: receipt?.spec?.result ?? "not-run",
      selectable_crds: receipt ? String(receipt.spec?.renderedSelectableFields?.length ?? 0) : "",
      comparisons: receipt ? String(receipt.spec?.comparison?.length ?? 0) : "",
      receipt: receiptPath(target),
    };
  });
  const counts = new Map();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1);
  return {
    csv: toCsv(rows),
    md: `# SelectableFields Capability Witness

This lane reruns the strict CRD capability question behind the Kubernetes 1.30
watchlist rows. It applies only the rendered CRDs that author
\`spec.versions[].selectableFields\` to a fresh \`kindest/node:v1.35.0\`
cluster, then reads the live CRDs back and compares those fields.

\`\`\`text
pass: ${counts.get("pass") ?? 0}
blocked: ${counts.get("blocked") ?? 0}
not-run: ${counts.get("not-run") ?? 0}
\`\`\`

| Chart | Base | Profile | Result | Selectable CRDs | Comparisons | Receipt |
| --- | --- | --- | --- | ---: | ---: | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.capability_profile} | ${row.result} | ${row.selectable_crds} | ${row.comparisons} | ${row.receipt} |`).join("\n")}

This does not erase the Kubernetes 1.30 watchlist rows. It proves that the same
rendered CRDs preserve \`selectableFields\` on the named Kubernetes 1.35 kind
profile. Broader production support still needs target-scoped evidence for the
target profile being claimed.
`,
  };
}

function selectableSummary(doc) {
  return {
    name: doc.metadata?.name ?? "",
    versions: (doc.spec?.versions ?? []).map((version) => ({
      name: version.name ?? "",
      selectableFields: (version.selectableFields ?? []).map((field) => field.jsonPath ?? "").filter(Boolean).sort(),
    })),
  };
}

function receiptPath(target) {
  return `data/capability-profile-witnesses/selectablefields/receipts/${slug(target.chart)}-${target.base}-kind-1.35.yaml`;
}

function kubectl(kubeconfig, context, args, timeout = 120) {
  return must("kubectl", ["--kubeconfig", kubeconfig, "--context", context, ...args], timeout);
}

function must(cmd, args, timeout = 120) {
  const result = run(cmd, args, timeout);
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`.trim());
  return result.stdout;
}

function run(cmd, args, timeout = 120) {
  return spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024 * 100,
  });
}

function errorText(error) {
  return String(error?.stack || error?.message || error).slice(0, 4000);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function slug(value) {
  return value.replaceAll("/", "-").replaceAll(".", "-");
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
