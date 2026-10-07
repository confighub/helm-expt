// One Catalog entry for NIMService, with one variant per retained sample.
//
// The repository retains NVIDIA's k8s-nim-operator serving samples under
// data/aicr-nim-operator-models/upstream/serving/. Until now they were profiled
// and joined to AICR platforms as member rows, and no sample was a Catalog
// entry. This module reads each retained sample file and returns everything a
// base-variant record needs to say about it: the exact objects and their
// object-set digest, the image it names and how that image is pinned, the
// Secrets it expects by name, the GPU and storage it requests, the operator it
// needs first, and any question the bytes raise that this module cannot answer.
//
// It also renders the three generated files that sit beside each sample's
// profile: an entry inventory, a flattening-safety verdict and two route
// intents. The generator, its verifier, the record generator and the
// processing-model verifier all call this module, so they cannot disagree.
//
// Nothing here contacts a registry, a cluster or NGC. It reads committed bytes.
// Every sample is retained, not uploaded and not deployed, and every sentence
// this module writes says so. A sample is described as published only when a
// tracked receipt matches the artifact built from its committed bytes
// (scripts/lib/nimservice-publication.mjs). Without one it is not published.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, identityFor, readYaml, readYamlText, repoRoot, serializeYaml } from "./proof-common.mjs";
import {
  buildReport as buildNimOperatorModelsReport,
  ngcCatalogPageFor,
  OUTPUT_ROOT,
  PROFILES_DIR,
  RECEIPTS_DIR,
} from "./aicr-nim-operator-models.mjs";
import { objectSetSha256 } from "../transform-config-oci.mjs";
import {
  buildNimServiceArtifact,
  loadNimServicePublication,
  nimServicePublicationPlanDoc,
} from "./nimservice-publication.mjs";

const posix = (path) => path.replaceAll("\\", "/");

export const NIMSERVICE_SOURCE_NAME = "nimservice";
export const NIMSERVICE_SOURCE_TYPE = "kubernetes-yaml";
export const NIMSERVICE_RECORD_PREFIX = "nimservice-";
export const NIMSERVICE_ENTRY_ROOT = `${posix(OUTPUT_ROOT)}/catalog-entries`;
export const NIMSERVICE_RETENTION_RECEIPT = `${posix(OUTPUT_ROOT)}/retention-receipt.yaml`;
export const NIMSERVICE_UPSTREAM_LICENSE = `${posix(OUTPUT_ROOT)}/upstream/LICENSE`;
export const NIMSERVICE_SERVING_ROOT = `${posix(OUTPUT_ROOT)}/upstream/serving`;
export const NIMSERVICE_LICENSE_READ = "docs/planning/nim-ngc-license-read.md";
export const NIMSERVICE_OPERATOR_ROUTE = "nim-operator-first";
export const NIMSERVICE_PULL_SECRET_ROUTE = "image-pull-secret";
export const NIMSERVICE_AUTH_SECRET_ROUTE = "model-auth-secret";
export const NIMSERVICE_STORAGE_ROUTE = "model-storage";
export const NIMSERVICE_GENERATOR = "scripts/generate-aicr-nim-operator-models.mjs";

// The operator's identity is read from files this repository already retains:
// the chart name, chart repository and version from a rendered AICR
// Application that installs it, and the release tag from the receipt that
// retained its custom resource definitions.
const OPERATOR_APPLICATION = "examples/aicr/eks-h100-inference-nim/argocd-rendered/templates/k8s-nim-operator.yaml";
const OPERATOR_CRD_RECEIPT = "examples/aicr/eks-h100-inference-nim/operator-crds-retention-receipt.yaml";
const OPERATOR_CRD_DIR = "examples/aicr/eks-h100-inference-nim/operator-crds";
const OPERATOR_CRDS = {
  NIMService: `${OPERATOR_CRD_DIR}/apps.nvidia.com_nimservices.yaml`,
  NIMCache: `${OPERATOR_CRD_DIR}/apps.nvidia.com_nimcaches.yaml`,
};
const OPERATOR_API_VERSION = "apps.nvidia.com/v1alpha1";

// Every kind a retained sample file may hold. A new kind stops the run, so a
// sample cannot gain an object this module describes as something else.
const KNOWN_KINDS = new Set(["NIMService", "NIMCache", "ResourceClaimTemplate"]);

// Every top-level NIMService spec field the retained corpus sets. A field
// outside this list stops the run until someone decides what it requires.
const KNOWN_SPEC_FIELDS = new Set([
  "affinity", "annotations", "authSecret", "draResources", "env", "expose", "groupID", "image",
  "inferencePlatform", "initContainers", "labels", "metrics", "multiNode", "priorityClassName",
  "readinessProbe", "replicas", "resources", "router", "runtimeClassName", "scale", "sidecarContainers",
  "startupProbe", "storage", "userID",
]);

// The only fields that name a Secret in the retained corpus. Any other key
// with "secret" in its name stops the run instead of going unrecorded.
const SECRET_FIELDS = new Map([
  ["authSecret", "model-auth"],
  ["pullSecret", "image-pull"],
  ["pullSecrets", "image-pull"],
]);

function repoPath(root, rel) {
  return join(root, rel);
}

function docsIn(root, rel) {
  const parsed = readYamlText(readFileSync(repoPath(root, rel), "utf8"));
  return (Array.isArray(parsed) ? parsed : [parsed]).filter((doc) => doc && typeof doc === "object");
}

