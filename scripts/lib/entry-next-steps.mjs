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

// The dated log of the one live walk of steps 3 to 5. It ran the command forms
// below for the two entries named here, with cub v0.8.7, a ConfigHub server at
// v0.8.9, installer plugin 0.1.0, kind v0.31.0 and Argo CD v3.5.4. It is a log,
// not a receipt, so no state in this module reads from it. A step carries it as
// liveWalk so a reader can see which forms were run. The delete line in steps 4
// and 5 and the placeholder names in steps 3 to 5 come from what it found.
export const ENTRY_STEPS_WALK = {
  date: "2026-10-08",
  path: "docs/user/live-walk-entry-steps-2026-10-08.md",
  url: "https://github.com/confighub/helm-expt/blob/main/docs/user/live-walk-entry-steps-2026-10-08.md",
  versions: "cub v0.8.7, ConfigHub server v0.8.9, installer plugin 0.1.0 and Argo CD v3.5.4",
  entries: ["bitnami-nginx-24-0-2-http-clusterip", "nvidia-gpu-operator-v26-3-3-default"],
};

// The names a reader chooses. The page cannot use the entry id as a Space name,
// because the walk found that name already taken in an organization.
export const SPACE_PLACEHOLDER = "<your-space>";
export const COMPONENT_PLACEHOLDER = "<your-component>";

// A step that carries liveWalk, for an installer package.
// One run of the printed commands for a published OCI bundle.
export const BUNDLE_ROUTE_WALK = {
  date: "2026-11-02",
  path: "docs/user/live-walk-bundle-route-2026-11-02.md",
  url: "https://github.com/confighub/helm-expt/blob/main/docs/user/live-walk-bundle-route-2026-11-02.md",
  versions: "cub v0.9.0, workshop plugin 0.6.61",
};

const WALKED_STEPS = ["upload", "deploy", "promote"];
const INSTALLER_RECORD = "installer-record";

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

// Which public artifact a reader can upload from. A published OCI bundle comes
// first, because it needs no render on the reader's machine and leaves no
// installer record to remove. An installer package counts only when the listing
// pins it by digest, and a literal bundle only when the listing records it as
// published at a public reference. Anything else is not a public artifact, so
// the entry has no upload command.
export function uploadPath(listing) {
  const format = listing.source?.format ?? "";
  const ociRef = listing.source?.ociRef ?? "";
  const namespace = fixedInput(listing, "namespace");
  const validNamespace = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(namespace);
  const literal = bundle(listing, "literal-config");
  if (literal.state === "published" && literal.referenceState === "published" && String(literal.reference).startsWith("oci://")) {
    return { kind: "literal-bundle", reference: literal.reference, ...(validNamespace ? { namespace } : {}) };
  }
  if (format === "helm" && /@sha256:[0-9a-f]{64}$/.test(ociRef) && validNamespace) {
    return { kind: "installer-package", reference: ociRef, namespace };
  }
  return { kind: "none" };
}

// The installer package route for a Helm entry, whichever route its upload step
// prints. A page that recorded a run of this route shows these commands.
export function installerPackageCommands(listing) {
  const ociRef = listing.source?.ociRef ?? "";
  const namespace = fixedInput(listing, "namespace");
  if (listing.source?.format !== "helm" || !/@sha256:[0-9a-f]{64}$/.test(ociRef) || !namespace) return null;
  const { id, base } = listing.identity;
  return {
    setup: `cub installer setup --pull ${ociRef} --base ${base} --work-dir ./${id} --non-interactive --namespace ${namespace}`,
    upload: `cub installer upload --work-dir ./${id} --space ${SPACE_PLACEHOLDER} --component ${COMPONENT_PLACEHOLDER}`,
    list: `cub unit list --space ${SPACE_PLACEHOLDER}`,
  };
}

// API groups a cluster serves without any CRD.
const BUILT_IN_API_GROUPS = new Set(["", "apps", "batch", "rbac.authorization.k8s.io", "policy", "networking.k8s.io", "autoscaling", "apiextensions.k8s.io", "admissionregistration.k8s.io", "storage.k8s.io", "scheduling.k8s.io", "coordination.k8s.io", "discovery.k8s.io", "node.k8s.io", "certificates.k8s.io", "apiregistration.k8s.io", "flowcontrol.apiserver.k8s.io", "events.k8s.io", "resource.k8s.io"]);

