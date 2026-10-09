// Discover every retained-and-rendered AICR recipe directory under
// examples/aicr and read the facts its own files hold.
//
// The record generator, the certified-bundle generator, the platform evidence
// generator and the processing-model verifier all need the same answer to one
// question: which AICR recipe directories were generated, retained and
// rendered, and never published or deployed. Each of them used to hard-code a
// short list, so an entry outside the list was not refused. It was skipped, and
// a skipped entry read as "not assessed". This module is the one place that
// answers the question, from the bytes each directory holds.
//
// Nothing here runs the aicr binary, touches a registry, or reads anything
// outside the repository. It reads committed files and returns plain data.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { check, py, repoRoot, sha256File } from "./proof-common.mjs";

export const AICR_EXAMPLES_ROOT = "examples/aicr";
export const AICR_ENTRY_REGISTER = `${AICR_EXAMPLES_ROOT}/claims/entry-names.yaml`;
export const AICR_MEMBERS_CSV = "data/aicr-nim-model-profiles/platform-members.csv";
export const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
// Where a bundle keeps the recipe it was generated from, when it keeps one.
export const BUNDLED_RECIPE = "argocd-helm-bundle/recipe.yaml";
// The routes an entry names for itself, when it keeps them by hand.
export const ROUTE_INTENT = "route-intent.yaml";
// The kind of nested source an Application has when it takes a path inside the
// entry's own AICR bundle package.
export const AICR_BUNDLE_PATH_SOURCE = "path-in-aicr-source-package";

// The files a retained-and-rendered recipe directory must hold. A directory
// that is missing one is refused rather than given a thinner record.
const REQUIRED_FILES = [
  "generation-receipt.yaml",
  "recipe.yaml",
  "argocd-rendered/checksums.txt",
  "digest-index/platform-index.json",
];

// One Python process parses every receipt, recipe and rendered Application.
// The recipes alone are about twelve megabytes of YAML, so a process per file
// would cost minutes; the C loader is used when the interpreter has it.
const EXTRACT_SCRIPT = `
import json, sys, yaml
Base = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
class Loader(Base):
    pass
Loader.add_constructor("tag:yaml.org,2002:value", lambda loader, node: loader.construct_scalar(node))

def load_all(path):
    with open(path, "r", encoding="utf-8") as handle:
        return [doc for doc in yaml.load_all(handle.read(), Loader=Loader) if doc is not None]

def load_one(path):
    docs = load_all(path)
    return docs[0] if len(docs) == 1 else None

request = json.load(sys.stdin)
result = {"register": load_one(request["register"]), "entries": {}}
for entry in request["entries"]:
    receipt = load_one(entry["receipt"]) or {}
    recipe = load_one(entry["recipe"]) or {}
    components = []
    for component in recipe.get("componentRefs") or []:
        components.append({
            "name": component.get("name") or component.get("chart") or "",
            "chart": component.get("chart") or "",
            "type": component.get("type") or "",
            "dependencyRefs": list(component.get("dependencyRefs") or []),
        })
    applications = []
    for path in entry["applications"]:
        docs = [doc for doc in load_all(path) if isinstance(doc, dict)]
        row = {"path": path, "documents": len(docs)}
        if len(docs) == 1:
            doc = docs[0]
            metadata = doc.get("metadata") or {}
            spec = doc.get("spec") or {}
            source = spec.get("source") or {}
            sync_policy = spec.get("syncPolicy") or {}
            annotations = metadata.get("annotations") or {}
            row.update({
                "apiVersion": str(doc.get("apiVersion", "")),
                "kind": str(doc.get("kind", "")),
                "name": str(metadata.get("name", "")),
                "namespace": str(metadata.get("namespace", "")),
                "syncWave": annotations.get("argocd.argoproj.io/sync-wave"),
                "destinationNamespace": str((spec.get("destination") or {}).get("namespace", "")),
                "source": {
                    "repoURL": str(source.get("repoURL", "")),
                    "chart": str(source.get("chart", "")),
                    "path": str(source.get("path", "")),
                    "targetRevision": str(source.get("targetRevision", "")),
                },
                "automatedSync": isinstance(sync_policy.get("automated"), dict),
            })
        applications.append(row)
    verdict = load_one(entry["verdict"]) if entry.get("verdict") else None
    intent = load_one(entry["routeIntent"]) if entry.get("routeIntent") else None
    named_routes = []
    for route in ((intent or {}).get("spec") or intent or {}).get("routes") or []:
        if isinstance(route, dict) and route.get("id"):
            named_routes.append({
                "id": str(route.get("id")),
                "text": " ".join(str(route.get(key, "")) for key in ("lifecycleWork", "evidenceRequired", "observed")),
            })
    bundled = load_one(entry["bundledRecipe"]) if entry.get("bundledRecipe") else None
    bundled_components = []
    for component in (bundled or {}).get("componentRefs") or []:
        bundled_components.append({
            "name": component.get("name") or component.get("chart") or "",
            "dependencyRefs": list(component.get("dependencyRefs") or []),
        })
    result["entries"][entry["id"]] = {
        "receipt": {
            "kind": receipt.get("kind"),
            "name": (receipt.get("metadata") or {}).get("name"),
            "status": receipt.get("status") or {},
            "source": (receipt.get("spec") or {}).get("source") or {},
            "criteria": (receipt.get("spec") or {}).get("criteria") or {},
            "generationInputs": (receipt.get("spec") or {}).get("generationInputs") or {},
            "result": (receipt.get("spec") or {}).get("result") or {},
            "boundary": (receipt.get("spec") or {}).get("boundary") or {},
            "overlay": (receipt.get("spec") or {}).get("overlay") or {},
            "newRequiredInputs": (receipt.get("spec") or {}).get("newRequiredInputs") or [],
            "answeredRefusals": (receipt.get("spec") or {}).get("answeredRefusals") or [],
            "retained": (receipt.get("spec") or {}).get("retained") or {},
            "plannedArtifacts": (receipt.get("spec") or {}).get("plannedArtifacts") or {},
        },
        "recipe": {
            "version": str((recipe.get("metadata") or {}).get("version", "")),
            "appliedOverlays": list((recipe.get("metadata") or {}).get("appliedOverlays") or []),
            "criteria": recipe.get("criteria") or {},
            "deploymentOrder": list(recipe.get("deploymentOrder") or (recipe.get("spec") or {}).get("deploymentOrder") or []),
            "components": components,
        },
        "applications": applications,
        "namedRoutes": named_routes,
        "bundledRecipe": None if bundled is None else {
            "deploymentOrder": list(bundled.get("deploymentOrder") or (bundled.get("spec") or {}).get("deploymentOrder") or []),
            "components": bundled_components,
        },
        "verdict": None if verdict is None else {
            "kind": verdict.get("kind"),
            "lane": ((verdict.get("spec") or {}).get("verdict") or {}).get("lane"),
            "subject": (verdict.get("spec") or {}).get("subject") or {},
            "orderingEvidence": (verdict.get("spec") or {}).get("orderingEvidence"),
        },
    }
print(json.dumps(result, sort_keys=True))
`;