let operatorCache = null;
function loadOperator(root) {
  if (operatorCache?.root === root) return operatorCache.value;
  for (const rel of [OPERATOR_APPLICATION, OPERATOR_CRD_RECEIPT, ...Object.values(OPERATOR_CRDS)]) {
    check(existsSync(repoPath(root, rel)), `${rel} is missing, so the NIM Operator requirement cannot be read from retained bytes`);
  }
  const application = docsIn(root, OPERATOR_APPLICATION).find((doc) => doc.kind === "Application");
  const source = application?.spec?.source ?? {};
  check(
    source.chart && source.repoURL && source.targetRevision,
    `${OPERATOR_APPLICATION}: the rendered Application names no chart, repository and version`,
  );
  const receipt = readYaml(repoPath(root, OPERATOR_CRD_RECEIPT));
  const retainedTag = String(receipt.spec?.source?.ref ?? "");
  check(/^v\d+\.\d+\.\d+$/.test(retainedTag), `${OPERATOR_CRD_RECEIPT}: the retained tag ${retainedTag || "(none)"} is not a release tag`);
  check(
    retainedTag === `v${source.targetRevision}`,
    `${OPERATOR_CRD_RECEIPT} retains ${retainedTag}, and ${OPERATOR_APPLICATION} pins chart ${source.targetRevision}; the two must agree before a version floor is stated`,
  );
  const schemas = {};
  for (const [kind, rel] of Object.entries(OPERATOR_CRDS)) {
    const crd = readYaml(repoPath(root, rel));
    const version = (crd.spec?.versions ?? []).find((item) => `${crd.spec?.group}/${item.name}` === OPERATOR_API_VERSION);
    check(version?.served === true, `${rel}: the retained definition does not serve ${OPERATOR_API_VERSION}`);
    check(crd.spec?.names?.kind === kind, `${rel}: expected the ${kind} definition`);
    schemas[kind] = { spec: version.schema?.openAPIV3Schema?.properties?.spec, crdName: crd.metadata?.name, rel };
    check(schemas[kind].spec && schemas[kind].crdName, `${rel}: the retained definition has no spec schema or name`);
  }
  const value = {
    chart: String(source.chart),
    chartRepository: String(source.repoURL),
    floorVersion: String(source.targetRevision),
    retainedTag,
    schemas,
  };
  operatorCache = { root, value };
  return value;
}

// Walks a sample object against the retained definition and returns every
// field the definition does not declare. A field the retained operator release
// does not define means the sample needs a different release, and this module
// cannot say which, so the caller turns each one into an open question.
export function fieldsOutsideSchema(schema, value, path = ["spec"], found = new Set()) {
  if (!schema || schema["x-kubernetes-preserve-unknown-fields"] === true) return found;
  if (Array.isArray(value)) {
    for (const item of value) fieldsOutsideSchema(schema.items, item, path, found);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  const properties = schema.properties;
  const additional = schema.additionalProperties;
  for (const [key, child] of Object.entries(value)) {
    if (properties && Object.hasOwn(properties, key)) fieldsOutsideSchema(properties[key], child, [...path, key], found);
    else if (additional && typeof additional === "object") fieldsOutsideSchema(additional, child, [...path, key], found);
    else if (additional === true || (!properties && additional === undefined && schema.type !== "object")) continue;
    else found.add([...path, key].join("."));
  }
  return found;
}

function pinnedBy(reference) {
  return reference.includes("@sha256:") ? "digest" : "tag";
}

function imageFrom(image, where, fileRel) {
  check(image?.repository && image?.tag !== undefined, `${fileRel}: ${where} names no repository and tag`);
  return `${image.repository}:${image.tag}`;
}

function collectSecrets(node, path, kind, found, fileRel) {
  if (Array.isArray(node)) {
    for (const item of node) collectSecrets(item, path, kind, found, fileRel);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    const here = [...path, key];
    if (/secret/i.test(key)) {
      check(
        SECRET_FIELDS.has(key),
        `${fileRel}: ${kind} ${here.join(".")} names a Secret through a field this module does not know; extend scripts/lib/nimservice-entries.mjs before this sample gets a record`,
      );
      const names = Array.isArray(value) ? value : [value];
      for (const name of names) {
        check(typeof name === "string" && name.length > 0, `${fileRel}: ${kind} ${here.join(".")} is not a Secret name`);
        found.push({ name, role: SECRET_FIELDS.get(key), namedBy: `${kind} ${here.join(".")}` });
      }
      continue;
    }
    collectSecrets(value, here, kind, found, fileRel);
  }
}

function placeholdersIn(node, path, found) {
  if (Array.isArray(node)) {
    node.forEach((item) => placeholdersIn(item, item && typeof item === "object" && item.name ? [...path.slice(0, -1), `${path.at(-1)}[${item.name}]`] : path, found));
    return found;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) placeholdersIn(value, [...path, key], found);
    return found;
  }
  if (typeof node === "string" && /<[a-z][a-z0-9-]*>/i.test(node)) found.push({ field: path.join("."), value: node });
  return found;
}

function pvcSentence(owner, pvc) {
  const storageClass = pvc.storageClass ? `storage class ${pvc.storageClass}` : "an empty storageClass, so the storage class is a destination choice";
  const size = pvc.size ? `${pvc.size} ` : "";
  const mode = pvc.volumeAccessMode ? `${pvc.volumeAccessMode} ` : "";
  const named = pvc.name ? ` named ${pvc.name}` : "";
  return `${owner} ${pvc.create === true ? "asks the operator to create" : "expects"} a ${size}${mode}PersistentVolumeClaim${named} with ${storageClass}.`;
}

