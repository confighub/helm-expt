#!/usr/bin/env node

// Compile one immutable Kubara Git revision into a deterministic ConfigHub
// import contract. This is a semantic bridge, not an AI migration:
//
//   Kubara config + generated charts/configs + exact locks + effective renders
//     -> component-first OCI plan
//     -> ConfigHub Spaces, Units, lineage, and NeedsProvides plan
//     -> target-fact boundary and app-ready handoff
//
// Publication and live reconciliation are intentionally not implemented here.
// A generic implementation must first prove registry idempotency, empty-org
// ownership, target binding, and secret externalization for arbitrary input.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import {
  check,
  parseDocs,
  readYaml,
  sha256,
  toYaml,
} from "./lib/proof-common.mjs";

const MODES = new Set(["--plan", "--compile", "--verify", "--self-test", "--package", "--apply"]);
const SAFE_NONCREDENTIAL_SECRET_KEYS = new Set(["config", "name", "server", "alertmanager.yaml", "ca.crt", "tls.crt"]);
const REFERENCE_KEYS = new Set([
  "apiKeySecretRef", "clientSecretSecretRef", "credentialsRef", "existingSecret",
  "passwordKey", "privateKeySecretRef", "secretKey", "secretKeyRef",
  "secretName", "secretStoreRef", "tokenSecretRef",
]);
const args = process.argv.slice(2);
validateCliArgs(args);
const selectedModes = args.filter((arg) => MODES.has(arg));

if (args.includes("--help") || selectedModes.length === 0) {
  usage();
  process.exit(selectedModes.length === 0 && !args.includes("--help") ? 1 : 0);
}
check(selectedModes.length === 1, `choose one mode: ${[...MODES].join(", ")}`);
const mode = selectedModes[0];

if (mode === "--self-test") {
  selfTest();
  process.exit(0);
}

if (["--package", "--apply"].includes(mode)) {
  throw new Error(
    `${mode.slice(2)} is deliberately unsupported: this tool currently proves only an offline, deterministic import plan. `
      + "Do not publish OCI or mutate an organization until generic registry idempotency, empty-org ownership, target-fact binding, and clean-room apply are implemented and accepted.",
  );
}

const requestPath = requiredOption("--request");
const checkoutRoot = resolve(requiredOption("--checkout"));
const outputRoot = mode === "--plan" ? "" : resolve(requiredOption("--output"));
const compiled = compileImport({ requestPath: resolve(requestPath), checkoutRoot });

if (mode === "--plan") {
  process.stdout.write(compiled.planText);
} else if (mode === "--compile") {
  check(!isWithin(outputRoot, checkoutRoot), "--output must be outside the source checkout; the importer never mutates its Git input");
  writeOutputs(outputRoot, compiled);
  console.log(`compiled Kubara Git import ${compiled.lock.spec.platformDigest} -> ${outputRoot}`);
} else {
  check(!isWithin(outputRoot, checkoutRoot), "--output must be outside the source checkout; verification never trusts generated files mixed into its Git input");
  verifyOutputs(outputRoot, compiled);
  console.log(`verified Kubara Git import ${compiled.lock.spec.platformDigest} in ${outputRoot}`);
}

