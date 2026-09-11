import { sha256 } from "./proof-common.mjs";

const WORKLOAD_KINDS = new Set(["Deployment", "DaemonSet", "StatefulSet"]);
const API_EXTENSIONS_GROUP = "apiextensions.k8s.io";
const STRATEGIES = {
  Deployment: new Set(["RollingUpdate", "Recreate"]),
  DaemonSet: new Set(["RollingUpdate", "OnDelete"]),
  StatefulSet: new Set(["RollingUpdate", "OnDelete"]),
};
const API_VERSION_RE = /^(?:[A-Za-z0-9][A-Za-z0-9.-]*\/)?[A-Za-z0-9][A-Za-z0-9.-]*$/;

export const DISRUPTION_REVIEW_RULES = Object.freeze({
  deploymentSelectorChange: {
    category: "replace-immutable-field",
    verdict: "review-required",
    guidance: "Deployment selectors are immutable; the API rejects an in-place patch and does not recreate the workload automatically.",
    source: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#label-selector-updates",
  },
  workloadPodTemplateChange: {
    category: "recreate-workload",
    verdict: "review-required",
    guidance: "A pod-template change may trigger Pod replacements; the update strategy describes controller behavior but does not guarantee zero downtime.",
    source: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/",
  },
  daemonSetUpdate: {
    category: "recreate-workload",
    verdict: "review-required",
    guidance: "DaemonSet replacement follows its declared update strategy; manual replacement may be needed for OnDelete and no node drain or rebuild is inferred.",
    source: "https://kubernetes.io/docs/tasks/manage-daemon/update-daemon-set/",
  },
  statefulSetUpdate: {
    category: "recreate-workload",
    verdict: "review-required",
    guidance: "StatefulSet replacement follows its declared update strategy; OnDelete requires manual replacement and RollingUpdate partition limits remain unassessed.",
    source: "https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/",
  },
  crdOrApiVersionChange: {
    category: "crd-or-apiversion-change",
    verdict: "review-required",
    guidance: "CRD or apiVersion changes require review of API compatibility, conversion, and storage behavior.",
    source: "https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/",
  },
  unknownChange: {
    category: "unclassified",
    verdict: "review-required",
    guidance: "The static classifier cannot determine the runtime effect of this change; review the exact object transition before applying it.",
    source: "",
  },
});

export function reviewDisruption(beforeObjects, afterObjects) {
  const before = indexObjects(beforeObjects, "before");
  const after = indexObjects(afterObjects, "after");
  const identities = [...new Set([...before.keys(), ...after.keys()])].sort();
  const objects = identities.map((key) => reviewObject(before.get(key), after.get(key)));
  const changed = objects.some((item) => item.changeType !== "unchanged");
  return {
    schemaVersion: "1",
    verdict: changed ? "review-required" : "no-config-change",
    risk: "static-risk",
    rules: [...new Set(Object.values(DISRUPTION_REVIEW_RULES).map((rule) => rule.category))].sort().map((category) => ({
      category,
      sources: [...new Set(Object.values(DISRUPTION_REVIEW_RULES).filter((rule) => rule.category === category && rule.source).map((rule) => rule.source))].sort(),
    })),
    objects,
    unassessed: [
      "target admission and preflight",
      "runtime availability and downtime",
      "dependency ordering and CRD readiness",
      "delivery ownership and prune or retention policy",
      "node drain and driver-specific replacement behavior",
      "rollback data safety",
      "rollback success",
    ],
  };
}

function indexObjects(objects, side) {
  if (!Array.isArray(objects)) throw new TypeError(`${side} objects must be an array`);
  const indexed = new Map();
  for (const object of objects) {
    const identity = objectIdentity(object, side);
    const key = identityKey(identity);
    if (indexed.has(key)) throw new Error(`${side} objects contain duplicate identity ${key}`);
    indexed.set(key, { object, identity });
  }
  return indexed;
}

function objectIdentity(object, side) {
  assertJsonValue(object, new Set(), `${side} object`);
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    throw new TypeError(`${side} object must be an object`);
  }
  const apiVersion = object.apiVersion;
  const kind = object.kind;
  const name = object.metadata?.name;
  const namespace = object.metadata?.namespace ?? "";
  if (typeof apiVersion !== "string" || !API_VERSION_RE.test(apiVersion) || typeof kind !== "string" || !kind
    || typeof name !== "string" || !name || typeof namespace !== "string") {
    throw new Error(`${side} object has a malformed identity`);
  }
  const group = apiVersion.includes("/") ? apiVersion.split("/", 1)[0] : "";
  return { group, kind, namespace, name };
}