function gpuResourceName(source) {
  if (source === "draResources") return "a Dynamic Resource Allocation claim";
  return source.replace(/^resources\.limits\."(.+)"$/, "$1");
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function readEntry(root, fact, source, operator) {
  const fileRel = posix(fact.fileRepoPath);
  const docs = docsIn(root, fileRel);
  for (const doc of docs) {
    check(
      KNOWN_KINDS.has(doc.kind),
      `${fileRel}: holds a ${doc.kind}, which this module does not describe; extend scripts/lib/nimservice-entries.mjs before this sample gets a record`,
    );
    check(doc.metadata?.name, `${fileRel}: a ${doc.kind} has no name`);
  }
  const services = docs.filter((doc) => doc.kind === "NIMService");
  check(
    services.length === 1,
    `${fileRel}: holds ${services.length} NIMService objects. One sample file is one variant, so a file with more than one needs a decision about how to split it`,
  );
  const service = services[0];
  const spec = service.spec ?? {};
  for (const key of Object.keys(spec)) {
    check(
      KNOWN_SPEC_FIELDS.has(key),
      `${fileRel}: NIMService spec.${key} is a field this module has not read before; extend scripts/lib/nimservice-entries.mjs to say what it requires`,
    );
  }
  const caches = docs.filter((doc) => doc.kind === "NIMCache");
  const others = docs.filter((doc) => !["NIMService", "NIMCache"].includes(doc.kind));

  const objects = docs
    .map((doc) => ({
      apiVersion: String(doc.apiVersion ?? ""),
      kind: String(doc.kind),
      namespace: String(doc.metadata?.namespace ?? ""),
      name: String(doc.metadata.name),
      identity: identityFor(doc),
    }))
    .sort((left, right) => (left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0));
  check(new Set(objects.map((object) => object.identity)).size === objects.length, `${fileRel}: two objects share one identity`);

  // Images. The NIMService image is the served container. A NIMCache names the
  // image that pulls the model, and a sample can add router, init and sidecar
  // images of its own.
  const images = [];
  const addImage = (reference, namedBy, role) => {
    images.push({ reference, pinnedBy: pinnedBy(reference), namedBy, role });
  };
  const servedImage = imageFrom(spec.image, "NIMService spec.image", fileRel);
  check(servedImage === fact.image, `${fileRel}: the served image ${servedImage} does not match the profiled image ${fact.image}`);
  addImage(servedImage, "NIMService spec.image", "served-model-container");
  for (const cache of caches) {
    for (const [sourceKind, sourceSpec] of Object.entries(cache.spec?.source ?? {})) {
      check(
        ["ngc", "hf"].includes(sourceKind),
        `${fileRel}: NIMCache ${cache.metadata.name} has a ${sourceKind} source, which this module does not describe`,
      );
      check(typeof sourceSpec?.modelPuller === "string", `${fileRel}: NIMCache ${cache.metadata.name} names no modelPuller image`);
      addImage(sourceSpec.modelPuller, `NIMCache spec.source.${sourceKind}.modelPuller`, "model-puller");
    }
  }
  const eppImage = spec.expose?.router?.eppConfig?.containerSpec?.image;
  if (eppImage) addImage(imageFrom(eppImage, "NIMService spec.expose.router.eppConfig.containerSpec.image", fileRel), "NIMService spec.expose.router.eppConfig.containerSpec.image", "endpoint-picker");
  for (const [field, role] of [["initContainers", "init-container"], ["sidecarContainers", "sidecar-container"]]) {
    for (const container of spec[field] ?? []) {
      addImage(imageFrom(container.image, `NIMService spec.${field}[].image`, fileRel), `NIMService spec.${field}[].image`, role);
    }
  }
  const gatedImages = images
    .filter((image) => image.reference.startsWith("nvcr.io/"))
    .filter((image, index, all) => all.findIndex((other) => other.reference === image.reference) === index);

  // Secrets, by name only.
  const secretRefs = [];
  for (const doc of docs) collectSecrets(doc.spec ?? {}, ["spec"], doc.kind, secretRefs, fileRel);
  const secrets = [];
  for (const ref of secretRefs) {
    let secret = secrets.find((candidate) => candidate.name === ref.name && candidate.role === ref.role);
    if (!secret) {
      secret = { name: ref.name, role: ref.role, namedBy: [] };
      secrets.push(secret);
    }
    if (!secret.namedBy.includes(ref.namedBy)) secret.namedBy.push(ref.namedBy);
  }
  secrets.sort((left, right) => (`${left.role}|${left.name}` < `${right.role}|${right.name}` ? -1 : 1));
  const pullSecrets = secrets.filter((secret) => secret.role === "image-pull");
  const authSecrets = secrets.filter((secret) => secret.role === "model-auth");
  check(authSecrets.length > 0, `${fileRel}: the sample names no auth Secret, and the retained definition requires one`);
  check(
    authSecrets.some((secret) => secret.name === fact.authSecret),
    `${fileRel}: the profiled auth Secret ${fact.authSecret} is not among the Secrets this module read`,
  );

  // Storage.
  const storage = [];
  const storageSpec = spec.storage ?? {};
  for (const key of Object.keys(storageSpec)) {
    check(
      ["nimCache", "pvc", "hostPath", "emptyDir", "sharedMemorySizeLimit", "readOnly"].includes(key),
      `${fileRel}: NIMService spec.storage.${key} is a storage shape this module has not read before`,
    );
  }
  const cacheRef = storageSpec.nimCache?.name ? String(storageSpec.nimCache.name).trim() : "";
  const cacheInFile = cacheRef ? caches.find((cache) => cache.metadata.name === cacheRef) : null;
  if (cacheRef) {
    storage.push({
      kind: "nim-cache",
      name: cacheRef,
      definedInSample: Boolean(cacheInFile),
      detail: cacheInFile
        ? `The NIMService reads its model from NIMCache ${cacheRef}, which this sample file also defines.`
        : `The NIMService reads its model from NIMCache ${cacheRef}, which this sample file does not define.`,
    });
  }
  for (const cache of caches) {
    const pvc = cache.spec?.storage?.pvc;
    check(pvc, `${fileRel}: NIMCache ${cache.metadata.name} declares no PersistentVolumeClaim, which is a storage shape this module has not read before`);
    storage.push({
      kind: "persistent-volume-claim",
      owner: `NIMCache ${cache.metadata.name}`,
      create: pvc.create === true,
      size: pvc.size ? String(pvc.size) : "",
      storageClass: pvc.storageClass ? String(pvc.storageClass) : "",
      accessMode: pvc.volumeAccessMode ? String(pvc.volumeAccessMode) : "",
      detail: pvcSentence(`NIMCache ${cache.metadata.name}`, pvc),
    });
  }
  if (storageSpec.pvc) {
    const pvc = storageSpec.pvc;
    storage.push({
      kind: "persistent-volume-claim",
      owner: `NIMService ${service.metadata.name}`,
      create: pvc.create === true,
      size: pvc.size ? String(pvc.size) : "",
      storageClass: pvc.storageClass ? String(pvc.storageClass) : "",
      accessMode: pvc.volumeAccessMode ? String(pvc.volumeAccessMode) : "",
      ...(pvc.name ? { name: String(pvc.name) } : {}),
      detail: pvcSentence(`NIMService ${service.metadata.name}`, pvc),
    });
  }
  if (storageSpec.hostPath) {
    storage.push({
      kind: "host-path",
      path: String(storageSpec.hostPath),
      detail: `The NIMService mounts the node path ${storageSpec.hostPath}, so every node that can run it must hold that path.`,
    });
  }
  if (storageSpec.emptyDir) {
    storage.push({
      kind: "empty-dir",
      size: storageSpec.emptyDir.sizeLimit ? String(storageSpec.emptyDir.sizeLimit) : "",
      detail: `The NIMService uses an emptyDir volume${storageSpec.emptyDir.sizeLimit ? ` limited to ${storageSpec.emptyDir.sizeLimit}` : ""}, so the model is fetched again whenever the pod is replaced.`,
    });
  }
  check(storage.length > 0, `${fileRel}: the sample declares no storage this module can describe`);
  const storageSummary = storage.map((item) => item.detail).join(" ");

  // GPU. The count and where it was read come from the profile library, so the
  // record and the member rows cannot disagree.
  const gpu = {
    count: fact.gpuCount,
    source: fact.gpuCountSource,
    resource: gpuResourceName(fact.gpuCountSource),
    replicas: Number.isInteger(spec.replicas) ? spec.replicas : 1,
  };
  const gpuSentence = fact.gpuCountSource === "draResources"
    ? `The NIMService requests ${plural(gpu.count, "GPU")} per pod through a Dynamic Resource Allocation claim, with ${plural(gpu.replicas, "replica")}.`
    : `The NIMService requests ${plural(gpu.count, "GPU")} per pod as ${gpu.resource}, with ${plural(gpu.replicas, "replica")}.`;

  // Destination facts the bytes name, beyond the operator, the Secrets, the
  // storage and the GPU.
  const namespace = service.metadata?.namespace ? String(service.metadata.namespace) : "";
  const requirements = [];
  const need = (name, purpose) => requirements.push({ category: "target-fact", name, purpose });
  need("gpu-request", `${gpuSentence} A destination needs that many allocatable GPUs of a kind the image supports, and nothing here checked one.`);
  need(
    "namespace",
    namespace
      ? `Every object in the sample is in the ${namespace} namespace. The sample ships no Namespace object, so the namespace must exist before apply.`
      : "The sample sets no namespace, so the destination chooses one and it must exist before apply.",
  );
  const limits = spec.resources?.limits ?? {};
  for (const resource of Object.keys(limits)) {
    if (["cpu", "memory", "nvidia.com/gpu", "nvidia.com/pgpu"].includes(resource)) continue;
    need(`extended-resource-${resource.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, `The NIMService requests the extended resource ${resource}=${limits[resource]}, so a device plugin on the destination has to advertise it.`);
  }
  if (spec.inferencePlatform) {
    need("inference-platform", `The sample sets spec.inferencePlatform to ${spec.inferencePlatform}, so that platform must be installed on the destination before the operator can serve this NIMService.`);
  }
  const annotations = spec.annotations ?? {};
  if (Object.keys(annotations).some((key) => key.startsWith("autoscaling.knative.dev/"))) {
    need("knative-serving", "The sample carries autoscaling.knative.dev annotations, so Knative Serving must be installed on the destination.");
  }
  if (annotations["k8s.v1.cni.cncf.io/networks"]) {
    need("secondary-network", `The sample attaches the pods to the secondary network ${annotations["k8s.v1.cni.cncf.io/networks"]}, so a network attachment of that name must exist on the destination.`);
  }
  const routers = [["spec.expose.router", spec.expose?.router], ["spec.router", spec.router]].filter(([, router]) => router);
  for (const [field, router] of routers) {
    if (router.gateway) {
      const routes = [router.gateway.httpRoutesEnabled ? "HTTPRoute" : "", router.gateway.grpcRoutesEnabled ? "GRPCRoute" : ""].filter(Boolean).join(" and ");
      need("gateway", `${field}.gateway names the Gateway ${router.gateway.name} in namespace ${router.gateway.namespace}${routes ? ` and asks for ${routes} objects` : ""}. The Gateway API and that Gateway must exist on the destination.`);
      if (router.gateway.backendRef) {
        need("inference-pool-api", `${field}.gateway.backendRef names an ${router.gateway.backendRef.kind} in the ${router.gateway.backendRef.group} API group, so that API must be installed on the destination.`);
      }
    }
    if (router.ingress?.ingressClass) {
      need("ingress-class", `${field}.ingress names the ingress class ${router.ingress.ingressClass}, so an ingress controller serving that class must run on the destination.`);
    }
    if (router.hostDomainName) {
      need("host-domain", `${field}.hostDomainName is ${router.hostDomainName}, an example domain. A destination supplies its own.`);
    }
  }
  if (spec.expose?.ingress?.enabled) {
    const ingressSpec = spec.expose.ingress.spec ?? {};
    need("ingress-class", `spec.expose.ingress names the ingress class ${ingressSpec.ingressClassName ?? "(none)"}, so an ingress controller serving that class must run on the destination.`);
    const hosts = (ingressSpec.rules ?? []).map((rule) => rule.host).filter(Boolean);
    if (hosts.length > 0) need("host-domain", `spec.expose.ingress routes the host ${hosts.join(", ")}, an example domain. A destination supplies its own.`);
  }
  if (spec.metrics?.serviceMonitor) {
    const labels = Object.entries(spec.metrics.serviceMonitor.additionalLabels ?? {}).map(([key, value]) => `${key}=${value}`).join(", ");
    need("service-monitor-api", `The sample enables a ServiceMonitor${labels ? ` labelled ${labels}` : ""}, so the Prometheus Operator's ServiceMonitor API must exist on the destination.`);
  }
  if (spec.scale?.hpa) {
    const custom = (spec.scale.hpa.metrics ?? []).filter((metric) => metric.type !== "Resource").map((metric) => metric.object?.metric?.name ?? metric.type);
    need(
      "autoscaling",
      custom.length > 0
        ? `The sample enables a HorizontalPodAutoscaler that reads the metric ${custom.join(", ")}, so a metrics adapter on the destination has to serve it.`
        : "The sample enables a HorizontalPodAutoscaler on resource metrics, so the destination needs a metrics server.",
    );
  }
  if (spec.multiNode) {
    const backend = Object.keys(spec.multiNode).filter((key) => key !== "parallelism").join(", ") || "no backend named";
    need("multi-node-serving", `The sample sets spec.multiNode (${backend}), so one model spans several pods. The destination needs whatever the operator uses to group those pods, and this entry has not established what that is.`);
  }
  if (spec.draResources) {
    const classes = new Set();
    for (const claim of spec.draResources) {
      for (const device of claim.claimCreationSpec?.devices ?? []) classes.add(device.deviceClassName ?? "gpu.nvidia.com");
    }
    for (const other of others.filter((doc) => doc.kind === "ResourceClaimTemplate")) {
      for (const request of other.spec?.spec?.devices?.requests ?? []) if (request.exactly?.deviceClassName) classes.add(request.exactly.deviceClassName);
    }
    need("dynamic-resource-allocation", `The sample claims its GPU through Dynamic Resource Allocation${classes.size > 0 ? ` with device class ${[...classes].sort().join(", ")}` : ""}. The destination needs the resource.k8s.io API and a driver that publishes that class.`);
  }
  if (spec.runtimeClassName) {
    need("runtime-class", `The sample sets runtimeClassName to ${spec.runtimeClassName}, so that RuntimeClass must exist on the destination.`);
  }
  if (spec.priorityClassName) {
    need("priority-class", `The sample sets priorityClassName to ${spec.priorityClassName}. The sample ships no PriorityClass, so one of that name must exist on the destination.`);
  }
  const nodeTerms = spec.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms ?? [];
  const nodeLabels = nodeTerms.flatMap((term) => (term.matchExpressions ?? []).map((expression) => `${expression.key} ${expression.operator} ${(expression.values ?? []).join(",")}`));
  if (nodeLabels.length > 0) {
    need("node-labels", `The sample schedules only onto nodes where ${nodeLabels.join(" and ")}, so the destination's nodes must carry that label.`);
  }
  const hubModels = [];
  for (const cache of caches) {
    const hf = cache.spec?.source?.hf;
    if (hf) hubModels.push(`${hf.namespace}/${hf.modelName} from ${hf.endpoint}`);
  }
  for (const variable of spec.env ?? []) {
    if (typeof variable.value === "string" && variable.value.startsWith("hf://")) hubModels.push(`${variable.value.slice("hf://".length)} from Hugging Face`);
  }
  if (hubModels.length > 0) {
    need("hugging-face-model", `The sample fetches model weights for ${[...new Set(hubModels)].join(", ")}. Those weights carry their own licence, and this entry fetched none of them.`);
  }
  check(
    new Set(requirements.map((item) => item.name)).size === requirements.length,
    `${fileRel}: two destination requirements share one name (${requirements.map((item) => item.name).join(", ")})`,
  );

  // The retained operator release, and whether it defines every field the
  // sample sets.
  const outside = [];
  for (const doc of docs) {
    const schema = operator.schemas[doc.kind];
    if (!schema) continue;
    check(doc.apiVersion === OPERATOR_API_VERSION, `${fileRel}: ${doc.kind} ${doc.metadata.name} uses ${doc.apiVersion}, not ${OPERATOR_API_VERSION}`);
    for (const field of fieldsOutsideSchema(schema.spec, doc.spec ?? {})) outside.push(`${doc.kind} ${field}`);
  }
  outside.sort();

  // Open questions. Each is one sentence about something the bytes raise and
  // this module cannot settle.
  const openQuestions = [];
  for (const image of gatedImages) {
    const [repository] = image.reference.split(/:(?=[^/]*$)/);
    if (ngcCatalogPageFor(repository) === null) {
      openQuestions.push(`The image ${image.reference} is on an NVIDIA registry path outside the public nvcr.io/nim catalog, so can a user outside NVIDIA pull it at all?`);
    }
  }
  if (outside.length > 0) {
    openQuestions.push(`The sample sets ${outside.join(" and ")}, which the definition retained from operator ${operator.retainedTag} does not declare, so which operator release accepts it?`);
  }
  const placeholders = placeholdersIn(spec, ["spec"], []);
  if (placeholders.length > 0) {
    openQuestions.push(`The sample carries the placeholder ${placeholders.map((item) => item.value).join(", ")} in ${placeholders.map((item) => item.field).join(", ")}, so what value should a published variant carry?`);
  }
  if (cacheRef && !cacheInFile) {
    openQuestions.push(`The NIMService reads NIMCache ${cacheRef}, which the sample file does not define, so which cache definition belongs with this variant?`);
  }

  const versionRange = outside.length === 0 ? `>=${operator.floorVersion}` : `>${operator.floorVersion}`;
  const operatorRequirement = {
    chart: operator.chart,
    chartRepository: operator.chartRepository,
    apiVersion: OPERATOR_API_VERSION,
    kinds: [...new Set(docs.filter((doc) => operator.schemas[doc.kind]).map((doc) => doc.kind))].sort(),
    customResourceDefinitions: [...new Set(docs.filter((doc) => operator.schemas[doc.kind]).map((doc) => operator.schemas[doc.kind].crdName))].sort(),
    versionRange,
    versionFloorChecked: operator.floorVersion,
    versionFloorBasis: outside.length === 0
      ? `Every field this sample sets is declared by the ${OPERATOR_API_VERSION} definitions retained from operator ${operator.retainedTag} under ${OPERATOR_CRD_DIR}.`
      : `The sample sets ${outside.join(" and ")}, which the ${OPERATOR_API_VERSION} definitions retained from operator ${operator.retainedTag} under ${OPERATOR_CRD_DIR} do not declare.`,
    versionCeiling: `The newest operator release this sample works with is not established. The sample was retained from upstream commit ${source.commit}, and this repository does not record which operator release contains that commit.`,
    fieldsOutsideRetainedDefinition: outside,
    catalogEntry: "not-in-the-catalog-on-this-branch",
    catalogEntryNote: `The ${operator.chart} chart is not yet a Catalog entry on this branch, so this requirement names the chart and does not link a record.`,
  };

  const slug = fact.slug;
  const entryDir = `${NIMSERVICE_ENTRY_ROOT}/${slug}`;
  return {
    slug,
    recordName: `${NIMSERVICE_RECORD_PREFIX}${slug}`,
    scenario: fact.scenario,
    nimService: { name: String(service.metadata.name), namespace },
    fileRel,
    fileSha256: fact.sha256,
    profileRel: `${posix(PROFILES_DIR)}/${slug}.yaml`,
    receiptRel: `${posix(RECEIPTS_DIR)}/${slug}.yaml`,
    entryDir,
    entryRel: `${entryDir}/entry.yaml`,
    verdictRel: `${entryDir}/flattening-safety-verdict.yaml`,
    operatorRouteRel: `${entryDir}/operator-first-ordering.yaml`,
    secretRouteRel: `${entryDir}/user-supplied-secrets.yaml`,
    source,
    objects,
    objectCount: objects.length,
    objectSetSha256: objectSetSha256(docs),
    nimCaches: caches.map((cache) => String(cache.metadata.name)),
    nimCacheIncluded: caches.length > 0,
    nimCacheRef: cacheRef,
    otherObjects: others.map((doc) => `${doc.kind} ${doc.metadata.name}`),
    image: servedImage,
    imagePinnedBy: pinnedBy(servedImage),
    images,
    gatedImages: gatedImages.map((image) => image.reference),
    ngcCatalogPage: fact.ngcCatalogPage,
    secrets,
    pullSecrets,
    authSecrets,
    storage,
    storageSummary,
    gpu,
    gpuSentence,
    requirements,
    operator: operatorRequirement,
    openQuestions,
    attention: openQuestions.length > 0 ? "watch" : "",
  };
}

// The pure function every caller uses. It returns one entry per retained
// NIMService sample, in slug order.
export function loadNimServiceEntries({ root = repoRoot } = {}) {
  const report = buildNimOperatorModelsReport(root);
  const receipt = readYaml(repoPath(root, NIMSERVICE_RETENTION_RECEIPT));
  const source = receipt.spec?.source ?? {};
  check(/^[0-9a-f]{40}$/.test(String(source.commit ?? "")), `${NIMSERVICE_RETENTION_RECEIPT}: the retained commit is not a full commit id`);
  const boundary = receipt.spec?.boundary ?? {};
  check(
    boundary.configPlaneOnly === true
      && boundary.nimContainersRan === false
      && boundary.modelsFetched === false
      && boundary.ngcArtifactsPulled === false
      && boundary.secretValuesIncluded === false,
    `${NIMSERVICE_RETENTION_RECEIPT} no longer says the corpus is configuration only with nothing pulled and nothing run, so this module may not describe it`,
  );
  check(source.license === "Apache-2.0", `${NIMSERVICE_RETENTION_RECEIPT}: the retained corpus is no longer recorded as Apache-2.0`);
  const operator = loadOperator(root);
  const pinned = {
    name: String(source.name),
    repository: String(source.repository),
    commit: String(source.commit),
    subtree: String(source.subtree),
    license: String(source.license),
    retrievedAt: String(source.retrievedAt),
  };
  const entries = report.facts
    .map((fact) => readEntry(root, fact, pinned, operator))
    .sort((left, right) => (left.slug < right.slug ? -1 : 1));
  check(entries.length > 0, "no retained NIMService sample was discovered");
  check(new Set(entries.map((entry) => entry.recordName)).size === entries.length, "two retained NIMService samples share one record name");
  check(new Set(entries.map((entry) => entry.fileRel)).size === entries.length, "two NIMService records would be built from one sample file");
  for (const entry of entries) entry.siblingRecordNames = entries.map((item) => item.recordName);
  // The artifact a publication would push, built from the sample and the two
  // route files as this module renders them, and the receipt for it if one is
  // tracked. The route files say nothing about publication, so the artifact
  // digest does not move when a variant is published.
  for (const entry of entries) {
    const rendered = new Map([
      [entry.operatorRouteRel, serializeYaml(operatorRouteDoc(entry))],
      [entry.secretRouteRel, serializeYaml(secretRouteDoc(entry))],
    ]);
    entry.artifact = buildNimServiceArtifact(entry, {
      root,
      readText: (rel) => rendered.get(rel) ?? readFileSync(repoPath(root, rel), "utf8"),
    });
    entry.publication = loadNimServicePublication(entry, { root, artifact: entry.artifact });
  }
  return entries;
}

// The sentences every record carries about what was not done. They are written
// once here so the record, the verdict and the routes use the same words.
export function boundarySentences(entry) {
  const gated = entry.gatedImages.length > 0
    ? `The container image${entry.gatedImages.length === 1 ? "" : "s"} ${entry.gatedImages.join(" and ")} and the model weights are gated by NVIDIA. This entry did not pull them, does not hold them and will never redistribute them.`
    : "The model weights are gated by their publisher. This entry did not fetch them and does not hold them.";
  return {
    // What is true of publication, read from the receipt. The key keeps its
    // name because every caller puts this sentence where that limit goes.
    notPublished: entry.publication?.published
      ? `This variant is published as a literal configuration OCI at ${entry.publication.observedReference}, with its two route files. Nothing was uploaded to ConfigHub.`
      : "This variant is not published. No OCI artifact exists for it, and nothing was uploaded to ConfigHub.",
    notDeployed: "This variant is not deployed. No operator reconciled it, no model was run, and no cluster or GPU was contacted.",
    gated,
    license: `The sample file is ${entry.source.license} configuration from ${entry.source.repository}, retained with its licence at ${NIMSERVICE_UPSTREAM_LICENSE}. The image and the weights are governed by NVIDIA's own terms and by each artifact's terms on NGC. ${NIMSERVICE_LICENSE_READ} records the general read, and nobody has read the terms for this exact artifact.`,
  };
}

function secretSentence(secret) {
  return `${secret.name} (${secret.namedBy.join(", ")})`;
}

export function operatorStages(entry) {
  const stages = [
    {
      order: 1,
      name: "nim-operator-installed",
      selector: { kinds: ["CustomResourceDefinition"], names: entry.operator.customResourceDefinitions },
      waitFor: `The ${entry.operator.chart} controller is running and the listed definitions are established. They come from the operator chart, not from this sample.`,
      objectCount: 0,
    },
    {
      order: 2,
      name: "user-secrets-present",
      selector: { kinds: ["Secret"], names: [...new Set(entry.secrets.map((secret) => secret.name))].sort() },
      waitFor: "The user has created each named Secret in the sample's namespace. No Secret ships in this sample.",
      objectCount: 0,
    },
  ];
  const before = entry.objects.filter((object) => object.kind !== "NIMService");
  if (before.length > 0) {
    stages.push({
      order: stages.length + 1,
      name: "model-cache-and-claims",
      selector: { kinds: [...new Set(before.map((object) => object.kind))].sort(), names: [...new Set(before.map((object) => object.name))].sort() },
      waitFor: entry.nimCacheIncluded
        ? "The operator reports the NIMCache ready, which means it pulled the model with the user's own entitlement."
        : "The listed objects exist.",
      objectCount: before.length,
    });
  }
  stages.push({
    order: stages.length + 1,
    name: "nim-service",
    selector: { kinds: ["NIMService"], names: [entry.nimService.name] },
    objectCount: 1,
  });
  return stages;
}

function entryDoc(entry) {
  const boundary = boundarySentences(entry);
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "NIMServiceCatalogEntry",
    metadata: { name: entry.recordName },
    spec: {
      catalogEntry: NIMSERVICE_SOURCE_NAME,
      variant: entry.slug,
      scenario: entry.scenario,
      source: {
        ...entry.source,
        file: entry.fileRel,
        fileSha256: entry.fileSha256,
        retentionReceipt: NIMSERVICE_RETENTION_RECEIPT,
      },
      objects: {
        count: entry.objectCount,
        objectSetSha256: entry.objectSetSha256,
        digestMethod: "sha256 over the JSON of every object in the file, each paired with its apiVersion|kind|namespace|name identity and sorted by that identity",
        identities: entry.objects.map((object) => object.identity),
        nimCacheIncluded: entry.nimCacheIncluded,
        nimCaches: entry.nimCaches,
        otherObjects: entry.otherObjects,
      },
      images: entry.images,
      secrets: entry.secrets,
      gpu: entry.gpu,
      storage: entry.storage,
      operator: entry.operator,
      destinationRequirements: entry.requirements.map((item) => ({ name: item.name, detail: item.purpose })),
      licensing: {
        sampleLicense: entry.source.license,
        sampleLicenseFile: NIMSERVICE_UPSTREAM_LICENSE,
        ngcCatalogPage: entry.ngcCatalogPage,
        governingTermsRead: false,
        licenseRead: NIMSERVICE_LICENSE_READ,
        statement: boundary.license,
      },
      attention: {
        status: entry.attention || "none",
        openQuestions: entry.openQuestions,
      },
    },
    status: {
      result: entry.publication?.published ? "retained-published" : "retained-not-published",
      published: entry.publication?.published === true,
      ...(entry.publication?.published
        ? { publicationReceipt: entry.publication.receiptRel, publishedReference: entry.publication.observedReference }
        : {}),
      uploadedToConfigHub: false,
      deployed: false,
      imagePulled: false,
      modelFetched: false,
      modelRun: false,
    },
  };
}

function verdictDoc(entry) {
  const boundary = boundarySentences(entry);
  const secretNames = [...new Set(entry.secrets.map((secret) => secret.name))].sort();
  const absent = (className, detail) => ({ class: className, finding: "absent", detail, disposition: "none required" });
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "FlatteningSafetyVerdict",
    metadata: { name: entry.recordName },
    spec: {
      subject: {
        kind: "nimservice-sample",
        entry: entry.fileRel,
        platformDigest: `sha256:${entry.objectSetSha256}`,
        upstreamVersion: entry.source.commit,
        note: `The subject is one retained NIMService sample file, ${plural(entry.objectCount, "object")} from scenario ${entry.scenario}. platformDigest is the object-set digest of that file.`,
      },
      dispositions: [
        absent("helm-hooks", "the sample is plain YAML and carries no helm.sh/hook annotation"),
        absent("resource-policy-keep", "the sample carries no helm.sh/resource-policy annotation"),
        absent("lookup", "the sample is plain YAML, so nothing is evaluated at template time"),
        absent("webhook-ca", "the sample holds no webhook configuration"),
        absent("capabilities-api-versions", "the sample is plain YAML, so nothing is selected by cluster capabilities"),
        {
          class: "generated-secrets",
          finding: "present",
          detail: `the sample names ${plural(secretNames.length, "Secret")} it does not ship (${secretNames.join(", ")})`,
          disposition: `route recorded beside this verdict at ${entry.secretRouteRel}; the user supplies each Secret, and no value is held here`,
          companionRequired: "external-secret-reference",
        },
        {
          class: "crd-ordering",
          finding: "present",
          detail: `every object the operator owns is a custom resource of ${entry.operator.apiVersion}, defined by ${entry.operator.customResourceDefinitions.join(" and ")}, which the sample does not ship`,
          disposition: `route recorded beside this verdict at ${entry.operatorRouteRel}; no runtime has executed it`,
          companionRequired: "apply-ordering",
        },
        absent("immutable-fields", "the sample is applied as written and no retained evidence names an immutable field change"),
        {
          class: "namespace-creation",
          finding: "absent",
          detail: entry.nimService.namespace
            ? `no Namespace object ships in the sample; the ${entry.nimService.namespace} namespace must exist before apply`
            : "no Namespace object ships in the sample, and the sample sets no namespace",
          disposition: "declared at ingest",
        },
        absent("subchart-conditions", "the sample is plain YAML and has no subchart"),
        absent("test-hooks", "the sample carries no test hook"),
      ],
      componentScope: {
        mode: "reconciled-late-by-the-nim-operator",
        referencedCharts: [entry.operator.chart],
        statement: `Flattened here means the custom resources as written. The ${entry.operator.chart} controller turns them into Deployments, Services and volumes on the cluster, and this verdict does not render or assess those. The chart is named as a prerequisite at ${entry.operator.versionRange}, and it is not a Catalog entry on this branch.`,
      },
      verdict: {
        lane: "flatten-with-routes",
        rationale: "The sample is born as exact objects, so nothing is rendered. It is usable only after the operator's definitions and controller exist and the user has created the Secrets it names, and those are lifecycle requirements this lane records as routes.",
        routes: [
          `operator-first ordering, recorded at ${entry.operatorRouteRel} and not executed`,
          `user-supplied Secrets by name, recorded at ${entry.secretRouteRel} and not executed`,
        ],
      },
      boundedness: [
        boundary.notPublished,
        boundary.notDeployed,
        boundary.gated,
        entry.operator.versionFloorBasis,
        entry.operator.versionCeiling,
        entry.storageSummary,
        entry.gpuSentence,
        ...entry.openQuestions.map((question) => `Open question. ${question}`),
      ],
      provenance: {
        emittedBy: NIMSERVICE_GENERATOR,
        generatedFrom: [entry.fileRel, NIMSERVICE_RETENTION_RECEIPT, ...Object.values(OPERATOR_CRDS), OPERATOR_APPLICATION],
      },
    },
  };
}