// A receipt qualifies when it says the entry was generated and retained, and
// says nothing was published, uploaded or delivered. The mirror generator
// writes that as one word. The older v0.18.0 receipt predates the word and
// records the same facts field by field, so it is read field by field.
export function receiptSaysRetainedOffline(receipt) {
  if (receipt?.kind !== "SourceGenerationReceipt") return false;
  const status = receipt.status ?? {};
  if (status.result === "retained-offline") return status.liveRegistryPublicationClaimed !== true;
  return status.generated === true
    && status.published === false
    && status.configHubUpload === "not-run"
    && status.deliveryProof === "not-run";
}

// The generation chose, for every mirrored entry whose bundle leaves out
// dra-node-labeler, not to opt in to DRA eviction: no eviction node label was
// given at bundle time, so AICR logged the reason and left the labeler out.
// That is the decision the hand-retained v1.0.0 entry records as the route
// dra-plugin-eviction. A mirrored entry gets the same kind of route only when
// its own bytes show the premise: the selected recipe lists the component, the
// bundled recipe does not, AICR's logged reason names the unset flag, and the
// generation inputs carry no eviction label. Where any part fails, no route is
// recorded and the entry stays flagged.
export const DRA_EVICTION_ROUTE = "dra-plugin-eviction";
export const DRA_LABELER = "dra-node-labeler";
export const DRA_EVICTION_FLAG = "--dra-eviction-node-label";

export function draEvictionPremise({ receipt, selectedNames, bundledNames }) {
  const mirrored = /generate-aicr-from-overlay\.mjs/.test(String(receipt?.source?.binaryVerifiedBeforeUse ?? ""));
  const row = (receipt?.result?.componentsLeftOutOfBundle ?? []).find((candidate) => String(candidate.name) === DRA_LABELER);
  const inputs = Object.entries(receipt?.generationInputs ?? {});
  const holds = mirrored
    && Boolean(bundledNames)
    && selectedNames.includes(DRA_LABELER)
    && !bundledNames.includes(DRA_LABELER)
    && Boolean(row)
    && String(row.reason ?? "").includes(`${DRA_EVICTION_FLAG} unset`)
    && !inputs.some(([key, value]) => /evict/i.test(key) || String(value).includes(DRA_EVICTION_FLAG));
  return { holds, reason: holds ? String(row.reason) : "" };
}

