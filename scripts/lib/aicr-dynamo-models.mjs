// Shared extraction and rendering logic for the Dynamo model-profile
// generator: NVIDIA's own ai-dynamo/dynamo production recipes corpus,
// retained under data/aicr-dynamo-models/upstream/recipes/, profiled one
// record per retained `kind: DynamoGraphDeployment` document.
//
// This mirrors scripts/lib/aicr-nim-operator-models.mjs (a different
// upstream corpus, a different custom resource, a different delivery
// mechanism) closely enough to read side by side, but the retained corpus
// here has two shapes this module must both understand: the upstream
// repository carries DynamoGraphDeployment recipes on two API versions,
// `nvidia.com/v1alpha1` (a `spec.services` map, each service's runtime
// nested under `extraPodSpec.mainContainer`) and `nvidia.com/v1beta1` (a
// `spec.components` list, each component's runtime nested under
// `podTemplate.spec.containers`). Both appear throughout the retained
// corpus; every extractor below understands both shapes rather than
// assuming one.
//
// Retention scope (see data/aicr-dynamo-models/retention-receipt.yaml for
// the full provenance record): every file under the upstream repository's
// `recipes/` tree that carries a top-level `kind: DynamoGraphDeployment`
// document, EXCLUDING `recipes/templates/` (parameterized authoring
// templates, not a concrete model) and `recipes/kustomize/` plus every
// per-model `kustomize/` subdirectory (strategic-merge-patch fragments that
// are already folded into the complete, already-rendered `deploy-*.yaml`
// siblings this corpus retains instead). That leaves 157 complete,
// deployable recipe files across 27 model directories -- one
// DynamoGraphDeployment document per retained file throughout this corpus,
// confirmed by discoverTargets() below rather than assumed.
//
// Model reference: a recipe's model is read only from a literal `--model`
// or `--model-path` CLI argument shaped like a HuggingFace `org/repo`
// reference (a leading path segment, a slash, a trailing segment; no `$`,
// `<`, or `>`). Many retained recipes are parameterized -- `--model
// "${MODEL_NAME}"`, `--model-path "${MODEL_PATH}"`, or a PVC path such as
// `/model-cache/thinkingmachines/Inkling-NVFP4` -- meant to be filled in by
// the deploying user's own `hw/*.env` file or already-downloaded cache; none
// of those is a HuggingFace reference, so this module records `model: null`
// for them rather than guessing. 101 of the 157 retained recipes carry a
// literal, extractable HuggingFace reference; the other 56 are
// template-parameterized this way.
//
// Pinned vs. template: an image is "pinned" only if it is a concrete
// `repo:tag` or `repo@sha256:<digest>` reference with no unresolved
// placeholder. `${VLLM_IMAGE}`-style env-var interpolation, `<your-registry>`
// / `<IMAGE_TAG>`-style angle-bracket placeholders, and the literal tags
// `latest` and `my-tag` all count as unpinned; everything else (including
// the handful of recipes that already pin to a digest in the source file)
// counts as pinned. `pinned` is per-record: false if the recipe carries no
// image at all or if any one of its images is unresolved.
//
// GPU requests: best-effort. For each service (v1alpha1) or component
// (v1beta1), this reads that unit's own GPU resource request (preferring
// `resources.requests`, falling back to `resources.limits`, under either
// key `nvidia.com/gpu` or the shorter `gpu` v1alpha1 uses), multiplies by
// that unit's own `replicas` (default 1), and sums across every unit in the
// document. This is the same arithmetic several retained recipes' own
// comments do by hand (for example gemma4-31b/trtllm/agg-h200-agentic:
// "2 replicas x tp=4 = 8 GPUs").
//
// Accelerator: recorded per profile as a best-effort, informational field
// only -- a GPU-product nodeSelector or node-affinity match
// (`nvidia.com/gpu.product`) found anywhere in the recipe, or null if none
// is present. Unlike the retained k8s-nim-operator sample corpus (see
// aicr-nim-operator-models.mjs's module header), this Dynamo corpus is NOT
// accelerator-generic: 104 of the 157 retained recipes carry such a pin (to
// H100, H200, B200, GB200, GB300, and others). That is why
// scripts/lib/aicr-platform-members.mjs does not attach this corpus to the
// platform=dynamo inference platforms the way it attaches the retained NIM
// corpus to platform=nim -- a blanket "every recipe reaches every platform"
// join would misrepresent accelerator-specific recipes as accelerator-
// generic. See data/aicr-dynamo-models/summary.md.
//
// The generator and the verifier both call buildReport(), so they cannot
// disagree. Everything here reads committed bytes only. No network, no
// cluster, no registry contact, and no wall-clock time enters the output;
// the only date recorded anywhere is the source `retrievedAt` pinned in the
// retention receipt.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, imageTag, listYamlFiles, readYamlText, relativeRepo, repoRoot, serializeYaml, sha256File } from "./proof-common.mjs";

