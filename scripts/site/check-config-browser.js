(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const questionData = byId("configuration-question-data");
  const settingsData = byId("configuration-check-settings");
  if (!questionData || !settingsData) return;

  const questions = JSON.parse(questionData.textContent);
  const settings = JSON.parse(settingsData.textContent);
  const comparisonInstructions = {
    none: "No existing configuration was supplied. Keep the result candidate-only and do not imply that a comparison ran.",
    "chart-version": "Render the stated comparison version with the same release name, namespace, values, capabilities, hook policy, and CRD policy as the candidate.",
    "helm-release": "Capture the installed release with helm status, helm get values -a, helm get manifest, helm get hooks, helm history, and Helm's stored release Secret. Treat the output as sensitive.",
    "local-files": "Read the stated local YAML files. Record their paths and calculate a digest before comparing them.",
    oci: "Pull the stated OCI reference. Record its immutable digest, extract the Kubernetes objects locally, and calculate their object-set digest.",
    git: "Read the stated Git revision and path without changing the working tree. Record the commit and calculate a digest of the selected Kubernetes objects.",
    "live-cluster": "Use the stated kubectl context and namespace. Record the exact object selection and keep live state separate from Helm's release record and desired configuration.",
  };
  const exampleCandidate = [
    "apiVersion: apps/v1",
    "kind: Deployment",
    "metadata:",
    "  name: ai-written-nginx",
    "spec:",
    "  replicas: 3",
    "  selector:",
    "    matchLabels:",
    "      app: ai-written-nginx",
    "  template:",
    "    metadata:",
    "      labels:",
    "        app: ai-written-nginx",
    "    spec:",
    "      containers:",
    "        - name: nginx",
    "          image: nginx:latest",
    "          securityContext:",
    "            privileged: true",
  ].join("\n");
  const exampleComparison = [
    "apiVersion: apps/v1",
    "kind: Deployment",
    "metadata:",
    "  name: ai-written-nginx",
    "spec:",
    "  replicas: 1",
    "  selector:",
    "    matchLabels:",
    "      app: ai-written-nginx",
    "  template:",
    "    metadata:",
    "      labels:",
    "        app: ai-written-nginx",
    "    spec:",
    "      containers:",
    "        - name: nginx",
    "          image: nginx:1.27.5",
    "          securityContext:",
    "            runAsNonRoot: true",
  ].join("\n");

  let latestReview = null;
  let latestReviewJson = "";
  let latestCandidate = "";
  let latestReviewDigest = "";

  function selectedQuestion() {
    return questions[byId("question-type").value];
  }

  async function loadExample() {
    byId("question-type").value = "ai-values";
    byId("question").value = "AI changed this workload. What matters before I deploy it?";
    byId("chart").value = "bitnami/nginx";
    byId("version").value = "24.0.2";
    byId("values-summary").value = "The candidate increases replicas, changes the image tag, and enables privileged mode.";
    byId("source-visibility").value = "public";
    byId("source-type").value = "helm";
    byId("source-reference").value = "bitnami/nginx@24.0.2 example";
    byId("candidate-name").value = "candidate.yaml";
    byId("candidate-yaml").value = exampleCandidate;
    byId("comparison-name").value = "catalog-starting-point.yaml";
    byId("comparison-yaml").value = exampleComparison;
    byId("assistant-finding").value = "Example: the candidate changes one Deployment, uses an unpinned image tag, and requests privileged mode.";
    await runBrowserCheck();
  }

  function applyQuestionHash() {
    const code = window.location.hash.slice(1);
    if (!questions[code]) return;
    byId("question-type").value = code;
    byId("build-prompt").scrollIntoView({ block: "start" });
  }

  function sourceIdentity() {
    const chart = byId("chart").value.trim();
    const sourceRef = byId("source-reference").value.trim();
    return sourceRef || chart || "unknown source";
  }

  function buildPrompt() {
    const code = byId("question-type").value;
    const item = selectedQuestion();
    const question = byId("question").value.trim() || item.label;
    const chart = byId("chart").value.trim() || "<repo/chart>";
    const version = byId("version").value.trim() || "<exact version or version pair>";
    const release = byId("release").value.trim();
    const namespace = byId("namespace").value.trim();
    const comparisonSource = byId("comparison-source").value;
    const comparisonLabel = byId("comparison-source").selectedOptions[0].textContent;
    const comparisonReference = byId("comparison-reference").value.trim();
    const visibility = byId("source-visibility").value;
    const values = byId("values-summary").value.trim() || "<none supplied>";
    const privacy = visibility === "private"
      ? "This source is private. Do not upload it, quote private values, or open a public issue."
      : "This is a public chart. Ask before opening any public issue.";
    const prompt = [
      "I need help checking one Kubernetes configuration decision.",
      "",
      "Question code: " + code,
      "Question: " + question,
      "Chart: " + chart,
      "Version: " + version,
      "Existing release: " + (release || "<none supplied>"),
      "Existing namespace: " + (namespace || "<none supplied>"),
      "Compare with: " + comparisonLabel,
      "Existing configuration reference: " + (comparisonReference || "<none supplied>"),
      "Values, flags, or symptoms (secrets removed): " + values,
      "Privacy: " + privacy,
      "",
      "Work locally. Use Helm and ordinary shell tools. Use cub installer only when an exact Config Workshop package exists. Do not upload my chart, values, or existing configuration.",
      release && namespace
        ? "1. Capture the existing release locally with helm status, helm get values -a, helm get manifest, helm get hooks, helm history, and kubectl get secret -l owner=helm,name=" + release + ". Treat every output file as sensitive."
        : "1. No existing release context was supplied. State that release status, history, stored values, hooks, and live drift are unknown.",
      "2. Resolve the exact chart source and version. Record the chart digest and every render command.",
      "3. Render the candidate with the release name, namespace, values, capabilities, hooks, and CRD flags stated above. Also render the chart defaults when that comparison applies. If an input is missing, name it instead of guessing.",
      "4. " + comparisonInstructions[comparisonSource] + (comparisonSource === "none" ? "" : " If the reference is incomplete, name what is missing instead of guessing."),
      "5. " + item.instruction,
      release && namespace
        ? "6. Compare the candidate with Helm's recorded manifest and history. Check pending states, removed or renamed objects, immutable fields, storage, hooks, CRDs, release-record size, and the risk of reusing old values. Keep Helm's record separate from live cluster state."
        : "6. Do not claim upgrade, rollback, or live-state safety without an existing release capture.",
      "7. Fetch https://confighub.github.io/helm-expt/site/changes.schema.json and https://confighub.github.io/helm-expt/site/changes.json. Resolve the exact chart and version, including aliases. Missing or not_checked coverage means Config Workshop has not checked that claim.",
      "8. Cite the chart page and relevant evidence URLs for every retained historical or live claim. Keep your computed findings separate from retained evidence.",
      "9. Write the exact candidate objects to ./workshop-review/candidate.yaml. If a comparison ran, write its exact objects to ./workshop-review/comparison.yaml. Do not add secrets that were not already supplied.",
      "10. Recommend one next action: correct a value, make a reviewed object change, provide a prerequisite, choose a lifecycle route, compare with a Catalog entry, retain local files or OCI, submit a public Catalog candidate with my approval, or save the reviewed result in ConfigHub.",
      "",
      "Return this block at the end:",
      "WORKSHOP FINDING",
      "question_code: " + code,
      "question: " + question,
      "source: " + chart,
      "version: " + version,
      "render_digest: <sha256 or unknown>",
      "comparison: <source and exact identity, or none>",
      "comparison_digest: <sha256 or unknown>",
      "catalog_match: <exact, related, absent, or unknown>",
      "checked: <short list of checks that ran>",
      "not_checked: <important checks that did not run>",
      "findings: <short factual list>",
      "receipt_urls: <URLs actually used, or none>",
      "recommended_next_step: <one action>",
    ].join("\n");

    byId("prompt-output").value = prompt;
    byId("prompt-result").hidden = false;
    byId("catalog-lookup").href = "./charts/index.html?q=" + encodeURIComponent(chart.replace(/@.*$/, ""));
    byId("prompt-result").scrollIntoView({ behavior: "smooth", block: "start" });
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
    const documents = splitDocuments(text);
    const objects = documents.map((document, index) => {
      const apiVersion = topLevelValue(document, "apiVersion") || "unknown-api";
      const kind = topLevelValue(document, "kind") || "Unknown";
      const objectName = metadataValue(document, "name") || "document-" + (index + 1);
      const namespace = metadataValue(document, "namespace") || "_cluster";
      return {
        apiVersion,
        kind,
        name: objectName,
        namespace,
        hasRequiredIdentity: apiVersion !== "unknown-api" && kind !== "Unknown" && !objectName.startsWith("document-"),
        ref: kind + "/" + namespace + "/" + objectName,
        document,
        normalized: normalizeDocument(document),
      };
    });
    return { name, text, objects };
  }

  function addFinding(findings, seen, code, level, object, message) {
    const key = [code, object, message].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ code, level, object, message });
  }

  function inspectObjects(objectSet) {
    const findings = [];
    const seen = new Set();
    const refs = new Set();
    for (const object of objectSet.objects) {
      const text = object.document;
      if (!object.hasRequiredIdentity) addFinding(findings, seen, "invalid-object-identity", "warning", object.ref, "This document is missing apiVersion, kind, or metadata.name. It is not a complete Kubernetes object.");
      if (refs.has(object.ref)) addFinding(findings, seen, "duplicate-object", "review", object.ref, "This object identity appears more than once in the input.");
      refs.add(object.ref);
      if (object.kind === "Secret") addFinding(findings, seen, "secret-present", "review", object.ref, "A Secret is present. Confirm how its data is supplied and keep real credentials out of public records.");
      if (/\b(?:change[-_ ]?me|replace[-_ ]?me|dummy|sk-prod-old-key|example-password)\b/i.test(text)) addFinding(findings, seen, "placeholder-value", "warning", object.ref, "A placeholder or example credential may still be present.");
      for (const match of text.matchAll(/^\s*image:\s*([^\s#]+).*$/gm)) {
        const image = unquote(match[1]);
        if (!/@sha256:[0-9a-f]{64}$/i.test(image)) addFinding(findings, seen, "image-not-digest-pinned", "review", object.ref, "Image " + image + " is not pinned by digest.");
      }
      if (/^\s*privileged:\s*true\s*$/m.test(text)) addFinding(findings, seen, "privileged-container", "warning", object.ref, "A container requests privileged mode.");
      if (/^\s*allowPrivilegeEscalation:\s*true\s*$/m.test(text)) addFinding(findings, seen, "privilege-escalation", "warning", object.ref, "A container allows privilege escalation.");
      if (/^\s*runAsNonRoot:\s*false\s*$/m.test(text)) addFinding(findings, seen, "root-container", "review", object.ref, "A workload explicitly allows a root user.");
      if (/^\s*host(?:Network|PID|IPC):\s*true\s*$/m.test(text)) addFinding(findings, seen, "host-access", "warning", object.ref, "A workload requests host-level namespace access.");
      if (object.kind === "Service" && /^\s*type:\s*(?:LoadBalancer|NodePort)\s*$/m.test(text)) addFinding(findings, seen, "externally-exposed-service", "review", object.ref, "The Service may expose the workload outside the cluster.");
      if (["ClusterRole", "Role"].includes(object.kind) && /^\s*-?\s*['\"]?\*['\"]?\s*$/m.test(text)) addFinding(findings, seen, "broad-rbac", "review", object.ref, "The role contains a wildcard permission. Review its resources and verbs.");
      if (object.kind === "CustomResourceDefinition") addFinding(findings, seen, "crd-present", "information", object.ref, "A CRD is present. Install and establish it before dependent custom resources.");
      if (/helm\.sh\/hook\s*:/i.test(text)) addFinding(findings, seen, "helm-hook", "review", object.ref, "This object carries a Helm hook annotation. Record who will run it and in which order.");
      if (["Job", "CronJob"].includes(object.kind)) addFinding(findings, seen, "job-present", "information", object.ref, "A Job is present. Confirm whether it is an ordinary workload or lifecycle setup work.");
      if (["Deployment", "StatefulSet", "DaemonSet"].includes(object.kind) && /\bcontainers:\s*$/m.test(text)) {
        if (!/\b(?:readinessProbe|livenessProbe):\s*$/m.test(text)) addFinding(findings, seen, "probes-not-declared", "information", object.ref, "No readiness or liveness probe was found in this workload document.");
      }
    }
    return findings;
  }

  function compareObjectSets(candidate, comparison) {
    if (!comparison) return { status: "not-supplied" };
    const before = new Map(comparison.objects.map((object) => [object.ref, object]));
    const after = new Map(candidate.objects.map((object) => [object.ref, object]));
    const added = [...after.keys()].filter((ref) => !before.has(ref)).sort();
    const removed = [...before.keys()].filter((ref) => !after.has(ref)).sort();
    const changed = [...after.keys()].filter((ref) => before.has(ref) && after.get(ref).normalized !== before.get(ref).normalized).sort();
    return { status: "compared", added, removed, changed };
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text.replaceAll("\r\n", "\n"));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return "sha256:" + [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function objectSetRecord(objectSet, digest) {
    return {
      name: objectSet.name,
      sha256: digest,
      objectCount: objectSet.objects.length,
      objects: objectSet.objects.map((object) => object.ref).sort(),
    };
  }

  function safeSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "reviewed-config";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function findingList(findings) {
    if (!findings.length) return "<p>No finding was produced by the browser checks. This does not mean the configuration is safe or deployable.</p>";
    return "<ul>" + findings.map((finding) => "<li><strong>" + escapeHtml(finding.level) + ":</strong> " + escapeHtml(finding.message) + (finding.object ? " <code>" + escapeHtml(finding.object) + "</code>" : "") + "</li>").join("") + "</ul>";
  }

  function comparisonSummary(comparison) {
    if (comparison.status !== "compared") return "<p>No comparison object set was supplied.</p>";
    return "<p><strong>Added:</strong> " + comparison.added.length + " &middot; <strong>Removed:</strong> " + comparison.removed.length + " &middot; <strong>Changed:</strong> " + comparison.changed.length + "</p>" +
      (comparison.added.length ? "<p>Added: <code>" + comparison.added.map(escapeHtml).join("</code>, <code>") + "</code></p>" : "") +
      (comparison.removed.length ? "<p>Removed: <code>" + comparison.removed.map(escapeHtml).join("</code>, <code>") + "</code></p>" : "") +
      (comparison.changed.length ? "<p>Changed: <code>" + comparison.changed.map(escapeHtml).join("</code>, <code>") + "</code></p>" : "");
  }

  async function runBrowserCheck() {
    const candidateText = byId("candidate-yaml").value.trim();
    const comparisonText = byId("comparison-yaml").value.trim();
    if (!candidateText) {
      window.alert("Add the rendered candidate YAML first.");
      return;
    }
    const candidate = parseObjectSet(candidateText, byId("candidate-name").value.trim() || "candidate.yaml");
    if (!candidate.objects.length) {
      window.alert("No YAML documents were found in the candidate input.");
      return;
    }
    const comparisonSet = comparisonText ? parseObjectSet(comparisonText, byId("comparison-name").value.trim() || "comparison.yaml") : null;
    const comparison = compareObjectSets(candidate, comparisonSet);
    const findings = inspectObjects(candidate);
    const candidateDigest = await sha256(candidateText);
    const comparisonDigest = comparisonSet ? await sha256(comparisonText) : "";
    const code = byId("question-type").value;
    const item = selectedQuestion();
    const now = new Date().toISOString();
    const id = "review-" + candidateDigest.slice(7, 19);
    const chart = byId("chart").value.trim();
    const catalogUrl = new URL("charts/index.html", window.location.href);
    if (chart) catalogUrl.searchParams.set("q", chart.replace(/@.*$/, ""));
    latestReview = {
      apiVersion: "workshop.confighub.com/v1alpha1",
      kind: "ConfigurationReview",
      metadata: { id, createdAt: now },
      spec: {
        question: {
          code,
          text: byId("question").value.trim() || item.label,
        },
        source: {
          type: byId("source-type").value,
          visibility: byId("source-visibility").value,
          identity: sourceIdentity(),
          version: byId("version").value.trim(),
          valuesSummary: byId("values-summary").value.trim(),
        },
        candidate: objectSetRecord(candidate, candidateDigest),
        comparison: comparison.status === "compared"
          ? {
              status: "compared",
              objectSet: objectSetRecord(comparisonSet, comparisonDigest),
              added: comparison.added,
              removed: comparison.removed,
              changed: comparison.changed,
            }
          : { status: "not-supplied" },
        checks: {
          method: "config-workshop-browser-static-v1",
          scope: "Object inventory, selected manifest checks, and exact document comparison in this browser.",
          findings,
          notChecked: [
            "Helm template execution and values provenance",
            "Kubernetes schema and admission behavior",
            "hook execution and CRD establishment",
            "live workload health and drift",
            "database migrations and external services",
          ],
        },
        finding: byId("assistant-finding").value.trim(),
        recommendation: item.recommendation,
        catalog: { status: "not-looked-up", url: catalogUrl.href },
      },
    };
    latestReviewJson = JSON.stringify(latestReview, null, 2) + "\n";
    latestReviewDigest = await sha256(latestReviewJson);
    latestCandidate = candidateText;
    byId("browser-check-summary").innerHTML =
      "<p><strong>Candidate:</strong> " + candidate.objects.length + " objects &middot; <code>" + escapeHtml(candidateDigest) + "</code></p>" +
      comparisonSummary(comparison) +
      "<h3>Findings to review</h3>" + findingList(findings) +
      "<p><strong>Not checked:</strong> Helm rendering, schema and admission behavior, lifecycle execution, live health, and external effects.</p>";
    byId("review-record-output").value = latestReviewJson;
    byId("handoff-candidate-digest").textContent = candidateDigest;
    byId("review-result").hidden = false;
    buildHandoffCommands();
    byId("review-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildHandoffCommands() {
    if (!latestReview) return;
    const component = safeSlug(byId("component-slug").value || latestReview.spec.source.identity);
    const space = component + "-reviewed";
    const reviewUnit = "review-" + latestReviewDigest.slice(7, 19);
    const command = [
      "# Keep the reviewed objects and review record together in ConfigHub.",
      "cub auth login",
      "cub variant upload \\",
      "  --component " + component + " \\",
      "  --variant reviewed \\",
      "  --space " + space + " \\",
      "  --granularity per-resource \\",
      "  --change-desc \"Config Workshop " + latestReview.metadata.id + "\" \\",
      "  --annotation workshop.confighub.com/candidate-sha256=" + latestReview.spec.candidate.sha256 + " \\",
      "  --annotation workshop.confighub.com/review-sha256=" + latestReviewDigest + " \\",
      "  ./candidate.yaml",
      "",
      "# Provider None keeps this evidence Unit out of deployment releases.",
      "cub unit create --space " + space + " --allow-exists \\",
      "  --provider None --toolchain AppConfig/YAML \\",
      "  " + reviewUnit + " ./workshop-review.json",
    ].join("\n");
    byId("handoff-command").value = command;
    buildAiHandoffPrompt();
  }

  function buildAiHandoffPrompt() {
    if (!latestReview) return;
    const component = safeSlug(byId("component-slug").value || latestReview.spec.source.identity);
    const space = component + "-reviewed";
    const prompt = [
      "I have already checked a rendered Kubernetes configuration in Config Workshop.",
      "Help me retain that exact reviewed result in ConfigHub.",
      "",
      "The current directory contains:",
      "- candidate.yaml: the exact Kubernetes objects I accepted",
      "- workshop-review.json: the browser review record",
      "",
      "Do this:",
      "1. Read both files through the workspace you already have open. Treat them as private unless workshop-review.json explicitly says the source is public. Do not disclose them through another service or a public issue.",
      "2. Calculate the SHA-256 of candidate.yaml and confirm that it matches spec.candidate.sha256 in workshop-review.json. The expected SHA-256 of workshop-review.json is " + latestReviewDigest + ". Stop if either digest differs.",
      "3. Summarize the recorded findings and the checks listed under spec.checks.notChecked. Do not describe an omitted check as passed.",
      "4. Do not rewrite or re-render candidate.yaml during this handoff. If you recommend a fix, write a separate candidate and ask me to run the checks again.",
      "5. Check candidate.yaml for Kubernetes Secret objects. If it contains any, stop and ask me how those Secrets will be supplied. Do not put rendered Secret data into the ConfigHub upload.",
      "6. Show me the exact ConfigHub commands below and ask for approval before running them.",
      "7. After approval, run the commands. Then read the stored result with `cub unit list --space " + space + "` and `cub k8s get all --space " + space + " --show data`.",
      "8. Report the Space, stored Units, candidate digest, review digest, and any discrepancy. Say plainly that a successful upload does not prove deployment, admission, hook execution, or workload health.",
      "",
      "Exact ConfigHub commands:",
      byId("handoff-command").value,
    ].join("\n");
    byId("ai-handoff-prompt").value = prompt;
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
    URL.revokeObjectURL(url);
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
    if (statusId) byId(statusId).textContent = "Copied.";
  }

  async function loadFile(input, textarea, nameField) {
    const file = input.files && input.files[0];
    if (!file) return;
    byId(textarea).value = await file.text();
    byId(nameField).value = file.name;
  }

  function openPublicIssue() {
    const code = byId("question-type").value;
    const item = selectedQuestion();
    const question = byId("question").value.trim() || item.label;
    const chart = byId("chart").value.trim();
    const version = byId("version").value.trim();
    const finding = byId("assistant-finding").value.trim();
    if (byId("source-visibility").value === "private") {
      window.alert("This investigation is marked private. Keep it local or save it in your ConfigHub organization.");
      return;
    }
    if (!chart || !version) {
      window.alert("Add the public chart and exact version before opening the issue.");
      return;
    }
    const shortText = (value, length) => value.replace(/\s+/g, " ").trim().slice(0, length);
    const marker = finding.lastIndexOf("WORKSHOP FINDING");
    const findingToCopy = marker >= 0 ? finding.slice(marker).trim() : finding;
    const target = new URL(settings.issueUrl);
    target.searchParams.set("title", shortText("Problem chart: " + chart + " " + version + " - " + question, 200));
    target.searchParams.set("question_code", item.issueOption);
    target.searchParams.set("question", shortText(question, 300));
    target.searchParams.set("chart", shortText(chart, 160));
    target.searchParams.set("version", shortText(version, 80));
    const targetUrl = target.toString().length <= settings.maxIssueUrlLength ? target.toString() : settings.issueUrl;
    const copyValue = findingToCopy || latestReviewJson;
    if (copyValue) copyText(copyValue, "public-handoff-status");
    byId("public-handoff-status").textContent = copyValue
      ? "GitHub opened. Paste the copied finding or review record into the report and check it for private data."
      : "GitHub opened. Add only public reproduction details.";
    window.open(targetUrl, "_blank", "noopener");
  }

  byId("comparison-source").addEventListener("change", () => {
    byId("helm-release-context").hidden = byId("comparison-source").value !== "helm-release";
  });
  byId("load-example").addEventListener("click", loadExample);
  byId("build-prompt-button").addEventListener("click", buildPrompt);
  byId("copy-prompt").addEventListener("click", () => copyText(byId("prompt-output").value, "copy-status"));
  byId("candidate-file").addEventListener("change", () => loadFile(byId("candidate-file"), "candidate-yaml", "candidate-name"));
  byId("comparison-file").addEventListener("change", () => loadFile(byId("comparison-file"), "comparison-yaml", "comparison-name"));
  byId("run-browser-check").addEventListener("click", runBrowserCheck);
  byId("component-slug").addEventListener("input", buildHandoffCommands);
  byId("download-review").addEventListener("click", () => latestReviewJson && download("workshop-review.json", latestReviewJson, "application/json"));
  byId("download-candidate").addEventListener("click", () => latestCandidate && download("candidate.yaml", latestCandidate, "application/yaml"));
  byId("copy-handoff").addEventListener("click", () => copyText(byId("handoff-command").value, "handoff-copy-status"));
  byId("copy-ai-handoff").addEventListener("click", () => copyText(byId("ai-handoff-prompt").value, "ai-handoff-copy-status"));
  byId("file-public-question").addEventListener("click", openPublicIssue);
  window.addEventListener("hashchange", applyQuestionHash);
  applyQuestionHash();
})();
