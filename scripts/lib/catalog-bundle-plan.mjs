// The plan of a catalog bundle, and the rule that it agrees with the record.
//
// A flatten-with-routes entry has a plan. Two places state it. The entry's
// BaseVariantRecord names the steps, under spec.lifecycle.routeIntent.routes.
// The entry's bundle carries plan documents beside its objects. This module
// holds the words both sides share, so the generator that writes the
// documents, the generator that writes the record and the verifier that
// compares them cannot each mean something different.
//
// A plan document is one of three things.
//
//   1. A document the bundle generator writes from the committed render. It
//      orders the definitions the bundle holds, or names the objects Helm was
//      asked to keep. It carries the step whose id is its file name.
//   2. The BundleTargetRequirements document. It repeats each record step
//      that names something the target must already have, such as a Secret,
//      a namespace or a definition the bundle does not hold.
//   3. A BundleRoute document of the kind recorded-plan-step. It repeats one
//      record step that is ordering or lifecycle work.
//
// The second and third are written from the record and say only what the
// record says. Neither is automatic.

export const CATALOG_RECORD_ROOT = "data/base-variant-records/records";
export const PLAN_STEP_ROUTE_KIND = "recorded-plan-step";
export const PLAN_STEP_ROLE_PREFIX = "route: plan-step ";
export const PLAN_REQUIREMENTS_ROLE = "requirement: target";
export const PLAN_REQUIREMENTS_KIND = "BundleTargetRequirements";
export const PLAN_REQUIREMENTS_FILE = "target-requirements.yaml";
export const PLAN_FROM_RENDER = "the committed render";
export const PLAN_FROM_RECORD = "the record";
export const PLAN_RULE =
  "The plan documents of this bundle carry every step the record names, and the record names every step they carry.";
export const PLAN_NOT_RUN = "recorded-not-run";

const API_VERSION = "evidence.confighub.com/v1alpha1";

