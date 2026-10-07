// The five steps every Catalog entry carries, in one fixed order, and the state
// of each step for one entry.
//
// A listing already says what was rendered, published, uploaded, delivered and
// promoted, but it says so in five different sections. A reader who wants to
// use an entry has to know which section answers which question. This module
// reads those sections and writes the same five steps for every entry, with
// the commands that entry supports and the state its own record supports.
//
// Nothing here is a new claim. Each state is derived from fields the listing
// already publishes, and nextStepClaimErrors() re-derives every state from the
// finished listing, so a step can never say more than its record does. A step
// whose precondition is missing carries no command at all.
//
// The command forms are the ones the repository documents and has receipts
// for: docs/user/variants-after-upload.md and the generated confighub.sh
// scripts (cub installer setup, cub installer upload, cub variant promote),
// and docs/user/cub-deployment-path.md (cub variant upload, cub variant create
// --target, cub release publish). No plugin version is pinned here, because a
// pin in 400 listings would go stale with every plugin release.

export const NEXT_STEPS_HEADING = "Use this entry in ConfigHub";

export const NEXT_STEPS = [
  { id: "get-objects", label: "Get the exact objects" },
  { id: "compare", label: "Compare with another version or base" },
  { id: "upload", label: "Upload it as a variant" },
  { id: "deploy", label: "Deploy it" },
  { id: "promote", label: "Promote a change" },
];

export const NEXT_STEP_STATES = new Map([
  ["run-for-this-entry", "Run for this entry"],
  ["partly-run-for-this-entry", "Partly run for this entry"],
  ["not-run-for-this-entry", "Not run for this entry"],
  ["blocked-for-this-entry", "Blocked for this entry"],
  ["not-available", "Not available yet"],
]);

// The Target the deploy commands name. `cub cluster up --name workshop` makes
// exactly this one, which is what the site's own deploy walkthrough uses.
export const NEXT_STEPS_TARGET = "workshop/target";

const RUNTIME_LABEL = new Map([
  ["argo-cd", "Argo CD"],
  ["flux", "Flux"],
  ["direct", "kubectl"],
]);

const RUNTIME_PHRASE = new Map([
  ["pass", "passed"],
  ["partial", "is partly recorded"],
  ["recorded-elsewhere", "is recorded for a related object set"],
  ["not-run", "has not run"],
  ["not-applicable", "does not apply"],
  ["not-recorded", "has no record"],
]);

const BUNDLE_PHRASE = new Map([
  ["published", "published"],
  ["local", "held only as a local layout"],
  ["recorded-elsewhere", "recorded for a related object set"],
  ["not-published", "not published"],
  ["not-recorded", "not recorded"],
]);

function bundle(listing, role) {
  return (listing.oci?.bundles ?? []).find((entry) => entry.role === role) ?? { role, state: "not-recorded", reference: "", referenceState: "none" };
}