function operatorRouteDoc(entry) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-operator-first-ordering` },
    spec: {
      quirkClass: "crd-ordering",
      routeKind: "apply-ordering",
      discharges: `Without this order the API server rejects the sample, because ${entry.operator.customResourceDefinitions.join(" and ")} do not exist until the ${entry.operator.chart} chart is installed.`,
      declaration: {
        stages: operatorStages(entry),
        prerequisite: {
          chart: entry.operator.chart,
          chartRepository: entry.operator.chartRepository,
          versionRange: entry.operator.versionRange,
          versionFloorChecked: entry.operator.versionFloorChecked,
          apiVersion: entry.operator.apiVersion,
          catalogEntry: entry.operator.catalogEntry,
          note: entry.operator.catalogEntryNote,
        },
      },
      executedBy: {
        runtimes: [
          { name: "Argo CD", mechanism: "a sync-wave or a separate Application for the operator chart ahead of this sample", proven: false },
          { name: "Flux", mechanism: "a dependsOn from the Kustomization that holds this sample to the one that installs the operator", proven: false },
          { name: "direct apply", mechanism: "install the operator chart, wait for its definitions, then apply the sample", proven: false },
        ],
        automatic: false,
      },
      boundedness: [
        entry.operator.versionFloorBasis,
        entry.operator.versionCeiling,
        entry.operator.catalogEntryNote,
        "No runtime has executed this route. Nothing in this repository has installed the operator or applied this sample on any cluster.",
      ],
      provenance: {
        emittedBy: NIMSERVICE_GENERATOR,
        generatedFrom: [entry.fileRel, ...Object.values(OPERATOR_CRDS), OPERATOR_APPLICATION, OPERATOR_CRD_RECEIPT],
        verdictRef: entry.verdictRel,
      },
    },
  };
}

function secretRouteDoc(entry) {
  const boundary = boundarySentences(entry);
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-user-supplied-secrets` },
    spec: {
      quirkClass: "generated-secrets",
      routeKind: "external-secret-reference",
      discharges: "Without these Secrets the image cannot be pulled and the model cannot be fetched, because both are gated and the sample carries Secret names and no values.",
      declaration: {
        namespace: entry.nimService.namespace || "the namespace the destination chooses",
        secrets: entry.secrets.map((secret) => ({
          name: secret.name,
          role: secret.role,
          namedBy: secret.namedBy,
          suppliedBy: "the user, from their own NVIDIA or model-hub entitlement",
          valueHeldHere: false,
        })),
      },
      executedBy: {
        runtimes: [
          { name: "the user's secret manager", mechanism: "create each named Secret in the sample's namespace before the sample is applied", proven: false },
          { name: "direct apply", mechanism: "kubectl create secret, run by the user with their own credential", proven: false },
        ],
        automatic: false,
      },
      boundedness: [
        "The sample carries Secret names only. No Secret value is in this repository, and no key or token was used to build this entry.",
        "The keys each Secret must hold are not declared by the retained objects, so this route names the Secrets and does not name their keys.",
        boundary.gated,
        "No runtime has executed this route.",
      ],
      provenance: {
        emittedBy: NIMSERVICE_GENERATOR,
        generatedFrom: [entry.fileRel],
        verdictRef: entry.verdictRel,
      },
    },
  };
}