// What a route of the entry's own contributes to the ordering decision. A hand
// route comes from route-intent.yaml. A mirrored entry's route is the one the
// premise above lets the mirror generator write.
function routesNamedFor(facts) {
  const routes = [...(facts.namedRoutes ?? [])];
  const bundledNames = facts.bundledRecipe ? facts.bundledRecipe.components.map((component) => component.name) : null;
  const premise = draEvictionPremise({
    receipt: facts.receipt,
    selectedNames: facts.recipe.components.map((component) => component.name),
    bundledNames,
  });
  if (premise.holds && !routes.some((route) => route.id === DRA_EVICTION_ROUTE)) {
    routes.push({ id: DRA_EVICTION_ROUTE, text: DRA_LABELER });
  }
  return routes;
}

// The slug a version takes inside a record name: v0.21.0 becomes v0-21-0.
export function versionSlug(version) {
  return String(version).replaceAll(".", "-");
}

// The retained-versions rule puts a version in a directory name when two
// entries share one description. The record name already carries the version,
// so it is taken off the source name rather than written twice.
export function sourceNameFor(id, version) {
  const suffix = `-${versionSlug(version)}`;
  return id.endsWith(suffix) ? id.slice(0, -suffix.length) : id;
}

export function recordNameFor(id, version) {
  return `aicr-${sourceNameFor(id, version)}-${versionSlug(version)}-argocd`;
}

function listApplicationFiles(root, entryRel) {
  const templates = join(root, entryRel, "argocd-rendered", "templates");
  if (!existsSync(templates)) return [];
  return readdirSync(templates)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => join(templates, name));
}

function candidateDirectories(root) {
  const examples = join(root, AICR_EXAMPLES_ROOT);
  return readdirSync(examples)
    .filter((name) => statSync(join(examples, name)).isDirectory())
    .filter((name) => existsSync(join(examples, name, "generation-receipt.yaml")))
    .sort();
}

// Every AICR recipe directory that holds rendered Applications, whatever its
// receipt says about publication. The model verifier requires a record for
// each of these, so a directory retained by hand is held to the same rule as a
// mirrored one.
export function listAicrRecipeDirectories(root = repoRoot) {
  return candidateDirectories(root).filter((id) => listApplicationFiles(root, `${AICR_EXAMPLES_ROOT}/${id}`).length > 0);
}