function compileImport({ requestPath, checkoutRoot }) {
  check(existsSync(requestPath), `request does not exist: ${requestPath}`);
  check(existsSync(checkoutRoot), `checkout does not exist: ${checkoutRoot}`);
  const request = readYaml(requestPath);
  validateRequest(request);
  const source = request.spec.source;
  const sourceRoot = safeJoin(checkoutRoot, source.path);
  check(existsSync(sourceRoot), `source path does not exist in checkout: ${source.path}`);
  verifyGitRevision(checkoutRoot, source);

  const layout = request.spec.layout;
  const inputPaths = resolveInputs(sourceRoot, layout);
  const config = readYaml(inputPaths.config);
  const artifacts = readYaml(inputPaths.artifactLock);
  const components = discoverComponents(inputPaths.components, artifacts);
  const topology = discoverTopology(config, components, request.spec.targets);
  const instances = discoverInstances(inputPaths, topology, components, request.spec.destination.deliveryMode);
  const wiring = inputPaths.wiringGraph ? readJson(inputPaths.wiringGraph) : null;
  const wiringPlan = buildWiringPlan(wiring, instances);

  const selectedFiles = inventoryRevisionFiles(checkoutRoot, sourceRoot, inputPaths);
  check(selectedFiles.length > 0, "selected import scope is empty");
  verifyTrackedInputs(checkoutRoot, source.commit, selectedFiles);
  scanForSecretMaterial(selectedFiles);

  const sourceInventory = selectedFiles.map((path) => ({
    path: gitPath(checkoutRoot, path),
    sha256: sha256(readFileSync(path)),
    size: readFileSync(path).length,
  }));
  const sourceTreeSha256 = digestRows(sourceInventory.map((row) => `${row.path}\0${row.sha256}\0${row.size}`));
  const requestSemantic = semanticRequest(request);
  const requestSha256 = sha256(stableJson(requestSemantic));
  const componentPackages = buildComponentPackagePlan(request, checkoutRoot, components);
  const configPackages = buildConfigPackagePlan(request, checkoutRoot, instances);
  const spacesAndUnits = buildConfigHubPlan(request, components, instances, wiringPlan);

  const digestInput = {
    source: {
      repository: source.repository,
      commit: source.commit,
      path: source.path,
      sourceTreeSha256,
    },
    destination: request.spec.destination,
    topology,
    componentPackages,
    configPackages,
    spaces: spacesAndUnits.spaces,
    units: spacesAndUnits.units,
    links: spacesAndUnits.links,
    targetFacts: wiringPlan.targetFacts,
  };
  const platformDigest = `sha256:${sha256(stableJson(digestInput))}`;
  const shortCommit = source.commit.slice(0, 12);
  const importLabels = {
    ManagedBy: "kubara-git-import",
    ImportName: request.metadata.name,
    GitCommit: shortCommit,
    PlatformDigest: platformDigest,
  };
  for (const row of spacesAndUnits.spaces) row.labels = { ...row.labels, ...importLabels };
  for (const row of spacesAndUnits.units) row.labels = { ...row.labels, ...importLabels };
  for (const row of spacesAndUnits.links) row.labels = { ...row.labels, ...importLabels };

  const lock = {
    apiVersion: "import.confighub.com/v1alpha1",
    kind: "KubaraGitImportLock",
    metadata: { name: request.metadata.name },
    spec: {
      platformDigest,
      source: {
        repository: source.repository,
        commit: source.commit,
        path: source.path,
        sourceTreeSha256,
        selectedFileCount: sourceInventory.length,
      },
      requestSemanticSha256: requestSha256,
      topologySha256: sha256(stableJson(topology)),
      componentPackagePlanSha256: sha256(stableJson(componentPackages)),
      configPackagePlanSha256: sha256(stableJson(configPackages)),
      wiringPlanSha256: sha256(stableJson(wiringPlan)),
      inventory: sourceInventory,
    },
    status: {
      result: "pass",
      mutableRefsAccepted: false,
      exactVersionsLocked: true,
      selectedImportPayloadSecretScan: "pass",
      targetFactsIncludedInOCI: false,
      aiRequired: false,
    },
  };

  const plan = {
    apiVersion: "import.confighub.com/v1alpha1",
    kind: "KubaraGitRevisionImportPlan",
    metadata: { name: request.metadata.name },
    spec: {
      platformDigest,
      boundary: {
        kubaraRemainsSourceOf: ["platform selection", "hub/spoke topology", "generated component wrappers", "per-cluster configuration", "wiring intent"],
        configHubAdds: ["component-first retention", "exact OCI publication plan", "reviewable definitions and instances", "revision history", "promotion and approval surfaces", "visible NeedsProvides links"],
        aiRequired: false,
        flattenedFleetBundle: false,
        targetFactsInGitOrOCI: false,
        applicationMigrationIncluded: false,
      },
      source: lock.spec.source,
      destination: {
        ...request.spec.destination,
        organizationPrecondition: "new-empty-or-importer-owned-identical-platform-digest",
        conflictingNonemptyOrganizationAction: "refuse",
        destructiveReconciliation: false,
      },
      topology,
      oci: {
        catalogPackages: componentPackages,
        configReleases: configPackages,
        aggregate: {
          type: "index-only",
          platformDigest,
          members: configPackages.map((row) => row.id),
          note: "The index preserves component boundaries; it is not an opaque deployable fleet blob.",
        },
      },
      configHub: spacesAndUnits,
      targetFacts: {
        placement: "target-bound-outside-git-and-oci",
        applyPrecondition: "resolve-required-and-target-prerequisite-rows-before-targeting-dependent-units",
        rows: wiringPlan.targetFacts,
      },
      handoff: {
        state: "app-ready-after-target-facts-and-platform-releases-converge",
        applicationsRemainSeparate: true,
        appUnitsMayUsePlatformNeedsProvidesLinks: true,
        nextStep: "create application definitions/variants, bind them to the mapped targets, then publish reviewed releases",
      },
      phases: [
        "verify the exact clean Git revision and selected import path",
        "verify exact dependency versions, source digests, and secret-free selected payloads",
        "require a new empty organization or an importer-owned organization with the identical platform digest",
        "publish component-first catalog packages without overwriting an existing different digest",
        "create the exact allowlisted Spaces and definition Units",
        "create per-cluster instance Units and UpgradeUnit lineage",
        "bind target facts outside Git and OCI, then target component instances",
        "publish one immutable config release OCI per component instance",
        "create visible NeedsProvides links with auto-update disabled",
        "verify the platform digest and hand the converged platform to application teams",
      ],
      capabilities: {
        plan: "implemented-and-offline-verified",
        verify: "implemented-and-offline-verified",
        package: "unsupported-until-generic-registry-idempotency-is-proven",
        apply: "unsupported-until-generic-clean-org-and-target-binding-are-proven",
      },
    },
  };

  const acceptance = {
    apiVersion: "import.confighub.com/v1alpha1",
    kind: "KubaraGitImportAcceptance",
    metadata: { name: request.metadata.name },
    spec: {
      platformDigest,
      checks: [
        pass("immutable-git-revision", source.commit),
        pass("clean-selected-path", source.path),
        pass("exact-component-locks", `${components.filter((row) => row.deployable).length} deployable definitions`),
        pass("selected-payload-secret-scan", `${sourceInventory.length} files`),
        pass("topology-preserved", `${topology.clusters.length} clusters; ${topology.hubs.length} hub(s); ${topology.spokes.length} spoke(s)`),
        pass("component-instance-boundaries", `${instances.length} instance release plans`),
        pass("needs-provides-plan", `${wiringPlan.links.length} visible cross-component links`),
        pass("target-fact-boundary", `${wiringPlan.targetFacts.length} rows excluded from Git/OCI publication`),
        pass("non-destructive-org-contract", request.spec.destination.organizationPolicy),
        pass("no-ai-required", "deterministic compiler"),
      ],
      claimBoundary: [
        "This receipt proves deterministic offline compilation and verification only.",
        "It does not claim that catalog/config OCI artifacts were published.",
        "It does not claim that the selected ConfigHub organization was created or reconciled.",
        "It does not claim that target facts or workloads converged.",
      ],
    },
    status: { result: "pass" },
  };

  const planText = `${JSON.stringify(plan, null, 2)}\n`;
  const lockText = `${toYaml(lock)}\n`;
  const acceptanceText = `${JSON.stringify(acceptance, null, 2)}\n`;
  const checksumsText = outputChecksums({ planText, lockText, acceptanceText });
  return { plan, lock, acceptance, planText, lockText, acceptanceText, checksumsText };
}

function validateRequest(request) {
  check(request?.apiVersion === "import.confighub.com/v1alpha1", "request apiVersion must be import.confighub.com/v1alpha1");
  check(request?.kind === "KubaraGitRevisionImport", "request kind must be KubaraGitRevisionImport");
  checkSlug(request?.metadata?.name, "metadata.name");
  const spec = request.spec ?? {};
  const source = spec.source ?? {};
  validateGitURL(source.repository);
  check(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(source.commit ?? ""), "spec.source.commit must be a full lowercase Git object ID; mutable refs are refused");
  checkSafeRelative(source.path, "spec.source.path");
  const layout = spec.layout ?? {};
  for (const key of ["source", "config", "components", "configs", "renders", "artifactLock", "generationReceipt", "wiringGraph"]) checkSafeRelative(layout[key], `spec.layout.${key}`);
  const destination = spec.destination ?? {};
  check(/^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/.test(destination.organization ?? ""), "spec.destination.organization is invalid");
  checkSlug(destination.spacePrefix, "spec.destination.spacePrefix");
  check(destination.organizationPolicy === "require-empty-or-importer-owned-identical", "spec.destination.organizationPolicy must be require-empty-or-importer-owned-identical");
  check(destination.deliveryMode === "confighub-managed-argo", "spec.destination.deliveryMode must be confighub-managed-argo; the faithful Kubara hub executor is a separate proof lane, not a generic import claim");
  check(/^oci:\/\/[^\s:@]+(?::\d+)?(?:\/[^\s:@]+)+$/.test(destination.catalogOCIBase ?? ""), "spec.destination.catalogOCIBase must be an untagged OCI repository base");
  check(!/[{@}]/.test(destination.catalogOCIBase), "spec.destination.catalogOCIBase cannot contain placeholders");
  check(spec.targets && typeof spec.targets === "object" && !Array.isArray(spec.targets), "spec.targets must map every Kubara cluster name");
  for (const [cluster, target] of Object.entries(spec.targets)) {
    checkSlug(cluster, `spec.targets key ${cluster}`);
    checkSlug(target?.space, `spec.targets.${cluster}.space`);
    checkSlug(target?.target, `spec.targets.${cluster}.target`);
    check(/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(target?.environment ?? ""), `spec.targets.${cluster}.environment is invalid`);
    if (target.region) check(/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(target.region), `spec.targets.${cluster}.region is invalid`);
  }
}