const VERDICT_LANES = ["born-flattened", "safe-to-flatten", "flatten-with-routes", "unsafe-to-flatten"];

// Every generated file for every entry, as a map from repo-relative path to the
// exact text it must hold.
export function buildNimServiceEntryOutputs({ root = repoRoot, entries = loadNimServiceEntries({ root }) } = {}) {
  const outputs = new Map();
  for (const entry of entries) {
    const verdict = verdictDoc(entry);
    check(VERDICT_LANES.includes(verdict.spec.verdict.lane), `${entry.recordName}: the verdict lane is not in the flattening vocabulary`);
    check(
      verdict.spec.dispositions.every((row) => ["absent", "present", "present-gated", "not-evaluated"].includes(row.finding)),
      `${entry.recordName}: a verdict disposition uses a finding outside the schema`,
    );
    outputs.set(entry.entryRel, serializeYaml(entryDoc(entry)));
    outputs.set(entry.verdictRel, serializeYaml(verdict));
    outputs.set(entry.operatorRouteRel, serializeYaml(operatorRouteDoc(entry)));
    outputs.set(entry.secretRouteRel, serializeYaml(secretRouteDoc(entry)));
    outputs.set(entry.artifact.planRel, serializeYaml(nimServicePublicationPlanDoc(entry, entry.artifact)));
  }
  return outputs;
}