function memberRowCounts(root) {
  const path = join(root, AICR_MEMBERS_CSV);
  const counts = new Map();
  if (!existsSync(path)) return counts;
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean).slice(1);
  for (const line of lines) {
    const id = line.split(",")[0];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// Compare the rendered sync-waves with the dependency edges the recipe
// declares. This is the rule the ordering-parity lane applies to its four
// hand-retained entries, with one difference that the mirror made necessary:
// a recipe can name a component it does not deploy. An edge to or from such a
// component cannot be checked against a wave that does not exist, so it is
// recorded by name instead of failing the entry or being dropped.
export function orderingEvidenceFor(entry) {
  const waved = new Map();
  const roots = [];
  for (const application of entry.applications) {
    if (application.syncWave === null || application.syncWave === undefined) {
      roots.push(application.name);
      continue;
    }
    waved.set(application.name, Number(application.syncWave));
  }
  const declared = entry.recipe.deploymentOrder;
  const deployed = new Set(declared);
  const missingFromRender = declared.filter((name) => !waved.has(name));
  const held = [];
  const violated = [];
  const undeployed = [];
  for (const component of entry.recipe.components) {
    for (const dependency of component.dependencyRefs) {
      const edge = { component: component.name, dependsOn: dependency };
      if (!deployed.has(component.name) || !deployed.has(dependency)) {
        undeployed.push({
          ...edge,
          notDeployed: [component.name, dependency].filter((name) => !deployed.has(name)),
        });
        continue;
      }
      if (!waved.has(component.name) || !waved.has(dependency)) {
        violated.push({ ...edge, reason: "one side renders without a sync-wave" });
        continue;
      }
      if (waved.get(dependency) < waved.get(component.name)) held.push(edge);
      else {
        violated.push({
          ...edge,
          reason: `wave ${waved.get(component.name)} does not come after wave ${waved.get(dependency)}`,
        });
      }
    }
  }
  // The selected recipe can hold an edge that the bundled recipe does not: a
  // component the bundle deploys depending on one the bundle leaves out. The
  // bundled recipe declares no such edge, so nothing above could see it. It is
  // an open question, who provides the omitted component, unless the entry
  // already names a route that decides that omission. A route decides it only
  // when it is the entry's own route for that component. The generic route
  // that lists every omitted component hands the decision to a destination and
  // does not make it, so it never counts.
  const bundledNames = new Set((entry.recipe.components ?? []).map((component) => component.name));
  const omittedUndecided = [];
  const omittedDecided = [];
  for (const component of entry.selectedComponents ?? []) {
    if (!bundledNames.has(component.name)) continue;
    for (const dependency of component.dependencyRefs) {
      if (bundledNames.has(dependency)) continue;
      const edge = { component: component.name, dependsOn: dependency };
      const mention = new RegExp(`(?<![A-Za-z0-9_-])${dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`);
      const route = (entry.namedRoutes ?? []).find((candidate) => mention.test(candidate.text));
      if (route) omittedDecided.push({ ...edge, decidedBy: route.id });
      else omittedUndecided.push(edge);
    }
  }
  const order = [...waved.entries()].sort((left, right) => left[1] - right[1] || (left[0] < right[0] ? -1 : 1));
  const distinctWaves = new Set(waved.values()).size;
  return {
    orderModel: distinctWaves === waved.size ? "total order" : "parallel groups",
    wavedApplications: waved.size,
    distinctWaves,
    lowestWave: order.length ? order[0][1] : null,
    highestWave: order.length ? order[order.length - 1][1] : null,
    declaredComponents: declared.length,
    declaredComponentsMissingFromRender: missingFromRender,
    dependencyEdges: held.length + violated.length + undeployed.length,
    edgesHeld: held.length,
    edgesViolated: violated,
    edgesNamingAnUndeployedComponent: undeployed,
    // The subset that matters to a destination: something the recipe does
    // deploy, depending on something it does not.
    deployedDependsOnUndeployed: undeployed.filter((edge) => !edge.notDeployed.includes(edge.component)),
    // Selected-recipe edges from a deployed component to one the bundle leaves
    // out. The first list has no route that decides it and raises the flag.
    edgesToAnOmittedComponent: omittedUndecided,
    edgesToAnOmittedComponentDecidedByARoute: omittedDecided,
    companions: order.map(([name]) => name).filter((name) => !deployed.has(name)),
    platformRoots: roots,
  };
}

// A sync-wave route is only worth recording when the bytes support it. Three
// findings mean they do not: nothing is ordered, the recipe names a component
// the render dropped, or a wave runs a component before something it depends
// on. Each is refused by name, so an entry cannot reach the catalog carrying an
// ordering its own recipe disowns, and cannot quietly fall back to "not
// assessed" either.
export function assertOrderingSupportsRoute(entry) {
  const ordering = entry.ordering;
  check(
    ordering.distinctWaves >= 2,
    `${entry.entryRel}: the rendered Applications carry ${ordering.distinctWaves} distinct sync-wave(s), so there is no ordering to record as a route`,
  );
  check(
    ordering.declaredComponentsMissingFromRender.length === 0,
    `${entry.entryRel}: the recipe deploys ${ordering.declaredComponentsMissingFromRender.join(", ")}, which the rendered Applications do not contain`,
  );
  check(
    ordering.edgesViolated.length === 0,
    `${entry.entryRel}: refusing to record a sync-wave route that contradicts the recipe: ${ordering.edgesViolated
      .map((edge) => `${edge.component} depends on ${edge.dependsOn} (${edge.reason})`)
      .join("; ")}`,
  );
  check(
    ordering.platformRoots.length === 1,
    `${entry.entryRel}: expected one platform root Application without a sync-wave, found ${ordering.platformRoots.length}`,
  );
}

// The sentences a verdict and a route both carry about the ordering. They are
// written from the counts, so an entry whose recipe names undeployed components
// says so in the same place another entry says every edge held.
export function orderingSentences(entry) {
  const ordering = entry.ordering;
  const checkable = ordering.edgesHeld + ordering.edgesViolated.length;
  const sentences = [
    `The order is AICR's and not this project's. It is read from the sync-wave annotations on ${ordering.wavedApplications} rendered Applications, which fall into ${ordering.distinctWaves} waves. ${entry.bundledRecipeRel ? "The recipe the bundle carries" : "The retained recipe"} deploys ${ordering.declaredComponents} components, and ${ordering.edgesHeld} of the ${checkable} dependency edges between them hold in those waves.`,
  ];
  // A selected component the bundle leaves out has no Application and no
  // sync-wave. The bundled recipe declares no edge to it, so nothing above
  // could check one. The selected recipe's edges to such a component are named
  // here, so the comparison does not drop them silently.
  if ((entry.leftOutOfBundle ?? []).length > 0) {
    const names = entry.leftOutOfBundle.map((row) => row.name);
    const edges = entry.leftOutEdges ?? [];
    sentences.push(
      `The selected recipe also names ${names.length} component${names.length === 1 ? "" : "s"} the bundle leaves out (${names.join(", ")}), and the generation receipt records the reason AICR logged for ${names.length === 1 ? "it" : "each"}. ${edges.length > 0
        ? `The selected recipe makes ${joinNames(edges.map((edge) => `${edge.component} depend on ${edge.dependsOn}`), "and")}. The recipe the bundle carries declares no such edge, so no sync-wave was asked to hold it. ${(ordering.edgesToAnOmittedComponent ?? []).length > 0
          ? `${(ordering.edgesToAnOmittedComponent ?? []).length === 1 ? "That edge is" : `${ordering.edgesToAnOmittedComponent.length} of those edges are`} recorded and not checked, and no route of this entry decides ${ordering.edgesToAnOmittedComponent.length === 1 ? "it" : "them"}, so the entry is flagged. The route that lists the omitted components records the decision a destination has to make.`
          : "A route records the decision a destination has to make."}`
        : "No component the bundle deploys depends on one of them in the selected recipe."}`,
    );
  }
  const undeployed = ordering.edgesNamingAnUndeployedComponent;
  if (undeployed.length > 0) {
    const names = [...new Set(undeployed.flatMap((edge) => edge.notDeployed))].sort();
    sentences.push(
      `${undeployed.length} further dependency edge${undeployed.length === 1 ? "" : "s"} in the recipe name${undeployed.length === 1 ? "s" : ""} a component the recipe does not deploy (${names.join(", ")}). No sync-wave exists for those components, so these edges are recorded and not checked.`,
    );
    const affecting = ordering.deployedDependsOnUndeployed;
    sentences.push(
      affecting.length > 0
        ? `${affecting.length} of them ${affecting.length === 1 ? "is a deployed component" : "are deployed components"} depending on one that is not deployed: ${affecting.map((edge) => `${edge.component} on ${edge.dependsOn}`).join(", ")}. That is an open question about the recipe, and this entry does not answer it.`
        : "None of them has a deployed component on the depending side, so no deployed component waits on something absent.",
    );
  }
  if (ordering.companions.length > 0) {
    sentences.push(
      `${ordering.companions.length} waved Application${ordering.companions.length === 1 ? " renders" : "s render"} without appearing in the recipe's deployment order (${ordering.companions.join(", ")}). ${ordering.companions.length === 1 ? "It is a companion of a component, and it is named here so the comparison does not drop it silently." : "They are companions of a component, and they are named here so the comparison does not drop them silently."}`,
    );
  }
  return sentences;
}

// The word a record and its listing carry when an entry needs attention. It is
// the existing assessment result state for "checked, with a limit to review",
// and it is never a pass.
export const ATTENTION_STATE = "watch";

// An edge is unchecked when the rendered sync-waves could not confirm it:
// either it names a component the recipe does not deploy, or one side renders
// without a wave.
export function uncheckedOrderingEdges(ordering) {
  return ordering.edgesNamingAnUndeployedComponent.length
    + ordering.edgesViolated.length
    + (ordering.edgesToAnOmittedComponent ?? []).length;
}

function joinNames(names, word) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${word} ${names.at(-1)}`;
}

// The open question an entry carries when its ordering evidence holds an edge
// nobody could check, as one plain sentence. An empty string means every edge
// was checked. The record generator writes the sentence and the model verifier
// recomputes it from the bytes, so the flag follows the evidence and nobody
// keeps a list of flagged entries.
export function orderingOpenQuestion(ordering) {
  if (uncheckedOrderingEdges(ordering) === 0) return "";
  const affecting = ordering.deployedDependsOnUndeployed;
  const omitted = ordering.edgesToAnOmittedComponent ?? [];
  if (affecting.length > 0 || omitted.length > 0) {
    const sentences = [];
    if (affecting.length > 0) {
      const missing = [...new Set(affecting.map((edge) => edge.dependsOn))].sort();
      const dependers = [...new Set(affecting.map((edge) => edge.component))].sort();
      const pairs = affecting.map((edge) => `${edge.component} depend on ${edge.dependsOn}`);
      const it = missing.length === 1 ? "it" : "them";
      sentences.push(`The recipe makes ${joinNames(pairs, "and")} and does not deploy ${it}, and nothing here shows whether ${joinNames(dependers, "or")} work${dependers.length === 1 ? "s" : ""} without ${it}.`);
    }
    if (omitted.length > 0) {
      const missing = [...new Set(omitted.map((edge) => edge.dependsOn))].sort();
      const pairs = omitted.map((edge) => `${edge.component} depend on ${edge.dependsOn}`);
      const it = missing.length === 1 ? "it" : "them";
      sentences.push(`The selected recipe makes ${joinNames(pairs, "and")} and the bundle does not deploy ${it}, and nothing here shows who provides ${it}.`);
    }
    return sentences.join(" ");
  }
  const undeployed = ordering.edgesNamingAnUndeployedComponent;
  if (undeployed.length > 0) {
    return `The recipe declares ${undeployed.length} dependency edge${undeployed.length === 1 ? "" : "s"} that name${undeployed.length === 1 ? "s" : ""} components it does not deploy, and nothing here shows whether their order matters to the components it does deploy.`;
  }
  const violated = ordering.edgesViolated;
  return `The rendered sync-waves do not confirm ${violated.length} dependency edge${violated.length === 1 ? "" : "s"} the recipe declares (${violated.map((edge) => `${edge.component} on ${edge.dependsOn}`).join(", ")}), and nothing here shows whether the recorded order is safe.`;
}

// The nested sources the Applications point at. They are read from each
// Application's own source block, so a chart pulled from an OCI repository is
// counted even though it carries no chart field.
export function nestedSourcesFor(entry, sourcePackageRepository) {
  return entry.applications.map((application) => {
    const source = application.source ?? {};
    const fromBundle = Boolean(sourcePackageRepository) && source.repoURL === sourcePackageRepository;
    return {
      application: application.name,
      kind: fromBundle
        ? AICR_BUNDLE_PATH_SOURCE
        : source.repoURL.startsWith("oci://")
          ? "oci-chart"
          : "helm-repository-chart",
      repoURL: source.repoURL,
      ...(source.chart ? { chart: source.chart } : {}),
      ...(source.path ? { path: source.path } : {}),
      targetRevision: source.targetRevision,
    };
  });
}

// Read every retained-and-rendered recipe directory. `verdictRoot` names where
// the generated platform-shape verdicts live, so a caller that needs the
// verdict gets it from the same pass; a caller that writes those verdicts
// passes nothing and reads none.
const extractionCache = new Map();

// One parse per root and verdict tree, shared by the two readers below.
function extractAicrDirectories(root, verdictRoot) {
  const key = `${root}|${verdictRoot}`;
  if (extractionCache.has(key)) return extractionCache.get(key);
  const directories = candidateDirectories(root);
  const request = {
    register: join(root, AICR_ENTRY_REGISTER),
    entries: directories.map((id) => {
      const entryRel = `${AICR_EXAMPLES_ROOT}/${id}`;
      const verdictRel = verdictRoot ? `${verdictRoot}/aicr-${id}/flattening-safety-verdict.yaml` : "";
      const bundledRecipe = join(root, entryRel, BUNDLED_RECIPE);
      return {
        id,
        receipt: join(root, entryRel, "generation-receipt.yaml"),
        recipe: existsSync(join(root, entryRel, "recipe.yaml")) ? join(root, entryRel, "recipe.yaml") : join(root, entryRel, "generation-receipt.yaml"),
        bundledRecipe: existsSync(bundledRecipe) ? bundledRecipe : "",
        applications: listApplicationFiles(root, entryRel),
        routeIntent: existsSync(join(root, entryRel, ROUTE_INTENT)) ? join(root, entryRel, ROUTE_INTENT) : "",
        verdict: verdictRel && existsSync(join(root, verdictRel)) ? join(root, verdictRel) : "",
      };
    }),
  };
  const result = { directories, parsed: py(EXTRACT_SCRIPT, JSON.stringify(request)) };
  extractionCache.set(key, result);
  return result;
}

// The ordering evidence for every AICR directory that holds rendered
// Applications, whatever stage it has reached. The rendered sync-waves are
// compared with the recipe the bundle itself carries when it carries one,
// because that is the recipe the waves were computed from. AICR v1.0.0 writes
// that recipe into the bundle and can leave a selected component out of it.
// Older bundles carry none, and the retained recipe is the only one there is.
export function loadAicrOrderingEvidence({ root = repoRoot, verdictRoot = "" } = {}) {
  const { directories, parsed } = extractAicrDirectories(root, verdictRoot);
  const evidence = new Map();
  for (const id of directories) {
    const facts = parsed.entries[id];
    if (facts.applications.length === 0) continue;
    const entryRel = `${AICR_EXAMPLES_ROOT}/${id}`;
    const ordering = orderingEvidenceFor({
      applications: facts.applications,
      recipe: facts.bundledRecipe ?? facts.recipe,
      selectedComponents: facts.bundledRecipe ? facts.recipe.components : null,
      namedRoutes: routesNamedFor(facts),
    });
    evidence.set(id, {
      id,
      renderedRel: `${entryRel}/argocd-rendered`,
      recipeRel: facts.bundledRecipe ? `${entryRel}/${BUNDLED_RECIPE}` : `${entryRel}/recipe.yaml`,
      ordering,
      openQuestion: orderingOpenQuestion(ordering),
    });
  }
  return evidence;
}

export function loadAicrRecipeEntries({ root = repoRoot, verdictRoot = "" } = {}) {
  const { directories, parsed } = extractAicrDirectories(root, verdictRoot);
  const registered = new Map((parsed.register?.spec?.entries ?? []).map((row) => [String(row.id), row]));
  const members = memberRowCounts(root);

  const entries = [];
  for (const id of directories) {
    const facts = parsed.entries[id];
    if (!receiptSaysRetainedOffline(facts.receipt)) continue;
    const entryRel = `${AICR_EXAMPLES_ROOT}/${id}`;
    for (const file of REQUIRED_FILES) {
      check(existsSync(join(root, entryRel, file)), `${entryRel}: a retained AICR recipe directory must hold ${file}`);
    }
    check(
      registered.has(id),
      `${entryRel}: the directory is retained and rendered but ${AICR_ENTRY_REGISTER} does not name it`,
    );
    const version = String(facts.receipt.source?.version ?? "");
    check(/^v\d+\.\d+\.\d+$/.test(version), `${entryRel}/generation-receipt.yaml records no AICR version`);
    check(
      String(registered.get(id).retainedVersion) === version,
      `${entryRel}: the receipt says ${version} and the entry register says ${registered.get(id).retainedVersion}`,
    );
    check(facts.applications.length > 0, `${entryRel}/argocd-rendered/templates holds no Applications`);
    for (const application of facts.applications) {
      const rel = application.path.slice(root.length + 1);
      check(application.documents === 1, `${rel}: expected exactly one document`);
      check(
        application.kind === "Application" && application.apiVersion.startsWith("argoproj.io/"),
        `${rel}: expected an Argo CD Application, found ${application.apiVersion} ${application.kind}`,
      );
      check(application.name, `${rel}: the Application has no name`);
      check(
        application.syncWave === null || application.syncWave === undefined || Number.isInteger(Number(application.syncWave)),
        `${rel}: the sync-wave is not an integer`,
      );
    }
    const names = facts.applications.map((application) => application.name);
    check(new Set(names).size === names.length, `${entryRel}: two rendered Applications share one name`);

    const indexRel = `${entryRel}/digest-index/platform-index.json`;
    const index = JSON.parse(readFileSync(join(root, indexRel), "utf8"));
    const platformDigest = String(index.spec?.platformDigest ?? "");
    check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), `${indexRel} records no platform digest`);

    const entry = {
      id,
      entryRel,
      page: String(registered.get(id).page ?? ""),
      version,
      versionSlug: versionSlug(version),
      sourceName: sourceNameFor(id, version),
      recordName: recordNameFor(id, version),
      bundleName: `aicr-${id}`,
      // The mirror generator names itself in the receipts it writes. The two
      // older directories have the same shape and were retained by hand.
      origin: /generate-aicr-from-overlay\.mjs/.test(String(facts.receipt.source?.binaryVerifiedBeforeUse ?? ""))
        ? "mirrored-overlay"
        : "hand-retained",
      // The overlay AICR resolved last is the one the criteria selected.
      selectedOverlay: String(facts.recipe.appliedOverlays.at(-1) ?? id),
      receiptRel: `${entryRel}/generation-receipt.yaml`,
      recipeRel: `${entryRel}/recipe.yaml`,
      renderedRel: `${entryRel}/argocd-rendered`,
      templatesRel: `${entryRel}/argocd-rendered/templates`,
      inventoryRel: `${entryRel}/argocd-rendered/checksums.txt`,
      inventorySha256: sha256File(join(root, entryRel, "argocd-rendered", "checksums.txt")),
      indexRel,
      platformDigest,
      indexBoundary: index.spec?.boundary ?? {},
      sourcePackageRepository: "",
      receipt: facts.receipt,
      recipe: facts.recipe,
      applications: facts.applications.map((application) => ({
        ...application,
        file: application.path.slice(join(root, entryRel, "argocd-rendered").length + 1),
        path: application.path.slice(root.length + 1),
      })),
      verdict: facts.verdict,
      memberRows: members.get(id) ?? 0,
    };
    // The reference a publication would use, read from the rendered bytes
    // rather than from a side file: the platform root Application names it.
    const root0 = entry.applications.find((application) => application.syncWave === null || application.syncWave === undefined);
    entry.sourcePackageRepository = root0?.source?.repoURL ?? "";
    entry.sourcePackageRevision = root0?.source?.targetRevision ?? "";
    // The sync-waves are compared with the recipe the bundle carries when the
    // entry retains its bundle, because AICR computed the waves from that
    // recipe and can leave a selected component out of it.
    const bundled = facts.bundledRecipe;
    entry.bundledRecipeRel = bundled ? `${entryRel}/${BUNDLED_RECIPE}` : "";
    entry.bundleRel = bundled ? `${entryRel}/${BUNDLED_RECIPE.split("/")[0]}` : "";
    entry.orderingRecipeRel = entry.bundledRecipeRel || entry.recipeRel;
    entry.ordering = orderingEvidenceFor({
      applications: entry.applications,
      recipe: bundled ?? facts.recipe,
      selectedComponents: bundled ? facts.recipe.components : null,
      namedRoutes: routesNamedFor(facts),
    });
    const bundledNames = new Set((bundled?.components ?? []).map((component) => component.name));
    const loggedReasons = new Map((facts.receipt.result?.componentsLeftOutOfBundle ?? []).map((row) => [String(row.name), String(row.reason ?? "")]));
    entry.leftOutOfBundle = bundled
      ? facts.recipe.components
          .map((component) => component.name)
          .filter((name) => !bundledNames.has(name))
          .sort()
          .map((name) => ({ name, reason: loggedReasons.get(name) ?? "" }))
      : [];
    check(
      !bundled || JSON.stringify(entry.leftOutOfBundle.map((row) => row.name)) === JSON.stringify([...loggedReasons.keys()].sort()),
      `${entryRel}/generation-receipt.yaml does not name exactly the components the retained bundle leaves out`,
    );
    entry.leftOutEdges = bundled
      ? facts.recipe.components
          .filter((component) => bundledNames.has(component.name))
          .flatMap((component) => component.dependencyRefs
            .filter((dependency) => !bundledNames.has(dependency))
            .map((dependency) => ({ component: component.name, dependsOn: dependency })))
      : [];
    entry.draEvictionPremise = draEvictionPremise({
      receipt: facts.receipt,
      selectedNames: facts.recipe.components.map((component) => component.name),
      bundledNames: bundled ? bundled.components.map((component) => component.name) : null,
    });
    entry.nestedSources = nestedSourcesFor(entry, entry.sourcePackageRepository);
    entries.push(entry);
  }

  // An overlay that another retained entry builds on is a shared substrate.
  // The recipe says which overlays it applied, so the relation is read rather
  // than inferred from the directory name. It only holds inside one AICR
  // version: an older entry that applied an overlay of the same name applied
  // that version's overlay, which this catalog does not retain.
  const byOverlay = new Map(entries.map((entry) => [`${entry.version}|${entry.selectedOverlay}`, entry]));
  const builtOn = new Map(entries.map((entry) => [entry.id, []]));
  for (const entry of entries) {
    entry.overlayParents = [];
    for (const overlay of entry.recipe.appliedOverlays.slice(0, -1)) {
      const parent = byOverlay.get(`${entry.version}|${overlay}`);
      if (!parent || parent.id === entry.id) continue;
      entry.overlayParents.push(parent.id);
      builtOn.get(parent.id).push(entry.id);
    }
  }
  for (const entry of entries) {
    entry.overlayDependents = builtOn.get(entry.id).sort();
    entry.overlayRole = entry.overlayDependents.length > 0 ? "base-overlay" : "leaf-overlay";
  }
  return entries;
}