// The custom resource kinds in a set of rendered objects whose CRD is not among
// them. Argo CD and Flux stop the whole sync on such an object until the CRD exists.
export function customResourcesWithoutDefinition(yamlText) {
  const defined = new Set();
  const used = [];
  for (const doc of String(yamlText).split(/^---\s*$/m)) {
    const field = (pattern) => doc.match(pattern)?.[1];
    const apiVersion = field(/^apiVersion:\s*["']?([^"'\s]+)/m);
    const kind = field(/^kind:\s*["']?([^"'\s]+)/m);
    if (!apiVersion || !kind) continue;
    if (kind === "CustomResourceDefinition") {
      defined.add(`${field(/^  group:\s*["']?([^"'\s]+)/m)}/${field(/^    kind:\s*["']?([^"'\s]+)/m)}`);
    } else {
      used.push([apiVersion.includes("/") ? apiVersion.split("/")[0] : "", kind]);
    }
  }
  return [...new Set(used.filter(([group, kind]) => !BUILT_IN_API_GROUPS.has(group) && !defined.has(`${group}/${kind}`)).map(([, kind]) => kind))].sort();
}

function missingDefinitionWarning(kinds) {
  const named = kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(", ")} and ${kinds.at(-1)}`;
  return `This entry won't deliver yet. It holds ${named}, and ${kinds.length === 1 ? "the CRD for that kind is" : "the CRDs for those kinds are"} not in this entry. Argo CD or Flux stops the whole sync until ${kinds.length === 1 ? "that CRD exists" : "those CRDs exist"}, so make sure of that first.`;
}

// A bundle with a plan carries the plan's documents as Units, and Argo CD cannot
// apply their kinds, so they stay out of a Release. A promotion adds them back.
// A delete that matches nothing succeeds, so an older bundle without them is fine.
function planDocumentRemoval(listing, path, space) {
  if (path.kind !== "literal-bundle" || listing.flattened?.verdict !== "flatten-with-routes") return [];
  return ["bundleroute", "bundletargetrequirements"].map((suffix) => ({
    comment: "keep the plan's documents out of the Release, because Argo CD cannot apply them",
    command: `cub unit delete --space ${space}-dev --where "Slug LIKE '%-${suffix}'"`,
    needsAccount: true,
    writes: true,
  }));
}

// True when the listing records a passed delivery and the deploy step shows
// commands for the entry. The recorded delivery proofs ran other commands than
// the ones shown, so the step may not read as run for the commands it shows.
export function deliveryRanOtherCommands(listing) {
  return uploadPath(listing).kind !== "none" && (listing.oci?.runtimes ?? []).some((runtime) => runtime.state === "pass");
}

// True when the promote step shows commands that no recorded promotion ran.
// Every recorded promotion ran the preview and the promote. For an installer
// package the step also deletes the installer record and publishes a Release,
// which the live walk added and no per-entry receipt holds.
export function promotionRanFewerCommands(listing) {
  return uploadPath(listing).kind === "installer-package";
}

// CRDs the base itself carries are not inputs the destination supplies. The
// listing records both under installTimeInputs, so the detail text decides.
function splitInstallInputs(listing) {
  const inputs = (listing.lifecycle?.installTimeInputs ?? []).filter((input) => input.name);
  const carried = (input) => input.kind === "requiredCRDs" && /\bincluded in this (base|preset)\b/i.test(input.detail ?? "");
  return {
    needs: inputs.filter((input) => !carried(input)).map((input) => input.name),
    carries: inputs.filter(carried).map((input) => input.name),
  };
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
    // A passed delivery is a run of the commands it ran. The recorded proofs
    // upload with a Target, set the Space's release Target and publish. The
    // commands this step shows clone the base with cub variant create, which no
    // proof recorded, so a passed delivery reads as partly run when the step
    // shows commands.
    if (states.includes("pass")) return { state: deliveryRanOtherCommands(listing) ? "partly-run-for-this-entry" : "run-for-this-entry", basis };
    if (states.includes("partial") || states.includes("recorded-elsewhere")) return { state: "partly-run-for-this-entry", basis };
    return { state: path.kind === "none" ? "not-available" : "not-run-for-this-entry", basis };
  }
  if (stepId === "promote") {
    const state = listing.lifecycle?.promotion?.state ?? "not-recorded";
    const basis = ["lifecycle.promotion"];
    if (state === "pass" || state === "proven") return { state: promotionRanFewerCommands(listing) ? "partly-run-for-this-entry" : "run-for-this-entry", basis };
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

function walkOf(walk = ENTRY_STEPS_WALK) {
  return { liveWalk: { date: walk.date, path: walk.path, url: walk.url, versions: walk.versions } };
}

// Plain sentences that follow a step's summary. Only an installer package has
// them today, because only that path was walked. A backtick pair marks a span
// of code on the page.
function noteList(...notes) {
  return notes.length > 0 ? { notes } : {};
}

// related: every other maintained entry for the same source, as
// { id, url, version, base, format, plan }. plan: this entry's own fetch plan.
export function buildNextSteps(listing, { plan, related = [], missingDefinitions = [] }) {
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
    const countNote = path.kind === "installer-package"
      ? noteList("An upload can create more Units than the objects counted here. The installer renders a Namespace, and the upload adds an `installer-record` Unit.")
      : {};
    return { summary, commands, ...countNote, ...(plan.kind === "none" ? { link: listing.flattened.objectsUrl } : {}) };
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
        summary: "The Catalog holds no other version or base of this entry's source in the same format.",
        unblock: `A second entry for ${name} in this format would give this step a sibling.`,
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
        { comment: "upload step 1's directory as a Space of Units, under names you choose", command: `cub installer upload --work-dir ./${id} --space ${SPACE_PLACEHOLDER} --component ${COMPONENT_PLACEHOLDER}`, needsAccount: true, writes: true },
        { comment: "list the Units the upload created", command: `cub unit list --space ${SPACE_PLACEHOLDER}`, needsAccount: true },
      );
    } else if (path.kind === "literal-bundle") {
      // A rendered chart carries no Namespace object. The installer adds one, so this
      // route asks for one too, except for a namespace every cluster already has.
      const createNamespace = path.namespace && !/^(default|kube-.*)$/.test(path.namespace) ? " --create-namespace" : "";
      const args = `--component ${slug(name)} --variant ${base} --space ${id}${path.namespace ? ` --namespace ${path.namespace}${createNamespace}` : ""} ${path.reference}`;
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
    const uploadNotes = path.kind === "installer-package"
      ? {
          ...noteList(
            "Replace each value in angle brackets with a name of your own. The entry id may already exist as a Space in your organization, and the package name as a Component.",
            "In the live walk, a Space named for the nginx entry's id and a Component named bitnami-nginx already existed, so the walk chose its own names. The `--component` flag sets the Component label the upload writes on the Space, which is the package name when you omit it.",
            "The cub installer plugin reads your organization from `CUB_CONTEXT` and ignores `--context`. If you use a context other than your default, export `CUB_CONTEXT` first, or the plugin works in your default organization.",
          ),
          ...walkOf(),
        }
      : {};
    if (state === "run-for-this-entry") {
      const evidence = upload.state === "published" ? receiptOf(upload) : release.state === "published" ? receiptOf(release) : {};
      return { summary: `The Catalog saved this entry in ConfigHub. ${source}`, commands, ...uploadNotes, ...evidence };
    }
    if (state === "partly-run-for-this-entry") {
      const partial = ["local", "recorded-elsewhere"].includes(upload.state) ? upload : release;
      return { summary: `The record holds a local, temporary or separately recorded upload for this entry, and no retained one. ${source}`, commands, ...uploadNotes, ...receiptOf(partial) };
    }
    if (state === "not-run-for-this-entry") {
      return { summary: `The Catalog has not uploaded this entry. ${source}`, commands, ...uploadNotes };
    }
    return {
      summary: "This entry is not published, so there is no public artifact to upload.",
      unblock: `The listing records its literal configuration bundle as ${BUNDLE_PHRASE.get(literal.state) ?? literal.state}. Publishing the ${listing.flattened?.materializationStatus === "recorded-no-op" ? "retained" : "rendered"} objects as that bundle, with a receipt, would make this step available.`,
    };
  }));

  // 4. Deploy it.
  steps.push(step("deploy", (state) => {
    const { needs, carries } = splitInstallInputs(listing);
    const installer = path.kind === "installer-package";
    const spaceArg = installer ? SPACE_PLACEHOLDER : id;
    const planRemoval = planDocumentRemoval(listing, path, spaceArg);
    const commands = path.kind === "none" ? [] : [
      { comment: "clone the base onto a Target as a dev variant", command: `cub variant create dev ${spaceArg} --target ${NEXT_STEPS_TARGET} --space-pattern "template:${spaceArg}-dev"`, needsAccount: true, writes: true },
      ...planRemoval,
      { comment: installer ? "publish the Release that the cluster's Argo CD pulls" : "publish the Release that Argo CD or Flux pulls", command: `cub release publish ${spaceArg}-dev`, needsAccount: true, writes: true },
      ...(installer ? [
        { comment: "delete the installer record, which Argo CD cannot read", command: `cub unit delete --space ${spaceArg}-dev ${INSTALLER_RECORD}`, needsAccount: true, writes: true },
        { comment: "publish again without it", command: `cub release publish ${spaceArg}-dev`, needsAccount: true, writes: true },
      ] : []),
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
    const inputs = { ...(needs.length > 0 ? { needs } : {}), ...(carries.length > 0 ? { carries } : {}) };
    const common = { ...inputs, ...(alsoRecorded ? { alsoRecorded } : {}), ...evidence };
    if (state === "not-available") {
      return {
        summary: "This step needs an upload command from step 3, and this entry has none.",
        unblock: "A published artifact for this entry, with a receipt, would make this step available.",
        ...inputs,
      };
    }
    const passed = (listing.oci?.runtimes ?? []).some((runtime) => runtime.state === "pass");
    const lead = state === "run-for-this-entry"
      ? "A delivery run passed for this entry."
      : passed
        ? installer
          ? "A delivery run passed for this entry, but it ran other commands than the ones below. It uploaded with the Target in the upload command, set the Space's release Target and published the Release. The commands below have no recorded run for this entry."
          : "A delivery run passed for this entry, but it ran other commands than the ones below, which have no recorded run for this entry."
        : state === "partly-run-for-this-entry"
          ? "A delivery is partly recorded for this entry, and no run has passed."
          : "No delivery run is recorded for this entry.";
    const deployNotes = installer && commands.length > 0
      ? {
          ...noteList(
            "Use the Space name you chose in step 3. The delete command is needed because the cloned `installer-record` Unit carries the Target and Argo CD v3.5.4 cannot read it, a defect seen on cub v0.8.7 and server v0.8.9.",
            "Without that line the walk deployed nothing and Argo CD showed Unknown, while every cub command exited 0. The walk ran the four commands in this order and did not try them without the first publish.",
            "ConfigHub shows nothing when Argo CD fails to read a Release. Run `kubectl -n argocd get applications.argoproj.io` and read the Sync column, because Healthy alone is not a pass. Argo CD took between 18 seconds and about 5 minutes to read a Release on a cluster made without argobot.",
            "Make the cluster with `cub cluster up --no-k8sbot`, a flag cub v0.8.7 called no-argobot when the walk ran. That command creates two Spaces, a Worker, a Target and a Trigger, opens ports 30010 to 30019 on the machine, and installs Argo CD from an unpinned upstream manifest.",
            "Removing the ConfigHub side does not remove the workload. In the walk, deleting the Application Unit and the Spaces left the Application and its pods running, because the root Application does not prune.",
          ),
          ...walkOf(),
        }
      : commands.length > 0 && path.kind === "literal-bundle" && listing.source?.format === "helm"
        ? {
            ...noteList(`The target \`${NEXT_STEPS_TARGET}\` comes from \`cub cluster up --name workshop --no-k8sbot\`, which makes a local kind cluster with Argo CD. In a run with cub v0.9.0, the same command without \`--no-k8sbot\` failed while it installed argobot.`),
            ...walkOf(BUNDLE_ROUTE_WALK),
          }
        : {};
    const warning = path.kind === "literal-bundle" && missingDefinitions.length > 0 ? `${missingDefinitionWarning(missingDefinitions)} ` : "";
    return { summary: `${warning}${lead} ${runtimes}`.trim(), commands, ...deployNotes, ...common };
  }));

  // 5. Promote a change.
  steps.push(step("promote", (state) => {
    const promotion = listing.lifecycle?.promotion ?? {};
    const installer = path.kind === "installer-package";
    const spaceArg = installer ? SPACE_PLACEHOLDER : id;
    const commands = path.kind === "none" || state === "blocked-for-this-entry" ? [] : [
      { comment: "preview what the dev variant would take from the base", command: `cub variant promote ${spaceArg}-dev --dry-run -o mutations`, needsAccount: true },
      { comment: "promote once you have read the preview", command: `cub variant promote ${spaceArg}-dev --change-desc "Pull the reviewed base forward"`, needsAccount: true, writes: true },
      ...(installer ? [
        { comment: "delete the installer record that the promotion adds back", command: `cub unit delete --space ${spaceArg}-dev ${INSTALLER_RECORD}`, needsAccount: true, writes: true },
      ] : planDocumentRemoval(listing, path, spaceArg)),
      // A promotion changes the Space and publishes nothing, on either route.
      { comment: "publish the Release that carries the change", command: `cub release publish ${spaceArg}-dev`, needsAccount: true, writes: true },
    ];
    const promoteNotes = installer && commands.length > 0
      ? {
          ...noteList(
            "The promotion changes the dev Space and publishes nothing. It also adds the `installer-record` Unit back with the Target. The change reaches the cluster only after the delete and the publish.",
            "The preview lists the whole installer record as added. In the walk, the preview of a one-label change to gpu-operator ran to 405 lines, and about 400 of them were that record.",
          ),
          ...walkOf(),
        }
      : commands.length > 0 && path.kind === "literal-bundle" && listing.source?.format === "helm"
        ? {
            ...noteList("The promotion changes the dev Space and publishes nothing. The change reaches the cluster only after the publish. In a run on another entry, an edit made to the variant survived the promotion."),
            ...walkOf(BUNDLE_ROUTE_WALK),
          }
        : {};
    if (state === "not-available") {
      return {
        summary: "This step needs an upload command from step 3, and this entry has none.",
        unblock: "A published artifact for this entry, with a receipt, would make this step available.",
      };
    }
    if (state === "blocked-for-this-entry") {
      return { summary: "The Catalog's promotion run for this entry is blocked, so no promotion command is given. Read the record before you try one.", ...receiptOf(promotion) };
    }
    const route = promotion.path ? ` It followed ${String(promotion.path).replaceAll(" -> ", " to ")}.` : "";
    const proven = ["pass", "proven"].includes(promotion.state);
    const unrecorded = installer ? " It ran the preview and the promote. The delete and the publish below have no recorded run for this entry." : " It ran the preview and the promote. The publish below has no recorded run for this entry.";
    const lead = state === "run-for-this-entry"
      ? `A promotion ran for this entry.${route}`
      : state === "partly-run-for-this-entry"
        ? proven
          ? `A promotion ran for this entry.${route}${unrecorded}`
          : `A promotion ran for this entry and left a limit to review.${unrecorded}`
        : "No promotion is recorded for this entry.";
    return { summary: lead, commands, ...promoteNotes, ...receiptOf(promotion) };
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
    if (path.kind === "installer-package" && WALKED_STEPS.includes(step.id) && commands.length > 0) {
      // Commands the live walk ran. The Space and Component names are the
      // reader's, the deploy and promote steps delete the cloned record before
      // they publish, and the step links the log that ran those forms.
      for (const { command } of commands) {
        if (command.replace(`./${id}`, "").includes(id)) errors.push(`${id}: step ${step.id} uses the entry id as a Space name, and the walk found that name already taken`);
      }
      const uploadCommand = commands.find(({ command }) => /\bcub installer upload\b/.test(command));
      if (uploadCommand && !/ --component \S/.test(uploadCommand.command)) errors.push(`${id}: step ${step.id} uploads without --component`);
      if (["deploy", "promote"].includes(step.id)) {
        const removal = commands.findIndex(({ command }) => /^cub unit delete .*\binstaller-record$/.test(command));
        if (removal < 0) errors.push(`${id}: step ${step.id} does not delete the cloned installer-record Unit, and Argo CD cannot read a Release that carries it`);
        else if (!commands.slice(removal + 1).some(({ command }) => /^cub release publish /.test(command))) errors.push(`${id}: step ${step.id} does not publish after it deletes the installer-record Unit`);
      }
      if (JSON.stringify(step.liveWalk ?? null) !== JSON.stringify(walkOf().liveWalk)) errors.push(`${id}: step ${step.id} does not link the live walk that ran its commands`);
    } else if (path.kind === "literal-bundle" && listing.source?.format === "helm" && ["deploy", "promote"].includes(step.id) && commands.length > 0) {
      if (JSON.stringify(step.liveWalk ?? null) !== JSON.stringify(walkOf(BUNDLE_ROUTE_WALK).liveWalk)) errors.push(`${id}: step ${step.id} does not link the run of the OCI bundle route`);
    } else if (step.liveWalk) {
      errors.push(`${id}: step ${step.id} links the live walk, and the walk ran no command of this step for this kind of entry`);
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