function identityKey(identity) {
  return [identity.group, identity.kind, identity.namespace, identity.name]
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function reviewObject(beforeEntry, afterEntry) {
  const identity = afterEntry?.identity ?? beforeEntry.identity;
  if (!beforeEntry) {
    return record(identity, "added", [""], null, digest(afterEntry.object), rulesForAbsent(identity));
  }
  if (!afterEntry) {
    return record(identity, "deleted", [""], digest(beforeEntry.object), null, rulesForAbsent(identity));
  }
  const changedPaths = diffPaths(beforeEntry.object, afterEntry.object);
  if (changedPaths.length === 0) {
    return record(identity, "unchanged", [], digest(beforeEntry.object), digest(afterEntry.object), []);
  }
  const rules = classifyRules(beforeEntry.object, afterEntry.object, changedPaths);
  return record(identity, "changed", changedPaths, digest(beforeEntry.object), digest(afterEntry.object), rules);
}

function rulesForAbsent(identity) {
  const rules = [DISRUPTION_REVIEW_RULES.unknownChange];
  if (identity.group === API_EXTENSIONS_GROUP && identity.kind === "CustomResourceDefinition") {
    rules.unshift(DISRUPTION_REVIEW_RULES.crdOrApiVersionChange);
  }
  return rules;
}

function record(identity, changeType, changedPaths, beforeDigest, afterDigest, rules) {
  return {
    identity,
    changeType,
    changedPaths,
    beforeDigest,
    afterDigest,
    rules: rules.map(({ category, guidance, source }) => ({ category, guidance, ...(source ? { source } : {}) })),
  };
}

function classifyRules(before, after, paths) {
  const rules = [];
  const apiVersionChanged = before.apiVersion !== after.apiVersion;
  const beforeGroup = apiGroup(before.apiVersion);
  const afterGroup = apiGroup(after.apiVersion);
  const isCrd = beforeGroup === API_EXTENSIONS_GROUP && before.kind === "CustomResourceDefinition";
  if ((apiVersionChanged && beforeGroup === afterGroup) || isCrd) {
    rules.push(DISRUPTION_REVIEW_RULES.crdOrApiVersionChange);
  }
  const appsV1Workload = before.apiVersion === "apps/v1"
    && after.apiVersion === "apps/v1"
    && beforeGroup === "apps"
    && afterGroup === "apps"
    && WORKLOAD_KINDS.has(before.kind)
    && before.kind === after.kind;
  if (appsV1Workload && before.kind === "Deployment" && !sameJson(before.spec?.selector, after.spec?.selector)) {
    rules.push(DISRUPTION_REVIEW_RULES.deploymentSelectorChange);
  }
  if (appsV1Workload && !sameJson(before.spec?.template, after.spec?.template)) {
    rules.push(workloadStrategyRule(after));
  }
  if (rules.length === 0) rules.push(DISRUPTION_REVIEW_RULES.unknownChange);
  return [...new Map(rules.map((rule) => [rule.category, rule])).values()];
}

function apiGroup(apiVersion) {
  return apiVersion.includes("/") ? apiVersion.split("/", 1)[0] : "";
}

function workloadStrategyRule(object) {
  const strategy = object.kind === "Deployment"
    ? object.spec?.strategy?.type ?? "RollingUpdate"
    : object.spec?.updateStrategy?.type ?? "RollingUpdate";
  const known = STRATEGIES[object.kind]?.has(strategy) === true;
  if (!known) return { ...DISRUPTION_REVIEW_RULES.workloadPodTemplateChange, guidance: "The workload update strategy is unrecognized; replacement behavior remains unassessed and no downtime guarantee is made." };
  if (object.kind === "DaemonSet") return { ...DISRUPTION_REVIEW_RULES.daemonSetUpdate, guidance: `${DISRUPTION_REVIEW_RULES.daemonSetUpdate.guidance} The declared strategy is ${strategy}.` };
  if (object.kind === "StatefulSet") return { ...DISRUPTION_REVIEW_RULES.statefulSetUpdate, guidance: `${DISRUPTION_REVIEW_RULES.statefulSetUpdate.guidance} The declared strategy is ${strategy}.` };
  return { ...DISRUPTION_REVIEW_RULES.workloadPodTemplateChange, guidance: `${DISRUPTION_REVIEW_RULES.workloadPodTemplateChange.guidance} The declared strategy is ${strategy}.` };
}

function diffPaths(before, after, path = "") {
  if (Object.is(before, after)) return [];
  if (!before || !after || typeof before !== "object" || typeof after !== "object"
    || Array.isArray(before) !== Array.isArray(after)) return [path];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => diffPaths(before[key], after[key], `${path}/${escapePointer(key)}`));
}

function escapePointer(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function digest(object) {
  return `sha256:${sha256(JSON.stringify(canonicalize(object)))}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function assertJsonValue(value, seen, label) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(`${label} contains a non-finite number`);
  }
  if (typeof value !== "object") throw new TypeError(`${label} is not JSON-compatible`);
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label} is not a plain JSON object`);
  }
  if (seen.has(value)) throw new TypeError(`${label} contains a cycle`);
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertJsonValue(item, seen, label);
  } else {
    for (const [key, child] of Object.entries(value)) assertJsonValue(child, seen, label);
  }
  seen.delete(value);
}
