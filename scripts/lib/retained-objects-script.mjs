// The second test script of a Catalog entry, try-objects.sh. It tests the
// entry's retained objects themselves: one multi-document YAML file, fetched
// by URL and checked against the SHA-256 its listing records, then applied
// with kubectl. It needs no cub CLI and no account.
//
// Everything here is worked out from the listing and from the retained file at
// generation time. The script it writes runs under bash 3.2.

export const OBJECTS_SCRIPT_NAME = "try-objects.sh";

const ELIGIBLE_VERDICTS = new Set(["safe-to-flatten", "flatten-with-routes", "born-flattened"]);

// A plan step with this id says a value must be set before the objects are
// rendered. The retained file then holds a placeholder, and no step on a
// cluster can stand in for it, so the entry gets no script.
const FILE_MUST_CHANGE_STEP = "value-before-render";

// API groups that every cluster serves. A kind in any other group needs a
// CustomResourceDefinition, from this file or from the cluster.
const BUILT_IN_GROUPS = new Set([
  "", "admissionregistration.k8s.io", "apiextensions.k8s.io", "apiregistration.k8s.io", "apps",
  "authentication.k8s.io", "authorization.k8s.io", "autoscaling", "batch", "certificates.k8s.io",
  "coordination.k8s.io", "discovery.k8s.io", "events.k8s.io", "flowcontrol.apiserver.k8s.io",
  "networking.k8s.io", "node.k8s.io", "policy", "rbac.authorization.k8s.io", "resource.k8s.io",
  "scheduling.k8s.io", "storage.k8s.io",
]);

const BUILT_IN_CLUSTER_KINDS = new Set([
  "APIService", "CSIDriver", "CSINode", "CertificateSigningRequest", "ClusterRole", "ClusterRoleBinding",
  "CustomResourceDefinition", "DeviceClass", "FlowSchema", "IngressClass", "MutatingWebhookConfiguration",
  "Namespace", "Node", "PersistentVolume", "PriorityClass", "PriorityLevelConfiguration", "RuntimeClass",
  "StorageClass", "ValidatingAdmissionPolicy", "ValidatingAdmissionPolicyBinding",
  "ValidatingWebhookConfiguration", "VolumeAttachment",
]);

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;

