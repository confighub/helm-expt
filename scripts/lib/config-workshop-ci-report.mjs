import { createHash } from "node:crypto";

const VERDICT_LABELS = {
  blocked: "Blocked by a recorded decision",
  "needs-review": "Needs review",
  "clear-in-completed-checks": "No blocker found in the completed checks",
  unknown: "Not enough evidence",
};

const BLOCKED_RESULTS = new Set(["blocked", "deny", "denied", "fail", "failed"]);

export function buildWorkshopCiReport(result, options = {}) {
  validateResult(result);
  const files = new Map(result.spec.files.map((file) => [file.path, file]));
  validateFiles(result, files);
  const scanner = parseJsonFile(files, "cub-check.json");
  const review = parseJsonFile(files, "workshop-review.json");
  const receipt = result.spec.checks.advisoryReceipts[0] ?? null;
  const identity = result.spec.candidate.objectSet;
  const scannerMatches = Boolean(
    receipt
      && receipt.input?.objectSetSha256 === identity.sha256
      && receipt.input?.objectCount === identity.objectCount,
  );
  const outcomes = result.spec.findingDecisions?.outcomes ?? [];
  const decisions = new Map(outcomes.map((outcome) => [outcome.findingId, outcome]));
  const findings = (scanner?.findings ?? []).map((finding) => {
    const decision = decisions.get(finding.id);
    return {
      id: finding.id,
      severity: finding.severity ?? "unknown",
      resource: resourceName(finding.resource),
      message: finding.message ?? finding.name ?? "No finding description was recorded.",
      decision: decision?.decision ?? "unreviewed",
      controlIds: decision?.controlIds ?? finding.control_ids ?? [],
      nextAction: finding.next_step?.description ?? finding.remediation?.steps?.[0] ?? "Review this finding.",
    };
  });
  findings.sort(compareFindings);

  const lifecycle = review?.spec?.lifecycle ?? {};
  const comparison = review?.spec?.comparison ?? { status: "not-supplied" };
  const verdict = chooseVerdict({ result, receipt, scanner, scannerMatches, findings, lifecycle });
  const artifactBase = normalizeArtifactBase(options.artifactBase ?? "");
  const artifacts = result.spec.files.map((file) => ({
    path: file.path,
    sha256: file.sha256,
    url: artifactBase ? `${artifactBase}${encodePath(file.path)}` : "",
  }));
  const catalogUrl = review?.spec?.catalog?.url ?? "";
  if (catalogUrl) {
    const path = catalogUrl.includes("/charts/") ? "Catalog record" : "Related guide";
    artifacts.push({ path, sha256: "", url: catalogUrl });
  }

  return {
    schemaVersion: "workshop-ci-report-v1",
    generatedAt: result.metadata.createdAt,
    generatedFrom: result.metadata.id,
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    summary: summaryFor(verdict, findings, result.spec.checks.notRun.length),
    scope: {
      checked: "the exact Kubernetes objects and the completed checks listed in this report",
      notProven: "destination acceptance, deployment, workload health, drift, and rollback unless separate receipts are linked",
    },
    source: {
      type: result.spec.source.type ?? "unknown",
      identity: result.spec.source.identity ?? "unknown",
      version: result.spec.source.version ?? "",
      valuesSummary: result.spec.source.valuesSummary ?? "",
    },
    candidate: {
      objectCount: identity.objectCount,
      objectSetSha256: identity.sha256,
      contentSha256: result.spec.candidate.content.sha256,
    },
    comparison: {
      status: comparison.status ?? "not-supplied",
      added: comparison.added ?? [],
      removed: comparison.removed ?? [],
      changed: comparison.changed ?? [],
      unchanged: comparison.unchanged ?? [],
    },
    findings,
    checks: {
      completed: result.spec.checks.completed,
      notRun: result.spec.checks.notRun,
      localScanner: receipt
        ? {
            authority: receipt.authority,
            tool: receipt.tool,
            version: receipt.version,
            scanTime: receipt.scanTime,
            patternBundleVersion: receipt.patternBundle?.version ?? "",
            patternBundleManifestSha256: receipt.patternBundle?.manifestSha256 ?? "",
            objectSetMatched: scannerMatches,
          }
        : null,
      managedValidation: "not-recorded-by-this-local-report",
      destination: "not-checked",
      delivery: "not-checked",
      runtime: "not-checked",
    },
    lifecycle: {
      requirements: lifecycle.requirements ?? [],
      routes: lifecycle.routes ?? [],
      targetFactsStatus: lifecycle.targetFacts?.status ?? "not-recorded",
      resolutionStatus: lifecycle.resolution?.status ?? "not-recorded",
    },
    decision: {
      status: result.spec.findingDecisions?.status ?? "not-recorded",
      record: result.spec.findingDecisions?.record ?? null,
      outcomes,
    },
    artifacts,
    nextActions: nextActionsFor(result, findings, lifecycle),
  };
}

