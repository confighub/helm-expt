(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const exampleNode = byId("promotion-example-data");
  if (!exampleNode) return;

  const example = JSON.parse(exampleNode.textContent);
  let latestReview = null;
  let latestReviewJson = "";
  let latestCurrent = "";
  let latestCandidate = "";

  function canonicalFileText(text) {
    return text.replaceAll("\r\n", "\n");
  }

  function splitDocuments(text) {
    return text
      .replaceAll("\r\n", "\n")
      .split(/^---\s*$/m)
      .map((document) => document.trim())
      .filter((document) => document && !/^\.\.\.\s*$/.test(document));
  }

  function unquote(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  function topLevelValue(document, key) {
    const match = document.match(new RegExp("^" + key + ":\\s*(.+?)\\s*$", "m"));
    return match ? unquote(match[1].replace(/\s+#.*$/, "")) : "";
  }

  function metadataValue(document, key) {
    const lines = document.split("\n");
    let metadataIndent = -1;
    for (const line of lines) {
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;
      if (metadataIndent < 0 && /^metadata:\s*(?:#.*)?$/.test(trimmed)) {
        metadataIndent = indent;
        continue;
      }
      if (metadataIndent < 0) continue;
      if (trimmed && !trimmed.startsWith("#") && indent <= metadataIndent) break;
      const match = trimmed.match(new RegExp("^" + key + ":\\s*(.+?)\\s*$"));
      if (match && indent > metadataIndent) return unquote(match[1].replace(/\s+#.*$/, ""));
    }
    return "";
  }

  function normalizeDocument(document) {
    return document
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""))
      .filter((line) => !/^\s*#/.test(line))
      .join("\n")
      .trim();
  }

  function parseObjectSet(text, name) {
    const objects = splitDocuments(text).map((document, index) => {
      const apiVersion = topLevelValue(document, "apiVersion") || "unknown-api";
      const kind = topLevelValue(document, "kind") || "Unknown";
      const objectName = metadataValue(document, "name") || "document-" + (index + 1);
      const namespace = metadataValue(document, "namespace") || "_cluster";
      return {
        apiVersion,
        kind,
        name: objectName,
        namespace,
        ref: kind + "/" + namespace + "/" + objectName,
        valid: apiVersion !== "unknown-api" && kind !== "Unknown" && !objectName.startsWith("document-"),
        document,
        normalized: normalizeDocument(document),
      };
    });
    const counts = new Map();
    for (const object of objects) counts.set(object.ref, (counts.get(object.ref) || 0) + 1);
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([ref]) => ref).sort();
    return { name, text, objects, duplicates };
  }

  function compareObjectSets(current, candidate) {
    const before = new Map(current.objects.map((object) => [object.ref, object]));
    const after = new Map(candidate.objects.map((object) => [object.ref, object]));
    return {
      added: [...after.keys()].filter((ref) => !before.has(ref)).sort(),
      removed: [...before.keys()].filter((ref) => !after.has(ref)).sort(),
      changed: [...after.keys()].filter((ref) => before.has(ref) && after.get(ref).normalized !== before.get(ref).normalized).sort(),
      unchanged: [...after.keys()].filter((ref) => before.has(ref) && after.get(ref).normalized === before.get(ref).normalized).sort(),
    };
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return "sha256:" + [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function uniqueMatches(text, expression, group = 1) {
    return [...new Set([...text.matchAll(expression)].map((match) => match[group]))].sort();
  }

  function workloadReplica(text, name) {
    const object = splitDocuments(text).find((document) =>
      /^kind:\s*StatefulSet\s*$/m.test(document) && new RegExp("^  name:\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m").test(document));
    const match = object?.match(/^  replicas:\s*(\d+)\s*$/m);
    return match ? Number(match[1]) : null;
  }

  function inspectCandidate(candidate, comparison) {
    const findings = [];
    const text = candidate.text;
    if (candidate.objects.some((object) => !object.valid)) findings.push("At least one YAML document is not a complete Kubernetes object.");
    if (candidate.duplicates.length) findings.push("The candidate contains duplicate object identities: " + candidate.duplicates.slice(0, 3).join(", ") + (candidate.duplicates.length > 3 ? "." : ""));
    if (candidate.objects.some((object) => object.kind === "Secret")) findings.push("The candidate contains a Secret. Confirm how credentials will be supplied before it moves.");
    if (candidate.objects.some((object) => object.kind === "CustomResourceDefinition")) findings.push("The candidate contains CRDs. Test CRD ordering and establishment before dependent objects.");
    if (/helm\.sh\/hook\s*:/i.test(text)) findings.push("The candidate contains a Helm hook annotation. Decide who runs that lifecycle step and in which order.");
    if (comparison.removed.length) findings.push("The candidate removes objects. Test pruning, retained state, and rollback before promotion.");
    if (comparison.changed.some((ref) => /StatefulSet/.test(ref))) findings.push("A StatefulSet changes. Test storage, rollout, and application readiness in staging.");
    if (/\b(?:change[-_ ]?me|replace[-_ ]?me|dummy|example-password)\b/i.test(text)) findings.push("The candidate may still contain an example or placeholder value.");
    const unpinned = uniqueMatches(text, /^\s*image:\s*([^\s#]+).*$/gm).filter((image) => !/@sha256:[0-9a-f]{64}$/i.test(image));
    if (unpinned.length) findings.push("Some container images are not pinned by digest: " + unpinned.slice(0, 3).join(", ") + (unpinned.length > 3 ? "." : ""));
    return findings;
  }

  function addList(id, items, fallback) {
    const node = byId(id);
    node.replaceChildren();
    const values = items.length ? items : [fallback];
    for (const value of values) {
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

  async function loadFile(inputId, textareaId, labelId) {
    const file = byId(inputId).files && byId(inputId).files[0];
    if (!file) return;
    byId(textareaId).value = await file.text();
    byId(labelId).value = file.name;
  }

  function applyUrlContext() {
    const params = new URLSearchParams(window.location.search);
    const chart = (params.get("chart") || "").trim().slice(0, 160);
    const version = (params.get("current") || params.get("version") || "").trim().slice(0, 80);
    const base = (params.get("base") || "").trim().slice(0, 80);
    if (!chart) return;
    byId("promotion-context").hidden = false;
    byId("promotion-context-text").textContent = "You are planning a change for " + chart + (version ? "@" + version : "") + (base ? " (" + base + ")" : "") + ".";
    byId("current-label").value = chart + (version ? "@" + version : "") + (base ? " " + base : "");
  }

  let autoLoading = false;

  function loadRedisExample() {
    byId("change-type").value = "upgrade";
    byId("current-label").value = "bitnami/redis@25.5.3 reuse-existing-secret, replicas 2";
    byId("candidate-label").value = "bitnami/redis@27.0.0 reuse-existing-secret, replicas 2";
    byId("destination").value = "staging";
    byId("current-yaml").value = example.currentYaml;
    byId("candidate-yaml").value = example.candidateYaml;
    byId("example-note").hidden = false;
    comparePromotion(true);
  }

  function buildAiPrompt(review) {
    const tests = review.spec.testsRequired.map((test) => "- " + test).join("\n");
    return [
      "I am reviewing one configuration promotion.",
      "",
      "Current file: current.yaml (" + review.spec.current.sha256 + ")",
      "Candidate file: candidate.yaml (" + review.spec.candidate.sha256 + ")",
      "Destination: " + review.spec.change.destination,
      "",
      "Read both files locally. Do not upload them or change them in place.",
      "Confirm both SHA-256 values before using the review.",
      "Explain the added, removed, and changed Kubernetes objects in plain English.",
      "Check immutable fields, storage, Secrets, CRDs, hooks, pruning, rollback, and application-specific migrations.",
      "Do not call the change safe when a listed test has not run.",
      "Write any proposed correction to a new candidate file and show me the exact diff.",
      "",
      "Tests still required:",
      tests,
    ].join("\n");
  }

  async function comparePromotion(isExample = false) {
    const currentText = canonicalFileText(byId("current-yaml").value);
    const candidateText = canonicalFileText(byId("candidate-yaml").value);
    if (!currentText.trim() || !candidateText.trim()) {
      window.alert("Add both the current and proposed Kubernetes YAML.");
      return;
    }

    const current = parseObjectSet(currentText, byId("current-label").value.trim() || "current.yaml");
    const candidate = parseObjectSet(candidateText, byId("candidate-label").value.trim() || "candidate.yaml");
    if (!current.objects.length || !candidate.objects.length) {
      window.alert("Both inputs must contain at least one Kubernetes YAML document.");
      return;
    }

    const comparison = compareObjectSets(current, candidate);
    const findings = inspectCandidate(candidate, comparison);
    const destination = byId("destination").value.trim();
    const currentDigest = await sha256(currentText);
    const candidateDigest = await sha256(candidateText);
    const sameIdentities = comparison.added.length === 0 && comparison.removed.length === 0;
    const whatChanges = [
      comparison.added.length + " object(s) added, " + comparison.removed.length + " removed, and " + comparison.changed.length + " changed.",
    ];
    if (comparison.changed.length) whatChanges.push("Changed objects include " + comparison.changed.slice(0, 5).join(", ") + (comparison.changed.length > 5 ? ", and others." : "."));

    const whatStays = [
      sameIdentities
        ? "The same " + candidate.objects.length + " Kubernetes object identities remain in the candidate."
        : comparison.unchanged.length + " object(s) are byte-for-byte unchanged after comments and trailing spaces are ignored.",
    ];
    const testsRequired = [...findings];

    if (isExample) {
      const currentVersions = uniqueMatches(currentText, /app\.kubernetes\.io\/version:\s*([^\s#]+)/g);
      const candidateVersions = uniqueMatches(candidateText, /app\.kubernetes\.io\/version:\s*([^\s#]+)/g);
      const currentReplicas = workloadReplica(currentText, "redis-replicas");
      const candidateReplicas = workloadReplica(candidateText, "redis-replicas");
      whatChanges.push("The Redis application label moves from " + currentVersions.join(", ") + " to " + candidateVersions.join(", ") + ".");
      if (currentReplicas === 2 && candidateReplicas === 2) whatStays.push("The recorded replica change stays at 2 instead of returning to the chart default of 3.");
      if (/secretName:\s*redis-existing-secret/.test(candidateText) && !candidate.objects.some((object) => object.kind === "Secret")) {
        whatStays.push("The package still refers to the external Secret redis-existing-secret and does not include its password.");
      }
      const currentImages = uniqueMatches(currentText, /^\s*image:\s*([^\s#]+).*$/gm);
      const candidateImages = uniqueMatches(candidateText, /^\s*image:\s*([^\s#]+).*$/gm);
      if (JSON.stringify(currentImages) === JSON.stringify(candidateImages)) whatStays.push("The digest-pinned Redis image in this recorded pair does not change.");
      testsRequired.push(
        "Provide redis/redis-existing-secret before deployment; the candidate does not contain the credential.",
        "Run the candidate in staging and check both StatefulSets, two replicas, and a Redis PONG.",
        "Test the rollback as desired configuration. Do not assume it reverses database data or an irreversible migration.",
      );
    } else {
      testsRequired.push("Run the candidate in " + (destination || "a non-production environment") + " and check admission, rollout, application health, and rollback before production.");
    }

    const status = current.objects.some((object) => !object.valid) || candidate.objects.some((object) => !object.valid) || current.duplicates.length || candidate.duplicates.length
      ? "Fix the YAML first"
      : destination
        ? "Ready to test in " + destination
        : "Ready for testing";
    const nextAction = isExample
      ? "Use a staging environment first. The linked receipt shows this exact Redis version pair passing promotion, two-cluster rollout, and desired-configuration rollback."
      : "Run the listed tests in " + (destination || "a non-production environment") + ". Keep the candidate digest with the result, then promote that exact candidate rather than rendering it again.";

    latestReview = {
      apiVersion: "workshop.confighub.com/v1alpha1",
      kind: "PromotionReview",
      metadata: { createdAt: new Date().toISOString() },
      spec: {
        change: {
          type: byId("change-type").value,
          destination: destination || "not supplied",
          example: isExample ? "bitnami-redis-25.5.3-to-27.0.0" : "",
        },
        current: {
          name: current.name,
          sha256: currentDigest,
          objectCount: current.objects.length,
          objects: current.objects.map((object) => object.ref).sort(),
        },
        candidate: {
          name: candidate.name,
          sha256: candidateDigest,
          objectCount: candidate.objects.length,
          objects: candidate.objects.map((object) => object.ref).sort(),
        },
        comparison,
        browserChecks: {
          method: "config-workshop-promotion-browser-v1",
          scope: "Object identity, exact document comparison, and selected manifest checks in this browser.",
        },
        testsRequired: [...new Set(testsRequired)],
        nextAction,
      },
    };
    latestReviewJson = JSON.stringify(latestReview, null, 2) + "\n";
    latestCurrent = currentText;
    latestCandidate = candidateText;

    byId("promotion-status").textContent = status;
    byId("promotion-counts").textContent = comparison.added.length + " added · " + comparison.removed.length + " removed · " + comparison.changed.length + " changed · " + comparison.unchanged.length + " unchanged";
    byId("current-digest").textContent = currentDigest;
    byId("candidate-digest").textContent = candidateDigest;
    addList("what-changes", whatChanges, "No object changes were found.");
    addList("what-stays", whatStays, "No unchanged object was found.");
    addList("tests-required", [...new Set(testsRequired)], "Run a staging deployment and application health check.");
    addList("next-actions", [nextAction], "Review the result before it moves.");
    byId("promotion-review-output").value = latestReviewJson;
    byId("ai-promotion-prompt").value = buildAiPrompt(latestReview);
    byId("promotion-result").hidden = false;
    if (!autoLoading) byId("promotion-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  byId("load-redis-promotion").addEventListener("click", loadRedisExample);
  byId("use-own-yaml").addEventListener("click", () => byId("promotion-inputs").scrollIntoView({ behavior: "smooth", block: "start" }));
  byId("current-file").addEventListener("change", () => loadFile("current-file", "current-yaml", "current-label"));
  byId("candidate-file").addEventListener("change", () => loadFile("candidate-file", "candidate-yaml", "candidate-label"));
  byId("compare-promotion").addEventListener("click", () => { byId("example-note").hidden = true; comparePromotion(false); });
  byId("download-promotion-review").addEventListener("click", () => latestReviewJson && download("promotion-review.json", latestReviewJson, "application/json"));
  byId("download-promotion-current").addEventListener("click", () => latestCurrent && download("current.yaml", latestCurrent, "application/yaml"));
  byId("download-promotion-candidate").addEventListener("click", () => latestCandidate && download("candidate.yaml", latestCandidate, "application/yaml"));
  byId("copy-ai-promotion").addEventListener("click", () => copyText(byId("ai-promotion-prompt").value, "ai-promotion-copy-status"));
  applyUrlContext();
  // The proof is the first screen: with no chart context and nothing pasted,
  // the Redis upgrade review renders itself so a visitor sees a finished
  // answer before deciding whether to paste anything.
  if (!new URLSearchParams(window.location.search).get("chart") && !byId("current-yaml").value && !byId("candidate-yaml").value) {
    autoLoading = true;
    loadRedisExample();
    autoLoading = false;
  }
})();
