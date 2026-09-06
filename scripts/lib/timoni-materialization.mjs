import { createHash } from "node:crypto";
import { basename } from "node:path";
import { check, parseDocs } from "./proof-common.mjs";
import { objectSetSha256 } from "../transform-config-oci.mjs";

// Summarize already-materialized, retained Timoni inputs. This does not run
// Timoni, admit a Catalog entry, or execute its lifecycle routes.
export function buildTimoniInventory(items, text, sourceRecordPath) {
  check(items.length > 0, "Timoni inventory requires Kubernetes objects");
  for (const object of items) {
    check(object && typeof object === "object" && !Array.isArray(object), "Timoni output is not a Kubernetes object");
    for (const value of [object.apiVersion, object.kind, object.metadata?.name]) {
      check(typeof value === "string" && value.length > 0, "Timoni object requires apiVersion, kind, and metadata.name");
    }
  }
  const keys = items.map((object) => [object.apiVersion.includes("/") ? object.apiVersion.split("/")[0] : "", object.kind, object.metadata?.namespace ?? "", object.metadata.name].join("/"));
  check(new Set(keys).size === keys.length, "Timoni inventory contains duplicate object identities");
  check(objectSetSha256(parseDocs(text)) === objectSetSha256(items), "Timoni object text differs from inventory input");
  const identities = items.map((object) => ({
    apiVersion: String(object.apiVersion ?? ""),
    kind: String(object.kind ?? ""),
    namespace: String(object.metadata?.namespace ?? ""),
    name: String(object.metadata?.name ?? ""),
  })).sort(compareIdentity);
  const kindCounts = Object.fromEntries(
    [...new Set(identities.map((identity) => identity.kind))]
      .sort()
      .map((kind) => [kind, identities.filter((identity) => identity.kind === kind).length]),
  );
  const images = [...new Set(items.flatMap(findImages))].sort();
  return {
    schemaVersion: "1",
    source: sourceRecordPath,
    objectCount: items.length,
    fileSha256: sha256(text),
    canonicalObjectSetSha256: objectSetSha256(items),
    kindCounts,
    images,
    identities,
  };
}

export function buildTimoniReceipt({ lock, lifecycleRecord, flatteningRecord, inventoryRecord, schemaText, schemaPath, objects, observations }) {
  check(lock.kind === "SourceAndIntent" && lock.metadata?.name, "Timoni source record identity is missing");
  const source = lock.spec?.source;
  check(source?.type === "timoni" && source.module?.startsWith("oci://") && source.version, "Timoni source requires module and version");
  check(/^sha256:[a-f0-9]{64}$/.test(source.manifestDigest), "Timoni source requires an immutable manifest digest");
  check(lock.spec.processor?.name === "timoni" && lock.spec.processor.version, "Timoni processor version is missing");
  const selection = lock.spec.selection;
  check(selection?.instance && selection.namespace && selection.values && typeof selection.maskSecrets === "boolean", "Timoni selection is incomplete");
  check(schemaText.trim().length > 0 && schemaPath, "Timoni typed schema is missing");
  check(Array.isArray(observations) && observations.every((item) => typeof item === "string"), "Timoni observations must be explicit strings");
  check(lifecycleRecord.kind === "LifecycleRouteIntent" && Array.isArray(lifecycleRecord.spec?.routes), "Timoni lifecycle routes are missing");
  check(lifecycleRecord.spec.sourceRecord === inventoryRecord.source, "Timoni lifecycle points to another source record");
  check(lifecycleRecord.spec.targetFacts && Array.isArray(lifecycleRecord.spec.targetFacts.requirements), "Timoni target facts are missing");
  const routeNames = lifecycleRecord.spec.routes.map((route) => route.routeName);
  check(routeNames.every((name) => typeof name === "string" && name.length > 0) && new Set(routeNames).size === routeNames.length, "Timoni lifecycle route names are missing or duplicated");
  const flattening = flatteningRecord.spec;
  check(flatteningRecord.kind === "FlatteningSafetyVerdict" && flattening?.subject?.sourceType === "timoni" && flattening.subject.source === source.module && String(flattening.subject.version) === String(source.version), "Timoni flattening subject differs from source");
  check(flattening.retained?.objects === lock.spec.output?.objects && flattening.retained?.routeIntent === lock.spec.lifecycle?.routeIntent, "Timoni flattening references differ from selected output");
  check(typeof flattening.verdict?.lane === "string" && flattening.verdict.lane.length > 0, "Timoni flattening verdict is missing");
  check(flattening.verdict.lane !== "flatten-with-routes" || routeNames.length > 0, "Timoni flattening requires retained lifecycle routes");
  check(inventoryRecord.objectCount === objects.length && inventoryRecord.canonicalObjectSetSha256 === objectSetSha256(objects), "Timoni inventory differs from materialized objects");
  const labels = objects
    .map((object) => object.metadata?.labels?.["app.kubernetes.io/version"])
    .filter(Boolean);
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "SourceMaterializationReceipt",
    metadata: { name: lock.metadata.name },
    spec: {
      source: lock.spec.source,
      processor: lock.spec.processor,
      selection: lock.spec.selection,
      command: `timoni -n ${lock.spec.selection.namespace} build ${lock.spec.selection.instance} <module> -v ${lock.spec.source.version} -d <manifest-digest> -f ${basename(lock.spec.selection.values)}${lock.spec.selection.maskSecrets ? " --mask-secrets" : ""}`,
      sourceSchema: {
        path: schemaPath,
        sha256: sha256(schemaText),
      },
      output: {
        objects: lock.spec.output.objects,
        inventory: lock.spec.output.inventory,
        objectCount: inventoryRecord.objectCount,
        fileSha256: inventoryRecord.fileSha256,
        objectSetSha256: inventoryRecord.canonicalObjectSetSha256,
        kinds: inventoryRecord.kindCounts,
        images: inventoryRecord.images,
      },
      lifecycle: {
        routeIntent: lock.spec.lifecycle.routeIntent,
        routeCount: lifecycleRecord.spec.routes.length,
      },
      flattening: {
        verdict: flatteningRecord.spec.verdict.lane,
        record: lock.spec.lifecycle.flatteningVerdict,
      },
      observations,
      renderedVersionLabels: [...new Set(labels)].sort(),
    },
    status: {
      sourceDigestBoundBuild: "pass",
      localMaterialization: "pass",
      kubernetesSchemaValidation: "not-run",
      lifecycleExecution: "not-run",
      kubernetesApply: "not-run",
      workloadHealth: "not-run",
    },
  };
}

function findImages(value) {
  if (Array.isArray(value)) return value.flatMap(findImages);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "image" && typeof child === "string" ? [child] : findImages(child));
}

function compareIdentity(left, right) {
  return [left.kind, left.namespace, left.name].join("/")
    .localeCompare([right.kind, right.namespace, right.name].join("/")) || left.apiVersion.localeCompare(right.apiVersion);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