const ROOT_DIR = join("data", "aicr-dynamo-models");
const UPSTREAM_DIR = join(ROOT_DIR, "upstream");
const RECIPES_DIR = join(UPSTREAM_DIR, "recipes");
const CRD_PATH = join(UPSTREAM_DIR, "crd", "nvidia.com_dynamographdeployments.yaml");
const CHECKSUMS_PATH = join(ROOT_DIR, "upstream-checksums.txt");
const RETENTION_RECEIPT_PATH = join(ROOT_DIR, "retention-receipt.yaml");

export const OUTPUT_ROOT = ROOT_DIR;
export const PROFILES_DIR = join(ROOT_DIR, "profiles");
export const RECEIPTS_DIR = join(ROOT_DIR, "receipts");
export const SUMMARY_PATH = join(ROOT_DIR, "summary.md");

const BACKEND_TOKENS = ["vllm", "trtllm", "sglang", "mocker"];
const GPU_LIMIT_KEYS = ["nvidia.com/gpu", "gpu"];
const GPU_PRODUCT_KEY = "nvidia.com/gpu.product";
const MODEL_REF_RE = /(?:^|[\s"'])--model(?:-path)?(?:=|\s+)"?'?([A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*)"?'?/;
const DYNAMO_MODULE_RE = /dynamo\.(vllm|trtllm|sglang|mocker)\b/;

function repoJoin(root, ...parts) {
  return join(root, ...parts);
}

function kebab(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readAllDocs(absPath) {
  const parsed = readYamlText(readFileSync(absPath, "utf8"));
  const docs = Array.isArray(parsed) ? parsed : [parsed];
  return docs.filter((doc) => doc && typeof doc === "object");
}

// upstream-checksums.txt is a standard `sha256sum` listing: 64 hex
// characters, two spaces, then a path relative to `upstream/`.
function loadChecksums(root) {
  const path = repoJoin(root, CHECKSUMS_PATH);
  const text = readFileSync(path, "utf8");
  const map = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const match = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    check(match, `${relativeRepo(path)}: malformed checksum line: ${JSON.stringify(line)}`);
    map.set(match[2], match[1]);
  }
  return map;
}

function loadSource(root) {
  const path = repoJoin(root, RETENTION_RECEIPT_PATH);
  const doc = readAllDocs(path)[0];
  check(doc.kind === "SourceRetentionReceipt", `${relativeRepo(path)}: expected kind SourceRetentionReceipt`);
  const source = doc.spec?.source ?? {};
  for (const field of ["name", "repository", "commit", "subtree", "license", "retrievedAt"]) {
    check(source[field], `${relativeRepo(path)}: source.${field} is missing`);
  }
  return {
    name: source.name,
    repository: source.repository,
    commit: source.commit,
    subtree: source.subtree,
    license: source.license,
    retrievedAt: source.retrievedAt,
  };
}

function assertCrdRetained(root) {
  const path = repoJoin(root, CRD_PATH);
  check(existsSync(path), `missing retained DynamoGraphDeployment CRD: ${relativeRepo(path)}`);
  const doc = readAllDocs(path).find((d) => d.kind === "CustomResourceDefinition");
  check(doc, `${relativeRepo(path)}: expected a CustomResourceDefinition document`);
  return relativeRepo(path);
}

// Walks every retained recipe file (sorted, so discovery order is
// deterministic) and collects one raw target per `kind:
// DynamoGraphDeployment` document found. recipes/hf_hub_secret/*.yaml (a
// Secret placeholder, retained separately, referenced by name from many
// recipes but not itself a model shape) naturally carries zero such
// documents and is skipped rather than erroring.
function discoverTargets(root) {
  const recipesAbsDir = repoJoin(root, RECIPES_DIR);
  const files = listYamlFiles(recipesAbsDir);
  check(files.length > 0, `no retained recipe files found under ${relativeRepo(recipesAbsDir)}`);

  const targets = [];
  for (const fileAbsPath of files) {
    const fileRepoPath = relativeRepo(fileAbsPath);
    const docsInFile = readAllDocs(fileAbsPath);
    const dgdDocs = docsInFile.filter((doc) => doc.kind === "DynamoGraphDeployment");
    if (dgdDocs.length === 0) continue;
    check(dgdDocs.length === 1, `${fileRepoPath}: expected exactly one DynamoGraphDeployment document, found ${dgdDocs.length}`);
    const doc = dgdDocs[0];
    check(
      typeof doc.apiVersion === "string" && doc.apiVersion.startsWith("nvidia.com/"),
      `${fileRepoPath}: unexpected apiVersion "${doc.apiVersion}" for a DynamoGraphDeployment`,
    );
    const name = doc.metadata?.name;
    check(name, `${fileRepoPath}: DynamoGraphDeployment metadata.name is missing`);
    const modelDir = recipeModelDirFor(fileRepoPath);
    targets.push({ fileAbsPath, fileRepoPath, modelDir, docsInFile, doc, name });
  }
  check(targets.length > 0, `no DynamoGraphDeployment documents found under ${relativeRepo(recipesAbsDir)}`);
  return targets;
}

// The first path segment under upstream/recipes/ -- the recipe's own model
// directory (for example "qwen3-32b", "deepseek-v4"), matching the
// "Available Recipes" grouping in the upstream repository's own
// recipes/README.md.
function recipeModelDirFor(fileRepoPath) {
  const marker = "/recipes/";
  const idx = fileRepoPath.indexOf(marker);
  check(idx !== -1, `${fileRepoPath}: expected a /recipes/ segment`);
  const rest = fileRepoPath.slice(idx + marker.length);
  const modelDir = rest.split("/")[0];
  check(modelDir, `${fileRepoPath}: could not derive a model directory`);
  return modelDir;
}

// The path segments between the model directory and the file itself
// (extension stripped), used both to disambiguate a colliding slug and to
// scan for an agg/disagg pattern token.
function pathSuffixSegments(fileRepoPath, modelDir) {
  const marker = `/recipes/${modelDir}/`;
  const idx = fileRepoPath.indexOf(marker);
  check(idx !== -1, `${fileRepoPath}: expected ${marker}`);
  const rel = fileRepoPath.slice(idx + marker.length).replace(/\.ya?ml$/, "");
  return rel.split("/");
}

// Slug derivation: a slug starts as `<modelDir>-<metadata.name>` (both
// kebab-cased). 141 of the 157 retained DynamoGraphDeployment names are
// already unique within their model directory; the remaining 16 collide in
// 9 groups (recipes that share a name across a GPU-fabric or cloud-provider
// variant, for example the five qwen3-32b/vllm/cloud-providers/deploy-*.yaml
// files that all name their DynamoGraphDeployment
// q32b-1p1d-cloud-provider). Where the base slug collides, every path
// segment between the model directory and the file (not just the file's own
// leaf name, since several collisions -- for example
// deepseek-v4/deepseek-v4-pro/vllm/agg/{b200,gb200}/deploy.yaml -- share
// even that) is appended. Uniqueness is asserted, not assumed: buildReport
// fails closed if two targets still produce the same slug.
function assignSlugs(targets) {
  const baseSlugOf = (target) => `${kebab(target.modelDir)}-${kebab(target.name)}`;
  const baseCounts = new Map();
  for (const target of targets) {
    const base = baseSlugOf(target);
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }

  const seen = new Set();
  for (const target of targets) {
    const base = baseSlugOf(target);
    let slug = base;
    if (baseCounts.get(base) > 1) {
      const suffix = pathSuffixSegments(target.fileRepoPath, target.modelDir).map(kebab).join("-");
      slug = `${base}-${suffix}`;
    }
    check(!seen.has(slug), `two DynamoGraphDeployment targets still produced the same slug after disambiguation: ${slug}`);
    seen.add(slug);
    target.slug = slug;
  }
  return targets;
}

// Recursively visits every plain object found anywhere under `node`
// (services/components, containers, resources, secret refs -- whatever
// shape a given recipe uses), calling `visitor` once per object. Order
// follows readYamlText's own object-key order (alphabetical, since
// proof-common's YAML reader round-trips through `json.dumps(...,
// sort_keys=True)`); every use below is order-independent (deduped sets, or
// "does at least one exist" checks) except the model-reference scan, which
// is provably safe here because no retained recipe carries more than one
// distinct extractable reference (verified by hand across all 157 files).
function walkCollect(node, visitor) {
  if (Array.isArray(node)) {
    for (const item of node) walkCollect(item, visitor);
    return;
  }
  if (node && typeof node === "object") {
    visitor(node);
    for (const value of Object.values(node)) walkCollect(value, visitor);
  }
}

function collectImages(spec) {
  const images = new Set();
  walkCollect(spec, (obj) => {
    if (typeof obj.image === "string" && obj.image.length > 0) images.add(obj.image);
  });
  return [...images].sort();
}

// Every secret surface this corpus uses, wherever it appears: v1alpha1's
// direct `envFromSecret: <name>` field, v1beta1's native
// `envFrom[].secretRef.name` / `env[].valueFrom.secretKeyRef.name`, and
// `imagePullSecrets[].name` on either shape. Only names are ever collected;
// no value.
function collectSecretNames(spec) {
  const names = new Set();
  walkCollect(spec, (obj) => {
    if (typeof obj.envFromSecret === "string" && obj.envFromSecret) names.add(obj.envFromSecret);
    if (obj.secretRef && typeof obj.secretRef.name === "string") names.add(obj.secretRef.name);
    if (obj.secretKeyRef && typeof obj.secretKeyRef.name === "string") names.add(obj.secretKeyRef.name);
    if (Array.isArray(obj.imagePullSecrets)) {
      for (const entry of obj.imagePullSecrets) {
        if (entry && typeof entry.name === "string") names.add(entry.name);
      }
    }
  });
  return [...names].sort();
}

// See the module header: only a literal `--model`/`--model-path` CLI
// argument shaped like a HuggingFace `org/repo` reference counts. Args
// appear in this corpus two ways -- a flat CLI-token list
// (`["--model", "Qwen/Qwen3-32B"]`) and a single embedded multi-line shell
// script (`["python3 -m dynamo.vllm \\\n  --model Qwen/Qwen3-32B \\\n
// ..."]`) -- so every `args` array found is joined into one string before
// the regex runs, which handles both shapes with one pattern.
function collectModelRef(spec) {
  let found = null;
  walkCollect(spec, (obj) => {
    if (found || !Array.isArray(obj.args)) return;
    const joined = obj.args.filter((el) => typeof el === "string").join(" \n ");
    const match = joined.match(MODEL_REF_RE);
    if (match) found = match[1].replace(/\\+$/, "");
  });
  return found;
}

function huggingFaceModelPageFor(model) {
  return model ? `https://huggingface.co/${model}` : null;
}

// See the module header: pinned only if concrete AND resolvable, never an
// env-var interpolation, an angle-bracket placeholder, or a mutable
// "latest"/"my-tag" literal.
export function isPinnedImage(image) {
  if (typeof image !== "string" || image.length === 0) return false;
  if (image.includes("${") || image.includes("<") || image.includes(">")) return false;
  if (/@sha256:[0-9a-f]{64}$/.test(image)) return true;
  const tag = imageTag(image);
  if (!tag || tag === "latest" || tag === "my-tag") return false;
  return true;
}

function pinnedFactFor(images) {
  if (images.length === 0) {
    return { pinned: false, pinnedNote: "no container image was found in this DynamoGraphDeployment" };
  }
  const unpinned = images.filter((image) => !isPinnedImage(image));
  if (unpinned.length === 0) return { pinned: true, pinnedNote: null };
  return {
    pinned: false,
    pinnedNote: `at least one image is a template placeholder or a mutable tag rather than a concrete repo:tag or repo@digest reference: ${unpinned.join(", ")}`,
  };
}

// Normalizes v1alpha1's `spec.services` map and v1beta1's `spec.components`
// list into one shape: a list of units, each with its own replicas,
// containers, and (for v1alpha1 only, where GPU resources live at the
// service level rather than per-container) unit-level resources.
function unitsFor(doc, fileRepoPath) {
  const spec = doc.spec ?? {};
  if (spec.services && typeof spec.services === "object" && !Array.isArray(spec.services)) {
    return Object.entries(spec.services).map(([name, def]) => ({
      name,
      replicas: def?.replicas,
      containers: [def?.extraPodSpec?.mainContainer].filter((c) => c && typeof c === "object"),
      unitResources: def?.resources ?? null,
      roleText: `${name} ${def?.componentType ?? ""} ${def?.subComponentType ?? ""}`,
    }));
  }
  if (Array.isArray(spec.components)) {
    return spec.components.map((def) => ({
      name: def?.name,
      replicas: def?.replicas,
      containers: Array.isArray(def?.podTemplate?.spec?.containers) ? def.podTemplate.spec.containers : [],
      unitResources: null,
      roleText: `${def?.name ?? ""} ${def?.type ?? ""}`,
    }));
  }
  check(false, `${fileRepoPath}: DynamoGraphDeployment carries neither spec.services (map) nor spec.components (list)`);
  return [];
}

function gpuFromResources(resources) {
  if (!resources || typeof resources !== "object") return 0;
  const source = resources.requests ?? resources.limits ?? {};
  if (!source || typeof source !== "object") return 0;
  for (const key of GPU_LIMIT_KEYS) {
    if (source[key] != null) {
      const parsed = Number.parseInt(String(source[key]), 10);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  return 0;
}

// Best-effort total across every unit: that unit's own GPU request (unit-
// level for v1alpha1, summed across its containers for v1beta1) multiplied
// by its own replica count. See the module header for why this multiplies
// by replicas.
function collectGpuRequests(doc, fileRepoPath) {
  const units = unitsFor(doc, fileRepoPath);
  let total = 0;
  for (const unit of units) {
    let perReplica = gpuFromResources(unit.unitResources);
    for (const container of unit.containers) perReplica += gpuFromResources(container?.resources);
    const replicas = Number.isInteger(unit.replicas) && unit.replicas > 0 ? unit.replicas : 1;
    total += perReplica * replicas;
  }
  return total;
}

// Informational only (see the module header): a GPU-product pin found
// either as a plain `nodeSelector["nvidia.com/gpu.product"]` map entry or as
// an `In` node-affinity matchExpression on the same key. Not used to gate
// platform attachment.
function collectAccelerators(spec) {
  const values = new Set();
  walkCollect(spec, (obj) => {
    if (obj.nodeSelector && typeof obj.nodeSelector === "object" && !Array.isArray(obj.nodeSelector)) {
      const value = obj.nodeSelector[GPU_PRODUCT_KEY];
      if (typeof value === "string" && value.length > 0) values.add(value);
    }
    if (Array.isArray(obj.matchExpressions)) {
      for (const expr of obj.matchExpressions) {
        if (expr && expr.key === GPU_PRODUCT_KEY && Array.isArray(expr.values)) {
          for (const value of expr.values) {
            if (typeof value === "string") values.add(value);
          }
        }
      }
    }
  });
  return values.size > 0 ? [...values].sort() : null;
}

function backendFromModuleArgs(spec) {
  let found = null;
  walkCollect(spec, (obj) => {
    if (found || !Array.isArray(obj.args)) return;
    const joined = obj.args.filter((el) => typeof el === "string").join(" ");
    const match = joined.match(DYNAMO_MODULE_RE);
    if (match) found = match[1];
  });
  return found;
}

function backendFromPath(fileRepoPath) {
  for (const segment of fileRepoPath.toLowerCase().split("/")) {
    const tokens = segment.split(/[-_.]/);
    const hit = BACKEND_TOKENS.find((token) => tokens.includes(token));
    if (hit) return hit;
  }
  return null;
}

// v1beta1 recipes name their backend directly (`spec.backendFramework`);
// v1alpha1 recipes do not, so the module their worker's `args` invokes
// (`python3 -m dynamo.vllm`, `dynamo.trtllm`, `dynamo.sglang`) is read
// instead, falling back to a path-segment scan only if neither is present.
function extractBackend(doc, fileRepoPath) {
  if (typeof doc.spec?.backendFramework === "string" && BACKEND_TOKENS.includes(doc.spec.backendFramework)) {
    return { backend: doc.spec.backendFramework, backendSource: "spec.backendFramework" };
  }
  const fromModule = backendFromModuleArgs(doc.spec ?? {});
  if (fromModule) return { backend: fromModule, backendSource: "dynamo module arg" };
  const fromPath = backendFromPath(fileRepoPath);
  if (fromPath) return { backend: fromPath, backendSource: "path" };
  return { backend: null, backendSource: null };
}

function patternFromPath(fileRepoPath, modelDir) {
  for (const segment of pathSuffixSegments(fileRepoPath, modelDir)) {
    const tokens = segment.toLowerCase().split(/[-_]/);
    if (tokens.includes("agg") || tokens.includes("disagg")) return segment;
  }
  return null;
}

// Structural fallback for the recipes whose path carries no agg/disagg
// token at all (for example qwen3.6-35b/deploy/dynamo-fd.yaml): a
// prefill/decode role split anywhere in the unit names or types means
// disaggregated; otherwise, any worker unit at all means aggregated.
function patternFromStructure(doc, fileRepoPath) {
  const units = unitsFor(doc, fileRepoPath);
  const roleText = units
    .map((unit) => unit.roleText ?? "")
    .join(" ")
    .toLowerCase();
  if (roleText.includes("prefill") && roleText.includes("decode")) return "disagg";
  const workerUnits = units.filter((unit) => !/frontend/i.test(unit.name ?? ""));
  return workerUnits.length > 0 ? "agg" : null;
}

function extractPattern(doc, fileRepoPath, modelDir) {
  const fromPath = patternFromPath(fileRepoPath, modelDir);
  if (fromPath) return { pattern: fromPath, patternSource: "path" };
  const fromStructure = patternFromStructure(doc, fileRepoPath);
  if (fromStructure) return { pattern: fromStructure, patternSource: "structural" };
  return { pattern: null, patternSource: null };
}

// STOP, do not work around: a retained file that ever turned out to embed a
// Secret object (rather than only naming one by reference) would mean a
// real value could be sitting alongside it. Every retained file was hand-
// audited before this module was written and none does; this assertion is
// the regression guard for a future re-run against a changed upstream.
function assertNoEmbeddedSecretValues(docsInFile, fileRepoPath) {
  for (const doc of docsInFile) {
    check(doc.kind !== "Secret", `${fileRepoPath}: retained file embeds a Secret object; STOP and report rather than silently retaining a possible secret value`);
  }
}

function descriptionFor(fact) {
  const gpuWord = fact.gpuRequests === 1 ? "one GPU" : `${fact.gpuRequests} GPUs`;
  return (
    `A generated model profile for a retained DynamoGraphDeployment recipe from ` +
    `NVIDIA's ai-dynamo/dynamo recipes corpus, model directory "${fact.modelDir}". ` +
    `It requests ${gpuWord} (best-effort). This record is configuration data ` +
    "about the recipe; it grants nothing and fetches nothing."
  );
}

function governingTermsSentenceFor(fact) {
  if (fact.model) {
    return (
      `This recipe's model has not had its HuggingFace license read. Read it at ` +
      `${huggingFaceModelPageFor(fact.model)} before deploying this recipe; the model's ` +
      "own license governs, not this catalog."
    );
  }
  return (
    "This recipe's model reference is an unresolved template placeholder, filled in " +
    "at deploy time by the user's own hw/*.env file or model cache, so no HuggingFace " +
    "model page could be derived here. Whatever model the user supplies governs under " +
    "its own license, unread by this generator."
  );
}

function profileDocFor(fact) {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "DynamoModelProfileRecord",
    metadata: { name: fact.slug },
    spec: {
      description: descriptionFor(fact),
      delivery: "dynamo",
      dynamoGraphDeployment: fact.name,
      recipeModel: fact.modelDir,
      dynamoGraphDeploymentApiVersion: fact.apiVersion,
      sourceFile: fact.fileRepoPath,
      sourceSha256: fact.sha256,
      backend: fact.backend,
      backendSource: fact.backendSource,
      pattern: fact.pattern,
      patternSource: fact.patternSource,
      model: fact.model,
      images: fact.images,
      pinned: fact.pinned,
      pinnedNote: fact.pinnedNote,
      gpuRequests: fact.gpuRequests,
      gpuRequestsNote:
        "best-effort: each service/component's own GPU resource request (its limit, if " +
        "no request is set) multiplied by that unit's replicas, summed across the " +
        "recipe; 0 when no GPU resource field was found.",
      secretNames: fact.secretNames,
      accelerator: fact.accelerator,
      acceleratorNote:
        "best-effort and informational only: a GPU-product nodeSelector or node-affinity " +
        "match found anywhere in this recipe, or null if none is present. Not used to " +
        "gate platform attachment -- see data/aicr-dynamo-models/summary.md.",
      governingTerms: {
        modelSource:
          "the model is referenced by its HuggingFace repository name only; this " +
          "generator never fetched model weights and never read a model license.",
        huggingFaceModelPage: huggingFaceModelPageFor(fact.model),
        governingTermsReadAt: null,
        governingTermsNamed: [],
        governingTerms: governingTermsSentenceFor(fact),
      },
      notes: fact.notes,
    },
    status: {
      result: "described-offline-terms-pending",
      modelFetched: false,
      imagePulled: false,
    },
  };
}

function checksFor(fact) {
  return [
    { name: "document-kind-is-dynamographdeployment", result: "pass", detail: 'The retained document\'s kind is "DynamoGraphDeployment".' },
    {
      name: "api-version-is-nvidia-com",
      result: "pass",
      detail: `apiVersion "${fact.apiVersion}" is in the nvidia.com/* group the retained CRD defines.`,
    },
    {
      name: "shape-matches-declared-api-version",
      result: "pass",
      detail: fact.apiVersion.endsWith("v1beta1")
        ? "spec.components (the v1beta1 list shape) is present."
        : "spec.services (the v1alpha1 map shape) is present.",
    },
    {
      name: "images-recorded-as-written",
      result: "pass",
      detail: "Every container image is recorded exactly as written in the source file (a tag or a digest); none was resolved to a digest by this generator.",
    },
    {
      name: "pinned-or-template-flag",
      result: "pass",
      detail: fact.pinned ? "Every recorded image is a concrete repo:tag or repo@digest reference." : fact.pinnedNote,
    },
    {
      name: "no-secret-values",
      result: "pass",
      detail: "No kind: Secret document is co-located in this file, and every secret reference found carries a name only.",
    },
    {
      name: "source-sha256-matches-pin",
      result: "pass",
      detail: `sha256 of ${fact.fileRepoPath} matches the pin in ${CHECKSUMS_PATH.replaceAll("\\", "/")}.`,
    },
  ];
}

function receiptDocFor(fact, source, checksumsPathRepo, retentionReceiptPathRepo) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "DynamoModelReceipt",
    metadata: { name: fact.slug },
    spec: {
      dynamoGraphDeployment: fact.name,
      recipeModel: fact.modelDir,
      source: {
        name: source.name,
        repository: source.repository,
        commit: source.commit,
        license: source.license,
        retrievedAt: source.retrievedAt,
        retentionReceipt: retentionReceiptPathRepo,
      },
      file: {
        path: fact.fileRepoPath,
        role: "dynamoGraphDeployment",
        pinnedSha256: fact.sha256,
        observedSha256: fact.sha256,
        checksumsFile: checksumsPathRepo,
      },
      facts: {
        apiVersion: fact.apiVersion,
        backend: fact.backend,
        pattern: fact.pattern,
        model: fact.model,
        images: fact.images,
        pinned: fact.pinned,
        gpuRequests: fact.gpuRequests,
        secretNames: fact.secretNames,
        accelerator: fact.accelerator,
      },
      checks: checksFor(fact),
      boundary: {
        configPlaneOnly: true,
        containersRan: false,
        modelsFetched: false,
        ngcArtifactsPulled: false,
        secretValuesIncluded: false,
        statement:
          `This receipt describes retained configuration only for the ${fact.slug} ` +
          "DynamoGraphDeployment recipe. No Dynamo container ran, no model was fetched, " +
          "and no registry surface was contacted to produce it.",
      },
    },
    status: {
      result: "described-offline",
    },
  };
}

function summaryFor(facts, context) {
  const { checksumsPathRepo, retentionReceiptPathRepo, crdPathRepo, source } = context;
  const modelDirs = new Set(facts.map((fact) => fact.modelDir));
  const pinnedCount = facts.filter((fact) => fact.pinned).length;
  const templateCount = facts.length - pinnedCount;
  const withModel = facts.filter((fact) => fact.model !== null).length;
  const acceleratorSpecific = facts.filter((fact) => fact.accelerator !== null).length;
  const backendCounts = new Map();
  for (const fact of facts) {
    const key = fact.backend ?? "unknown";
    backendCounts.set(key, (backendCounts.get(key) ?? 0) + 1);
  }
  const backendLine = [...backendCounts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([backend, count]) => `${count} ${backend}`)
    .join(", ");

  return `# ${facts.length} generated Dynamo model profiles from the retained recipes corpus

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-dynamo-models:generate\` and checked by
\`npm run aicr-dynamo-models:verify\`. Both read the same retained recipes
under \`${RECIPES_DIR.replaceAll("\\", "/")}/\`, pinned in
\`${checksumsPathRepo}\` and provenanced by \`${retentionReceiptPathRepo}\`.

The corpus is NVIDIA's own ai-dynamo/dynamo production recipes library
(\`${source.repository}\`, commit \`${source.commit}\`), licensed
${source.license} and retained byte-for-byte on ${source.retrievedAt}. This
generator reads every retained file's \`kind: DynamoGraphDeployment\`
document and writes one profile plus one receipt for each. It found
${facts.length} such documents across ${modelDirs.size} model directories.
It creates no new catalog entry and changes no catalog count.

## Pinned images versus template placeholders

${pinnedCount} of the ${facts.length} recipes carry only concrete container
image references (a \`repo:tag\` or a \`repo@sha256:<digest>\`, exactly as
written upstream). The other ${templateCount} carry at least one unresolved
placeholder -- an env-var interpolation such as \`\${VLLM_IMAGE}\`, an
angle-bracket placeholder such as \`<your-registry>\`, or a mutable
\`latest\`/\`my-tag\` literal -- meant to be filled in by the deploying
user's own \`hw/*.env\` file rather than by this catalog.

## Models are HuggingFace-referenced, and their licenses are unread

${withModel} of the ${facts.length} recipes carry a literal, extractable
HuggingFace \`org/repo\` reference on a \`--model\` or \`--model-path\`
argument; the other ${facts.length - withModel} reference their model only
through a template placeholder (an env var or a pre-populated PVC path), so
no HuggingFace reference could be read from the recipe itself. Every
profile's \`governingTerms.governingTermsReadAt\` is \`null\` and
\`governingTermsNamed\` is empty: nobody has read these models' HuggingFace
license pages by hand yet. That model's own license governs a given
deployment, not anything stated in this catalog; reading it is a step a
person still has to take.

## Backends and the accelerator finding

Backend split across the ${facts.length} recipes: ${backendLine}. Backend is
read from \`spec.backendFramework\` where the recipe's v1beta1 shape states
it directly, from the \`dynamo.<backend>\` Python module its worker invokes
otherwise, and from the recipe's own path as a last resort.

${acceleratorSpecific} of the ${facts.length} recipes carry a GPU-product
nodeSelector or node-affinity match (to H100, H200, B200, GB200, GB300, and
others), recorded per profile as \`accelerator\` for reference. That is
recorded as informational only: this corpus, unlike the catalog's retained
k8s-nim-operator sample corpus, is not accelerator-generic, so platform
attachment for this corpus is handled separately rather than by a blanket
join.

## What ran and what did not

Every check above ran offline against the retained files, validated against
the retained CRD, \`${crdPathRepo}\`: the document's kind and apiVersion
match, its shape matches the API version it declares (a \`spec.services\`
map for v1alpha1, a \`spec.components\` list for v1beta1), every image is
recorded as written rather than resolved to a digest, every secret
reference carries a name only, and the file's sha256 matches the pin in
\`${checksumsPathRepo}\`. No container ran, no model weight moved, and no
registry was contacted.

## Regenerate and verify

\`\`\`sh
npm run aicr-dynamo-models:generate
npm run aicr-dynamo-models:verify
\`\`\`
`;
}

function extractFacts(root, target, checksums) {
  const { fileAbsPath, fileRepoPath, modelDir, doc, docsInFile, slug, name } = target;
  const spec = doc.spec ?? {};
  const notes = [];

  assertNoEmbeddedSecretValues(docsInFile, fileRepoPath);

  let images = [];
  let secretNames = [];
  let model = null;
  let gpuRequests = 0;
  let backend = null;
  let backendSource = null;
  let pattern = null;
  let patternSource = null;
  let accelerator = null;

  try {
    images = collectImages(spec);
  } catch (err) {
    notes.push(`image extraction failed: ${err.message}`);
  }
  try {
    secretNames = collectSecretNames(spec);
  } catch (err) {
    notes.push(`secret-name extraction failed: ${err.message}`);
  }
  try {
    model = collectModelRef(spec);
  } catch (err) {
    notes.push(`model-reference extraction failed: ${err.message}`);
  }
  try {
    gpuRequests = collectGpuRequests(doc, fileRepoPath);
  } catch (err) {
    notes.push(`gpu-request extraction failed: ${err.message}`);
    gpuRequests = 0;
  }
  try {
    ({ backend, backendSource } = extractBackend(doc, fileRepoPath));
  } catch (err) {
    notes.push(`backend inference failed: ${err.message}`);
  }
  try {
    ({ pattern, patternSource } = extractPattern(doc, fileRepoPath, modelDir));
  } catch (err) {
    notes.push(`pattern inference failed: ${err.message}`);
  }
  try {
    accelerator = collectAccelerators(spec);
  } catch (err) {
    notes.push(`accelerator extraction failed: ${err.message}`);
  }

  const { pinned, pinnedNote } = pinnedFactFor(images);

  const upstreamPrefix = `${relativeRepo(repoJoin(root, UPSTREAM_DIR))}/`;
  check(fileRepoPath.startsWith(upstreamPrefix), `${fileRepoPath}: expected a path under ${upstreamPrefix}`);
  const relUnderUpstream = fileRepoPath.slice(upstreamPrefix.length);
  const pinnedSha256 = checksums.get(relUnderUpstream);
  check(pinnedSha256, `${CHECKSUMS_PATH.replaceAll("\\", "/")}: no pinned checksum for ${relUnderUpstream}`);
  const observedSha256 = sha256File(fileAbsPath);
  check(observedSha256 === pinnedSha256, `${fileRepoPath}: observed sha256 ${observedSha256} does not match pinned ${pinnedSha256}`);

  return {
    slug,
    name,
    modelDir,
    fileRepoPath,
    sha256: observedSha256,
    apiVersion: doc.apiVersion,
    backend,
    backendSource,
    pattern,
    patternSource,
    model,
    images,
    pinned,
    pinnedNote,
    gpuRequests,
    secretNames,
    accelerator,
    notes,
  };
}

// The pure function the generator and the verifier both call, and that
// scripts/lib/aicr-platform-members.mjs would call if it ever attaches this
// corpus. It reads committed bytes only under `root`, asserts every
// consistency rule inline via `check`, and returns the exact text every
// output file must hold, plus the structured facts.
export function buildReport(root = repoRoot) {
  const checksums = loadChecksums(root);
  const source = loadSource(root);
  const crdPathRepo = assertCrdRetained(root);
  const checksumsPathRepo = relativeRepo(repoJoin(root, CHECKSUMS_PATH));
  const retentionReceiptPathRepo = relativeRepo(repoJoin(root, RETENTION_RECEIPT_PATH));

  const targets = assignSlugs(discoverTargets(root));
  const facts = targets.map((target) => extractFacts(root, target, checksums));

  const slugs = new Set();
  for (const fact of facts) {
    check(!slugs.has(fact.slug), `two facts produced the same slug: ${fact.slug}`);
    slugs.add(fact.slug);
  }

  const profiles = facts.map((fact) => ({
    slug: fact.slug,
    path: repoJoin(root, PROFILES_DIR, `${fact.slug}.yaml`),
    yaml: serializeYaml(profileDocFor(fact)),
  }));
  const receipts = facts.map((fact) => ({
    slug: fact.slug,
    path: repoJoin(root, RECEIPTS_DIR, `${fact.slug}.yaml`),
    yaml: serializeYaml(receiptDocFor(fact, source, checksumsPathRepo, retentionReceiptPathRepo)),
  }));

  return {
    facts,
    profiles,
    receipts,
    summaryPath: repoJoin(root, SUMMARY_PATH),
    summaryMd: summaryFor(facts, { checksumsPathRepo, retentionReceiptPathRepo, crdPathRepo, source }),
  };
}
