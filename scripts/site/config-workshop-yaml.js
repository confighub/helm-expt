(() => {
  "use strict";

  if (!globalThis.jsyaml) throw new Error("Config Workshop YAML support requires js-yaml");

  const ABSENT = Symbol("absent");
  const MAX_FIELD_ROWS = 2000;

  function canonicalFileText(text) {
    return String(text || "").replaceAll("\r\n", "\n");
  }

  function splitDocuments(text) {
    return canonicalFileText(text)
      .split(/^---\s*$/m)
      .map((document) => document.trim())
      .filter((document) => document && !/^\.\.\.\s*$/.test(document));
  }

  function stableValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
    }
    return value;
  }

  function canonicalValue(value) {
    if (value === ABSENT) return "<absent>";
    return JSON.stringify(stableValue(value));
  }

  function sameValue(left, right) {
    return canonicalValue(left) === canonicalValue(right);
  }

  function normalizedDocument(text) {
    return canonicalFileText(text)
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""))
      .filter((line) => !/^\s*#/.test(line))
      .join("\n")
      .trim();
  }

  function parseObjectSet(text, name) {
    const canonicalText = canonicalFileText(text);
    const rawDocuments = splitDocuments(canonicalText);
    const documents = [];
    globalThis.jsyaml.loadAll(canonicalText, (document) => {
      if (document !== null && document !== undefined) documents.push(document);
    });

    const objects = documents.map((document, index) => {
      const isMap = Boolean(document) && typeof document === "object" && !Array.isArray(document);
      const metadata = isMap && document.metadata && typeof document.metadata === "object" && !Array.isArray(document.metadata)
        ? document.metadata
        : {};
      const apiVersion = isMap ? String(document.apiVersion || "") : "";
      const kind = isMap ? String(document.kind || "") : "";
      const objectName = String(metadata.name || "");
      const namespace = String(metadata.namespace || "_cluster");
      const valid = Boolean(apiVersion && kind && objectName);
      const ref = valid ? `${kind}/${namespace}/${objectName}` : `Document/_cluster/document-${index + 1}`;
      const raw = rawDocuments[index] || "";
      return {
        apiVersion,
        kind,
        name: objectName,
        namespace,
        ref,
        valid,
        value: document,
        canonical: canonicalValue(document),
        raw,
        normalizedRaw: normalizedDocument(raw),
      };
    });

    const counts = new Map();
    for (const object of objects) counts.set(object.ref, (counts.get(object.ref) || 0) + 1);
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([ref]) => ref).sort();
    return { name, text: canonicalText, objects, duplicates };
  }

  function objectMap(objectSet) {
    return new Map(objectSet.objects.map((object) => [object.ref, object]));
  }

  function compareObjectSets(before, after) {
    const oldObjects = objectMap(before);
    const newObjects = objectMap(after);
    const added = [...newObjects.keys()].filter((ref) => !oldObjects.has(ref)).sort();
    const removed = [...oldObjects.keys()].filter((ref) => !newObjects.has(ref)).sort();
    const shared = [...newObjects.keys()].filter((ref) => oldObjects.has(ref));
    const changed = shared.filter((ref) => newObjects.get(ref).canonical !== oldObjects.get(ref).canonical).sort();
    const noOp = shared.filter((ref) => {
      const oldObject = oldObjects.get(ref);
      const newObject = newObjects.get(ref);
      return oldObject.canonical === newObject.canonical && oldObject.normalizedRaw !== newObject.normalizedRaw;
    }).sort();
    const unchanged = shared.filter((ref) => {
      const oldObject = oldObjects.get(ref);
      const newObject = newObjects.get(ref);
      return oldObject.canonical === newObject.canonical && oldObject.normalizedRaw === newObject.normalizedRaw;
    }).sort();
    return { added, removed, changed, noOp, unchanged };
  }

  function escapePointer(value) {
    return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
  }

  function flatten(value, path = "", result = new Map()) {
    if (Array.isArray(value)) {
      if (!value.length) result.set(path || "/", []);
      value.forEach((item, index) => flatten(item, `${path}/${index}`, result));
      return result;
    }
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const keys = Object.keys(value).sort();
      if (!keys.length) result.set(path || "/", {});
      for (const key of keys) flatten(value[key], `${path}/${escapePointer(key)}`, result);
      return result;
    }
    result.set(path || "/", stableValue(value));
    return result;
  }

  function fieldsForObject(object) {
    if (!object) return new Map([["/$object", ABSENT]]);
    const fields = flatten(object.value);
    fields.set("/$object", "present");
    return fields;
  }

  function fieldValue(fields, path) {
    return fields.has(path) ? fields.get(path) : ABSENT;
  }

  function sensitivePath(kind, path) {
    if (kind === "Secret" && /^\/(?:data|stringData)(?:\/|$)/.test(path)) return true;
    if (/\/env\/\d+\/value$/.test(path)) return true;
    return /\/(?:password|passwd|token|api[-_]?key|secret|private[-_]?key)(?:\/|$)/i.test(path);
  }

  function displayValue(value, kind, path) {
    if (value === ABSENT) return "<absent>";
    if (sensitivePath(kind, path)) return "<redacted>";
    const rendered = typeof value === "string" ? value : canonicalValue(value);
    return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered;
  }

  function classifyField({ oldSource, oldAccepted, newSource, newAccepted }) {
    const sourceChanged = !sameValue(oldSource, newSource);
    const oldOverride = !sameValue(oldAccepted, oldSource);
    const newOverride = !sameValue(newAccepted, newSource);
    const acceptedChanged = !sameValue(oldAccepted, newAccepted);

    if (!sourceChanged && !oldOverride && !newOverride && !acceptedChanged) {
      return { class: "inherited", mode: "unchanged", needsReview: false };
    }
    if (oldOverride || newOverride) {
      let mode = "kept";
      if (!oldOverride && newOverride) mode = "added";
      else if (oldOverride && !newOverride) mode = "removed";
      else if (acceptedChanged) mode = "changed";
      return {
        class: "overridden",
        mode,
        needsReview: sourceChanged && (oldOverride || newOverride),
        sourceChanged,
      };
    }
    if (sourceChanged || acceptedChanged) {
      return { class: "upstream-added", mode: "accepted", needsReview: false, sourceChanged };
    }
    return { class: "inherited", mode: "unchanged", needsReview: false };
  }

  function classifySourceAware(oldSourceSet, oldAcceptedSet, newSourceSet, newAcceptedSet) {
    const sets = [oldSourceSet, oldAcceptedSet, newSourceSet, newAcceptedSet];
    if (sets.some((set) => !set)) return { status: "not-supplied" };
    const maps = sets.map(objectMap);
    const refs = [...new Set(maps.flatMap((map) => [...map.keys()]))].sort();
    const rows = [];
    let inheritedCount = 0;
    let totalFieldCount = 0;
    let truncated = false;

    for (const ref of refs) {
      const objects = maps.map((map) => map.get(ref));
      const fieldMaps = objects.map(fieldsForObject);
      const paths = [...new Set(fieldMaps.flatMap((map) => [...map.keys()]))].sort();
      const kind = objects.find(Boolean)?.kind || "Unknown";
      for (const path of paths) {
        totalFieldCount += 1;
        const values = fieldMaps.map((fields) => fieldValue(fields, path));
        const classification = classifyField({
          oldSource: values[0],
          oldAccepted: values[1],
          newSource: values[2],
          newAccepted: values[3],
        });
        if (classification.class === "inherited") {
          inheritedCount += 1;
          continue;
        }
        if (rows.length >= MAX_FIELD_ROWS) {
          truncated = true;
          continue;
        }
        rows.push({
          object: ref,
          path,
          class: classification.class,
          mode: classification.mode,
          needsReview: classification.needsReview,
          sourceChanged: Boolean(classification.sourceChanged),
          oldSource: displayValue(values[0], kind, path),
          oldAccepted: displayValue(values[1], kind, path),
          newSource: displayValue(values[2], kind, path),
          newAccepted: displayValue(values[3], kind, path),
        });
      }
    }

    const counts = {
      inherited: inheritedCount,
      overridden: rows.filter((row) => row.class === "overridden").length,
      upstreamAdded: rows.filter((row) => row.class === "upstream-added").length,
      overlaps: rows.filter((row) => row.needsReview).length,
    };
    return { status: "compared", counts, rows, totalFieldCount, truncated, maxRows: MAX_FIELD_ROWS };
  }

  function lifecycleFromRecord(record, candidateSet) {
    const lifecycle = record?.spec?.lifecycle || {};
    const routes = Array.isArray(lifecycle?.routeIntent?.routes)
      ? lifecycle.routeIntent.routes
      : [];
    const targetFacts = lifecycle?.targetFacts || {};
    const requirements = Array.isArray(lifecycle?.requirements?.items)
      ? lifecycle.requirements.items.map((item) => ({
          ...item,
          name: item.name || item.id || "",
          category: item.category || item.type || "setup-item",
        }))
      : [];
    const objects = candidateSet?.objects || [];
    const routeDispositions = {};
    for (const route of routes) {
      const disposition = String(route.sourceStatus || route.status || "not-stated");
      routeDispositions[disposition] = (routeDispositions[disposition] || 0) + 1;
    }
    return {
      record: record?.metadata?.name || "not supplied",
      routes,
      requirements,
      manifestSignals: {
        crds: objects.filter((object) => object.kind === "CustomResourceDefinition").map((object) => object.ref),
        hooks: objects.filter((object) => /helm\.sh\/hook\s*:/i.test(object.raw)).map((object) => object.ref),
        jobs: objects.filter((object) => ["Job", "CronJob"].includes(object.kind)).map((object) => object.ref),
      },
      coverage: {
        routes: {
          state: record ? (routes.length ? "attached" : "none-recorded") : "record-not-supplied",
          intentStatus: lifecycle?.routeIntent?.status || (record ? "not-declared" : "record-not-supplied"),
          dispositions: routeDispositions,
        },
        targetFacts: targetFacts?.status ? {
          state: Object.keys(targetFacts.declared || {}).length || (targetFacts.requirementRefs || []).length
            ? "attached"
            : "none-recorded",
          recordStatus: targetFacts.status,
          requirementRefs: targetFacts.requirementRefs || [],
        } : {
          state: record ? "not-declared" : "record-not-supplied",
        },
        resolution: lifecycle?.resolution || {
          status: record ? "not-recorded" : "record-not-supplied",
          records: [],
        },
      },
    };
  }

  function parseTargetResults(text, fallbackNames, candidateDigest) {
    const rows = [];
    for (const rawLine of canonicalFileText(text).split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const [name = "", status = "not-run", note = "", digest = ""] = line.split("|").map((part) => part.trim());
      if (!name) continue;
      const normalizedStatus = ["pass", "watch", "blocked", "not-run"].includes(status) ? status : "blocked";
      const digestMatches = !digest || digest === candidateDigest;
      rows.push({
        name,
        status: digestMatches ? normalizedStatus : "blocked",
        note: digestMatches ? note : `Reported digest ${digest} does not match ${candidateDigest}.`,
        digest: digest || "not supplied",
        digestMatches,
      });
    }
    if (!rows.length) {
      for (const name of fallbackNames) rows.push({ name, status: "not-run", note: "No result supplied.", digest: "not supplied", digestMatches: true });
    }
    const counts = Object.fromEntries(["pass", "watch", "blocked", "not-run"].map((status) => [status, rows.filter((row) => row.status === status).length]));
    const overall = counts.blocked ? "blocked" : counts.watch || counts["not-run"] ? "partial" : rows.length && counts.pass === rows.length ? "pass" : "not-run";
    return { overall, counts, targets: rows };
  }

  function evaluateChangeWorkflow(workflow) {
    const candidateDigest = String(workflow?.candidateDigest || "");
    const events = Array.isArray(workflow?.events) ? workflow.events : [];
    const activeExceptions = new Map();
    const resolvedExceptions = new Set();
    const stagePaused = new Map();
    const writeCounts = new Map();
    for (const event of events) {
      if (event.type === "exception-open" && event.id) activeExceptions.set(event.id, event);
      if (event.type === "exception-resolved" && event.id) {
        activeExceptions.delete(event.id);
        resolvedExceptions.add(event.id);
      }
      if (event.type === "pause" && event.stage) stagePaused.set(event.stage, true);
      if (event.type === "resume" && event.stage) stagePaused.set(event.stage, false);
      if (event.type === "write" && event.operationId) {
        writeCounts.set(event.operationId, (writeCounts.get(event.operationId) || 0) + 1);
      }
    }
    const duplicateWrites = [...writeCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([operationId]) => operationId)
      .sort();
    const validException = (id) => {
      const exception = activeExceptions.get(id);
      return Boolean(
        exception?.reason
        && exception?.approvedBy
        && exception?.expiresAt
        && Date.parse(exception.expiresAt) > Date.now(),
      );
    };
    const stageResults = [];
    let priorPassed = true;
    for (const stage of Array.isArray(workflow?.stages) ? workflow.stages : []) {
      const latestTargets = new Map();
      for (const [index, target] of (stage.targets || []).entries()) {
        const previous = latestTargets.get(target.name);
        const time = Date.parse(target.observedAt || "") || index;
        if (!previous || time >= previous.time) latestTargets.set(target.name, { ...target, time });
      }
      const targets = [...latestTargets.values()].map((target) => ({
        ...target,
        status: target.digest && target.digest !== candidateDigest ? "blocked" : target.status,
        digestMatches: !target.digest || target.digest === candidateDigest,
      }));
      const counts = Object.fromEntries(["pass", "watch", "blocked", "not-run"].map((status) => [
        status,
        targets.filter((target) => target.status === status).length,
      ]));
      const targetOutcome = !targets.length
        ? "not-run"
        : counts.pass === targets.length
          ? "pass"
          : counts.pass > 0
            ? "partial"
            : counts.blocked > 0
              ? "blocked"
              : "partial";
      const blockers = [];
      if (!priorPassed) blockers.push("The previous stage has not passed.");
      if (stagePaused.get(stage.name) || stage.paused) blockers.push("This stage is paused.");
      for (const gate of stage.gates || []) {
        if (gate.candidateDigest && gate.candidateDigest !== candidateDigest) {
          blockers.push(`${gate.type || "Gate"} evidence belongs to a different candidate.`);
          continue;
        }
        if (gate.status !== "pass" && !validException(gate.exceptionId)) {
          blockers.push(`${gate.type || "Gate"} has not passed.`);
        }
      }
      if (targetOutcome !== "pass") blockers.push("Every current target result must pass for this candidate.");
      if (duplicateWrites.length) blockers.push("A write operation was recorded more than once.");
      const decision = blockers.length ? "blocked" : "pass";
      stageResults.push({
        name: stage.name,
        parallel: Boolean(stage.parallel),
        targets,
        counts,
        outcome: targetOutcome,
        decision,
        blockers,
      });
      priorPassed = decision === "pass";
    }
    const responsibilities = workflow?.responsibilities || {};
    const responsibilitiesSeparated = Boolean(
      responsibilities.changeManagement
      && ["argo-cd", "flux"].includes(responsibilities.reconciliation)
      && responsibilities.changeManagement !== responsibilities.reconciliation,
    );
    return {
      candidateDigest,
      initiatedBy: workflow?.initiatedBy || "not-recorded",
      stages: stageResults,
      overall: stageResults.length && stageResults.every((stage) => stage.decision === "pass") ? "pass" : "blocked",
      activeExceptions: [...activeExceptions.keys()].sort(),
      resolvedExceptions: [...resolvedExceptions].sort(),
      duplicateWrites,
      responsibilities: {
        ...responsibilities,
        separated: responsibilitiesSeparated,
      },
    };
  }

  globalThis.ConfigWorkshopYaml = {
    canonicalFileText,
    parseObjectSet,
    compareObjectSets,
    classifySourceAware,
    lifecycleFromRecord,
    parseTargetResults,
    evaluateChangeWorkflow,
  };
})();