function scalar(value) {
  const text = String(value ?? "").replace(/\s+#.*$/, "").trim();
  const quoted = /^(["'])(.*)\1$/.exec(text);
  return quoted ? quoted[2] : text;
}

// The awk program in the script starts a new document at every line that is
// only "---". This function numbers documents the same way, so a number worked
// out here names the same document the script writes.
export function splitRetainedDocuments(text) {
  const lines = String(text).split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const documents = [[]];
  for (const line of lines) {
    if (/^---[ \t]*$/.test(line)) documents.push([]);
    else documents[documents.length - 1].push(line);
  }
  return documents;
}

// The few fields the script needs from one document, read from its top-level
// keys. A document of only blank lines and comments holds no object.
function describeDocument(lines) {
  const found = { apiVersion: "", kind: "", name: "", namespace: "", crdGroup: "", crdKind: "", crdScope: "" };
  let top = null;
  let childIndent = null;
  let child = null;
  let grandchildIndent = null;
  let hasContent = false;
  for (const line of lines) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    hasContent = true;
    const topKey = /^([A-Za-z][A-Za-z0-9_]*):(?:\s+(.*))?$/.exec(line);
    if (topKey) {
      top = topKey[1];
      childIndent = null;
      child = null;
      if (top === "apiVersion" || top === "kind") found[top] = scalar(topKey[2]);
      continue;
    }
    if (top !== "metadata" && top !== "spec") continue;
    const indent = line.length - line.trimStart().length;
    if (indent === 0) continue;
    if (childIndent === null) childIndent = indent;
    if (indent === childIndent) {
      const key = /^\s+([A-Za-z][A-Za-z0-9_]*):(?:\s+(.*))?$/.exec(line);
      child = key ? key[1] : null;
      grandchildIndent = null;
      if (!key) continue;
      if (top === "metadata" && (child === "name" || child === "namespace")) found[child] = scalar(key[2]);
      if (top === "spec" && child === "group") found.crdGroup = scalar(key[2]);
      if (top === "spec" && child === "scope") found.crdScope = scalar(key[2]);
    } else if (indent > childIndent && top === "spec" && child === "names") {
      if (grandchildIndent === null) grandchildIndent = indent;
      const key = indent === grandchildIndent ? /^\s+kind:\s+(.*)$/.exec(line) : null;
      if (key) found.crdKind = scalar(key[1]);
    }
  }
  return hasContent ? found : null;
}

// What the retained file holds, by document number.
export function describeRetainedFile(text, label = "the retained file") {
  const objects = [];
  splitRetainedDocuments(text).forEach((lines, index) => {
    const found = describeDocument(lines);
    if (!found) return;
    if (!found.apiVersion || !found.kind || !found.name) {
      throw new Error(`${label}: document ${index} has no apiVersion, kind or metadata.name at its top level`);
    }
    if (found.kind === "CustomResourceDefinition" && !NAME_PATTERN.test(found.name)) {
      throw new Error(`${label}: document ${index} is a CRD with an unusable name`);
    }
    const group = found.apiVersion.includes("/") ? found.apiVersion.split("/")[0] : "";
    objects.push({ index, group, ...found });
  });
  const crds = objects.filter((object) => object.kind === "CustomResourceDefinition" && object.group === "apiextensions.k8s.io");
  for (const crd of crds) {
    if (!crd.crdGroup || !crd.crdKind || !crd.crdScope) {
      throw new Error(`${label}: CRD ${crd.name} has no spec.group, spec.names.kind or spec.scope`);
    }
  }
  const definedKinds = new Map(crds.map((crd) => [`${crd.crdGroup}/${crd.crdKind}`, crd]));
  const namespaceObjects = objects.filter((object) => object.kind === "Namespace" && object.group === "");
  const isNamespaced = (object) => {
    if (BUILT_IN_GROUPS.has(object.group)) return !BUILT_IN_CLUSTER_KINDS.has(object.kind);
    return definedKinds.get(`${object.group}/${object.kind}`)?.crdScope === "Namespaced";
  };
  const others = objects.filter((object) => !crds.includes(object) && !namespaceObjects.includes(object));
  // A namespaced object that names no namespace. kubectl would put it in
  // whatever namespace the reader's context points at.
  const unplaced = others.filter((object) => !object.namespace && isNamespaced(object));
  // Kinds the file uses and does not define. Something else must define them.
  const outsideKinds = [...new Map(
    others
      .filter((object) => !BUILT_IN_GROUPS.has(object.group) && !definedKinds.has(`${object.group}/${object.kind}`))
      .map((object) => [`${object.group}/${object.kind}`, { group: object.group, kind: object.kind }]),
  ).values()].sort((a, b) => `${a.group}/${a.kind}`.localeCompare(`${b.group}/${b.kind}`));
  for (const { group, kind } of outsideKinds) {
    if (!NAME_PATTERN.test(group) || !/^[A-Za-z][A-Za-z0-9]*$/.test(kind)) {
      throw new Error(`${label}: unusable kind ${JSON.stringify(`${kind}.${group}`)}`);
    }
  }
  const definedNamespaces = new Set(namespaceObjects.map((object) => object.name));
  const namedNamespaces = [...new Set(objects.map((object) => object.namespace).filter(Boolean))].sort();
  for (const namespace of namedNamespaces) {
    if (!NAME_PATTERN.test(namespace)) throw new Error(`${label}: unusable namespace ${JSON.stringify(namespace)}`);
  }
  return {
    objects,
    crds,
    namespaceObjects,
    unplaced,
    placed: others.filter((object) => !unplaced.includes(object)),
    outsideKinds,
    definedNamespaces,
    namedNamespaces,
  };
}

// When a plan step is due. The entry page prints these same words.
export function planStepTiming(step) {
  const id = String(step.id ?? "");
  if (/install/.test(id)) return "Around an install";
  if (/upgrade/.test(id) && /delete/.test(id)) return "Around an upgrade or a delete";
  if (/upgrade|rollback/.test(id)) return "Around an upgrade";
  if (/delete/.test(id)) return "Around a delete";
  if (["pre-apply", "preflight"].includes(step.phase)) return "Before you deliver";
  if (step.phase === "apply") return "When you deliver";
  if (["post-apply", "observe"].includes(step.phase)) return "After you deliver";
  return "Once the destination is known";
}

// What the script does about each step of the plan.
//   done           the script carries it out: CRDs first, or a namespace it creates
//   stop           an install needs it first and the script cannot do it
//   install-after  an install needs it afterwards and the script does not run it
//   later          it belongs to an upgrade, a delete or a check after delivery
function planStepRoles(listing, file, ensuredNamespaces) {
  const crdNames = new Set(file.crds.map((crd) => crd.name));
  const looksLikeCrdName = (ref) => /^[a-z0-9-]+(\.[a-z0-9-]+){2,}$/.test(ref);
  return (listing.routing?.routes ?? []).map((step) => {
    const id = String(step.id ?? "");
    const refs = (step.requirementRefs ?? []).map(String);
    const timing = planStepTiming(step);
    const ordersFileCrds = crdNames.size > 0 && (
      (refs.length > 0 && refs.every((ref) => crdNames.has(ref)))
      || (/(^|-)crds?(-|$)/.test(id) && !refs.some((ref) => looksLikeCrdName(ref) && !crdNames.has(ref)))
    );
    const namesEnsuredNamespace = /(^|-)namespace(-|$)/.test(id)
      && refs.length > 0
      && refs.every((ref) => ensuredNamespaces.has(ref));
    let role = "later";
    if (timing === "Around an install") role = /post-install/.test(id) && !/pre-install/.test(id) ? "install-after" : "stop";
    else if (timing === "Before you deliver") role = ordersFileCrds || namesEnsuredNamespace ? "done" : "stop";
    else if (timing === "When you deliver") role = ordersFileCrds ? "done" : "later";
    else if (timing === "Once the destination is known") role = /(^|-)prune(-|$)/.test(id) ? "later" : "stop";
    return { step, role };
  });
}

// Where the script lives: beside try.sh, under the entry's page and base.
export function retainedObjectsScriptDir(listing) {
  const pageStem = String(listing.identity?.page ?? "").split("/").pop().replace(/\.html$/, "");
  const baseSlug = String(listing.identity?.base ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return pageStem && baseSlug ? `sh/${pageStem}/${baseSlug}` : "";
}

// Whether an entry gets the script, read from its listing alone.
export function retainedObjectsScriptEligibility(listing) {
  const retained = listing.flattened?.retainedObjects ?? {};
  const no = (reason) => ({ eligible: false, reason });
  if (!retained.url || !retained.sha256) return no("no-retained-objects");
  if (!ELIGIBLE_VERDICTS.has(listing.flattened?.verdict)) return no("verdict");
  if (listing.identity?.format === "aicr") return no("needs-argo-cd");
  if (!retainedObjectsScriptDir(listing)) return no("no-entry-page");
  if ((listing.routing?.routes ?? []).some((step) => step.id === FILE_MUST_CHANGE_STEP)) return no("file-holds-a-placeholder");
  return { eligible: true, reason: "" };
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function documentName(index) {
  return String(index).padStart(4, "0");
}

// Lines that move documents into a group directory, a few numbers to a line.
function moveLines(objects, group) {
  const numbers = objects.map((object) => documentName(object.index));
  const lines = [];
  for (let at = 0; at < numbers.length; at += 12) {
    lines.push(`for n in ${numbers.slice(at, at + 12).join(" ")}; do mv "$work/docs/doc-$n.yaml" "$work/${group}/"; done`);
  }
  return lines;
}

// stepBrief: the words the entry page prints for one plan step.
export function retainedObjectsScript({ listing, text, stepBrief }) {
  const id = listing.identity.id;
  if (!NAME_PATTERN.test(String(id))) throw new Error(`${id}: the listing id cannot name a directory`);
  const retained = listing.flattened.retainedObjects;
  const digest = /^sha256:([0-9a-f]{64})$/.exec(String(retained.sha256))?.[1];
  if (!digest) throw new Error(`${id}: the listing's retained-object digest is not a SHA-256`);
  if (!/^https:\/\/raw\.githubusercontent\.com\/[A-Za-z0-9._\/-]+$/.test(String(retained.url))) {
    throw new Error(`${id}: the listing's retained-object URL is not a plain raw GitHub address`);
  }
  const file = describeRetainedFile(text, id);
  if (file.objects.length === 0) throw new Error(`${id}: the retained file holds no object`);

  // The namespace the entry was built for. Only objects that name no
  // namespace need it.
  const builtFor = (listing.source?.fixedAtBuildTime ?? [])
    .map((item) => /^namespace=(.+)$/.exec(String(item))?.[1])
    .filter(Boolean);
  if (file.unplaced.length > 0 && (builtFor.length !== 1 || !NAME_PATTERN.test(builtFor[0]))) {
    throw new Error(`${id}: ${file.unplaced.length} object(s) name no namespace and the listing records no single namespace for them`);
  }
  const unplacedNamespace = file.unplaced.length > 0 ? builtFor[0] : "";
  const namespacesToCreate = [...new Set([...file.namedNamespaces, unplacedNamespace].filter(Boolean))]
    .filter((namespace) => !file.definedNamespaces.has(namespace))
    .sort();
  const ensuredNamespaces = new Set([...namespacesToCreate, ...file.definedNamespaces]);

  const roles = planStepRoles(listing, file, ensuredNamespaces);
  const words = (entry) => String(stepBrief(entry.step)).replace(/\s+/g, " ").trim();
  const stopSteps = roles.filter((entry) => entry.role === "stop");
  const installAfterSteps = roles.filter((entry) => entry.role === "install-after");
  const laterSteps = roles.filter((entry) => entry.role === "later");
  const notRunSteps = [...stopSteps, ...laterSteps];

  const crdCount = file.crds.length;
  const otherCount = file.objects.length - crdCount;
  const self = `bash ${OBJECTS_SCRIPT_NAME}`;
  const lines = [
    "#!/usr/bin/env bash",
    `# ${listing.identity.name} ${listing.identity.version} - base variant: ${listing.identity.base}`,
    "# Path: fetch this entry's retained objects, check their SHA-256, then apply",
    "# them with kubectl. It uses curl, shasum, awk and kubectl. It needs no cub",
    "# CLI and no ConfigHub account.",
    "# Generated by scripts/generate-public-site.mjs from this entry's listing:",
    `# ${listing.identity.url}`,
    `# Entry page: ${listing.identity.page}`,
    "set -euo pipefail",
    "",
    "say() { printf '\\n>> %s\\n' \"$*\"; }",
    "",
    "for tool in curl awk kubectl; do",
    '  if ! command -v "$tool" >/dev/null 2>&1; then',
    "    printf '%s is required and was not found.\\n' \"$tool\" >&2",
    "    exit 1",
    "  fi",
    "done",
    "if command -v shasum >/dev/null 2>&1; then",
    "  sha256_of() { shasum -a 256 \"$1\" | awk '{print $1}'; }",
    "elif command -v sha256sum >/dev/null 2>&1; then",
    "  sha256_of() { sha256sum \"$1\" | awk '{print $1}'; }",
    "else",
    "  printf 'shasum is required and was not found.\\n' >&2",
    "  exit 1",
    "fi",
    "",
    `work=./${id}-objects`,
    `objects_url=${retained.url}`,
    `objects_sha256=${digest}`,
    "",
    'say "Fetch the retained objects into $work/objects.yaml"',
    'mkdir -p "$work"',
    'curl -fsSL -o "$work/objects.yaml" "$objects_url"',
    "",
    'say "Check the file against the SHA-256 in the listing"',
    'fetched_sha256="$(sha256_of "$work/objects.yaml")"',
    'if [ "$fetched_sha256" != "$objects_sha256" ]; then',
    "  printf 'The file differs from the listing, so the script stops. Nothing was applied.\\n  listing: %s\\n  fetched: %s\\n' \"$objects_sha256\" \"$fetched_sha256\" >&2",
    "  exit 1",
    "fi",
    "printf 'The file matches: sha256 %s\\n' \"$fetched_sha256\"",
    "",
    `say "Split the file into its ${plural(file.objects.length, "object")}. The cluster is untouched so far"`,
  ];
  const groups = [
    ["crds", file.crds],
    ["namespaces", file.namespaceObjects],
    ["rest", file.placed],
    ["unplaced", file.unplaced],
  ].filter(([, objects]) => objects.length > 0);
  const groupDirs = groups.map(([group]) => `"$work/${group}"`).join(" ");
  lines.push(
    `rm -rf "$work/docs" ${groupDirs}`,
    `mkdir -p "$work/docs" ${groupDirs}`,
    // One document more at every "---" line. Names are padded so that a
    // directory listing keeps the order of the file.
    `awk -v dir="$work/docs" 'BEGIN { n = 0; f = sprintf("%s/doc-%04d.yaml", dir, n) } /^---[ \\t]*$/ { close(f); n++; f = sprintf("%s/doc-%04d.yaml", dir, n); next } { print > f }' "$work/objects.yaml"`,
  );
  for (const [group, objects] of groups) lines.push(...moveLines(objects, group));
  lines.push(`ls ${groupDirs}`);

  if (stopSteps.length > 0) {
    lines.push(
      "",
      'if [ "${REQUIREMENTS_READY:-0}" != "1" ]; then',
      `  say "Stop before applying anything. This entry's plan has ${plural(stopSteps.length, "step")} that an install needs first"`,
      "  cat >&2 <<'EOF_REQUIREMENTS'",
      `This script cannot carry out ${stopSteps.length === 1 ? "this step" : "these steps"} of the plan. ${stopSteps.length === 1 ? "It is" : "They are"} yours to do, with your own values:`,
      ...stopSteps.map((entry) => `  - ${words(entry)}`),
      `Nothing was applied. Complete ${stopSteps.length === 1 ? "it" : "them"} before you apply the objects.`,
      `When ${stopSteps.length === 1 ? "it is" : "they are"} done, re-run with:`,
      `  REQUIREMENTS_READY=1 ${self}`,
      "EOF_REQUIREMENTS",
      "  exit 1",
      "fi",
      `say "REQUIREMENTS_READY=1 is set. The script takes your word for ${plural(stopSteps.length, "step")} and does not check ${stopSteps.length === 1 ? "it" : "them"}"`,
    );
  }

  lines.push(
    "",
    'say "Check that kubectl reaches a cluster"',
    "if ! kubectl get --raw /version >/dev/null 2>&1; then",
    "  printf 'kubectl cannot reach a cluster. Point it at a throwaway cluster and re-run this script.\\n' >&2",
    "  exit 1",
    "fi",
    "kubectl config current-context 2>/dev/null || true",
  );

  if (file.outsideKinds.length > 0) {
    lines.push(
      "",
      "serves_kind() {",
      "  kubectl api-resources --api-group=\"$1\" --no-headers 2>/dev/null | awk -v kind=\"$2\" '$NF == kind { found = 1 } END { exit found ? 0 : 1 }'",
      "}",
      "",
      `say "Check that the cluster serves the ${plural(file.outsideKinds.length, "kind")} this file uses and does not define"`,
      'missing_kinds=""',
      ...file.outsideKinds.flatMap(({ group, kind }) => [
        `if ! serves_kind ${group} ${kind}; then`,
        `  missing_kinds="$missing_kinds ${kind}.${group}"`,
        "fi",
      ]),
      'if [ -n "$missing_kinds" ]; then',
      "  printf 'The cluster does not serve:%s\\n' \"$missing_kinds\" >&2",
      "  printf 'This file uses these kinds and does not define them. Install what defines them, then re-run this script. Nothing was applied.\\n' >&2",
      "  exit 1",
      "fi",
    );
  }

  for (const namespace of namespacesToCreate) {
    lines.push(
      "",
      `say "Create the ${namespace} namespace if it does not exist"`,
      `if ! kubectl get namespace ${namespace} >/dev/null 2>&1; then`,
      `  kubectl create namespace ${namespace}`,
      "fi",
    );
  }

  if (crdCount > 0) {
    // One CRD or several: the sentences agree in number.
    const one = crdCount === 1;
    const crdWord = one ? "CRD" : "CRDs";
    lines.push(
      "",
      "wait_for_crd() {",
      '  crd_name="$1"',
      '  deadline=$(( $(date +%s) + 180 ))',
      '  until kubectl get "crd/${crd_name}" >/dev/null 2>&1; do',
      '    if [ "$(date +%s)" -ge "$deadline" ]; then',
      '      printf "CRD %s did not appear within 180 seconds.\\n" "$crd_name" >&2',
      "      return 1",
      "    fi",
      "    sleep 2",
      "  done",
      '  kubectl wait --for=condition=Established --timeout=120s "crd/${crd_name}"',
      "}",
      "",
      `say "Check the ${plural(crdCount, "CRD")} this file holds"`,
      "missing_crds=0",
      ...file.crds.flatMap((crd) => [
        `if ! kubectl get crd/${crd.name} >/dev/null 2>&1; then`,
        "  missing_crds=1",
        "fi",
      ]),
      // The same three cases as try.sh. A missing CRD means apply. A match
      // means leave them. A difference stops, because the objects that
      // follow may need the newer definitions, as they do on an upgrade.
      'if [ "$missing_crds" -eq 1 ]; then',
      `  say "${one ? "The CRD" : "A CRD"} is missing, so apply the file's ${crdWord} first"`,
      '  kubectl apply --server-side -f "$work/crds"',
      `  crd_outcome="${one ? "was" : "were"} applied${otherCount === 0 ? "" : " first"}"`,
      'elif kubectl diff --server-side -f "$work/crds" >/dev/null 2>&1; then',
      `  say "The ${crdWord} already ${one ? "exists and matches" : "exist and match"} this file. The script leaves ${one ? "it under its" : "them under their"} current owner"`,
      `  crd_outcome="already existed and matched, so the script left ${one ? "it" : "them"} alone"`,
      'elif [ "${APPLY_CRDS:-0}" = "1" ]; then',
      `  say "The existing ${crdWord} ${one ? "differs" : "differ"} from this file. APPLY_CRDS=1 is set, so the script applies the file's ${crdWord}"`,
      '  kubectl apply --server-side -f "$work/crds"',
      `  crd_outcome="differed and ${one ? "was" : "were"} applied, because APPLY_CRDS=1 was set"`,
      "else",
      `  say "The ${crdWord} already ${one ? "exists and differs" : "exist and differ"} from this file, or another tool owns ${one ? "it" : "them"}"`,
      "  cat <<'EOF_CRDS'",
      "This script does not change CRDs it did not just create.",
      "If this is an upgrade, the objects that follow may need the newer CRDs.",
      `To let this script apply the file's ${crdWord}, re-run with:`,
      `  APPLY_CRDS=1 ${self}`,
      "EOF_CRDS",
      "  exit 1",
      "fi",
      ...file.crds.map((crd) => `wait_for_crd ${crd.name}`),
    );
  }

  if (file.namespaceObjects.length > 0) {
    lines.push(
      "",
      `say "Apply the ${plural(file.namespaceObjects.length, "Namespace object")} this file holds"`,
      'kubectl apply -f "$work/namespaces"',
    );
  }
  if (file.placed.length > 0) {
    const label = crdCount > 0 || file.namespaceObjects.length > 0
      ? `Apply the other ${plural(file.placed.length, "object")}`
      : `Apply the ${plural(file.placed.length, "object")}`;
    lines.push("", `say "${label}"`, 'kubectl apply -f "$work/rest"');
  }
  if (file.unplaced.length > 0) {
    lines.push(
      "",
      `say "Apply ${plural(file.unplaced.length, "object")} that ${file.unplaced.length === 1 ? "names" : "name"} no namespace into ${unplacedNamespace}, the namespace this entry was built for"`,
      `kubectl apply -n ${unplacedNamespace} -f "$work/unplaced"`,
    );
  }

  // Say only what ran. The CRD sentence is chosen while the script runs,
  // because a second run leaves matching CRDs alone.
  const done = crdCount === 0
    ? `Done. kubectl applied the ${plural(otherCount, "object")} of this entry's retained file.`
    : otherCount === 0
      ? `Done. The ${plural(crdCount, "CRD")} of this entry's retained file $crd_outcome.`
      : `Done. The ${plural(crdCount, "CRD")} $crd_outcome. kubectl applied the other ${plural(otherCount, "object")} of this entry's retained file.`;
  lines.push(
    "",
    `say "${done}"`,
    'say "The script stops here. It did not wait for any workload to start"',
  );
  if (installAfterSteps.length > 0) {
    lines.push(
      `say "This install is not finished. The plan has ${installAfterSteps.length === 1 ? "an install step" : `${installAfterSteps.length} install steps`} that this script does not run:"`,
      "cat <<'EOF_INSTALL_STEPS'",
      ...installAfterSteps.map((entry) => `   - ${words(entry)}`),
      "EOF_INSTALL_STEPS",
    );
  }
  if (notRunSteps.length > 0) {
    lines.push(
      `say "Not run by this script: ${plural(notRunSteps.length, installAfterSteps.length > 0 ? "other step" : "step")} of this entry's plan. The entry page says who runs ${notRunSteps.length === 1 ? "it" : "each one"}."`,
      "cat <<'EOF_NOT_RUN'",
      ...notRunSteps.map((entry) => `   - ${words(entry)}`),
      "EOF_NOT_RUN",
    );
  }
  lines.push("");
  return lines.join("\n");
}