function resolveInputs(sourceRoot, layout) {
  const result = {
    source: safeJoin(sourceRoot, layout.source),
    config: safeJoin(sourceRoot, layout.config),
    components: safeJoin(sourceRoot, layout.components),
    configs: safeJoin(sourceRoot, layout.configs),
    renders: safeJoin(sourceRoot, layout.renders),
    artifactLock: safeJoin(sourceRoot, layout.artifactLock),
    generationReceipt: safeJoin(sourceRoot, layout.generationReceipt),
    wiringGraph: safeJoin(sourceRoot, layout.wiringGraph),
  };
  for (const [name, path] of Object.entries(result)) if (path) check(existsSync(path), `layout input ${name} is missing: ${path}`);
  return result;
}

function verifyGitRevision(checkoutRoot, source) {
  const top = git(checkoutRoot, ["rev-parse", "--show-toplevel"]);
  check(realpathSync(top) === realpathSync(checkoutRoot), `--checkout must be the Git worktree root (${top})`);
  const head = git(checkoutRoot, ["rev-parse", "HEAD"]);
  check(head === source.commit, `checkout HEAD ${head} does not equal requested immutable commit ${source.commit}`);
  const remote = git(checkoutRoot, ["remote", "get-url", "origin"]);
  check(normalizeGitURL(remote) === normalizeGitURL(source.repository), `checkout origin ${remote} does not equal requested repository ${source.repository}`);
  git(checkoutRoot, ["cat-file", "-e", `${source.commit}^{commit}`]);
  const status = git(checkoutRoot, ["status", "--porcelain=v1", "--untracked-files=all", "--", source.path]);
  check(status === "", `selected Git path is dirty; commit every Kubara artifact before import:\n${status}`);
}

