import { readFileSync } from "node:fs";
import vm from "node:vm";

import { check, repoRoot } from "./lib/proof-common.mjs";
import { join } from "node:path";

const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(readFileSync(join(repoRoot, "scripts/site/vendor/js-yaml-4.1.0.min.js"), "utf8"), context);
vm.runInContext(readFileSync(join(repoRoot, "scripts/site/config-workshop-yaml.js"), "utf8"), context);

const tools = context.ConfigWorkshopYaml;
check(tools, "browser YAML tools did not load");

const deployment = (replicas, image, secret = "") => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  namespace: test
spec:
  replicas: ${replicas}
  template:
    spec:
      containers:
        - name: app
          image: ${image}${secret ? `
          env:
            - name: API_KEY
              value: ${secret}` : ""}
`;

const oldSource = tools.parseObjectSet(deployment(3, "app:v1"), "old-source");
const oldAccepted = tools.parseObjectSet(deployment(2, "app:v1"), "old-accepted");
const newSource = tools.parseObjectSet(deployment(3, "app:v2"), "new-source");
const newAccepted = tools.parseObjectSet(deployment(2, "app:v2"), "new-accepted");
const classified = tools.classifySourceAware(oldSource, oldAccepted, newSource, newAccepted);
check(classified.status === "compared", "four-way source classification did not run");
check(classified.rows.some((row) => row.path === "/spec/replicas" && row.class === "overridden" && row.mode === "kept"), "kept post-render replica edit was not classified");
check(classified.rows.some((row) => row.path.endsWith("/image") && row.class === "upstream-added"), "source image change was not classified");
check(classified.counts.overlaps === 0, "independent source and post-render changes were reported as an overlap");

const overlap = tools.classifySourceAware(
  oldSource,
  oldAccepted,
  tools.parseObjectSet(deployment(4, "app:v1"), "new-source"),
  tools.parseObjectSet(deployment(1, "app:v1"), "new-accepted"),
);
check(overlap.rows.some((row) => row.path === "/spec/replicas" && row.needsReview), "source and post-render overlap was not marked for review");

const keptOverlap = tools.classifySourceAware(
  oldSource,
  oldAccepted,
  tools.parseObjectSet(deployment(4, "app:v1"), "new-source"),
  tools.parseObjectSet(deployment(2, "app:v1"), "new-accepted"),
);
check(keptOverlap.rows.some((row) => row.path === "/spec/replicas" && row.mode === "kept" && row.needsReview), "a retained override on a changed source field was not marked for review");

const secretReview = tools.classifySourceAware(
  tools.parseObjectSet(deployment(3, "app:v1", "old-key"), "old-source"),
  tools.parseObjectSet(deployment(3, "app:v1", "old-key"), "old-accepted"),
  tools.parseObjectSet(deployment(3, "app:v1", "new-key"), "new-source"),
  tools.parseObjectSet(deployment(3, "app:v1", "new-key"), "new-accepted"),
);
check(secretReview.rows.some((row) => row.path.endsWith("/value") && row.newAccepted === "<redacted>"), "sensitive field values were not redacted");

const differentlyOrdered = `kind: Deployment
apiVersion: apps/v1
metadata: { namespace: test, name: app }
spec:
  template:
    spec:
      containers: [{ image: app:v1, name: app }]
  replicas: 3
`;
const noOp = tools.compareObjectSets(oldSource, tools.parseObjectSet(differentlyOrdered, "reordered"));
check(noOp.changed.length === 0 && noOp.noOp.length === 1, "representation-only YAML change was not classified as no-op");

const digest = `sha256:${"a".repeat(64)}`;
const partial = tools.parseTargetResults("staging | pass | healthy | " + digest + "\nprod | not-run | waiting |", [], digest);
check(partial.overall === "partial" && partial.counts.pass === 1 && partial.counts["not-run"] === 1, "partial target results were collapsed");
const mismatch = tools.parseTargetResults("staging | pass | healthy | sha256:" + "b".repeat(64), [], digest);
check(mismatch.overall === "blocked" && !mismatch.targets[0].digestMatches, "mismatched target digest was not blocked");

const recordIndex = JSON.parse(readFileSync(join(repoRoot, "data/base-variant-records/records.json"), "utf8"));
const redisRecord = recordIndex.records.find((record) => record.metadata?.name === "bitnami-redis-25-5-3-reuse-existing-secret");
check(redisRecord, "Redis BaseVariantRecord fixture is missing");
const redisLifecycle = tools.lifecycleFromRecord(redisRecord, oldSource);
check(redisLifecycle.coverage.routes.state === "none-recorded", "an empty lifecycle route list was not kept distinct from target-fact coverage");
check(redisLifecycle.coverage.targetFacts.state === "attached", "Redis target-fact coverage was not retained");
check(redisLifecycle.requirements.some((requirement) => requirement.name === "redis/redis-existing-secret"), "Redis Secret prerequisite was not retained");

console.log("config workshop YAML browser self-test: pass");