function fixedInput(listing, key) {
  const prefix = `${key}=`;
  const found = (listing.source?.fixedAtBuildTime ?? []).find((entry) => String(entry).startsWith(prefix));
  return found ? String(found).slice(prefix.length) : "";
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Which public artifact a reader can upload from. An installer package counts
// only when the listing pins it by digest, and a literal bundle only when the
// listing records it as published at a public reference. Anything else is not
// a public artifact, so the entry has no upload command.
export function uploadPath(listing) {
  const format = listing.source?.format ?? "";
  const ociRef = listing.source?.ociRef ?? "";
  const namespace = fixedInput(listing, "namespace");
  if (format === "helm" && /@sha256:[0-9a-f]{64}$/.test(ociRef) && /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(namespace)) {
    return { kind: "installer-package", reference: ociRef, namespace };
  }
  const literal = bundle(listing, "literal-config");
  if (literal.state === "published" && literal.referenceState === "published" && String(literal.reference).startsWith("oci://")) {
    return { kind: "literal-bundle", reference: literal.reference };
  }
  return { kind: "none" };
}

// The state each step may claim, read from the listing alone. `plan` is the
// fetch plan for this entry's retained objects and `comparable` says whether a
// sibling with the same object shape exists; both are facts about committed
// files, passed in by the generator.
export function deriveStepState(listing, stepId, { hasObjects, siblingCount, comparableCount }) {
  const path = uploadPath(listing);
  if (stepId === "get-objects") {
    const materialization = (listing.assessment?.stages ?? []).find((stage) => stage.id === "materialization") ?? {};
    const retained = ["captured", "recorded-no-op"].includes(listing.flattened?.materializationStatus) && materialization.evidenceState === "completed";
    return {
      state: retained && hasObjects ? "run-for-this-entry" : "not-available",
      basis: ["flattened.materializationStatus", "flattened.retainedObjects", "flattened.inventory", "flattened.digest"],
    };
  }
  if (stepId === "compare") {
    return {
      state: siblingCount > 0 && comparableCount > 0 ? "not-run-for-this-entry" : "not-available",
      basis: ["variants.known", "source.name", "flattened.format"],
    };
  }
  if (stepId === "upload") {
    const upload = bundle(listing, "confighub-upload");
    const release = bundle(listing, "confighub-release");
    const lane = listing.lifecycle?.coverage?.confighub_scan_ops?.status ?? "not_declared";
    const basis = ["source.ociRef", "oci.bundles[literal-config]", "oci.bundles[confighub-upload]", "oci.bundles[confighub-release]", "lifecycle.coverage.confighub_scan_ops"];
    if (upload.state === "published" || release.state === "published" || lane === "checked") return { state: "run-for-this-entry", basis };
    if (["local", "recorded-elsewhere"].includes(upload.state) || ["local", "recorded-elsewhere"].includes(release.state) || lane === "partial") {
      return { state: "partly-run-for-this-entry", basis };
    }
    return { state: path.kind === "none" ? "not-available" : "not-run-for-this-entry", basis };
  }
  if (stepId === "deploy") {
    const states = (listing.oci?.runtimes ?? []).map((runtime) => runtime.state);
    const basis = ["oci.runtimes", "lifecycle.installTimeInputs"];
    if (states.includes("pass")) return { state: "run-for-this-entry", basis };
    if (states.includes("partial") || states.includes("recorded-elsewhere")) return { state: "partly-run-for-this-entry", basis };
    return { state: path.kind === "none" ? "not-available" : "not-run-for-this-entry", basis };
  }
  if (stepId === "promote") {
    const state = listing.lifecycle?.promotion?.state ?? "not-recorded";
    const basis = ["lifecycle.promotion"];
    if (state === "pass" || state === "proven") return { state: "run-for-this-entry", basis };
    if (state === "partial") return { state: "partly-run-for-this-entry", basis };
    if (state === "blocked") return { state: "blocked-for-this-entry", basis };
    return { state: path.kind === "none" ? "not-available" : "not-run-for-this-entry", basis };
  }
  throw new Error(`unknown next step ${stepId}`);
}

// Versions are compared segment by segment as numbers, so 9.5.15 sorts before
// 10.1.3 and v0.21.0 after v0.20.0.
export function compareVersions(left, right) {
  const parts = (value) => String(value).split(/[^0-9]+/).filter(Boolean).map(Number);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

function fetchCommands(id, plan, { verify }) {
  if (plan.kind === "file") {
    const commands = [{ comment: verify ? "fetch the retained objects for this entry" : `fetch the retained objects of ${id}`, command: `curl -fsSL -o ${id}.yaml ${plan.url}` }];
    if (verify) {
      commands.push({
        comment: "check the bytes against the listing",
        command: `shasum -a 256 ${id}.yaml`,
        expect: `${plan.sha256.replace(/^sha256:/, "")}  ${id}.yaml`,
      });
    }
    return commands;
  }
  if (plan.kind === "inventory") {
    const commands = [
      { comment: verify ? "make the directories the inventory names" : `fetch the retained files of ${id}`, command: `mkdir -p ${plan.dirs.map((dir) => (dir === "." ? id : `${id}/${dir}`)).join(" ")}` },
      { ...(verify ? { comment: "fetch the inventory, then every file it lists" } : {}), command: `curl -fsSL -o ${id}/${plan.inventoryName} ${plan.rawBase}/${plan.inventoryName}` },
      { command: `cut -c67- ${id}/${plan.inventoryName} | xargs -I{} curl -fsSL -o ${id}/{} ${plan.rawBase}/{}` },
    ];
    if (verify) {
      commands.push(
        { comment: "check every file against the inventory", command: `(cd ${id} && shasum -a 256 -c ${plan.inventoryName})` },
        {
          comment: "check the inventory against the listing digest",
          command: `shasum -a 256 ${id}/${plan.inventoryName}`,
          expect: `${plan.sha256.replace(/^sha256:/, "")}  ${id}/${plan.inventoryName}`,
        },
      );
    }
    if (plan.joinGlob) commands.push({ comment: verify ? "join the files into one for step 2" : "join them into one file", command: `cat ${id}/${plan.joinGlob} > ${id}.yaml` });
    return commands;
  }
  return [];
}

function comparable(plan) {
  return plan.kind === "file" || (plan.kind === "inventory" && Boolean(plan.joinGlob));
}

function objectNoun(listing) {
  const count = listing.flattened?.objectCount ?? 0;
  const noun = listing.flattened?.format === "argocd-application-yaml" ? "Argo CD Application" : "object";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function runtimeSentence(listing) {
  const parts = (listing.oci?.runtimes ?? []).map((runtime) => `${RUNTIME_LABEL.get(runtime.runtime) ?? runtime.runtime} ${RUNTIME_PHRASE.get(runtime.state) ?? runtime.state}`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}.`;
}

function receiptOf(source) {
  return source?.receipt && source?.receiptUrl ? { receipt: source.receipt, receiptUrl: source.receiptUrl } : {};
}

// related: every other maintained entry for the same source, as
// { id, url, version, base, format, plan }. plan: this entry's own fetch plan.
export function buildNextSteps(listing, { plan, related = [] }) {
  const id = listing.identity.id;
  const base = listing.identity.base;
  const version = listing.identity.version;
  const name = listing.source?.name ?? listing.identity.name;
  const path = uploadPath(listing);
  const sameShape = related.filter((entry) => entry.format === listing.flattened?.format && comparable(entry.plan));
  const facts = {
    hasObjects: plan.kind !== "none" || Boolean(listing.flattened?.objectsUrl),
    siblingCount: related.length,
    comparableCount: comparable(plan) ? sameShape.length : 0,
  };
  const stateOf = (stepId) => deriveStepState(listing, stepId, facts);
  const label = (stepId) => NEXT_STEPS.find((step) => step.id === stepId).label;
  const step = (stepId, fields) => {
    const { state, basis } = stateOf(stepId);
    const { summary, commands = [], ...rest } = fields(state);
    return { id: stepId, label: label(stepId), state, summary, basis, commands, ...rest };
  };

  const steps = [];

  // 1. Get the exact objects.
  steps.push(step("get-objects", (state) => {
    if (state !== "run-for-this-entry") {
      return {
        summary: "The record does not hold rendered objects a reader can fetch for this entry.",
        unblock: "A retained object file or inventory for this entry would make this step available.",
      };
    }
    const supplied = listing.flattened?.materializationStatus === "recorded-no-op";
    const commands = fetchCommands(id, plan, { verify: true });
    if (path.kind === "installer-package") {
      commands.push({
        comment: "render this base from the signed package; step 3 uploads this directory",
        command: `cub installer setup --pull ${path.reference} --base ${base} --work-dir ./${id} --non-interactive --namespace ${path.namespace}`,
      });
    }
    const summary = plan.kind === "file"
      ? `The Catalog ${supplied ? "retains" : "rendered this entry and retains"} its ${objectNoun(listing)} in one file${supplied ? ", exactly as supplied" : ""}.`
      : plan.kind === "inventory"
        ? `The Catalog ${supplied ? "retains" : "rendered this entry and retains"} its ${objectNoun(listing)} as files that one inventory lists.`
        : `The Catalog retains this entry's ${objectNoun(listing)} as files in the repository, with no single file or inventory to fetch.`;
    return { summary, commands, ...(plan.kind === "none" ? { link: listing.flattened.objectsUrl } : {}) };
  }));

  // 2. Compare with another version or base.
  steps.push(step("compare", (state) => {
    const siblings = [...related]
      .sort((left, right) => compareVersions(left.version, right.version) || (left.base < right.base ? -1 : left.base > right.base ? 1 : 0))
      .map((entry) => ({
        id: entry.id,
        url: entry.url,
        version: entry.version,
        base: entry.base,
        relation: entry.version === version ? "other-base" : "other-version",
      }));
    if (related.length === 0) {
      return {
        summary: "This entry has no other version or base in the Catalog.",
        unblock: `A second retained version or base of ${name} would give this step a sibling.`,
        siblings,
      };
    }
    if (state === "not-available") {
      return {
        summary: "The other Catalog entries for this source retain a different object shape, so no object comparison is given.",
        unblock: "A sibling retained in the same shape as this entry would make this step available.",
        siblings,
      };
    }
    const commands = [];
    const otherBase = sameShape.filter((entry) => entry.version === version).sort((left, right) => (left.base === "default" ? -1 : right.base === "default" ? 1 : left.base < right.base ? -1 : 1))[0];
    if (otherBase) {
      commands.push(...fetchCommands(otherBase.id, otherBase.plan, { verify: false }).map((command, index) => (index === 0 ? { ...command, comment: `fetch the ${otherBase.base} base of the same version` } : command)));
      commands.push({ comment: "list what differs between the two bases", command: `cub config diff ${id}.yaml ${otherBase.id}.yaml --summary` });
    }
    const otherVersions = sameShape.filter((entry) => entry.version !== version);
    const preferred = otherVersions.filter((entry) => entry.base === base);
    const pool = preferred.length > 0 ? preferred : otherVersions;
    const older = pool.filter((entry) => compareVersions(entry.version, version) < 0).sort((left, right) => compareVersions(right.version, left.version) || (left.base < right.base ? -1 : 1))[0];
    const newer = pool.filter((entry) => compareVersions(entry.version, version) > 0).sort((left, right) => compareVersions(left.version, right.version) || (left.base < right.base ? -1 : 1))[0];
    const otherVersion = older ?? newer;
    if (otherVersion) {
      commands.push(...fetchCommands(otherVersion.id, otherVersion.plan, { verify: false }).map((command, index) => (index === 0 ? { ...command, comment: `fetch the ${otherVersion.base} base at version ${otherVersion.version}` } : command)));
      commands.push(older
        ? { comment: `list what changed from ${otherVersion.version} to ${version}`, command: `cub config diff ${otherVersion.id}.yaml ${id}.yaml --summary` }
        : { comment: `list what changes from ${version} to ${otherVersion.version}`, command: `cub config diff ${id}.yaml ${otherVersion.id}.yaml --summary` });
    }
    return {
      summary: "The listing records no comparison for this entry. The commands run on the retained files, with no account.",
      commands,
      siblings,
    };
  }));

  // 3. Upload it as a variant.
  steps.push(step("upload", (state) => {
    const upload = bundle(listing, "confighub-upload");
    const release = bundle(listing, "confighub-release");
    const literal = bundle(listing, "literal-config");
    const commands = [];
    if (path.kind === "installer-package") {
      commands.push(
        { comment: "sign in; steps 3 to 5 write to your ConfigHub organization", command: "cub auth login", needsAccount: true },
        { comment: "upload the directory rendered in step 1 as a Space of Units", command: `cub installer upload --work-dir ./${id} --space ${id}`, needsAccount: true, writes: true },
        { comment: "list the Units the upload created", command: `cub unit list --space ${id}`, needsAccount: true },
      );
    } else if (path.kind === "literal-bundle") {
      const args = `--component ${slug(name)} --variant ${base} --space ${id} ${path.reference}`;
      commands.push(
        { comment: "sign in; steps 3 to 5 write to your ConfigHub organization", command: "cub auth login", needsAccount: true },
        { comment: "preview the upload of the published bundle; nothing is written", command: `cub variant upload --dry-run ${args}`, needsAccount: true },
        { comment: "upload the bundle as a base Space of Units", command: `cub variant upload ${args}`, needsAccount: true, writes: true },
      );
    }
    const source = path.kind === "installer-package"
      ? "The commands use its signed installer package."
      : path.kind === "literal-bundle"
        ? "The commands use its published literal configuration bundle."
        : "The listing names no public artifact for it, so no upload command is given.";
    if (state === "run-for-this-entry") {
      const evidence = upload.state === "published" ? receiptOf(upload) : release.state === "published" ? receiptOf(release) : {};
      return { summary: `The Catalog saved this entry in ConfigHub. ${source}`, commands, ...evidence };
    }
    if (state === "partly-run-for-this-entry") {
      const partial = ["local", "recorded-elsewhere"].includes(upload.state) ? upload : release;
      return { summary: `The record holds a local, temporary or separately recorded upload for this entry, and no retained one. ${source}`, commands, ...receiptOf(partial) };
    }
    if (state === "not-run-for-this-entry") {
      return { summary: `The Catalog has not uploaded this entry. ${source}`, commands };
    }
    return {
      summary: "This entry is not published, so there is no public artifact to upload.",
      unblock: `The listing records its literal configuration bundle as ${BUNDLE_PHRASE.get(literal.state) ?? literal.state}. Publishing the rendered objects as that bundle, with a receipt, would make this step available.`,
    };
  }));

  // 4. Deploy it.
  steps.push(step("deploy", (state) => {
    const needs = (listing.lifecycle?.installTimeInputs ?? []).map((input) => input.name).filter(Boolean);
    const commands = path.kind === "none" ? [] : [
      { comment: "clone the base onto a Target as a dev variant", command: `cub variant create dev ${id} --target ${NEXT_STEPS_TARGET} --space-pattern "template:${id}-dev"`, needsAccount: true, writes: true },
      { comment: "publish the Release that Argo CD or Flux pulls", command: `cub release publish ${id}-dev`, needsAccount: true, writes: true },
    ];
    const runtimes = runtimeSentence(listing);
    const earlier = [
      listing.lifecycle?.coverage?.local_kubernetes?.status === "checked" ? "a local Kubernetes run" : "",
      listing.lifecycle?.coverage?.gitops_oci_live?.status === "checked" ? "a GitOps OCI run" : "",
    ].filter(Boolean);
    const alsoRecorded = earlier.length > 0 && state !== "run-for-this-entry"
      ? `The coverage lanes record ${earlier.join(" and ")} for this base. They are separate from the delivery record this step reads.`
      : "";
    // The delivery receipt when the record has one, and otherwise the receipt
    // of the ConfigHub release a delivery would have pulled.
    const evidence = listing.oci?.receiptUrl ? receiptOf(listing.oci) : state === "not-run-for-this-entry" ? {} : receiptOf(bundle(listing, "confighub-release"));
    const common = { ...(needs.length > 0 ? { needs } : {}), ...(alsoRecorded ? { alsoRecorded } : {}), ...evidence };
    if (state === "not-available") {
      return {
        summary: "This step needs the upload in step 3, which is not available for this entry.",
        unblock: "Publishing the entry, as step 3 describes, would make this step available.",
        ...(needs.length > 0 ? { needs } : {}),
      };
    }
    const lead = state === "run-for-this-entry"
      ? "A delivery run passed for this entry."
      : state === "partly-run-for-this-entry"
        ? "A delivery is partly recorded for this entry, and no run has passed."
        : "No delivery run is recorded for this entry.";
    return { summary: `${lead} ${runtimes}`.trim(), commands, ...common };
  }));

  // 5. Promote a change.
  steps.push(step("promote", (state) => {
    const promotion = listing.lifecycle?.promotion ?? {};
    const commands = path.kind === "none" || state === "blocked-for-this-entry" ? [] : [
      { comment: "preview what the dev variant would take from the base", command: `cub variant promote ${id}-dev --dry-run -o mutations`, needsAccount: true },
      { comment: "promote once you have read the preview", command: `cub variant promote ${id}-dev --change-desc "Pull the reviewed base forward"`, needsAccount: true, writes: true },
    ];
    if (state === "not-available") {
      return {
        summary: "This step needs the upload in step 3, which is not available for this entry.",
        unblock: "Publishing the entry, as step 3 describes, would make this step available.",
      };
    }
    if (state === "blocked-for-this-entry") {
      return { summary: "The Catalog's promotion run for this entry is blocked, so no promotion command is given. Read the record before you try one.", ...receiptOf(promotion) };
    }
    const route = promotion.path ? ` It followed ${String(promotion.path).replaceAll(" -> ", " to ")}.` : "";
    const lead = state === "run-for-this-entry"
      ? `A promotion ran for this entry.${route}`
      : state === "partly-run-for-this-entry"
        ? "A promotion ran for this entry and left a limit to review."
        : "No promotion is recorded for this entry.";
    return { summary: lead, commands, ...receiptOf(promotion) };
  }));

  return steps.map((entry) => {
    // An empty list is dropped; an absent key and an empty key mean the same
    // thing here, and one of them is enough.
    const result = { ...entry, commands: entry.commands.map((command) => ({ ...command })) };
    if (result.siblings && result.siblings.length === 0) delete result.siblings;
    return result;
  });
}