// The record of one Helm preset has the name of its render intent.
export function catalogRecordName({ repo, chart, version, base }) {
  return `${repo}-${chart}-${version}-${base}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const catalogRecordRel = (name) => `${CATALOG_RECORD_ROOT}/${name}.yaml`;

export const isPlanStepRole = (role) => String(role ?? "").startsWith(PLAN_STEP_ROLE_PREFIX);
export const isPlanRequirementsRole = (role) => String(role ?? "") === PLAN_REQUIREMENTS_ROLE;
// A route file the bundle generator wrote from the render.
export const isRenderRouteRole = (role) => String(role ?? "").startsWith("route:") && !isPlanStepRole(role);
export const isPlanDocumentRole = (role) => String(role ?? "").startsWith("route:") || isPlanRequirementsRole(role);

export const planFileStem = (path) => String(path).split("/").at(-1).replace(/\.ya?ml$/, "");

export function recordSteps(record) {
  return record?.spec?.lifecycle?.routeIntent?.routes ?? [];
}

// The requirements the record lists as facts about the target, by id.
export function recordTargetFacts(record) {
  const facts = new Map();
  for (const item of record?.spec?.lifecycle?.requirements?.items ?? []) {
    if (item.type === "target-fact" || item.type === "target-facts") facts.set(String(item.id), item);
  }
  return facts;
}

// The object names a render-written document orders or protects.
export function renderDocumentNames(doc) {
  const declaration = doc?.spec?.declaration ?? {};
  const names = new Set();
  for (const stage of Array.isArray(declaration.stages) ? declaration.stages : []) {
    for (const name of stage?.selector?.names ?? []) names.add(String(name));
  }
  for (const object of Array.isArray(declaration.protect) ? declaration.protect : []) {
    if (object?.name) names.add(String(object.name));
  }
  return names;
}

// Where the bundle carries one record step.
//
// A render-written document with the step's id carries it. The step is also
// written into the requirements document when it names a target fact that
// the render-written document does not name. Two entries have a step called
// crd-ordering that is about definitions the bundle does not hold, beside a
// document called crd-ordering that orders the definitions it does hold.
// Without this rule the bundle would agree with the record by id and still
// not say what the record says.
//
// A step with no render-written document goes to the requirements document
// when it names a target fact, and gets its own route document when it does
// not.
export function planPlacement(step, { targetFacts, renderDocuments }) {
  const refs = (step.requirementRefs ?? []).map(String);
  const facts = refs.filter((ref) => targetFacts.has(ref));
  const renderDocument = renderDocuments.get(String(step.id));
  if (renderDocument) {
    const named = renderDocumentNames(renderDocument);
    const outside = facts.filter((ref) => !named.has(ref));
    return { render: true, requirement: outside.length > 0, route: false, facts };
  }
  return { render: false, requirement: facts.length > 0, route: facts.length === 0, facts };
}

// The fields of a record step that a record-written document repeats. The
// names are the record's own, apart from the three the BundleRoute vocabulary
// already has a place for.
function recordedFields(step) {
  return {
    status: String(step.status ?? ""),
    sourceStatus: String(step.sourceStatus ?? ""),
  };
}

const stringList = (value) => (Array.isArray(value) ? value.map(String) : []);

function stepBoundedness(step, recordRel) {
  const lines = [
    `This document repeats one plan step of the Catalog record ${recordRel}. It adds nothing the record does not say.`,
    `The step is not automatic. The record marks it ${step.sourceStatus}.`,
  ];
  if (step.sourceStatus === PLAN_NOT_RUN) lines.push("No delivery runtime has carried out this step for this base.");
  return lines;
}

// One record step as a BundleRoute document. The step's own words are the
// sentence a route gives for what it discharges, as the record generator
// reads that sentence back when it reads a route document.
export function buildPlanStepRoute({ name, step, recordRel, verdictRel, emittedBy }) {
  return {
    apiVersion: API_VERSION,
    kind: "BundleRoute",
    metadata: { name },
    spec: {
      routeKind: PLAN_STEP_ROUTE_KIND,
      discharges: String(step.proposedMechanism),
      declaration: {
        step: String(step.id),
        phase: String(step.phase),
        requirementRefs: stringList(step.requirementRefs),
        supportedRuntimes: stringList(step.supportedRuntimes),
        checks: stringList(step.checks),
        recorded: recordedFields(step),
        evidence: stringList(step.evidence),
      },
      executedBy: {
        invokedBy: String(step.proposedActor),
        automatic: false,
        ...(step.sourceStatus === PLAN_NOT_RUN ? { evidenceState: "not-run" } : {}),
      },
      boundedness: stepBoundedness(step, recordRel),
      provenance: { emittedBy, generatedFrom: [recordRel], verdictRef: verdictRel },
    },
  };
}

// The record steps that name something the target must already have, as one
// BundleTargetRequirements document.
export function buildPlanRequirements({ name, subject, steps, targetFacts, lane, recordRel, verdictRel, emittedBy }) {
  const notRun = steps.every((step) => step.sourceStatus === PLAN_NOT_RUN);
  return {
    apiVersion: API_VERSION,
    kind: PLAN_REQUIREMENTS_KIND,
    metadata: { name },
    spec: {
      subject,
      requirements: steps.map((step) => ({
        step: String(step.id),
        phase: String(step.phase),
        invokedBy: String(step.proposedActor),
        statement: String(step.proposedMechanism),
        names: stringList(step.requirementRefs)
          .filter((ref) => targetFacts.has(ref))
          .map((ref) => ({ id: ref, detail: String(targetFacts.get(ref).detail ?? "") })),
        checks: stringList(step.checks),
        automatic: false,
        ...(step.sourceStatus === PLAN_NOT_RUN ? { evidenceState: "not-run" } : {}),
        recorded: recordedFields(step),
        evidence: stringList(step.evidence),
      })),
      flattening: { lane, verdict: verdictRel },
      checked: notRun
        ? "No destination has been checked against these requirements."
        : "The record marks at least one of these requirements as observed. The evidence it cites is listed with that requirement.",
      provenance: { emittedBy, generatedFrom: [recordRel], verdictRef: verdictRel },
    },
  };
}

// The steps one plan document carries. A record-written entry also gives the
// fields it repeats, so a reader can compare them with the record.
export function planDocumentSteps(doc, path) {
  if (doc?.kind === PLAN_REQUIREMENTS_KIND) {
    return (Array.isArray(doc.spec?.requirements) ? doc.spec.requirements : []).map((entry) => ({
      id: String(entry.step ?? ""),
      writtenFrom: PLAN_FROM_RECORD,
      place: "requirement",
      repeats: {
        phase: entry.phase,
        proposedActor: entry.invokedBy,
        proposedMechanism: entry.statement,
        automatic: entry.automatic,
        status: entry.recorded?.status,
        sourceStatus: entry.recorded?.sourceStatus,
        checks: entry.checks,
        evidence: entry.evidence,
        names: (Array.isArray(entry.names) ? entry.names : []).map((item) => String(item?.id ?? "")),
      },
    }));
  }
  if (doc?.kind === "BundleRoute" && doc.spec?.routeKind === PLAN_STEP_ROUTE_KIND) {
    const declaration = doc.spec.declaration ?? {};
    return [{
      id: String(declaration.step ?? ""),
      writtenFrom: PLAN_FROM_RECORD,
      place: "route",
      repeats: {
        phase: declaration.phase,
        proposedActor: doc.spec.executedBy?.invokedBy,
        proposedMechanism: doc.spec.discharges,
        automatic: doc.spec.executedBy?.automatic,
        status: declaration.recorded?.status,
        sourceStatus: declaration.recorded?.sourceStatus,
        checks: declaration.checks,
        evidence: declaration.evidence,
        requirementRefs: declaration.requirementRefs,
        supportedRuntimes: declaration.supportedRuntimes,
      },
    }];
  }
  if (doc?.kind === "BundleRoute") {
    return [{ id: planFileStem(path), writtenFrom: PLAN_FROM_RENDER, place: "render" }];
  }
  return [];
}

const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

// Every way the plan documents of one bundle and the steps of its record
// disagree, as sentences. An empty list means they agree.
//
// documents is a list of { path, doc }. The comparison is made here from the
// documents and the record. It does not call the functions that wrote the
// documents, so a mistake in them is not checked against itself.
export function planDisagreements({ record, documents }) {
  const problems = [];
  const steps = recordSteps(record);
  const targetFacts = recordTargetFacts(record);
  const carried = documents.flatMap(({ path, doc }) => planDocumentSteps(doc, path).map((entry) => ({ ...entry, path })));
  const renderDocuments = new Map(
    documents
      .filter(({ doc }) => doc?.kind === "BundleRoute" && doc.spec?.routeKind !== PLAN_STEP_ROUTE_KIND)
      .map(({ path, doc }) => [planFileStem(path), doc]),
  );
  for (const { path, doc } of documents) {
    if (planDocumentSteps(doc, path).length === 0) problems.push(`${path} is a plan document that carries no step`);
  }
  const stepIds = new Set(steps.map((step) => String(step.id)));
  for (const entry of carried) {
    if (!entry.id) problems.push(`${entry.path} carries a step with no id`);
    else if (!stepIds.has(entry.id)) problems.push(`the bundle carries the step ${entry.id} in ${entry.path}, and the record does not name it`);
  }
  const written = carried.filter((entry) => entry.writtenFrom === PLAN_FROM_RECORD);
  for (const entry of written) {
    if (written.filter((other) => other.id === entry.id && other.place === entry.place).length > 1) {
      problems.push(`the bundle repeats the step ${entry.id} twice as a ${entry.place}`);
    }
  }
  for (const step of steps) {
    const id = String(step.id);
    const here = carried.filter((entry) => entry.id === id);
    if (here.length === 0) {
      problems.push(`the record names the step ${id}, and no plan document in the bundle carries it`);
      continue;
    }
    const placement = planPlacement(step, { targetFacts, renderDocuments });
    const requirement = here.find((entry) => entry.place === "requirement");
    const route = here.find((entry) => entry.place === "route");
    if (placement.requirement && !requirement) {
      problems.push(`the step ${id} names ${placement.facts.join(", ")}, which the target must already have, and the requirements document does not carry it`);
    }
    if (!placement.requirement && requirement) problems.push(`the requirements document carries the step ${id}, which names nothing the target must already have`);
    if (placement.route && !route) problems.push(`the step ${id} has no route document`);
    if (!placement.route && route) problems.push(`the step ${id} has a route document it does not need`);
    for (const entry of here.filter((candidate) => candidate.writtenFrom === PLAN_FROM_RECORD)) {
      const repeats = entry.repeats;
      const differs = [];
      if (repeats.phase !== step.phase) differs.push("phase");
      if (repeats.proposedActor !== step.proposedActor) differs.push("proposedActor");
      if (repeats.proposedMechanism !== step.proposedMechanism) differs.push("proposedMechanism");
      if (repeats.status !== step.status) differs.push("status");
      if (repeats.sourceStatus !== step.sourceStatus) differs.push("sourceStatus");
      if (!same(repeats.checks, stringList(step.checks))) differs.push("checks");
      if (!same(repeats.evidence, stringList(step.evidence))) differs.push("evidence");
      if (entry.place === "route" && !same(repeats.requirementRefs, stringList(step.requirementRefs))) differs.push("requirementRefs");
      if (entry.place === "route" && !same(repeats.supportedRuntimes, stringList(step.supportedRuntimes))) differs.push("supportedRuntimes");
      if (entry.place === "requirement" && !same(repeats.names, placement.facts)) differs.push("names");
      if (differs.length > 0) problems.push(`${entry.path} repeats the step ${id} and differs from the record in ${differs.join(", ")}`);
      if (repeats.automatic !== false) problems.push(`${entry.path} does not mark the step ${id} as not automatic`);
    }
  }
  return problems;
}

// A bundle published before this rule has its bytes fixed in a registry, so
// it keeps the companion files it was published with, and its name goes here.
// A name stays only while its publication receipt exists. Republishing a
// bundle under the rule means removing its name. Every bundle that was listed
// has been republished, so the list is empty.
export const PUBLISHED_BEFORE_THE_PLAN_RULE = new Set([]);
