(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const exampleNode = byId("promotion-example-data");
  const yamlTools = globalThis.ConfigWorkshopYaml;
  if (!exampleNode || !yamlTools) return;

  const example = JSON.parse(exampleNode.textContent);
  let latestReview = null;
  let latestReviewJson = "";
  let latestCurrent = "";
  let latestCandidate = "";

  async function sha256(text) {
    const bytes = new TextEncoder().encode(yamlTools.canonicalFileText(text));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return "sha256:" + [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function uniqueMatches(text, expression, group = 1) {
    return [...new Set([...text.matchAll(expression)].map((match) => match[group]))].sort();
  }

  function workloadReplica(text, name) {
    const objectSet = yamlTools.parseObjectSet(text, "workload");
    const workload = objectSet.objects.find((object) => object.kind === "StatefulSet" && object.name === name);
    return Number.isInteger(workload?.value?.spec?.replicas) ? workload.value.spec.replicas : null;
  }

  function inspectCandidate(candidate, comparison) {
    const findings = [];
    const text = candidate.text;
    if (candidate.objects.some((object) => !object.valid)) findings.push("At least one YAML document is not a complete Kubernetes object.");
    if (candidate.duplicates.length) findings.push("The proposed configuration contains duplicate object identities: " + candidate.duplicates.slice(0, 3).join(", ") + (candidate.duplicates.length > 3 ? "." : ""));
    if (candidate.objects.some((object) => object.kind === "Secret")) findings.push("The proposed configuration contains a Secret. Confirm how credentials will be supplied before it moves.");
    if (candidate.objects.some((object) => object.kind === "CustomResourceDefinition")) findings.push("The proposed configuration contains CRDs. Test CRD ordering and establishment before dependent objects.");
    if (/helm\.sh\/hook\s*:/i.test(text)) findings.push("The proposed configuration contains a Helm hook annotation. Decide who runs that lifecycle step and in which order.");
    if (comparison.removed.length) findings.push("The proposed configuration removes objects. Test pruning, retained state, and rollback before promotion.");
    if (comparison.changed.some((ref) => /StatefulSet/.test(ref))) findings.push("A StatefulSet changes. Test storage, rollout, and application readiness in staging.");
    if (/\b(?:change[-_ ]?me|replace[-_ ]?me|dummy|example-password)\b/i.test(text)) findings.push("The proposed configuration may still contain an example or placeholder value.");
    const unpinned = uniqueMatches(text, /^\s*image:\s*([^\s#]+).*$/gm).filter((image) => !/@sha256:[0-9a-f]{64}$/i.test(image));
    if (unpinned.length) findings.push("Some container images are not pinned by digest: " + unpinned.slice(0, 3).join(", ") + (unpinned.length > 3 ? "." : ""));
    return findings;
  }

  function addList(id, items, fallback) {
    const node = byId(id);
    node.replaceChildren();
    for (const value of items.length ? items : [fallback]) {
      const item = document.createElement("li");
      item.textContent = value;
      node.appendChild(item);
    }
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copyText(value, statusId) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = value;
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
    }
    byId(statusId).textContent = "Copied.";
  }

  async function loadFile(inputId, textareaId, labelId = "") {
    const file = byId(inputId).files && byId(inputId).files[0];
    if (!file) return;
    byId(textareaId).value = await file.text();
    if (labelId) byId(labelId).value = file.name;
  }

  function parseRecord(text) {
    if (!text.trim()) return null;
    const record = globalThis.jsyaml.load(text);
    if (!record || record.kind !== "BaseVariantRecord") throw new Error("The source and intent file must be a BaseVariantRecord.");
    return record;
  }

  async function objectSetRecord(objectSet, digest) {
    const identity = yamlTools.scannerObjectSetPayload(objectSet);
    return {
      name: objectSet.name,
      sha256: digest,
      objectCount: objectSet.objects.length,
      objectSetSha256: await sha256(identity.payload),
      objectSetHashAlgorithm: "cub-scan-canonical-json-v1",
      objects: objectSet.objects.map((object) => object.ref).sort(),
    };
  }

  function destinationNames() {
    return [...new Set(byId("destination").value.split(/[\n,]/).map((name) => name.trim()).filter(Boolean))];
  }

  function safeSlug(value, fallback) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || fallback;
  }

  function buildConfigHubCommands(review) {
    const component = safeSlug(byId("confighub-component").value, "my-component");
    const baseSpace = safeSlug(byId("confighub-base-space").value, `${component}-base`);
    const granularity = byId("confighub-granularity").value;
    const namespace = safeSlug(byId("confighub-namespace").value, "");
    const uploadShape = `--granularity ${granularity}${namespace ? ` --namespace ${namespace}` : ""}`;
    const destinations = byId("confighub-destination-spaces").value.split(/[\n,]/).map((value) => safeSlug(value, "")).filter(Boolean);
    const changeId = `promote-${review.spec.candidate.objectSetSha256.slice(7, 19)}`;
    const escapedBase = baseSpace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const preview = [
      "# 1. Read the Space first. A re-upload must repeat its recorded Unit layout and namespace.",
      `cub space get ${baseSpace} -o yaml`,
      "# 2. Preview the source refresh. This is a three-way merge and changes nothing.",
      `cub variant upload --dry-run --component ${component} --variant base --space ${baseSpace} ${uploadShape} --annotation workshop.confighub.com/object-set-sha256=${review.spec.candidate.objectSetSha256} candidate.yaml`,
    ];
    const execute = [
      "set -euo pipefail",
      "",
      "# Run these writes only after the preview and destination checks pass.",
      `cub variant upload --component ${component} --variant base --space ${baseSpace} ${uploadShape} --annotation workshop.confighub.com/object-set-sha256=${review.spec.candidate.objectSetSha256} --change-desc \"Reviewed ${review.spec.candidate.objectSetSha256}\" candidate.yaml`,
      `cub unit update ${component} --space ${baseSpace} --annotation workshop.confighub.com/object-set-sha256=${review.spec.candidate.objectSetSha256} --change-desc \"Bind the accepted object set\"`,
    ];
    if (!destinations.length) preview.push("", "# Add one existing downstream Space above to preview its promotion.");
    for (const destination of destinations) {
      const variantName = safeSlug(destination.replace(new RegExp(`^${escapedBase}-?`), ""), "staging");
      preview.push(
        "",
        `# If ${destination} does not exist, run this once, then rerun this preview:`,
        `# cub variant create ${variantName} ${baseSpace} --space-pattern template:${destination}`,
        `cub space get ${destination} -o name`,
        `# Preview exactly what existing Space ${destination} would receive:`,
        `cub variant promote ${destination} --dry-run -o mutations`,
      );
      execute.push(
        "",
        `# Stop if ${destination} has not been created and previewed:`,
        `cub space get ${destination} -o name >/dev/null`,
        `# After the preview, destination checks, and approval, retain the promotion in one ChangeSet:`,
        `cub changeset create --space ${destination} ${changeId} --description \"Promote reviewed ${review.spec.candidate.objectSetSha256}\"`,
        `cub variant promote ${destination} --changeset ${changeId} --change-desc \"Promote reviewed ${review.spec.candidate.objectSetSha256}\"`,
        `# Publish only after the Space has a release target and its apply gates pass:`,
        `cub release publish ${destination}`,
      );
    }
    execute.push("", "# Read the released digest back and add each target result to the PromotionReview.");
    return { preview: preview.join("\n"), execute: execute.join("\n") };
  }

  function setConfigHubCommands(review) {
    const commands = buildConfigHubCommands(review);
    byId("confighub-promotion-preview").value = commands.preview;
    byId("confighub-promotion-run").value = commands.execute;
  }

  function assessmentForPromotion(sourceAware, destinationPreflight, targetResults) {
    const destinations = destinationPreflight.destinations || [];
    const suppliedTargetResults = (targetResults.targets || []).filter((target) =>
      target.status !== "not-run" || target.digest !== "not supplied" || target.note !== "No result supplied.");
    const postState = !suppliedTargetResults.length
      ? { evidenceState: "not-run", resultState: "not-run", answer: "No result for the exact candidate digest was supplied." }
      : targetResults.overall === "pass"
        ? { evidenceState: "completed", resultState: "pass", answer: `Every supplied target result passed for the exact candidate digest across ${suppliedTargetResults.length} target(s).` }
        : targetResults.overall === "blocked"
          ? { evidenceState: "completed", resultState: "blocked", answer: "At least one supplied target result was blocked or referred to a different candidate digest." }
          : { evidenceState: "completed", resultState: "watch", answer: "The supplied target results are partial or include a watch result. They do not establish a complete pass." };
    const destinationState = suppliedTargetResults.length
      ? {
          evidenceState: "completed",
          resultState: postState.resultState === "pass" ? "pass" : postState.resultState === "watch" ? "watch" : "blocked",
          answer: "The supplied post-deployment result also provides evidence about destination acceptance for the exact candidate. Review its scope before reusing it.",
        }
      : {
          evidenceState: "blocked",
          resultState: "not-run",
          answer: destinations.length
            ? `The destination names are recorded (${destinations.join(", ")}), but current destination facts were not supplied.`
            : "No destination or current destination facts were supplied.",
        };
    return {
      stages: [
        {
          id: "inspection",
          question: "What do I have?",
          answer: "The browser parsed and compared the supplied current and candidate Kubernetes object sets.",
          requiredInputs: ["current Kubernetes objects", "candidate Kubernetes objects"],
          catalogMatchRequired: false,
          sourceIntentRequired: false,
          destinationAccessRequired: false,
          deploymentRequired: false,
          evidenceState: "completed",
          resultState: "available",
          records: ["current.yaml", "candidate.yaml"],
          nextAction: "Confirm that both object sets use the revisions you intend to compare.",
        },
        {
          id: "materialization",
          question: "What will it produce?",
          answer: sourceAware.status === "compared"
            ? "Supplied source renders were compared with the current and candidate objects, so source changes and later object edits are separated. The browser did not rerun the source-native tool."
            : "The exact candidate objects are available, but source renders were not supplied and the source-native tool did not run.",
          requiredInputs: ["source and intent", "source-native materialization tool or supplied source renders", "exact candidate objects"],
          catalogMatchRequired: false,
          sourceIntentRequired: true,
          destinationAccessRequired: false,
          deploymentRequired: false,
          evidenceState: sourceAware.status === "compared" ? "completed" : "not-run",
          resultState: "available",
          records: ["candidate.yaml"],
          nextAction: sourceAware.status === "compared"
            ? "Review fields changed by both the source and a later object edit."
            : "Supply source renders or rerun the source-native tool when source-to-output reproduction matters.",
        },
        {
          id: "destination",
          question: "Can this destination accept it?",
          answer: destinationState.answer,
          requiredInputs: ["exact candidate", "named destination", "current destination facts"],
          catalogMatchRequired: false,
          sourceIntentRequired: false,
          destinationAccessRequired: true,
          deploymentRequired: false,
          evidenceState: destinationState.evidenceState,
          resultState: destinationState.resultState,
          records: suppliedTargetResults.length ? ["promotion-review.json"] : [],
          nextAction: suppliedTargetResults.length
            ? "Confirm that the evidence covers the destination acceptance claim you need."
            : "Run the listed destination checks before promotion.",
        },
        {
          id: "post-deployment",
          question: "Did it work?",
          answer: postState.answer,
          requiredInputs: ["exact delivered revision", "named destination", "claim-specific live evidence"],
          catalogMatchRequired: false,
          sourceIntentRequired: false,
          destinationAccessRequired: true,
          deploymentRequired: true,
          evidenceState: postState.evidenceState,
          resultState: postState.resultState,
          records: suppliedTargetResults.length ? ["promotion-review.json"] : [],
          nextAction: suppliedTargetResults.length
            ? "Keep each target result tied to the exact candidate digest and the claim it checked."
            : "Deploy the exact candidate to staging, then record the controller, resource, workload, runtime, drift, or rollback result required by the claim.",
        },
      ],
    };
  }

  function buildAiPrompt(review) {
    const tests = review.spec.testsRequired.map((test) => `- ${test}`).join("\n");
    const sourceSummary = review.spec.sourceAware.status === "compared"
      ? `${review.spec.sourceAware.counts.upstreamAdded} source field changes; ${review.spec.sourceAware.counts.overridden} post-render fields; ${review.spec.sourceAware.counts.overlaps} overlaps needing review.`
      : "Source renders were not supplied, so values/source changes cannot be separated from later object edits.";
    return [
      "I am reviewing one configuration promotion.",
      "",
      `Current file: current.yaml (${review.spec.current.sha256}); object set ${review.spec.current.objectSetSha256}`,
      `Candidate file: candidate.yaml (${review.spec.candidate.sha256}); object set ${review.spec.candidate.objectSetSha256}`,
      `Destinations: ${review.spec.change.destinations.join(", ") || "not supplied"}`,
      `Field ownership: ${sourceSummary}`,
      "",
      "Read current.yaml, candidate.yaml, and promotion-review.json locally. Do not upload them or edit them in place.",
      "Confirm both SHA-256 values before using the review.",
      "If source renders are present, explain source changes separately from post-render overrides. Do not set one field silently in both places.",
      "Read the lifecycle routes and prerequisites. Do not treat a recorded route as executed unless its evidence says it ran for this exact version and path.",
      "Explain added, removed, and changed Kubernetes objects in plain English.",
      "Check immutable fields, storage, Secrets, CRDs, hooks, pruning, rollback, and application-specific migrations.",
      "Do not call the fleet successful when any target is watch, blocked, or not-run.",
      "Read spec.assessment and report its four stages separately. Inspection is not materialization, destination acceptance needs current target facts, and a post-deployment pass needs the exact delivered revision and live evidence.",
      "Treat a missing prerequisite as blocked or not run. Do not call the source, candidate, workload, or conformance result failed unless the matching check actually ran and failed.",
      "Write any proposed correction to a new candidate file and show me the exact diff.",
      "Ask before running any ConfigHub write. Start with every --dry-run command in the review.",
      "Before a ConfigHub re-upload, read the base Space and confirm that the command repeats its recorded Unit layout and namespace. Stop if they differ.",
      "",
      "Tests still required:",
      tests,
    ].join("\n");
  }

  function renderSourceAware(sourceAware, noOpObjects) {
    const section = byId("source-aware-result");
    if (sourceAware.status !== "compared") {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    byId("source-aware-summary").textContent = `${sourceAware.counts.upstreamAdded} field change(s) came from the new source; ${sourceAware.counts.overridden} field(s) are post-render edits; ${sourceAware.counts.overlaps} overlap(s) need a decision. ${sourceAware.counts.inherited} inherited field(s) stay out of the table. ${noOpObjects.length} object(s) changed only in formatting or key order.`;
    const tbody = byId("source-aware-rows");
    tbody.replaceChildren();
    const fieldPriority = (row) => {
      let score = row.needsReview ? 1000 : row.class === "overridden" ? 500 : 0;
      if (/^\/spec\//.test(row.path)) score += 200;
      if (/\/(?:image|replicas|resources|storageClassName|volumeClaimTemplates|selector)(?:\/|$)/i.test(row.path)) score += 150;
      if (/^\/data\//.test(row.path)) score += 100;
      if (/^\/metadata\/(?:labels|annotations)\//.test(row.path)) score -= 100;
      if (/checksum|helm\.sh~1chart|app\.kubernetes\.io~1version/i.test(row.path)) score -= 100;
      return score;
    };
    const important = [...sourceAware.rows]
      .sort((left, right) => fieldPriority(right) - fieldPriority(left) || left.object.localeCompare(right.object) || left.path.localeCompare(right.path))
      .slice(0, 12);
    for (const row of important) {
      const tr = document.createElement("tr");
      const source = document.createElement("td");
      source.textContent = row.needsReview ? "Source and later edit overlap" : row.class === "upstream-added" ? "Chart or source" : `Later edit (${row.mode})`;
      const field = document.createElement("td");
      const object = document.createElement("code");
      object.textContent = row.object;
      field.append(object, document.createElement("br"));
      const path = document.createElement("code");
      path.textContent = row.path;
      field.append(path);
      const result = document.createElement("td");
      result.textContent = row.needsReview
        ? `source ${row.oldSource} -> ${row.newSource}; accepted ${row.oldAccepted} -> ${row.newAccepted}`
        : row.class === "upstream-added"
          ? `${row.oldSource} -> ${row.newSource}`
          : `source ${row.newSource}; accepted ${row.newAccepted}`;
      tr.append(source, field, result);
      tbody.appendChild(tr);
    }
    byId("source-aware-note").textContent = sourceAware.rows.length > important.length
      ? `Showing ${important.length} of ${sourceAware.rows.length} classified field changes. The downloaded review contains the full list.`
      : `Showing all ${important.length} classified field changes.`;
  }

  function renderTargets(targets) {
    byId("target-summary").textContent = `Overall: ${targets.overall}. ${targets.counts.pass} pass, ${targets.counts.watch} watch, ${targets.counts.blocked} blocked, ${targets.counts["not-run"]} not run.`;
    const tbody = byId("target-result-rows");
    tbody.replaceChildren();
    for (const target of targets.targets) {
      const tr = document.createElement("tr");
      for (const value of [target.name, target.status, target.digest, target.note]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  function lifecycleLines(lifecycle) {
    const lines = [];
    for (const requirement of lifecycle.requirements) {
      const category = requirement.category === "secret" ? "Secret" : requirement.category || "setup item";
      const when = requirement.requiredBefore === "apply" ? "Before apply" : `Before ${requirement.requiredBefore || "deployment"}`;
      lines.push(`${when}, provide or check ${category} ${requirement.name || "unnamed"}.`);
    }
    for (const route of lifecycle.routes) {
      const name = route.routeName || route.id || route.name || "unnamed";
      const phase = route.lifecyclePhase ? `${route.lifecyclePhase}: ` : "";
      const work = route.operatingDetails || route.whoRuns || "Read the recorded instructions before deployment.";
      const disposition = route.disposition || route.status || "not stated";
      const drift = route.sourceDrift ? " The route was recorded for a different source version, so recheck it." : "";
      lines.push(`${phase}${name}. ${work} Catalog status: ${disposition}.${drift}`);
    }
    if (lifecycle.manifestSignals.crds.length) lines.push(`${lifecycle.manifestSignals.crds.length} CRD object(s) appear in the proposed YAML.`);
    if (lifecycle.manifestSignals.hooks.length) lines.push(`${lifecycle.manifestSignals.hooks.length} Helm hook object(s) appear in the proposed YAML.`);
    if (lifecycle.manifestSignals.jobs.length) lines.push(`${lifecycle.manifestSignals.jobs.length} Job or CronJob object(s) need workload-versus-lifecycle review.`);
    if (!lines.length && lifecycle.record === "not supplied") lines.push("No Catalog source and intent record was supplied. Only manifest-visible hooks, CRDs, and Jobs were checked.");
    if (!lines.length) lines.push("The supplied Catalog record names no lifecycle route or target prerequisite for this configuration.");
    return lines;
  }

  async function comparePromotion(isExample = false) {
    try {
      const currentText = yamlTools.canonicalFileText(byId("current-yaml").value);
      const candidateText = yamlTools.canonicalFileText(byId("candidate-yaml").value);
      if (!currentText.trim() || !candidateText.trim()) {
        window.alert("Add both the current and proposed Kubernetes YAML.");
        return;
      }
      const current = yamlTools.parseObjectSet(currentText, byId("current-label").value.trim() || "current.yaml");
      const candidate = yamlTools.parseObjectSet(candidateText, byId("candidate-label").value.trim() || "candidate.yaml");
      if (!current.objects.length || !candidate.objects.length) throw new Error("Both inputs must contain at least one Kubernetes YAML document.");

      const currentSourceText = yamlTools.canonicalFileText(byId("current-source-yaml").value);
      const candidateSourceText = yamlTools.canonicalFileText(byId("candidate-source-yaml").value);
      if (Boolean(currentSourceText.trim()) !== Boolean(candidateSourceText.trim())) throw new Error("Add both source renders, or leave both blank.");
      const currentSource = currentSourceText.trim() ? yamlTools.parseObjectSet(currentSourceText, "current-source.yaml") : null;
      const candidateSource = candidateSourceText.trim() ? yamlTools.parseObjectSet(candidateSourceText, "candidate-source.yaml") : null;
      const sourceRecord = parseRecord(byId("source-record").value);
      const comparison = yamlTools.compareObjectSets(current, candidate);
      const sourceAware = yamlTools.classifySourceAware(currentSource, current, candidateSource, candidate);
      const findings = inspectCandidate(candidate, comparison);
      const currentDigest = await sha256(currentText);
      const candidateDigest = await sha256(candidateText);
      const currentRecord = await objectSetRecord(current, currentDigest);
      const candidateRecord = await objectSetRecord(candidate, candidateDigest);
      const lifecycle = yamlTools.lifecycleFromRecord(sourceRecord, candidate);
      const destinations = destinationNames();
      const destinationPreflight = yamlTools.destinationPreflight(candidate, lifecycle, destinations);
      const targetResults = yamlTools.parseTargetResults(
        byId("target-results").value,
        destinations.length ? destinations : ["staging"],
        candidateRecord.objectSetSha256,
      );
      const assessment = assessmentForPromotion(sourceAware, destinationPreflight, targetResults);
      const sameIdentities = comparison.added.length === 0 && comparison.removed.length === 0;
      const whatChanges = [`${comparison.added.length} object(s) added, ${comparison.removed.length} removed, and ${comparison.changed.length} changed.`];
      if (comparison.changed.length) whatChanges.push("Changed objects include " + comparison.changed.slice(0, 5).join(", ") + (comparison.changed.length > 5 ? ", and others." : "."));
      if (comparison.noOp.length) whatChanges.push(`${comparison.noOp.length} object(s) differ only in formatting, comments, or key order and are hidden as no-ops.`);

      const whatStays = [sameIdentities ? `The same ${candidate.objects.length} Kubernetes object identities remain in the proposed configuration.` : `${comparison.unchanged.length} object(s) are semantically unchanged.`];
      const testsRequired = [...findings];
      if (sourceAware.status !== "compared") testsRequired.push("Add both source renders if you need to separate chart or values changes from post-render edits.");
      if (sourceAware.status === "compared" && sourceAware.counts.overlaps) testsRequired.push(`Review ${sourceAware.counts.overlaps} field overlap(s) where the source and a later edit both changed the result.`);
      for (const requirement of lifecycle.requirements) {
        const category = requirement.category === "secret" ? "Secret" : requirement.category || "setup item";
        const when = requirement.requiredBefore === "apply" ? "before apply" : `before ${requirement.requiredBefore || "deployment"}`;
        testsRequired.push(`Provide or check ${category} ${requirement.name || "from the source record"} ${when}.`);
      }
      for (const route of lifecycle.routes) testsRequired.push(`Confirm route ${route.id || route.name || "from the source record"} has evidence for this exact destination and delivery path.`);
      if (targetResults.overall !== "pass") testsRequired.push("Complete every named target result for the proposed digest. Do not turn a partial fleet into a global pass.");

      if (isExample) {
        const currentVersions = uniqueMatches(currentText, /app\.kubernetes\.io\/version:\s*([^\s#]+)/g);
        const candidateVersions = uniqueMatches(candidateText, /app\.kubernetes\.io\/version:\s*([^\s#]+)/g);
        const currentReplicas = workloadReplica(currentText, "redis-replicas");
        const candidateReplicas = workloadReplica(candidateText, "redis-replicas");
        whatChanges.push(`The Redis application label moves from ${currentVersions.join(", ")} to ${candidateVersions.join(", ")}.`);
        if (currentReplicas === 2 && candidateReplicas === 2) whatStays.push("The post-render replica change stays at 2 instead of returning to the chart preset's 3.");
        if (/secretName:\s*redis-existing-secret/.test(candidateText) && !candidate.objects.some((object) => object.kind === "Secret")) whatStays.push("The package still refers to the external Secret redis-existing-secret and does not include its password.");
        testsRequired.push(
          "Provide redis/redis-existing-secret before deployment; the proposed configuration does not contain the credential.",
          "Run the proposed digest in staging and check both StatefulSets, two replicas, and a Redis PONG.",
          "Test rollback as desired configuration. Do not assume it reverses database data or an irreversible migration.",
        );
      } else {
        testsRequired.push(`Run the proposed digest in ${destinations.join(", ") || "a non-production environment"} and check admission, rollout, application health, and rollback before production.`);
      }

      const invalid = current.objects.some((object) => !object.valid) || candidate.objects.some((object) => !object.valid) || current.duplicates.length || candidate.duplicates.length;
      const status = invalid ? "Fix the YAML first" : targetResults.overall === "blocked" ? "Blocked on a target result" : `Ready to test${destinations.length ? ` in ${destinations.join(", ")}` : ""}`;
      const nextAction = isExample
        ? "Preview the ConfigHub source refresh, then run the exact proposed digest in staging. The linked receipt shows this Redis pair passing a two-cluster rollout and desired-configuration rollback; it does not prove your targets."
        : `Run the listed tests in ${destinations.join(", ") || "a non-production environment"}. Keep the proposed digest with every result, then move that exact candidate rather than rendering it again.`;

      latestReview = {
        apiVersion: "workshop.confighub.com/v1alpha2",
        kind: "PromotionReview",
        metadata: { createdAt: new Date().toISOString() },
        spec: {
          change: { type: byId("change-type").value, destinations, example: isExample ? "bitnami-redis-25.5.3-to-27.0.0" : "" },
          current: currentRecord,
          candidate: candidateRecord,
          comparison,
          assessment,
          sourceAware: {
            ...sourceAware,
            ...(currentSource ? { currentSource: await objectSetRecord(currentSource, await sha256(currentSourceText)) } : {}),
            ...(candidateSource ? { candidateSource: await objectSetRecord(candidateSource, await sha256(candidateSourceText)) } : {}),
          },
          lifecycle,
          destinationPreflight,
          targets: targetResults,
          browserChecks: {
            method: "config-workshop-promotion-browser-v2",
            scope: "Parsed Kubernetes objects, semantic object comparison, optional four-way field classification, lifecycle record indexing, and target-result digest checks in this browser.",
            sourceRecord: sourceRecord?.metadata?.name || "not supplied",
            notChecked: [
              "Helm, AICR, or source-tool execution",
              "Kubernetes schema and admission behavior",
              "hook execution and CRD establishment",
              "application health, data migration, and rollback",
              "ConfigHub writes, approvals, release publication, and live observations",
            ],
          },
          testsRequired: [...new Set(testsRequired)],
          nextAction,
          configHubPlan: {
            method: "variant-upload-refresh-then-variant-promote",
            candidateSha256: candidateDigest,
            candidateObjectSetSha256: candidateRecord.objectSetSha256,
            previewRequired: true,
          },
        },
      };
      latestReviewJson = JSON.stringify(latestReview, null, 2) + "\n";
      latestCurrent = currentText;
      latestCandidate = candidateText;

      byId("promotion-status").textContent = status;
      byId("promotion-counts").textContent = `${comparison.added.length} added · ${comparison.removed.length} removed · ${comparison.changed.length} changed · ${comparison.unchanged.length} unchanged · ${comparison.noOp.length} no-op`;
      byId("promotion-exact-answer").textContent = `${candidate.name}: ${candidate.objects.length} Kubernetes objects at ${candidateRecord.objectSetSha256}.`;
      byId("promotion-stage-answer").textContent = destinations.length
        ? destinations.join(" → ")
        : "No destination named. Test the candidate in a non-production environment first.";
      const requiredTestCount = latestReview.spec.testsRequired.length;
      byId("promotion-blocker-answer").textContent = invalid
        ? "Fix invalid or duplicate Kubernetes objects before testing the change."
        : targetResults.overall === "blocked"
          ? `At least one target is blocked. ${requiredTestCount} checks or tests remain in the review.`
          : `${requiredTestCount} checks or tests remain in the review. The browser comparison is not permission to deploy.`;
      byId("promotion-current-answer").textContent = targetResults.counts.pass === 0
        && targetResults.counts.watch === 0
        && targetResults.counts.blocked === 0
        ? `No target result has been supplied for ${candidateRecord.objectSetSha256}.`
        : `${targetResults.overall}: ${targetResults.counts.pass} pass, ${targetResults.counts.watch} watch, ${targetResults.counts.blocked} blocked, ${targetResults.counts["not-run"]} not run.`;
      byId("current-digest").textContent = currentDigest;
      byId("candidate-digest").textContent = candidateDigest;
      addList("what-changes", whatChanges, "No object changes were found.");
      addList("what-stays", whatStays, "No unchanged object was found.");
      addList(
        "destination-preflight",
        destinationPreflight.checks.map((check) => `${check.status}: ${check.note}`),
        "No destination preflight result is available.",
      );
      renderSourceAware(sourceAware, comparison.noOp);
      addList("lifecycle-work", lifecycleLines(lifecycle), "No lifecycle work was found.");
      addList("tests-required", [...new Set(testsRequired)], "Run a staging deployment and application health check.");
      renderTargets(targetResults);
      addList("next-actions", [nextAction], "Review the result before it moves.");
      byId("promotion-review-output").value = latestReviewJson;
      byId("ai-promotion-prompt").value = buildAiPrompt(latestReview);
      setConfigHubCommands(latestReview);
      byId("promotion-result").hidden = false;
      if (!autoLoading) byId("promotion-result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      window.alert(`Could not compare these files: ${error.message}`);
    }
  }

  function compareVersions(left, right) {
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  }

  async function fetchCatalogObjects(record) {
    const objectPath = record?.spec?.configuration?.objects;
    if (!objectPath) return "";
    const response = await fetch(`../${objectPath}`);
    return response.ok ? response.text() : "";
  }

  async function loadCatalogContext(chart, version, base, requestedCandidateVersion) {
    try {
      const response = await fetch("./base-variant-records.json");
      if (!response.ok) return;
      const payload = await response.json();
      const matching = payload.records.filter((item) => item.spec?.source?.name === chart && item.spec?.baseVariant?.name === base);
      const currentRecord = matching.find((item) => item.spec?.source?.version === version);
      if (!currentRecord) return;
      const candidateRecord = requestedCandidateVersion
        ? matching.find((item) => item.spec?.source?.version === requestedCandidateVersion)
        : matching
            .filter((item) => compareVersions(item.spec?.source?.version, version) > 0)
            .sort((left, right) => compareVersions(left.spec.source.version, right.spec.source.version))[0];
      const currentYaml = await fetchCatalogObjects(currentRecord);
      if (!currentYaml) return;
      byId("current-source-yaml").value = currentYaml;
      byId("current-yaml").value = currentYaml;
      byId("current-label").value = `${chart}@${version} ${base}`;
      byId("source-record").value = JSON.stringify(candidateRecord || currentRecord, null, 2);
      if (!candidateRecord) return;
      const candidateYaml = await fetchCatalogObjects(candidateRecord);
      if (!candidateYaml) return;
      const candidateVersion = candidateRecord.spec.source.version;
      byId("candidate-source-yaml").value = candidateYaml;
      byId("candidate-yaml").value = candidateYaml;
      byId("candidate-label").value = `${chart}@${candidateVersion} ${base}`;
      byId("destination").value ||= "staging";
      byId("promotion-context-text").textContent = `You are comparing ${chart}@${version} with the next retained ${base} configuration, ${candidateVersion}.`;
      autoLoading = true;
      await comparePromotion(false);
      autoLoading = false;
    } catch {
      // file:// previews cannot fetch the companion index. Manual inputs still work.
    }
  }

  async function applyUrlContext() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "check") {
      try {
        const reviewed = sessionStorage.getItem("config-workshop-reviewed-candidate") || "";
        const sourceRecord = sessionStorage.getItem("config-workshop-source-record") || "";
        if (reviewed) {
          byId("current-yaml").value = reviewed;
          byId("current-label").value = "reviewed candidate from Check my config";
          byId("promotion-context").hidden = false;
          byId("promotion-context-text").textContent = "Your reviewed configuration is loaded as the current state. Add the proposed next version or environment below.";
          byId("promotion-intro-detail").textContent = "The comparison runs in your browser. Your files are not uploaded, and you do not need an account. Add the next rendered configuration below, then compare it with the result you already reviewed.";
          byId("promotion-inputs-title").textContent = "1. Add the next configuration";
          byId("promotion-boundary").textContent = "2. What this page can decide";
        }
        if (sourceRecord) byId("source-record").value = sourceRecord;
      } catch {
        // Browser storage is optional; manual inputs remain available.
      }
    }
    const chart = (params.get("chart") || "").trim().slice(0, 160);
    const version = (params.get("current") || params.get("version") || "").trim().slice(0, 80);
    const candidateVersion = (params.get("candidate") || "").trim().slice(0, 80);
    const base = (params.get("base") || "").trim().slice(0, 80);
    if (!chart) return;
    byId("promotion-context").hidden = false;
    byId("promotion-context-text").textContent = `You are planning a change for ${chart}${version ? `@${version}` : ""}${base ? ` (${base})` : ""}.`;
    byId("current-label").value = `${chart}${version ? `@${version}` : ""}${base ? ` ${base}` : ""}`;
    const component = safeSlug(chart.split("/").pop(), "component");
    byId("confighub-component").value = component;
    byId("confighub-base-space").value = `${component}-base`;
    if (version && base) await loadCatalogContext(chart, version, base, candidateVersion);
  }

  let autoLoading = false;

  async function loadRedisExample() {
    byId("change-type").value = "upgrade";
    byId("current-label").value = "bitnami/redis@25.5.3 reuse-existing-secret, replicas 2";
    byId("candidate-label").value = "bitnami/redis@27.0.0 reuse-existing-secret, replicas 2";
    byId("destination").value = "staging\nproduction-wave-1\nproduction-wave-2";
    byId("current-source-yaml").value = example.currentSourceYaml;
    byId("current-yaml").value = example.currentYaml;
    byId("candidate-source-yaml").value = example.candidateSourceYaml;
    byId("candidate-yaml").value = example.candidateYaml;
    byId("source-record").value = JSON.stringify(example.sourceRecord, null, 2);
    byId("target-results").value = "staging | not-run | Run the proposed digest here first |\nproduction-wave-1 | not-run | Wait for staging |\nproduction-wave-2 | not-run | Wait for wave 1 |";
    byId("confighub-component").value = "redis";
    byId("confighub-base-space").value = "redis-base";
    byId("confighub-destination-spaces").value = "redis-development, redis-staging";
    byId("example-note").hidden = false;
    await comparePromotion(true);
  }

  byId("load-redis-promotion").addEventListener("click", loadRedisExample);
  byId("use-own-yaml").addEventListener("click", () => byId("promotion-inputs").scrollIntoView({ behavior: "smooth", block: "start" }));
  byId("current-file").addEventListener("change", () => loadFile("current-file", "current-yaml", "current-label"));
  byId("candidate-file").addEventListener("change", () => loadFile("candidate-file", "candidate-yaml", "candidate-label"));
  byId("current-source-file").addEventListener("change", () => loadFile("current-source-file", "current-source-yaml"));
  byId("candidate-source-file").addEventListener("change", () => loadFile("candidate-source-file", "candidate-source-yaml"));
  byId("source-record-file").addEventListener("change", () => loadFile("source-record-file", "source-record"));
  byId("compare-promotion").addEventListener("click", () => { byId("example-note").hidden = true; comparePromotion(false); });
  byId("download-promotion-review").addEventListener("click", () => latestReviewJson && download("promotion-review.json", latestReviewJson, "application/json"));
  byId("download-promotion-current").addEventListener("click", () => latestCurrent && download("current.yaml", latestCurrent, "application/yaml"));
  byId("download-promotion-candidate").addEventListener("click", () => latestCandidate && download("candidate.yaml", latestCandidate, "application/yaml"));
  byId("copy-ai-promotion").addEventListener("click", () => copyText(byId("ai-promotion-prompt").value, "ai-promotion-copy-status"));
  byId("copy-confighub-preview").addEventListener("click", () => copyText(byId("confighub-promotion-preview").value, "confighub-preview-copy-status"));
  byId("copy-confighub-run").addEventListener("click", () => copyText(byId("confighub-promotion-run").value, "confighub-run-copy-status"));
  for (const id of ["confighub-component", "confighub-base-space", "confighub-granularity", "confighub-namespace", "confighub-destination-spaces"]) {
    byId(id).addEventListener("input", () => {
      if (latestReview) setConfigHubCommands(latestReview);
    });
  }

  applyUrlContext().then(async () => {
    if (!new URLSearchParams(window.location.search).get("chart") && !byId("current-yaml").value && !byId("candidate-yaml").value) {
      autoLoading = true;
      await loadRedisExample();
      autoLoading = false;
    }
  });
})();