function discoverComponents(componentRoot, artifactSet) {
  check(artifactSet?.kind === "KubaraComponentArtifactSet", "artifact lock must be a KubaraComponentArtifactSet");
  check(artifactSet.spec?.exactVersionPolicy === "fail-if-missing", "artifact lock exactVersionPolicy must be fail-if-missing");
  check(artifactSet.spec?.retentionPolicy === "additive-only", "artifact lock retentionPolicy must be additive-only");
  const locked = artifactSet.spec?.artifacts ?? [];
  const firstParty = artifactSet.spec?.firstParty ?? [];
  const dirs = readdirSync(componentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  check(dirs.length > 0, "no Kubara component chart directories found");
  return dirs.map((service) => {
    const root = join(componentRoot, service);
    const chartPath = join(root, "Chart.yaml");
    check(existsSync(chartPath), `${service}: Chart.yaml is missing`);
    const chart = readYaml(chartPath);
    checkExactVersion(String(chart.version ?? ""), `${service} wrapper`);
    const dependencies = (chart.dependencies ?? []).map((dependency) => {
      checkExactVersion(String(dependency.version ?? ""), `${service}/${dependency.name}`);
      const local = String(dependency.repository ?? "").startsWith("file://");
      if (local) return { name: dependency.name, version: String(dependency.version), repository: dependency.repository, source: "local-library" };
      const candidates = locked.filter((row) => row.dependency === dependency.name || row.canonicalIdentity?.endsWith(`/${dependency.name}`));
      const match = candidates.find((row) => String(row.version) === String(dependency.version));
      check(match, `${service}/${dependency.name}@${dependency.version}: exact artifact lock is missing`);
      check(/^[0-9a-f]{64}$/.test(match.sha256 ?? ""), `${service}/${dependency.name}@${dependency.version}: SHA-256 lock is missing`);
      check(typeof match.url === "string" && match.url.length > 0, `${service}/${dependency.name}@${dependency.version}: immutable source URL is missing`);
      if (match.url.startsWith("oci://")) check(/^sha256:[0-9a-f]{64}$/.test(match.manifestDigest ?? ""), `${service}/${dependency.name}@${dependency.version}: OCI manifest digest is missing`);
      else {
        check(!/[?#]/.test(match.url), `${service}/${dependency.name}@${dependency.version}: source URL must not contain a mutable query or fragment`);
        check(match.url.includes(encodeURIComponent(String(dependency.version))) || match.url.includes(String(dependency.version)), `${service}/${dependency.name}@${dependency.version}: source URL does not contain the exact version`);
      }
      return {
        name: dependency.name,
        canonicalIdentity: match.canonicalIdentity,
        version: String(dependency.version),
        repository: dependency.repository,
        sourceURL: match.url,
        sourceSha256: match.sha256,
        manifestDigest: match.manifestDigest ?? null,
      };
    });
    const firstPartyRow = firstParty.find((row) => normalize(row.service) === normalize(service) || row.canonicalIdentity === `kubara:${service}` || row.canonicalIdentity === `kubara:${chart.name}`);
    if (dependencies.every((row) => row.source === "local-library")) check(firstPartyRow, `${service}@${chart.version}: first-party artifact lock is missing`);
    const role = chart.type === "library" ? "LibraryDefinition" : service === "bootstrap-crds" ? "LifecycleDefinition" : "ComponentDefinition";
    const deployable = chart.type !== "library" && service !== "bootstrap-crds";
    if (firstPartyRow) check(String(firstPartyRow.wrapperVersion) === String(chart.version), `${service}: first-party wrapper lock differs from Chart.yaml`);
    if (deployable && dependencies.some((row) => row.source !== "local-library")) {
      const wrapperLocks = locked.filter((row) => normalize(row.service) === normalize(service));
      check(wrapperLocks.length > 0 && wrapperLocks.every((row) => String(row.wrapperVersion) === String(chart.version)), `${service}: wrapper version is not exactly locked by its component artifacts`);
    }
    return {
      service,
      chartName: chart.name,
      wrapperVersion: String(chart.version),
      chartType: chart.type ?? "application",
      role,
      deployable,
      lifecycle: service === "bootstrap-crds",
      path: root,
      dependencies,
      firstParty: firstPartyRow ? { canonicalIdentity: firstPartyRow.canonicalIdentity, version: String(firstPartyRow.wrapperVersion) } : null,
    };
  });
}

function discoverTopology(config, components, targetMap) {
  check(Array.isArray(config.clusters) && config.clusters.length > 0, "Kubara config has no clusters");
  const componentByName = new Map(components.map((row) => [normalize(row.service), row]));
  const clusters = config.clusters.map((cluster) => {
    checkSlug(cluster.name, "Kubara cluster name");
    check(["hub", "spoke"].includes(cluster.type), `${cluster.name}: type must be hub or spoke`);
    const mapping = targetMap[cluster.name];
    check(mapping, `${cluster.name}: destination target mapping is missing`);
    const enabled = Object.entries(cluster.services ?? {}).filter(([, value]) => value?.status === "enabled").map(([name]) => name).sort();
    const disabled = Object.entries(cluster.services ?? {}).filter(([, value]) => value?.status === "disabled").map(([name]) => name).sort();
    if (cluster.argocd?.selfManaged === "enabled") enabled.unshift("argo-cd");
    const resolvedEnabled = enabled.map((service) => {
      const component = componentByName.get(normalize(service));
      check(component, `${cluster.name}: enabled Kubara service ${service} has no generated component chart`);
      return component.service;
    });
    return {
      name: cluster.name,
      stage: String(cluster.stage ?? ""),
      type: cluster.type,
      dnsName: cluster.dnsName ?? null,
      ingressClassName: cluster.ingressClassName ?? null,
      argoSelfManaged: cluster.argocd?.selfManaged ?? "disabled",
      enabledServices: [...new Set(resolvedEnabled)].sort(),
      disabledServices: [...new Set(disabled)].sort(),
      target: { ...mapping },
    };
  });
  const configured = new Set(clusters.map((row) => row.name));
  const extras = Object.keys(targetMap).filter((name) => !configured.has(name));
  check(extras.length === 0, `target mapping contains unknown clusters: ${extras.join(", ")}`);
  const hubs = clusters.filter((row) => row.type === "hub").map((row) => row.name);
  const spokes = clusters.filter((row) => row.type === "spoke").map((row) => row.name);
  check(hubs.length > 0, "Kubara topology must retain at least one hub");
  return { clusters, hubs, spokes, disabledSelectionsPreserved: true };
}

function discoverInstances(inputs, topology, components, deliveryMode) {
  const componentMap = new Map(components.map((row) => [row.service, row]));
  const generationReceipt = readYaml(inputs.generationReceipt);
  const receiptRenders = generationReceipt?.spec?.outputs?.renders ?? [];
  check(Array.isArray(receiptRenders) && receiptRenders.length > 0, "generation receipt has no effective-render inventory");
  const receiptArtifacts = generationReceipt?.spec?.artifacts ?? [];
  for (const component of components) {
    for (const dependency of component.dependencies.filter((row) => row.source !== "local-library")) {
      const locked = receiptArtifacts.find((row) => row.dependency === dependency.name && String(row.version) === dependency.version && row.sha256 === dependency.sourceSha256);
      check(locked, `${component.service}/${dependency.name}@${dependency.version}: generation receipt does not attest the exact artifact lock`);
    }
  }
  const instances = [];
  for (const cluster of topology.clusters) {
    for (const service of cluster.enabledServices) {
      const component = componentMap.get(service);
      const renderPath = join(inputs.renders, cluster.name, service, "release-objects.yaml");
      check(existsSync(renderPath), `${cluster.name}/${service}: effective render is missing`);
      const docs = parseDocs(readFileSync(renderPath, "utf8")).filter((doc) => doc?.apiVersion && doc?.kind && doc?.metadata?.name);
      check(docs.length > 0, `${cluster.name}/${service}: effective render contains no Kubernetes objects`);
      const renderSha256 = sha256(readFileSync(renderPath));
      const receiptRender = receiptRenders.find((row) => row.cluster === cluster.name && row.service === service);
      check(receiptRender, `${cluster.name}/${service}: generation receipt row is missing`);
      check(receiptRender.sha256 === renderSha256, `${cluster.name}/${service}: effective render differs from its generation receipt`);
      check(receiptRender.objectCount === docs.length, `${cluster.name}/${service}: object count differs from its generation receipt`);
      const configPath = join(inputs.configs, cluster.name, "helm", service);
      check(existsSync(configPath), `${cluster.name}/${service}: generated platform config directory is missing`);
      const retainedOnly = service === "argo-cd" && deliveryMode === "confighub-managed-argo";
      instances.push({
        id: `${cluster.name}/${service}`,
        cluster: cluster.name,
        service,
        stage: cluster.stage,
        topologyRole: cluster.type,
        componentRole: component.role,
        wrapperVersion: component.wrapperVersion,
        selectedVersions: component.dependencies.filter((row) => row.source !== "local-library").map((row) => ({
          identity: row.canonicalIdentity,
          version: row.version,
        })).concat(component.dependencies.every((row) => row.source === "local-library") && component.firstParty ? [{
          identity: component.firstParty.canonicalIdentity,
          version: component.firstParty.version,
        }] : []).sort((left, right) => left.identity.localeCompare(right.identity)),
        configPath,
        renderPath,
        renderSha256,
        objectCount: docs.length,
        target: retainedOnly ? null : `${cluster.target.space}/${cluster.target.target}`,
        disposition: retainedOnly ? "retained-faithful-kubara-hub-definition-not-targeted-in-adapted-lane" : "targeted-component-instance",
      });
    }
  }
  return instances.sort((left, right) => left.id.localeCompare(right.id));
}

function buildWiringPlan(graph, instances) {
  if (!graph) return { source: null, links: [], targetFacts: [] };
  check(graph.kind === "KubaraProvidesNeedsGraph", "wiring graph kind must be KubaraProvidesNeedsGraph");
  const instanceIds = new Set(instances.map((row) => row.id));
  check(graph.spec?.evidence?.mode === "offline-effective-render", "wiring graph must be mechanically derived from offline effective renders");
  check(Array.isArray(graph.spec?.evidence?.liveReads) && graph.spec.evidence.liveReads.length === 0, "wiring graph must not mix mutable live reads into the Git import contract");
  const graphComponents = new Map((graph.spec?.components ?? []).map((row) => [String(row.id ?? "").replace(/^component:/, ""), row]));
  check(graphComponents.size === instanceIds.size && [...instanceIds].every((id) => graphComponents.has(id)), "wiring graph component inventory differs from the effective-render instance inventory");
  for (const instance of instances) {
    const graphComponent = graphComponents.get(instance.id);
    check(graphComponent?.objectCount === instance.objectCount, `${instance.id}: wiring graph object count differs from the generation receipt`);
    const graphVersions = [...(graphComponent.selectedVersions ?? [])].map((row) => ({ identity: row.identity, version: String(row.version) })).sort((left, right) => left.identity.localeCompare(right.identity));
    check(stableJson(graphVersions) === stableJson(instance.selectedVersions), `${instance.id}: wiring graph selected versions differ from the exact component locks`);
  }
  const links = new Map();
  const targetFacts = new Map();
  for (const edge of graph.spec?.edges ?? []) {
    if (edge.relation !== "needs") continue;
    const consumer = String(edge.component ?? "");
    if (!instanceIds.has(consumer)) continue;
    const providers = (edge.providerComponents ?? []).filter((provider) => provider !== consumer && instanceIds.has(provider));
    if (["resolved-rendered", "resolved-runtime"].includes(edge.status)) {
      for (const provider of providers) {
        const key = `${consumer}->${provider}`;
        if (!links.has(key)) links.set(key, { consumer, provider, statuses: new Set(), reasons: new Set(), facts: new Set() });
        const row = links.get(key);
        row.statuses.add(edge.status);
        row.reasons.add(edge.reason);
        row.facts.add(edge.to);
      }
      continue;
    }
    if (["target-prerequisite", "external", "unresolved", "ambiguous"].includes(edge.status)) {
      const key = `${consumer}|${edge.to}|${edge.status}`;
      if (!targetFacts.has(key)) targetFacts.set(key, {
        cluster: consumer.split("/")[0],
        consumer,
        fact: edge.to,
        status: edge.status,
        reason: edge.reason,
        resolutionHint: edge.resolutionHint || null,
        includedInGitOrOCI: false,
        requiredBeforeApply: ["target-prerequisite", "unresolved", "ambiguous"].includes(edge.status),
      });
    }
  }
  return {
    source: graph.spec?.evidence ?? null,
    links: [...links.values()].map((row) => ({
      consumer: row.consumer,
      provider: row.provider,
      statuses: [...row.statuses].sort(),
      reasons: [...row.reasons].sort(),
      facts: [...row.facts].sort(),
      updateType: "NeedsProvides",
      autoUpdate: false,
    })).sort((left, right) => `${left.consumer}->${left.provider}`.localeCompare(`${right.consumer}->${right.provider}`)),
    targetFacts: [...targetFacts.values()].sort((left, right) => `${left.consumer}|${left.fact}|${left.status}`.localeCompare(`${right.consumer}|${right.fact}|${right.status}`)),
  };
}

function buildComponentPackagePlan(request, checkoutRoot, components) {
  const base = request.spec.destination.catalogOCIBase.replace(/\/+$/, "");
  const short = request.spec.source.commit.slice(0, 12);
  return components.map((component) => {
    const treeSha256 = digestTree(component.path);
    return {
      id: `component:${component.service}@${component.wrapperVersion}`,
      service: component.service,
      role: component.role,
      deployable: component.deployable,
      wrapperVersion: component.wrapperVersion,
      sourcePath: gitPath(checkoutRoot, component.path),
      sourceTreeSha256: treeSha256,
      dependencies: component.dependencies,
      firstParty: component.firstParty,
      plannedOCIRef: `${base}/${component.service}:${component.wrapperVersion}-git.${short}`,
      publicationPolicy: "push-new-or-reuse-identical-digest; refuse-overwrite",
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function buildConfigPackagePlan(request, checkoutRoot, instances) {
  const short = request.spec.source.commit.slice(0, 12);
  return instances.map((instance) => {
    const space = instanceSpace(request.spec.destination.spacePrefix, instance.cluster, instance.service);
    return {
      id: `config:${instance.id}@${short}`,
      component: instance.service,
      cluster: instance.cluster,
      wrapperVersion: instance.wrapperVersion,
      selectedVersions: instance.selectedVersions,
      render: gitPath(checkoutRoot, instance.renderPath),
      renderSha256: instance.renderSha256,
      objectCount: instance.objectCount,
      target: instance.target,
      disposition: instance.disposition,
      releaseSpace: space,
      releaseUnit: instance.service,
      plannedOCIRefTemplate: `oci://oci.hub.confighub.com:443/space/{${space}.SpaceID}/${instance.service}:git-${short}`,
      publicationPolicy: "ConfigHub immutable release; refuse different existing digest",
      lifecycleBoundary: "preserve full effective render; executor must prove CRD/lifecycle ordering before apply",
    };
  });
}

function buildConfigHubPlan(request, components, instances, wiringPlan) {
  const prefix = request.spec.destination.spacePrefix;
  const controlSpace = `${prefix}-platform`;
  const spaces = [{
    slug: controlSpace,
    role: "PlatformControl",
    labels: { Role: "PlatformControl", Layer: "Platform", Scope: "Fleet" },
  }];
  const units = [
    unit(controlSpace, "platform-lock", "PlatformLock", null, "AppConfig/YAML", "generated:platform-lock.yaml"),
    unit(controlSpace, "kubara-config", "PlatformContract", null, "AppConfig/YAML", "source:config"),
    unit(controlSpace, "wiring-ledger", "WiringDefinition", null, "AppConfig/JSON", "source:wiring-graph"),
  ];
  for (const component of components) {
    const space = definitionSpace(prefix, component.service);
    spaces.push({
      slug: space,
      role: component.role,
      labels: { Role: component.role, Layer: "Platform", Scope: "Fleet", KubaraComponent: component.service, ComponentVersion: component.wrapperVersion },
    });
    units.push(unit(space, `${component.service}-catalog-lock`, "ComponentCatalogLock", null, "AppConfig/YAML", `component:${component.service}@${component.wrapperVersion}`));
    const canonical = instances.find((row) => row.service === component.service);
    if (canonical) units.push(unit(space, component.service, component.role, null, "Kubernetes/YAML", `config:${canonical.id}`, {
      canonicalInstance: canonical.id,
    }));
  }
  for (const instance of instances) {
    const space = instanceSpace(prefix, instance.cluster, instance.service);
    const targetMapping = request.spec.targets[instance.cluster];
    spaces.push({
      slug: space,
      role: "ComponentInstance",
      labels: {
        Role: "ComponentInstance",
        Layer: "Platform",
        KubaraComponent: instance.service,
        ComponentVersion: instance.wrapperVersion,
        Cluster: instance.cluster,
        Environment: targetMapping.environment,
        Region: targetMapping.region ?? "unspecified",
        KubaraTopologyRole: instance.topologyRole,
      },
    });
    units.push(unit(space, instance.service, "ComponentInstance", instance.target, "Kubernetes/YAML", `config:${instance.id}`, {
      upstream: `${definitionSpace(prefix, instance.service)}/${instance.service}`,
      disposition: instance.disposition,
    }));
  }
  for (const [cluster, target] of Object.entries(request.spec.targets).sort(([a], [b]) => a.localeCompare(b))) {
    spaces.push({
      slug: target.space,
      role: "ClusterTarget",
      externalOrCreateEmpty: true,
      labels: { Role: "ClusterTarget", Layer: "Platform", Cluster: cluster, Environment: target.environment, Region: target.region ?? "unspecified" },
    });
  }
  const links = [];
  for (const instance of instances) {
    links.push({
      space: instanceSpace(prefix, instance.cluster, instance.service),
      slug: `upgrade-${instance.service}`,
      fromUnit: instance.service,
      toSpace: definitionSpace(prefix, instance.service),
      toUnit: instance.service,
      updateType: "UpgradeUnit",
      autoUpdate: false,
      labels: { Role: "DefinitionInstanceLineage" },
    });
  }
  for (const edge of wiringPlan.links) {
    const [consumerCluster, consumerService] = edge.consumer.split("/");
    const [providerCluster, providerService] = edge.provider.split("/");
    const consumerSpace = instanceSpace(prefix, consumerCluster, consumerService);
    links.push({
      space: consumerSpace,
      slug: uniqueLinkSlug(`needs-${providerService}`, links.filter((row) => row.space === consumerSpace)),
      fromUnit: consumerService,
      toSpace: instanceSpace(prefix, providerCluster, providerService),
      toUnit: providerService,
      updateType: "NeedsProvides",
      autoUpdate: false,
      makeCurrent: true,
      reasons: edge.reasons,
      facts: edge.facts,
      labels: { Role: "WiringInstance" },
    });
  }
  for (const row of spaces) checkSlug(row.slug, `generated Space ${row.slug}`);
  for (const row of units) checkSlug(row.slug, `generated Unit ${row.space}/${row.slug}`);
  for (const row of links) checkSlug(row.slug, `generated Link ${row.space}/${row.slug}`);
  return {
    organization: request.spec.destination.organization,
    ownershipAnnotation: "import.confighub.com/platform-digest",
    conflictPolicy: "refuse-unexpected-space-unit-link-or-different-platform-digest",
    destructiveOperations: [],
    spaces: dedupeBy(spaces, (row) => row.slug).sort((left, right) => left.slug.localeCompare(right.slug)),
    units: units.sort((left, right) => `${left.space}/${left.slug}`.localeCompare(`${right.space}/${right.slug}`)),
    links: links.sort((left, right) => `${left.space}/${left.slug}`.localeCompare(`${right.space}/${right.slug}`)),
  };
}

function inventoryRevisionFiles(checkoutRoot, sourceRoot, inputs) {
  // The immutable source path is the security and provenance boundary, not
  // merely the handful of files that become deployable Units. This prevents a
  // caller from hiding credentials in an unselected sibling file in the same
  // claimed platform revision.
  rejectSymlinks(sourceRoot, true);
  const result = walkFiles(sourceRoot, true).map((path) => resolve(path)).sort();
  for (const path of result) {
    check(isWithin(path, sourceRoot), `${path}: selected file escapes source path`);
    check(isWithin(path, checkoutRoot), `${path}: selected file escapes checkout`);
  }
  const targetFactFiles = result.filter((path) => gitPath(sourceRoot, path).split("/").includes("target-facts"));
  check(targetFactFiles.length === 0, `target facts must be supplied at target-binding time, outside the imported Git/OCI path:\n- ${targetFactFiles.join("\n- ")}`);
  for (const required of [inputs.config, inputs.artifactLock, inputs.generationReceipt, inputs.wiringGraph]) {
    check(result.includes(resolve(required)), `${required}: required layout input is outside the revision inventory`);
  }
  return result;
}

function verifyTrackedInputs(checkoutRoot, commit, files) {
  const tracked = new Set(git(checkoutRoot, ["ls-tree", "-r", "--name-only", commit]).split("\n").filter(Boolean));
  const missing = files.map((path) => gitPath(checkoutRoot, path)).filter((path) => !tracked.has(path));
  check(missing.length === 0, `selected import files are not committed at ${commit}:\n- ${missing.join("\n- ")}`);
}

function scanForSecretMaterial(files) {
  const findings = [];
  for (const path of files) {
    const bytes = readFileSync(path);
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    for (const match of text.matchAll(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g)) {
      const nearby = text.slice(match.index, match.index + 512);
      if (!/(?:<private-key>|REPLACE_ME|CHANGEME|redacted)/i.test(nearby)) findings.push(`${path}: PEM private key`);
    }
    if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(text)) findings.push(`${path}: AWS access-key-shaped value`);
    if (/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@]+@/i.test(text)) findings.push(`${path}: credential-bearing connection URL`);
    if (!/\.ya?ml$/i.test(path)) continue;
    let docs;
    try {
      docs = parseDocs(text);
    } catch {
      continue; // Helm templates are not plain YAML; the raw high-confidence checks still ran.
    }
    for (const doc of docs) {
      if (["ClusterSecretStore", "SecretStore"].includes(doc?.kind) && doc.spec?.provider?.fake?.data?.some((row) => meaningfulSecretValue(row?.value))) {
        findings.push(`${path}: ${doc.kind} ${doc.metadata?.name ?? "unnamed"} embeds fake-provider values; bind them as target facts instead`);
      }
      if (doc?.kind === "Secret") {
        for (const field of ["data", "stringData"]) {
          for (const [key, value] of Object.entries(doc[field] ?? {})) {
            const decoded = field === "data" ? decodeBase64(String(value)) : String(value);
            if (!SAFE_NONCREDENTIAL_SECRET_KEYS.has(key) || containsCredentialMaterial(decoded) || isSensitiveSecretKey(key)) {
              if (meaningfulSecretValue(value)) findings.push(`${path}: Secret ${doc.metadata?.namespace ?? "default"}/${doc.metadata?.name ?? "unnamed"} contains unexternalized ${field}.${key}`);
            }
          }
        }
        continue;
      }
      if (doc?.kind !== "CustomResourceDefinition") scanSensitiveMappings(doc, path, findings);
    }
  }
  check(findings.length === 0, `credential-shaped material is forbidden in selected Git/OCI payloads:\n- ${findings.join("\n- ")}`);
}

function semanticRequest(request) {
  return {
    apiVersion: request.apiVersion,
    kind: request.kind,
    metadata: { name: request.metadata.name },
    spec: request.spec,
  };
}

function writeOutputs(outputRoot, compiled) {
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "import-plan.json"), compiled.planText);
  writeFileSync(join(outputRoot, "platform-lock.yaml"), compiled.lockText);
  writeFileSync(join(outputRoot, "acceptance.json"), compiled.acceptanceText);
  writeFileSync(join(outputRoot, "checksums.txt"), compiled.checksumsText);
}

function verifyOutputs(outputRoot, compiled) {
  const expected = {
    "import-plan.json": compiled.planText,
    "platform-lock.yaml": compiled.lockText,
    "acceptance.json": compiled.acceptanceText,
    "checksums.txt": compiled.checksumsText,
  };
  for (const [name, text] of Object.entries(expected)) {
    const path = join(outputRoot, name);
    check(existsSync(path), `${path} is missing; compile the import first`);
    check(readFileSync(path, "utf8") === text, `${path} is stale or was modified; recompile from the exact Git revision`);
  }
}

function outputChecksums({ planText, lockText, acceptanceText }) {
  return [
    `${sha256(acceptanceText)}  acceptance.json`,
    `${sha256(planText)}  import-plan.json`,
    `${sha256(lockText)}  platform-lock.yaml`,
  ].sort().join("\n") + "\n";
}

function selfTest() {
  const fixture = resolve("examples/kubara/current-platform");
  check(existsSync(fixture), "current Kubara v0.13.0 fixture is missing");
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-kubara-git-import-"));
  try {
    const checkout = join(tempRoot, "checkout");
    const platform = join(checkout, "platform");
    cpSync(fixture, platform, { recursive: true });
    mkdirSync(join(platform, "wiring"), { recursive: true });
    cpSync(resolve("data/kubara-wiring/graph.json"), join(platform, "wiring", "graph.json"));
    gitInit(checkout, "https://example.invalid/acme/kubara-platform.git");
    let commit = commitAll(checkout, "fixture");
    const requestPath = join(tempRoot, "request.yaml");
    const output = join(tempRoot, "output");
    const request = fixtureRequest(commit);
    writeFileSync(requestPath, `${toYaml(request)}\n`);
    expectFailure(
      () => compileImport({ requestPath, checkoutRoot: checkout }),
      /target facts must be supplied at target-binding time/,
      "current test-only target-fact-in-Git refusal",
    );
    rmSync(join(platform, "target-facts"), { recursive: true, force: true });
    commit = commitAll(checkout, "externalize target facts");
    Object.assign(request.spec.source, { commit });
    writeFileSync(requestPath, `${toYaml(request)}\n`);
    expectFailure(
      () => compileImport({ requestPath, checkoutRoot: checkout }),
      /credential-shaped material is forbidden/,
      "current test-only application credential refusal",
    );
    rmSync(join(platform, "apps"), { recursive: true, force: true });
    commit = commitAll(checkout, "externalize application credentials and sources");
    Object.assign(request.spec.source, { commit });
    writeFileSync(requestPath, `${toYaml(request)}\n`);
    let compiled = compileImport({ requestPath, checkoutRoot: checkout });
    check(compiled.plan.spec.topology.clusters.length === 4, "self-test did not preserve four clusters");
    check(compiled.plan.spec.topology.hubs.length === 1 && compiled.plan.spec.topology.spokes.length === 3, "self-test did not preserve one hub and three spokes");
    check(compiled.plan.spec.oci.configReleases.length === 13, "self-test did not produce all 13 component-instance config release plans");
    check(compiled.plan.spec.oci.catalogPackages.filter((row) => row.deployable).length === 7, "self-test did not produce seven deployable component definitions");
    check(compiled.plan.spec.configHub.links.some((row) => row.updateType === "NeedsProvides"), "self-test did not preserve visible provides/needs wiring");
    check(compiled.plan.spec.targetFacts.rows.length > 0 && compiled.plan.spec.targetFacts.rows.every((row) => row.includedInGitOrOCI === false), "self-test did not preserve the external target-fact boundary");
    check(compiled.plan.spec.boundary.flattenedFleetBundle === false, "self-test flattened the platform");
    writeOutputs(output, compiled);
    verifyOutputs(output, compiled);

    const planPath = join(output, "import-plan.json");
    writeFileSync(planPath, `${compiled.planText.trimEnd()} \n`);
    expectFailure(() => verifyOutputs(output, compiled), /stale or was modified/, "output tamper refusal");
    writeOutputs(output, compiled);

    const mutableRequest = structuredClone(request);
    mutableRequest.spec.source.commit = "main";
    writeFileSync(requestPath, `${toYaml(mutableRequest)}\n`);
    expectFailure(() => compileImport({ requestPath, checkoutRoot: checkout }), /full lowercase Git object ID/, "mutable ref refusal");

    const missingTarget = structuredClone(request);
    delete missingTarget.spec.targets["hx-app-prod-b"];
    writeFileSync(requestPath, `${toYaml(missingTarget)}\n`);
    expectFailure(() => compileImport({ requestPath, checkoutRoot: checkout }), /destination target mapping is missing/, "missing target refusal");

    const unsafeOrg = structuredClone(request);
    unsafeOrg.spec.destination.organizationPolicy = "merge-whatever-exists";
    writeFileSync(requestPath, `${toYaml(unsafeOrg)}\n`);
    expectFailure(() => compileImport({ requestPath, checkoutRoot: checkout }), /organizationPolicy/, "unsafe organization policy refusal");

    const chartPath = join(platform, "generated/platform-components/helm/metrics-server/Chart.yaml");
    const originalChart = readFileSync(chartPath, "utf8");
    writeFileSync(chartPath, originalChart.replace("version: 3.13.1", "version: latest"));
    commit = commitAll(checkout, "mutable chart version");
    const mutableChartRequest = fixtureRequest(commit);
    writeFileSync(requestPath, `${toYaml(mutableChartRequest)}\n`);
    expectFailure(() => compileImport({ requestPath, checkoutRoot: checkout }), /must be an exact version/, "missing exact version refusal");

    writeFileSync(chartPath, originalChart);
    const secretPath = join(platform, "generated/platform-configs/hx-app-dev/helm/metrics-server/committed-secret.yaml");
    writeFileSync(secretPath, "apiVersion: v1\nkind: Secret\nmetadata:\n  name: bad\nstringData:\n  password: should-not-be-here\n");
    commit = commitAll(checkout, "secret material");
    const secretRequest = fixtureRequest(commit);
    writeFileSync(requestPath, `${toYaml(secretRequest)}\n`);
    expectFailure(() => compileImport({ requestPath, checkoutRoot: checkout }), /credential-shaped material is forbidden/, "secret material refusal");

    rmSync(secretPath);
    commitAll(checkout, "restore safe fixture");
    console.log("Kubara Git importer self-test passed: current four-cluster fixture, exact locks, topology, 13 instance releases, deterministic verification, and adversarial refusals");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function fixtureRequest(commit) {
  return {
    apiVersion: "import.confighub.com/v1alpha1",
    kind: "KubaraGitRevisionImport",
    metadata: { name: "kubara-current-four-cluster" },
    spec: {
      source: {
        repository: "https://example.invalid/acme/kubara-platform.git",
        commit,
        path: "platform",
      },
      layout: {
        source: "source",
        config: "source/config.yaml",
        components: "generated/platform-components/helm",
        configs: "generated/platform-configs",
        renders: "effective-renders",
        artifactLock: "component-artifacts.yaml",
        generationReceipt: "generation-receipt.yaml",
        wiringGraph: "wiring/graph.json",
      },
      destination: {
        organization: "Acme Kubara",
        organizationPolicy: "require-empty-or-importer-owned-identical",
        spacePrefix: "acme-kubara",
        deliveryMode: "confighub-managed-argo",
        catalogOCIBase: "oci://registry.example.invalid/acme/kubara-components",
      },
      targets: {
        "hx-app-dev": { space: "acme-target-dev", target: "target", environment: "Dev", region: "local" },
        "hx-app-staging": { space: "acme-target-staging", target: "target", environment: "Staging", region: "local" },
        "hx-app-prod-a": { space: "acme-target-prod-a", target: "target", environment: "Prod", region: "us-east" },
        "hx-app-prod-b": { space: "acme-target-prod-b", target: "target", environment: "Prod", region: "us-west" },
      },
    },
  };
}

function checkExactVersion(value, label) {
  check(value && !/[<>=~*^|,\s]/.test(value) && !/^(?:latest|main|master|head|x)$/i.test(value) && /\d/.test(value), `${label} must be an exact version, got ${JSON.stringify(value)}`);
}

function validateGitURL(value) {
  let parsed;
  try { parsed = new URL(value); } catch { check(false, "spec.source.repository must be a valid HTTPS Git URL"); }
  check(parsed.protocol === "https:" && parsed.username === "" && parsed.password === "", "spec.source.repository must be an HTTPS Git URL without embedded credentials");
  check(parsed.search === "" && parsed.hash === "" && parsed.pathname.endsWith(".git"), "spec.source.repository must end in .git and contain no mutable query or fragment");
}

function checkSafeRelative(value, label) {
  check(typeof value === "string" && value.length > 0, `${label} is required`);
  check(!value.startsWith("/") && !value.split(/[\\/]/).includes("..") && !value.includes("\0"), `${label} must be a safe relative path`);
}

function checkSlug(value, label) {
  check(/^[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?$/.test(value ?? ""), `${label} must be a lowercase DNS-style slug`);
}

function safeJoin(root, child) {
  checkSafeRelative(child, "relative path");
  const result = resolve(root, child);
  check(isWithin(result, root), `${child}: path escapes its declared root`);
  return result;
}

function isWithin(path, root) {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function rejectSymlinks(root, skipGit = false) {
  const visit = (path) => {
    const stat = lstatSync(path);
    check(!stat.isSymbolicLink(), `${path}: symbolic links are refused in selected import inputs`);
    if (stat.isDirectory()) for (const entry of readdirSync(path)) {
      if (skipGit && entry === ".git") continue;
      visit(join(path, entry));
    }
  };
  visit(root);
}

function walkFiles(root, skipGit = false) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (skipGit && entry.name === ".git") continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(path, skipGit));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}

function digestTree(root) {
  return digestRows(walkFiles(root).map((path) => `${relative(root, path).replaceAll("\\", "/")}\0${sha256(readFileSync(path))}`));
}

function digestRows(rows) {
  const hash = createHash("sha256");
  for (const row of [...rows].sort()) hash.update(`${row}\n`);
  return hash.digest("hex");
}

function git(cwd, gitArgs) {
  return execFileSync("git", ["-C", cwd, ...gitArgs], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitInit(checkout, remote) {
  mkdirSync(checkout, { recursive: true });
  execFileSync("git", ["-C", checkout, "init", "--quiet"]);
  execFileSync("git", ["-C", checkout, "remote", "add", "origin", remote]);
}

function commitAll(checkout, message) {
  execFileSync("git", ["-C", checkout, "add", "--all"]);
  execFileSync("git", ["-C", checkout, "-c", "user.name=Kubara Import Self-Test", "-c", "user.email=kubara-import@example.invalid", "commit", "--quiet", "-m", message]);
  return git(checkout, ["rev-parse", "HEAD"]);
}

function normalizeGitURL(value) {
  return String(value).trim().replace(/\/+$/, "");
}

function gitPath(checkoutRoot, path) {
  return relative(checkoutRoot, path).replaceAll("\\", "/");
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: invalid JSON: ${error.message}`);
  }
}

function stableJson(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sortDeep(nested)]));
  return value;
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function definitionSpace(prefix, service) {
  return `${prefix}-${service}-base`;
}

function instanceSpace(prefix, cluster, service) {
  return `${prefix}-${service}-${cluster}`;
}

function unit(space, slug, role, target, toolchain, source, extra = {}) {
  return { space, slug, role, target, toolchain, provider: target ? null : "None", source, labels: { Role: role }, ...extra };
}

function uniqueLinkSlug(base, rows) {
  const used = new Set(rows.map((row) => row.slug));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function dedupeBy(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!result.has(value)) result.set(value, row);
    else check(stableJson(result.get(value)) === stableJson(row), `conflicting duplicate plan row ${value}`);
  }
  return [...result.values()];
}

function isSensitiveSecretKey(key) {
  return /(?:^|[-_.])(password|passwd|token|private[-_.]?key|api[-_.]?key|client[-_.]?secret|secret[-_.]?key|credentials|auth)(?:$|[-_.])/i.test(key)
    || /^(?:password|passwd|token|privateKey|apiKey|clientSecret|credentials|auth)$/i.test(key);
}

function scanSensitiveMappings(value, path, findings, trail = []) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) scanSensitiveMappings(item, path, findings, [...trail, String(index)]);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.name === "string" && isSensitiveSecretKey(value.name) && Object.hasOwn(value, "value") && meaningfulSecretValue(value.value)) {
    findings.push(`${path}: literal credential-shaped environment value at ${[...trail, "value"].join(".")}`);
  }
  for (const [key, nested] of Object.entries(value)) {
    const nestedTrail = [...trail, key];
    if (!REFERENCE_KEYS.has(key) && isSensitiveSecretKey(key) && typeof nested !== "object" && meaningfulSecretValue(nested)) {
      findings.push(`${path}: literal credential-shaped value at ${nestedTrail.join(".")}`);
    }
    scanSensitiveMappings(nested, path, findings, nestedTrail);
  }
}

function decodeBase64(value) {
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.toString("utf8");
  } catch {
    return value;
  }
}

function containsCredentialMaterial(value) {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)
    || /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@]+@/i.test(value)
    || /"(?:password|token|apiKey|clientSecret|privateKey)"\s*:\s*"(?!<|\$\{|REPLACE_ME|CHANGEME|redacted)[^"]+"/i.test(value);
}

function meaningfulSecretValue(value) {
  if (value === null || value === undefined || value === "") return false;
  const text = String(value);
  return !/^(?:<[^>]+>|\$\{[^}]+\}|\{\{[^}]+\}\}|REPLACE_ME|CHANGEME|redacted|null)$/i.test(text.trim());
}

function pass(id, detail) {
  return { id, result: "pass", detail };
}

function expectFailure(fn, pattern, label) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  check(error && pattern.test(String(error.message)), `${label}: expected ${pattern}, got ${error?.message ?? "success"}`);
}

function requiredOption(name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : "";
  check(value && !value.startsWith("--"), `${name} is required`);
  return value;
}

function validateCliArgs(values) {
  const valueFlags = new Set(["--request", "--checkout", "--output"]);
  const flags = new Set([...MODES, "--help", ...valueFlags]);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    check(flags.has(value), `unknown argument ${value}`);
    if (valueFlags.has(value)) {
      check(values[index + 1] && !values[index + 1].startsWith("--"), `${value} requires a value`);
      index += 1;
    }
  }
}

function usage() {
  console.log(`Usage:
  node scripts/import-kubara-git-revision.mjs --plan    --request <request.yaml> --checkout <clean-git-checkout>
  node scripts/import-kubara-git-revision.mjs --compile --request <request.yaml> --checkout <clean-git-checkout> --output <directory-outside-checkout>
  node scripts/import-kubara-git-revision.mjs --verify  --request <request.yaml> --checkout <clean-git-checkout> --output <directory-outside-checkout>
  node scripts/import-kubara-git-revision.mjs --self-test

Reserved, currently refused:
  --package   Generic OCI packaging is not yet claimed.
  --apply     Generic ConfigHub organization reconciliation is not yet claimed.

The request must name an HTTPS Git repository, a full immutable commit object,
one path within that clean checkout, a selected ConfigHub organization, an
untagged catalog OCI base, and an exact target mapping for every Kubara cluster.
`);
}