// The record generator resolves each entry's verdict through this function. A
// missing verdict, a verdict for other bytes, or one with no decided lane is
// refused, so a NIMService variant can never fall through to born-flattened or
// not-assessed without a word.
export function resolveNimServiceFlattening({ recordName, entry, readVerdict }) {
  const verdict = readVerdict(entry.verdictRel);
  check(
    verdict,
    `${recordName}: no flattening verdict at ${entry.verdictRel}, so this NIMService variant would silently read as born-flattened. Run npm run aicr-nim-operator-models:generate, then npm run config-catalog.`,
  );
  const subject = verdict.spec?.subject ?? {};
  check(subject.entry === entry.fileRel, `${recordName}: ${entry.verdictRel} names ${subject.entry ?? "no entry"} as its subject, and the record is built from ${entry.fileRel}`);
  check(
    subject.upstreamVersion === entry.source.commit,
    `${recordName}: ${entry.verdictRel} decides upstream commit ${subject.upstreamVersion ?? "none"}, and the retained commit is ${entry.source.commit}`,
  );
  check(
    subject.platformDigest === `sha256:${entry.objectSetSha256}`,
    `${recordName}: ${entry.verdictRel} decides object set ${subject.platformDigest ?? "none"}, and the retained sample hashes to sha256:${entry.objectSetSha256}`,
  );
  const lane = verdict.spec?.verdict?.lane ?? "not-assessed";
  check(
    VERDICT_LANES.includes(lane),
    `${recordName}: ${entry.verdictRel} carries no decided flattening lane (found ${lane}); a retained NIMService variant may not be left not-assessed`,
  );
  check(
    lane === "flatten-with-routes",
    `${recordName}: ${entry.verdictRel} says ${lane}, and a NIMService needs its operator and its Secrets first, which only flatten-with-routes records`,
  );
  return { verdictPath: entry.verdictRel, verdict: lane };
}

export function secretNamesSentence(secrets) {
  return secrets.map(secretSentence).join("; ");
}