export function renderWorkshopCiMarkdown(report, options = {}) {
  const heading = "#".repeat(options.headingLevel ?? 2);
  const lines = [
    `${heading} Config Workshop check: ${report.verdictLabel}`,
    "",
    `**Source:** ${sourceLabel(report.source)}`,
    `**Exact objects:** ${report.candidate.objectCount} objects · \`${report.candidate.objectSetSha256}\``,
    `**Result:** ${report.summary}`,
    "",
    `This report covers ${report.scope.checked}. It does not prove ${report.scope.notProven}.`,
    "",
  ];

  if (report.comparison.status === "compared") {
    lines.push(
      `${heading}# What changed`,
      "",
      `- Added: ${formatCount(report.comparison.added)}`,
      `- Removed: ${formatCount(report.comparison.removed)}`,
      `- Changed: ${formatCount(report.comparison.changed)}`,
      "",
    );
  }

  lines.push(`${heading}# Findings`, "");
  if (!report.findings.length) {
    lines.push("No finding was returned by the recorded local check.", "");
  } else {
    lines.push("| Severity | Finding | Object | Decision |", "| --- | --- | --- | --- |");
    for (const finding of report.findings.slice(0, 10)) {
      lines.push(`| ${escapeCell(finding.severity)} | \`${escapeCell(finding.id)}\`: ${escapeCell(finding.message)} | ${escapeCell(finding.resource)} | ${escapeCell(finding.decision)} |`);
    }
    if (report.findings.length > 10) lines.push(`\n${report.findings.length - 10} more findings are in the complete result.`);
    lines.push("");
  }

  if (report.lifecycle.requirements.length || report.lifecycle.routes.length) {
    lines.push(`${heading}# Before deployment`, "");
    for (const requirement of report.lifecycle.requirements) {
      lines.push(`- ${requirementLabel(requirement)}`);
    }
    for (const route of report.lifecycle.routes) {
      lines.push(`- ${route.detail ?? route.action ?? route.id ?? "Review the recorded lifecycle route."}`);
    }
    lines.push("");
  }

  lines.push(`${heading}# Checks`, "", "Completed:");
  for (const check of report.checks.completed) lines.push(`- ${check}`);
  lines.push("", "Not checked:");
  for (const check of report.checks.notRun) lines.push(`- ${check}`);
  lines.push("- destination acceptance, delivery, and runtime status", "");

  lines.push(`${heading}# Next actions`, "");
  for (const action of report.nextActions) lines.push(`- ${action}`);
  lines.push("", `${heading}# Artifacts`, "");
  for (const artifact of report.artifacts) {
    const label = artifact.url ? `[${artifact.path}](${artifact.url})` : `\`${artifact.path}\``;
    lines.push(`- ${label}${artifact.sha256 ? ` · \`${artifact.sha256}\`` : ""}`);
  }
  return `${lines.join("\n").trim()}\n`;
}

function chooseVerdict({ result, receipt, scanner, scannerMatches, findings, lifecycle }) {
  if (!receipt || !scanner || !scannerMatches) return "unknown";
  const outcomes = result.spec.findingDecisions?.outcomes ?? [];
  const managed = result.spec.findingDecisions?.managedControls ?? [];
  if (outcomes.some((outcome) => outcome.decision === "rejected")) return "blocked";
  if (managed.some((control) => BLOCKED_RESULTS.has(String(control.result ?? "").toLowerCase()))) return "blocked";
  if (findings.length) return "needs-review";
  if (result.spec.checks.notRun.length) return "needs-review";
  if ((lifecycle.requirements ?? []).length && lifecycle.resolution?.status !== "resolved") return "needs-review";
  return "clear-in-completed-checks";
}

function summaryFor(verdict, findings, notRunCount) {
  if (verdict === "unknown") return "The report cannot match a local check to this exact object set.";
  if (verdict === "blocked") return "A recorded decision or managed control blocks this object set.";
  if (verdict === "needs-review") {
    const findingText = `${findings.length} finding${findings.length === 1 ? "" : "s"}`;
    const omittedText = `${notRunCount} check${notRunCount === 1 ? "" : "s"} not run`;
    return `${findingText}; ${omittedText}. Review them before this change progresses.`;
  }
  return "Every check recorded in this result completed without a blocker. Destination and runtime checks are separate.";
}

function nextActionsFor(result, findings, lifecycle) {
  const actions = [];
  for (const finding of findings) {
    if (finding.decision === "unreviewed") actions.push(`${finding.id}: ${finding.nextAction}`);
    if (finding.decision === "approved-exception") actions.push(`${finding.id}: recheck the approved exception when its object set, scope, or review date changes.`);
    if (finding.decision === "rejected") actions.push(`${finding.id}: replace or correct the candidate before continuing.`);
  }
  for (const requirement of lifecycle.requirements ?? []) {
    actions.push(requirementLabel(requirement));
  }
  if (result.spec.checks.notRun.length) actions.push("Run destination and live checks separately before deployment.");
  actions.push(result.spec.next.local);
  actions.push(result.spec.next.managed);
  return [...new Set(actions)];
}

function validateResult(result) {
  if (result?.apiVersion !== "workshop.confighub.com/v1alpha2" || result?.kind !== "WorkshopResult") {
    throw new Error("input must be one workshop.confighub.com/v1alpha2 WorkshopResult");
  }
  if (!result.spec?.candidate?.objectSet?.sha256 || !Array.isArray(result.spec?.files)) {
    throw new Error("WorkshopResult is missing its candidate identity or files");
  }
}

function validateFiles(result, files) {
  if (files.size !== result.spec.files.length) throw new Error("WorkshopResult repeats an embedded file path");
  for (const file of result.spec.files) {
    validateArtifactPath(file.path);
    const digest = sha256(file.content);
    if (file.sha256 !== digest) throw new Error(`${file.path} does not match its recorded SHA-256`);
  }
  const candidate = files.get(result.spec.candidate.content.path);
  if (!candidate) throw new Error("WorkshopResult does not embed its candidate file");
  if (candidate.sha256 !== result.spec.candidate.content.sha256) {
    throw new Error("candidate file does not match spec.candidate.content.sha256");
  }
}

export function validateArtifactPath(path) {
  if (!path || path.startsWith("/") || path.includes("\\")) throw new Error(`unsafe embedded file path: ${path}`);
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`unsafe embedded file path: ${path}`);
  }
}

function parseJsonFile(files, path) {
  const file = files.get(path);
  if (!file) return null;
  try {
    return JSON.parse(file.content);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

function sourceLabel(source) {
  return `${source.type}: ${source.identity}${source.version ? `@${source.version}` : ""}`;
}

function resourceName(resource = {}) {
  const namespace = resource.namespace ? `${resource.namespace}/` : "";
  return resource.kind && resource.name ? `${resource.kind}/${namespace}${resource.name}` : "not recorded";
}

function requirementLabel(requirement) {
  const detail = requirement.detail ?? "Review this requirement for the destination.";
  return requirement.id ? `${requirement.id}: ${detail}` : detail;
}

function compareFindings(left, right) {
  const rank = { critical: 0, high: 1, warning: 2, medium: 2, low: 3, info: 4, unknown: 5 };
  return (rank[left.severity] ?? 5) - (rank[right.severity] ?? 5)
    || left.id.localeCompare(right.id)
    || left.resource.localeCompare(right.resource);
}

function formatCount(items) {
  return items.length ? `${items.length} (${items.join(", ")})` : "0";
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function normalizeArtifactBase(value) {
  if (!value) return "";
  return value.endsWith("/") ? value : `${value}/`;
}

function encodePath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