// The refusal. Every claim a step makes is checked against the listing it sits
// in, so a hand-edited or mis-generated step cannot say more than its record.
export function nextStepClaimErrors(listing, { plan, related = [] }) {
  const errors = [];
  const steps = listing.nextSteps;
  const id = listing.identity?.id ?? "listing";
  if (!Array.isArray(steps) || steps.length !== NEXT_STEPS.length) return [`${id}: nextSteps must hold exactly ${NEXT_STEPS.length} steps`];
  const sameShape = related.filter((entry) => entry.format === listing.flattened?.format && comparable(entry.plan));
  const facts = {
    hasObjects: plan.kind !== "none" || Boolean(listing.flattened?.objectsUrl),
    siblingCount: related.length,
    comparableCount: comparable(plan) ? sameShape.length : 0,
  };
  const path = uploadPath(listing);
  const receipts = new Set([
    ...(listing.oci?.bundles ?? []).map((entry) => entry.receiptUrl),
    listing.oci?.receiptUrl,
    listing.lifecycle?.promotion?.receiptUrl,
  ].filter(Boolean));
  steps.forEach((step, index) => {
    const expected = NEXT_STEPS[index];
    if (step.id !== expected.id || step.label !== expected.label) {
      errors.push(`${id}: step ${index + 1} must be ${expected.id} (${expected.label}), found ${step.id} (${step.label})`);
      return;
    }
    const supported = deriveStepState(listing, step.id, facts).state;
    if (step.state !== supported) {
      errors.push(`${id}: step ${step.id} claims ${step.state}, and its record supports ${supported}`);
    }
    const commands = step.commands ?? [];
    if (["not-available", "blocked-for-this-entry"].includes(step.state) && commands.length > 0) {
      errors.push(`${id}: step ${step.id} is ${step.state} and still shows a command`);
    }
    if (step.state === "not-available" && !step.unblock) {
      errors.push(`${id}: step ${step.id} is not available and does not say what would unblock it`);
    }
    if (["upload", "deploy", "promote"].includes(step.id) && commands.length > 0 && path.kind === "none") {
      errors.push(`${id}: step ${step.id} shows a ConfigHub command, and the entry has no public artifact to upload`);
    }
    for (const { command } of commands) {
      if (/\bcub installer setup\b/.test(command) && !(path.kind === "installer-package" && command.includes(path.reference))) {
        errors.push(`${id}: step ${step.id} pulls a package the listing does not pin by digest`);
      }
      if (/\bcub variant upload\b/.test(command) && !(path.kind === "literal-bundle" && command.includes(path.reference))) {
        errors.push(`${id}: step ${step.id} uploads a bundle the listing does not record as published`);
      }
      if (/\bcub installer upload\b/.test(command) && path.kind !== "installer-package") {
        errors.push(`${id}: step ${step.id} uploads an installer work directory, and the entry has no pinned installer package`);
      }
    }
    if (step.receiptUrl && !receipts.has(step.receiptUrl)) {
      errors.push(`${id}: step ${step.id} links a receipt the listing does not record`);
    }
    for (const sibling of step.siblings ?? []) {
      if (!related.some((entry) => entry.id === sibling.id)) errors.push(`${id}: step ${step.id} names ${sibling.id}, which is not an entry for the same source`);
    }
  });
  return errors;
}
