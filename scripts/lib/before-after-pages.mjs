// The before-and-after examples: one page each, and the gallery at the top of
// the Apps page. Every count, table and terminal on a page is read from the
// files that scripts/generate-before-after.mjs recorded under
// examples/before-after/, and the builder checks the counts against the
// recorded command output, so a page cannot show a result that was not run.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readYamlText, repoRoot } from "./proof-common.mjs";
import { HELM_EXAMPLES } from "../generate-before-after.mjs";

const ROOT = "examples/before-after";
const GITHUB = "https://github.com/confighub/helm-expt/tree/main";
export const GPU_ENTRY = "nvidia-gpu-operator-v26-3-3-default";
const HELM_TEMPLATE = "helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v26.3.3 --namespace gpu-operator > before.yaml";

// The name each Helm chart goes by on its page.
const HELM_NAMES = {
  "helm-redis": "Bitnami Redis",
  "helm-postgresql": "Bitnami PostgreSQL",
  "helm-ingress-nginx": "ingress-nginx",
  "helm-cert-manager": "cert-manager",
  "helm-kube-prometheus-stack": "kube-prometheus-stack",
  "helm-argo-cd": "Argo CD",
  "helm-external-secrets": "External Secrets",
  "helm-metrics-server": "metrics-server",
  "helm-gatekeeper": "Gatekeeper",
};

export const BEFORE_AFTER_PAGES = [
  {
    id: "helm-gpu-operator",
    key: "beforeAfterHelmGpuOperatorHtml",
    file: "before-after-helm-gpu-operator.html",
    kicker: "Helm chart",
    title: "See what the GPU Operator Helm chart becomes",
    description: "Plain helm template against the Catalog's bundle for the NVIDIA GPU Operator v26.3.3: the hooks leave the objects and become plan steps, and the CRDs come first.",
    card: "Helm hides 8 hook objects among the 27 it renders. The bundle holds the 24 objects to apply, CRDs first, and a plan for the hooks.",
  },
  {
    id: "kustomize-apptique",
    key: "beforeAfterKustomizeApptiqueHtml",
    file: "before-after-kustomize-apptique.html",
    kicker: "Kustomize overlays",
    title: "See what dev and prod Kustomize overlays become",
    description: "A Kustomize base with dev and prod overlays, built flat, with every field that differs between the two environments in one table.",
    card: "A base, two overlays and their patches become two flat files, and one table lists every field that differs.",
  },
  {
    id: "argo-app-of-apps",
    key: "beforeAfterArgoAppOfAppsHtml",
    file: "before-after-argo-app-of-apps.html",
    kicker: "Argo CD app of apps",
    title: "See what an Argo CD app of apps becomes",
    description: "An Argo CD app of apps planned into ConfigHub: Argo CD keeps syncing, and each Application changes only its source.",
    card: "Argo CD keeps syncing. Each Application changes three lines, from a Git path to a ConfigHub release.",
  },
  {
    id: "flux-beginner",
    key: "beforeAfterFluxBeginnerHtml",
    file: "before-after-flux-beginner.html",
    kicker: "Flux fleet",
    title: "See what a Flux fleet becomes",
    description: "A Flux fleet of two clusters and two layers planned into ConfigHub: each Flux Kustomization keeps its name and settings, and reads a ConfigHub release instead of Git.",
    card: "Flux keeps reconciling. Each layer's Kustomization keeps its name and settings, and changes only where it reads from.",
  },
  {
    id: "kustomize-helm-chart",
    key: "beforeAfterKustomizeHelmChartHtml",
    file: "before-after-kustomize-helm-chart.html",
    kicker: "Kustomize with a Helm chart",
    title: "See what a Helm chart inside Kustomize becomes",
    description: "A Helm chart inflated by Kustomize for dev, staging and prod, built flat, with the namespace each object really gets.",
    card: "Kustomize's namespace setting misses objects inflated from a chart. Built flat, each environment shows the namespace every object gets.",
  },
  {
    id: "argo-applicationset",
    key: "beforeAfterArgoApplicationsetHtml",
    file: "before-after-argo-applicationset.html",
    kicker: "Argo CD ApplicationSet",
    title: "See what an Argo CD ApplicationSet becomes",
    description: "An ApplicationSet with a directory generator, planned into ConfigHub: the Applications it would generate, written out before Argo CD makes them.",
    card: "A template full of placeholders becomes the two Applications Argo CD would generate, written out where you can read them first.",
  },
  {
    id: "flux-expert-fleet",
    key: "beforeAfterFluxExpertFleetHtml",
    file: "before-after-flux-expert-fleet.html",
    kicker: "Flux fleet",
    title: "See which version runs where in a Flux fleet",
    description: "A Flux fleet of three clusters and four layers planned into ConfigHub: one base per layer, one variant per cluster, and the version each cluster runs.",
    card: "Three clusters and four layers become ten variants, and one line says which nginx version each cluster runs.",
  },
  ...HELM_EXAMPLES.map((spec) => {
    const name = HELM_NAMES[spec.id];
    return {
      id: spec.id,
      key: `beforeAfter${spec.id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}Html`,
      file: `before-after-${spec.id}.html`,
      kicker: "Helm chart",
      title: `See what the ${name} Helm chart becomes`,
      description: `Plain helm template for ${name} against the base the Catalog keeps for it: what changes in the objects, and the plan that comes with them.`,
      card: null,
    };
  }),
  {
    id: "app-shop-web",
    key: "beforeAfterAppShopWebHtml",
    file: "before-after-app-shop-web.html",
    kicker: "App",
    title: "See what the shop-web app needs from a platform",
    description: "An app's own YAML, then what ConfigHub reads in it: the platform services it needs, and a check of a platform that carries them.",
    card: null,
  },
];

const read = (id, path) => readFileSync(join(repoRoot, ROOT, id, path), "utf8");
const receipt = (id) => JSON.parse(read(id, "receipt.json"));
const objects = (text) => [].concat(readYamlText(text) ?? []).filter((doc) => doc && typeof doc === "object" && doc.kind);
const countKinds = (docs) => docs.reduce((counts, doc) => ({ ...counts, [doc.kind]: (counts[doc.kind] ?? 0) + 1 }), {});
const transcriptLines = (text) => text.replace(/^\n+/, "").replace(/\n+$/, "").split("\n");

// A terminal as a person sees it: the command, then its output, with the lines
// that carry the page's point highlighted.
function terminal(escapeHtml, { title, first = [], cmd, output, mark = [] }) {
  const lines = output.map((line) => (mark.some((pattern) => pattern.test(line)) ? `<span class="term-catch">${escapeHtml(line)}</span>` : escapeHtml(line)));
  const prompts = [...first, cmd].map((command) => `<span class="term-prompt">$</span> ${escapeHtml(command)}`).join("\n");
  return `<figure class="ba-shot"><div class="terminal-card" aria-label="${escapeHtml(title)}"><div class="terminal-title">${escapeHtml(title)}</div><pre class="terminal-body"><code>${prompts}
${lines.join("\n")}</code></pre></div></figure>`;
}

// Leaves of an object as path -> value, so two objects compare field by field.
function leaves(value, path = "", out = {}) {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) leaves(child, path ? `${path}.${Array.isArray(value) ? `[${key}]` : key}`.replace(".[", "[") : key, out);
  } else out[path] = value;
  return out;
}

// Every field that differs between two builds, with the objects it differs on.
// A Namespace is matched by kind, because its name is what differs.
export function fieldDifferences(left, right) {
  const key = (doc) => (doc.kind === "Namespace" ? "Namespace" : `${doc.kind}/${doc.metadata.name}`);
  const rightByKey = new Map(right.map((doc) => [key(doc), doc]));
  const rows = new Map();
  for (const doc of left) {
    const other = rightByKey.get(key(doc));
    if (!other) continue;
    const a = leaves(doc);
    const b = leaves(other);
    for (const path of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (a[path] === b[path]) continue;
      const id = `${path}\u0000${a[path]}\u0000${b[path]}`;
      if (!rows.has(id)) rows.set(id, { path, left: a[path], right: b[path], objects: [] });
      rows.get(id).objects.push(key(doc));
    }
  }
  return [...rows.values()];
}

function liveIntro() {
  return `<p>Everything above runs on your own machine with no account. To see the same example in ConfigHub, load it into your own organization with the commands below.</p>`;
}

// The screenshot the example's receipt records, copied into the site next to
// the page. Its caption says where and when it was taken and what it shows.
export function beforeAfterAssets() {
  return BEFORE_AFTER_PAGES.flatMap((page) => {
    const shot = receipt(page.id).confighub;
    if (!shot) return [];
    return [{ site: `before-after/${page.id}-confighub.png`, from: join(ROOT, page.id, shot.file) },
      ...(shot.graph ? [{ site: `before-after/${page.id}-graph.png`, from: join(ROOT, page.id, shot.graph.file) }] : []),
      ...(shot.crds ? [{ site: `before-after/${page.id}-crds.png`, from: join(ROOT, page.id, shot.crds.file) }] : [])];
  });
}

function liveScreenshot(id, escapeHtml) {
  const shot = receipt(id).confighub;
  if (!shot) return "";
  return `<h3 id="live-screenshot">What it looks like in ConfigHub</h3>
      <figure class="ba-ui"><img src="./before-after/${id}-confighub.png" alt="${escapeHtml(`ConfigHub showing ${shot.shows}`)}" loading="lazy"><figcaption>${escapeHtml(`The ${shot.organization} organization on ${shot.takenOn}, showing ${shot.shows}. It was loaded as this panel describes.${shot.note ? ` ${shot.note}` : ""}`)}</figcaption></figure>`;
}

function helmPage(h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock, listing } = h;
  const id = "helm-gpu-operator";
  const rec = receipt(id);
  const before = objects(read(id, "before/before.yaml"));
  const afterPath = Object.keys(rec.repoFiles)[0];
  const after = objects(readFileSync(join(repoRoot, afterPath), "utf8"));
  const hooks = before.filter((doc) => doc.metadata?.annotations?.["helm.sh/hook"]);
  const crds = after.filter((doc) => doc.kind === "CustomResourceDefinition");
  const checkBefore = transcriptLines(read(id, "transcripts/check-before.txt"));
  const checkAfter = transcriptLines(read(id, "transcripts/check-after.txt"));
  const lifecycle = readYamlText(read(id, "after/bundle/routes/lifecycle-actions.yaml"));
  const ordering = readYamlText(read(id, "after/bundle/routes/crd-ordering.yaml"));
  const actions = lifecycle.spec.declaration.actions;
  const stages = ordering.spec.declaration.stages;

  check(listing.identity.id === GPU_ENTRY, `the GPU Operator before-and-after page reads ${GPU_ENTRY}`);
  check(checkBefore.some((line) => line.includes(`${before.length} objects:`)) && checkBefore.some((line) => line.includes(`Helm hooks: ${hooks.length}`)), `${ROOT}/${id}/transcripts/check-before.txt does not report ${before.length} objects and ${hooks.length} hooks`);
  check(checkBefore.some((line) => /CRDs: 0$/.test(line)), `${ROOT}/${id}/transcripts/check-before.txt no longer reports that helm template leaves the CRDs out`);
  check(checkAfter.some((line) => line.includes(`${after.length} objects:`)) && checkAfter.some((line) => line.includes(`CRDs: ${crds.length} `)) && checkAfter.some((line) => /Helm hooks: 0$/.test(line)), `${ROOT}/${id}/transcripts/check-after.txt does not report ${after.length} objects, ${crds.length} CRDs and no hooks`);
  check(after.length === listing.flattened.objectCount, `site/listings/${GPU_ENTRY}.json counts ${listing.flattened.objectCount} objects, and the bundle holds ${after.length}`);
  const objectKey = (doc) => `${doc.kind}/${doc.metadata.namespace ?? ""}/${doc.metadata.name}`;
  const kept = new Map(after.filter((doc) => doc.kind !== "CustomResourceDefinition").map((doc) => [objectKey(doc), JSON.stringify(doc)]));
  const plain = before.filter((doc) => !doc.metadata?.annotations?.["helm.sh/hook"]);
  check(plain.length === kept.size && plain.every((doc) => kept.get(objectKey(doc)) === JSON.stringify(doc)), `the GPU Operator page says the two sides share every object that is not a hook or a CRD, and they differ`);
  const hookJobs = hooks.filter((doc) => doc.kind === "Job");
  check(hookJobs.length === actions.length, `${ROOT}/${id} has ${hookJobs.length} hook Jobs and ${actions.length} plan actions`);

  const bundleRef = rec.sources.find((source) => source.reference).reference;
  const step = (stepId) => listing.nextSteps.find((entry) => entry.id === stepId);
  const setup = step("get-objects").commands.find((command) => command.command.startsWith("cub installer setup"));
  const upload = step("upload").commands;
  check(setup && upload.length === 3, `site/listings/${GPU_ENTRY}.json changed its setup or upload commands`);
  const shared = before.length - hooks.length;

  const hookRows = hooks.map((doc) => [doc.kind, `<code>${escapeHtml(doc.metadata.name)}</code>`, escapeHtml(doc.metadata.annotations["helm.sh/hook"])]);
  const planRows = [
    ...stages.map((stage) => [`Apply ${stage.order}`, stage.order === 1 ? `the ${stage.objectCount} CRDs, then wait until each is Established` : `the other ${after.length - crds.length} objects`]),
    ...actions.map((action) => [escapeHtml(action.phase), `${escapeHtml(action.name)}. The plan names the hook objects in the signed package and never applies them with the base.`]),
  ];

  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES[0].title,
    lead: `Plain <code>helm template</code> renders ${before.length} objects for the NVIDIA GPU Operator v26.3.3, and ${hooks.length} of them are Helm hooks that must never be applied with the rest. The Catalog's bundle holds the ${after.length} objects to apply, with the ${crds.length} CRDs first, and a plan that says when each hook runs.`,
    opening: `    <p><strong>What you need.</strong> <code>helm</code>, <code>curl</code> and <code>cub</code> with the Workshop plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>You have the chart and its default values. Helm renders them like this, and the Workshop's check reads the result.</p>
      ${terminal(escapeHtml, { title: "before: plain helm template", first: [HELM_TEMPLATE], cmd: "cub config check before.yaml", output: checkBefore, mark: [/CRDs: 0$/, /Helm hooks: \d+/, /setup Jobs: \d+/] })}
      <p>The ${hooks.length} hook objects sit in the same file as everything else. Apply the file and they run at install time. The <code>post-delete</code> Job would remove node-feature-discovery labels from every node straight away.</p>
      ${markdownLikeTable([["Kind", "Name", "Helm hook"], ...hookRows], { rawColumns: [1] })}
      <p>The file holds no CRDs. Helm installs the chart's ${crds.length} CRDs on the first install only, and never upgrades them.</p>
    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what the Workshop gives you</h2>
      <p>The Catalog flattened the same chart into an OCI bundle, pinned by its digest. It holds the objects, and a plan for everything that is not an object to apply.</p>
      ${terminal(escapeHtml, { title: "after: the Catalog's bundle", cmd: "cub config check after.yaml", output: checkAfter, mark: [/CRDs: \d+ \(/, /Helm hooks: 0$/] })}
      <p>The plan has ${planRows.length} steps.</p>
      ${markdownLikeTable([["Step", "What it does"], ...planRows], { rawColumns: [0, 1] })}
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See what changed</h2>
      ${markdownLikeTable([
        ["", "Before, helm template", "After, the bundle"],
        ["Objects", String(before.length), String(after.length)],
        ["Helm hook objects in the file", String(hooks.length), "0, named in the plan"],
        ["CRDs", "0, installed once by helm install", `${crds.length}, applied first`],
        ["Other objects", String(shared), String(shared)],
      ])}
      <p>The ${shared} other objects are the same on both sides, so the difference is the work Helm does out of sight.</p>
    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub and the Workshop plugin</a> first.</p>
      ${commandBlock([
        { comment: "before: render the chart as Helm does", cmd: HELM_TEMPLATE },
        { cmd: "cub config check before.yaml" },
        { comment: "after: fetch the objects the bundle holds", cmd: step("get-objects").commands[0].command.replace(/-o \S+/, "-o after.yaml") },
        { cmd: "cub config check after.yaml" },
      ])}
      <p>The bundle itself is <code>${escapeHtml(bundleRef)}</code>, and <a href="./charts/${escapeHtml(listing.identity.page.split("/").pop())}#plan-${GPU_ENTRY}">its entry page</a> shows the plan.</p>
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      ${commandBlock([
        { comment: "render the base from the signed package", cmd: setup.command },
        { comment: upload[0].command === "cub auth login" ? "sign in to your organization" : "", cmd: upload[0].command },
        { comment: "load the objects as a Space of Units, under names you choose", cmd: upload[1].command },
        { comment: "list what was loaded", cmd: upload[2].command },
      ])}
      <p>These are the commands on the entry page. The screenshot below shows one run of them. The Catalog's own record for this entry still holds no upload.</p>
      ${liveScreenshot("helm-gpu-operator", escapeHtml)}
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>Both checks ran on ${escapeHtml(rec.recordedOn)} with cub ${escapeHtml(rec.tools.cub)}, Workshop plugin ${escapeHtml(rec.tools.workshopPlugin)} and helm ${escapeHtml(rec.tools.helm)}. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output on this page.</li>
        <li>No step of the plan has been run on a cluster. The plan says what a delivery workflow must do, and nothing runs it automatically.</li>
        <li>This is the chart's default base. Other bases of the same version are on the entry page.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

function kustomizePage(h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock } = h;
  const id = "kustomize-apptique";
  const rec = receipt(id);
  const dev = objects(read(id, "after/dev.yaml"));
  const prod = objects(read(id, "after/prod.yaml"));
  const checkDev = transcriptLines(read(id, "transcripts/check-dev.txt"));
  const checkProd = transcriptLines(read(id, "transcripts/check-prod.txt"));
  const beforeFiles = Object.keys(rec.files).filter((path) => path.startsWith("before/")).sort();
  const diffs = fieldDifferences(dev, prod);
  const prodPatch = readYamlText(read(id, "before/prod/kustomization.yaml"));

  check(checkDev.some((line) => line.includes(`${dev.length} objects:`)) && checkProd.some((line) => line.includes(`${prod.length} objects:`)), `${ROOT}/${id} transcripts do not report the ${dev.length} and ${prod.length} objects the builds hold`);
  check(diffs.length > 0, `${ROOT}/${id}: dev and prod no longer differ`);
  check(JSON.stringify(dev.map((doc) => doc.kind).sort()) === JSON.stringify(prod.map((doc) => doc.kind).sort()), `${ROOT}/${id}: dev and prod hold different kinds, and the page says only fields differ`);
  check(diffs.some((row) => /replicas$/.test(row.path)) && diffs.some((row) => /\.image$/.test(row.path)), `${ROOT}/${id}: the table no longer shows the replica and image differences the page describes`);
  const kinds = Object.entries(countKinds(dev)).map(([kind, n]) => `${n} ${kind}`).join(", ");
  const source = rec.sources[0];
  const sourceUrl = `${source.repository}/tree/${source.commit}/${source.path}`;
  const value = (v) => (v === undefined ? "not set" : `<code>${escapeHtml(String(v))}</code>`);
  const diffRows = diffs.map((row) => [`<code>${escapeHtml(row.path)}</code>`, value(row.left), value(row.right), escapeHtml(row.objects.join(", "))]);
  const named = (path) => objects(read(id, path)).map((doc) => `the ${doc.kind} ${doc.metadata.name}`).join(" and ");
  const fileRows = beforeFiles.map((path) => [`<code>${escapeHtml(path.replace(/^before\//, ""))}</code>`, path.endsWith("kustomization.yaml") ? (path.includes("base/") ? "lists the base objects and the labels every object gets" : "sets the namespace, the environment label and the image tag, and patches the Deployment") : escapeHtml(named(path))]);

  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES[1].title,
    lead: `To know what prod runs, you read ${beforeFiles.length} files and apply ${prodPatch.patches?.[0]?.patch ? "a JSON patch" : "the patches"} in your head. Built flat, dev and prod are two files you can read, and one table lists every field that differs between them.`,
    opening: `    <p><strong>What you need.</strong> <code>kustomize</code>, <code>git</code> and <code>cub</code> with the Workshop plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>The example keeps one base and two overlays in <a href="${sourceUrl}">confighub/examples</a>. Each overlay changes the base with its own namespace, label, image tag and patches.</p>
      ${markdownLikeTable([["File", "What it holds"], ...fileRows], { rawColumns: [0] })}
      <p>Nothing in these files says what prod runs. You find out by building it.</p>
    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what the Workshop gives you</h2>
      <p>Each overlay builds into one flat file of ${dev.length} objects: ${escapeHtml(kinds)}. The Workshop's check reads each one.</p>
      <div class="ba-pair">
      ${terminal(escapeHtml, { title: "after: dev, built flat", first: ["kustomize build dev > dev.yaml"], cmd: "cub config check dev.yaml", output: checkDev, mark: [/objects:/] })}
      ${terminal(escapeHtml, { title: "after: prod, built flat", first: ["kustomize build prod > prod.yaml"], cmd: "cub config check prod.yaml", output: checkProd, mark: [/objects:/] })}
      </div>
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See every field that differs</h2>
      <p>These are all the differences between the two builds, and nothing else differs.</p>
      ${markdownLikeTable([["Field", "dev", "prod", "On"], ...diffRows], { rawColumns: [0, 1, 2] })}
    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub and the Workshop plugin</a>, and <code>kustomize</code>, first.</p>
      ${commandBlock([
        { comment: "fetch the example at the commit this page was built from", cmd: `git clone https://github.com/confighub/examples.git && git -C examples checkout ${source.commit}` },
        { cmd: `cd examples/${source.path}` },
        { comment: "build each overlay flat", cmd: "kustomize build dev > dev.yaml && kustomize build prod > prod.yaml" },
        { cmd: "cub config check prod.yaml" },
      ])}
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      <p>The Guide <a href="./d/docs/user/workshop-review-a-change-guide.html">Review one change before it ships</a> loads this same app into ConfigHub as one base with a dev and a prod variant. A recorded run of it checked that what ConfigHub held for prod matched this prod build.</p>
      ${liveScreenshot("kustomize-apptique", escapeHtml)}
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>The builds and checks ran on ${escapeHtml(rec.recordedOn)} with kustomize ${escapeHtml(rec.tools.kustomize)}, cub ${escapeHtml(rec.tools.cub)} and Workshop plugin ${escapeHtml(rec.tools.workshopPlugin)}, from the files on this page. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output.</li>
        <li><code>cub config diff dev.yaml prod.yaml</code> reports every object as added or removed, because the namespace is part of an object's name. The table compares objects by kind and name instead.</li>
        <li>The example's own promotion record, <code>PROMOTED_FROM.md</code>, is not a Kubernetes object and is not on this page.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

function argoPage(h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock } = h;
  const id = "argo-app-of-apps";
  const rec = receipt(id);
  const plan = transcriptLines(read(id, "transcripts/argo-plan.txt"));
  const beforeFiles = Object.keys(rec.files).filter((path) => path.startsWith("before/")).sort();
  const apps = Object.keys(rec.files).filter((path) => path.startsWith("after/control/")).map((path) => path.split("/").pop().replace(/\.yaml$/, "")).sort();
  const rows = apps.flatMap((app) => {
    const control = readYamlText(read(id, `after/control/argo-apptique-apps-children/${app}.yaml`));
    const repointed = readYamlText(read(id, `after/repointed/argo-apptique-apps-children/${app}.yaml`));
    return fieldDifferences([control], [repointed]).map((row) => [escapeHtml(app), `<code>${escapeHtml(row.path)}</code>`, `<code>${escapeHtml(String(row.left))}</code>`, `<code>${escapeHtml(String(row.right))}</code>`]);
  });
  check(apps.length === 2 && rows.length === 6, `${ROOT}/${id}: the page describes 2 Applications that each change 3 fields, and the recording has ${apps.length} Applications and ${rows.length} changed fields`);
  check(rows.every((row) => row[1].includes("spec.source.")), `${ROOT}/${id}: a field outside spec.source changes, and the page says only the source changes`);
  check(plan[0].startsWith("Argo CD estate: 1 cluster") && plan.some((line) => line.includes("base     argo-apptique-dev-base")), `${ROOT}/${id}/transcripts/argo-plan.txt changed its summary or its bases`);
  check(plan.some((line) => line.includes("repoint Application apptique-apps at argo-apptique-apps-children")), `${ROOT}/${id}/transcripts/argo-plan.txt no longer repoints the root Application, and the page says it does`);
  const source = rec.sources[0];
  const sourceUrl = `${source.repository}/tree/${source.commit}/${source.path}`;
  const fileRows = beforeFiles.map((path) => {
    const short = path.replace(/^before\//, "");
    return [`<code>${escapeHtml(short)}</code>`, short.startsWith("root/") ? "the root Application, applied by hand, which syncs the apps directory" : short.startsWith("apps/") ? "an Application that syncs one environment's manifests from Git" : "the Deployment that Application syncs"];
  });

  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES[2].title,
    lead: "Argo CD keeps syncing. ConfigHub holds a base and a variant for each app, and each Application changes only its source, from a path in Git to a ConfigHub release.",
    opening: `    <p><strong>What you need.</strong> <code>git</code> and <code>cub</code> with the argo plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>The example is an app of apps in <a href="${sourceUrl}">confighub/examples</a>. One root Application syncs two child Applications, and each child syncs one environment from Git.</p>
      ${markdownLikeTable([["File", "What it is"], ...fileRows], { rawColumns: [0] })}
    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what ConfigHub would hold</h2>
      <p>The plan reads the files and says what ConfigHub would hold. It runs nothing and changes no cluster.</p>
      ${terminal(escapeHtml, { title: "after: the plan for this app of apps", cmd: "cub argo plan .", output: plan, mark: [/^ {2}base {5}/, /variant argo-/, /^ {2}\d\. repoint/] })}
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See what changes in each Application</h2>
      <p>After the handover each child Application reads a ConfigHub release instead of Git. These are the only fields that change.</p>
      ${markdownLikeTable([["Application", "Field", "Before", "After"], ...rows], { rawColumns: [1, 2, 3] })}
      <p>The finalizer, the sync policy and the destination stay as they are. <code>&lt;gateway&gt;</code> is the OCI address your ConfigHub serves releases from.</p>
      <p>The root Application <code>apptique-apps</code> also changes only its source. It moves to the Space <code>argo-apptique-apps-children</code>, which holds the two child Applications, as step 2 of the handover says.</p>
    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub</a> and the argo plugin as <a href="./bring-argo-into-confighub.html">Bring your Argo CD apps into ConfigHub</a> shows, first.</p>
      ${commandBlock([
        { comment: "fetch the example at the commit this page was built from", cmd: `git clone https://github.com/confighub/examples.git && git -C examples checkout ${source.commit}` },
        { cmd: `cd examples/${source.path}` },
        { comment: "read the plan; it runs nothing", cmd: "cub argo plan ." },
        { comment: "write the Applications before and after, and the scripts, to onboard/", cmd: "cub argo apply . --out onboard" },
      ])}
      <p>Compare <code>onboard/control/</code> with <code>onboard/repointed/</code> to see the table above for yourself.</p>
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      ${commandBlock([
        { comment: "sign in to your organization", cmd: "cub auth login" },
        { comment: "fill ConfigHub with the bases and variants the plan names; it changes no cluster", cmd: "bash onboard/apply.sh" },
      ])}
      <p><code>apply.sh</code> also needs <code>kustomize</code>. <code>onboard/cleanup.sh</code> takes everything back out. The handover, which moves Argo CD onto ConfigHub releases, is a separate step in <a href="./bring-argo-into-confighub.html#connect-deployment">the Argo CD Guide</a>.</p>
      ${liveScreenshot("argo-app-of-apps", escapeHtml)}
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>The plan ran on ${escapeHtml(rec.recordedOn)} with cub ${escapeHtml(rec.tools.cub)} and argo plugin ${escapeHtml(rec.tools.argoPlugin)}, inside a checkout of the example. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output.</li>
        <li>An oci:// source needs Argo CD v3.1 or newer. The plan checks this before the handover.</li>
        <li>Never delete these Applications to undo the handover. Their finalizer deletes everything they deployed.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

function fluxPage(h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock } = h;
  const id = "flux-beginner";
  const rec = receipt(id);
  const plan = transcriptLines(read(id, "transcripts/flux-plan.txt"));
  const beforeFiles = Object.keys(rec.files).filter((path) => path.startsWith("before/")).sort();
  const layerFiles = Object.keys(rec.files).filter((path) => path.startsWith("after/layers/")).sort();
  const rows = [];
  const added = [];
  for (const path of layerFiles) {
    const [env, file] = path.split("/").slice(-2);
    const layer = file.replace(/\.yaml$/, "");
    const before = objects(read(id, `before/clusters/${env}/${file}`));
    const after = objects(read(id, path));
    check(before.length === 1 && before[0].kind === "Kustomization", `${ROOT}/${id}/before/clusters/${env}/${file} is not one Flux Kustomization`);
    const kept = after.filter((doc) => doc.kind === "Kustomization");
    check(kept.length === 1 && kept[0].metadata.name === before[0].metadata.name, `${ROOT}/${id}/${path} does not keep the Kustomization ${before[0].metadata.name} under its own name`);
    for (const row of fieldDifferences(before, kept)) {
      check(row.path === "spec.path" || row.path.startsWith("spec.sourceRef."), `${ROOT}/${id}/${path} changes ${row.path}, and the page says only the path and the source change`);
      rows.push([escapeHtml(`${env} ${layer}`), `<code>${escapeHtml(row.path)}</code>`, `<code>${escapeHtml(String(row.left))}</code>`, `<code>${escapeHtml(String(row.right))}</code>`]);
    }
    for (const doc of after.filter((d) => d.kind !== "Kustomization")) added.push([escapeHtml(`${env} ${layer}`), escapeHtml(doc.kind), `<code>${escapeHtml(doc.spec.url)}</code>`]);
  }
  check(layerFiles.length === 4 && added.length === 4 && added.every((row) => row[1] === "OCIRepository"), `${ROOT}/${id}: the page describes 4 layers that each add one OCIRepository`);
  check(plan[0].startsWith("Flux fleet: 2 clusters, 2 layers, 4 variants"), `${ROOT}/${id}/transcripts/flux-plan.txt changed its summary`);
  check(plan.some((line) => line.includes("first prove each variant renders exactly what Git renders today")) && plan.some((line) => line.includes("so Flux keeps its inventory and nothing is reinstalled")), `${ROOT}/${id}/transcripts/flux-plan.txt no longer says what the page restates about the handover`);
  const source = rec.sources[0];
  const sourceUrl = `${source.repository}/tree/${source.commit}/${source.path}`;
  const describe = (path) => {
    const short = path.replace(/^before\//, "");
    const docs = objects(read(id, path));
    if (short.startsWith("clusters/")) return `the Flux Kustomization ${docs[0].metadata.name} for the ${short.split("/")[1]} cluster, which reads <code>${escapeHtml(docs[0].spec.path)}</code> from Git`;
    if (short.endsWith("kustomization.yaml")) return "the Kustomize file for this directory";
    return escapeHtml(docs.map((doc) => `the ${doc.kind} ${doc.metadata.name}`).join(" and "));
  };
  const fileRows = beforeFiles.map((path) => [`<code>${escapeHtml(path.replace(/^before\//, ""))}</code>`, describe(path)]);

  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES[3].title,
    lead: "Flux keeps reconciling. ConfigHub holds a base and a variant per cluster for each layer, and each Flux Kustomization keeps its name and settings and reads a ConfigHub release instead of a path in Git.",
    opening: `    <p><strong>What you need.</strong> <code>git</code> and <code>cub</code> with the flux plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>The example is a Flux fleet in <a href="${sourceUrl}">confighub/examples</a>. Two clusters, dev and prod, each run two layers, infrastructure and then apps, from one GitRepository.</p>
      ${markdownLikeTable([["File", "What it is"], ...fileRows], { rawColumns: [0, 1] })}
    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what ConfigHub would hold</h2>
      <p>The plan reads the files and says what ConfigHub would hold. It runs nothing and changes no cluster.</p>
      ${terminal(escapeHtml, { title: "after: the plan for this Flux fleet", cmd: "cub flux plan . --require Healthy", output: plan, mark: [/^ {2}base {5}/, / variant flux-/, /^ {2}1\. keep each layer/] })}
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See what changes in each Kustomization</h2>
      <p>After the handover each layer's Kustomization keeps its name, so Flux keeps its inventory and reinstalls nothing. These are the only fields that change.</p>
      ${markdownLikeTable([["Cluster and layer", "Field", "Before", "After"], ...rows], { rawColumns: [1, 2, 3] })}
      <p>The interval, prune, dependsOn, health checks and target namespace stay as they are. Each layer also gets one new object, the OCIRepository it now reads.</p>
      ${markdownLikeTable([["Cluster and layer", "New object", "Reads"], ...added], { rawColumns: [2] })}
      <p><code>__CONFIGHUB_OCI__</code> stands for the gateway, the OCI address your ConfigHub serves releases from. You give it as <code>CONFIGHUB_OCI</code> when you run <code>apply.sh</code> and <code>handover.sh</code>.</p>
    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub</a> and the flux plugin as <a href="./bring-flux-into-confighub.html">Bring your Flux fleet into ConfigHub</a> shows, first.</p>
      ${commandBlock([
        { comment: "fetch the example at the commit this page was built from", cmd: `git clone https://github.com/confighub/examples.git && git -C examples checkout ${source.commit}` },
        { cmd: `cd examples/${source.path}` },
        { comment: "read the plan; it runs nothing", cmd: "cub flux plan . --require Healthy" },
        { comment: "write what Flux would run after the handover, and the scripts, to onboard/", cmd: "cub flux apply . --require Healthy --out onboard" },
      ])}
      <p>Compare <code>clusters/dev/apps.yaml</code> with <code>onboard/layers/dev/apps.yaml</code> to see the table above for yourself.</p>
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      ${commandBlock([
        { comment: "sign in to your organization", cmd: "cub auth login" },
        { comment: "fill ConfigHub with the bases and variants the plan names; it changes no cluster", cmd: "CONFIGHUB_OCI=<gateway> bash onboard/apply.sh" },
      ])}
      <p><code>onboard/cleanup.sh</code> takes everything back out. The handover, which moves Flux onto ConfigHub releases one cluster at a time, is a separate step in <a href="./bring-flux-into-confighub.html#connect-deployment">the Flux Guide</a>.</p>
      ${liveScreenshot("flux-beginner", escapeHtml)}
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>The plan ran on ${escapeHtml(rec.recordedOn)} with cub ${escapeHtml(rec.tools.cub)} and flux plugin ${escapeHtml(rec.tools.fluxPlugin)}, inside a checkout of the example. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output.</li>
        <li>Both layers prune, so anything a release lacks would be deleted. The plan says to prove first that each variant renders exactly what Git renders today.</li>
        <li>The <code>flux-system</code> bootstrap stays outside ConfigHub, because <code>flux bootstrap</code> owns it.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}


// What a Helm example measures, from its recorded files and its listing.
function helmFacts(id) {
  const rec = receipt(id);
  const listing = JSON.parse(readFileSync(join(repoRoot, "site/listings", `${rec.listing}.json`), "utf8"));
  const before = objects(read(id, "before/before.yaml"));
  const after = objects(readFileSync(join(repoRoot, Object.keys(rec.repoFiles)[0]), "utf8"));
  const key = (doc) => `${doc.kind}/${doc.metadata.namespace ?? ""}/${doc.metadata.name}`;
  const hook = (doc) => doc.metadata?.annotations?.["helm.sh/hook"];
  const hooks = before.filter(hook);
  const plain = before.filter((doc) => !hook(doc));
  const afterByKey = new Map(after.map((doc) => [key(doc), doc]));
  const same = plain.filter((doc) => afterByKey.has(key(doc)) && JSON.stringify(afterByKey.get(key(doc))) === JSON.stringify(doc));
  const changed = plain.filter((doc) => afterByKey.has(key(doc)) && JSON.stringify(afterByKey.get(key(doc))) !== JSON.stringify(doc));
  const onlyBefore = plain.filter((doc) => !afterByKey.has(key(doc)));
  const plainKeys = new Set(plain.map(key));
  const onlyAfter = after.filter((doc) => !plainKeys.has(key(doc)));
  const again = rec.files["before/before-again.yaml"] ? objects(read(id, "before/before-again.yaml")) : null;
  const rerendered = again ? fieldDifferences(before, again) : [];
  const plan = listing.routing?.requirements ?? [];
  return { rec, listing, before, after, hooks, plain, same, changed, onlyBefore, onlyAfter, rerendered, plan, key, afterByKey,
    crdsBefore: before.filter((doc) => doc.kind === "CustomResourceDefinition").length,
    crdsAfter: after.filter((doc) => doc.kind === "CustomResourceDefinition").length,
    crdsOnlyAfter: onlyAfter.filter((doc) => doc.kind === "CustomResourceDefinition").length };
}

// The one point a Helm page makes, chosen from what was measured.
function helmPoint(f) {
  const steps = `${f.plan.length} step${f.plan.length === 1 ? "" : "s"}`;
  if (f.rerendered.length) {
    return {
      kind: "random",
      lead: `With the chart's own defaults, every <code>helm template</code> run writes a new random password into a Secret, so two renders of the same chart differ. The Catalog's <code>${f.listing.identity.base}</code> base holds no Secret: its pods read one you create, and its plan names it.`,
      card: "With the chart's defaults every render writes a new random password. The Catalog's base holds no Secret and names the one you create.",
    };
  }
  if (f.hooks.length) {
    const crds = f.crdsOnlyAfter ? `, including the ${f.crdsOnlyAfter} CRDs that <code>helm template</code> leaves out,` : "";
    return {
      kind: "hooks",
      lead: `Plain <code>helm template</code> renders ${f.before.length} objects, and ${f.hooks.length} of them are Helm hooks that must never be applied with the rest. The Catalog's base holds the ${f.after.length} objects to apply${crds} and a plan of ${steps}.`,
      card: `Helm mixes ${f.hooks.length} hook objects into the ${f.before.length} it renders. The base holds the ${f.after.length} objects to apply${f.crdsOnlyAfter ? `, ${f.crdsOnlyAfter} CRDs among them,` : ""} and a plan of ${steps}.`,
    };
  }
  if (f.plan.length) {
    return {
      kind: "plan",
      lead: `The ${f.before.length} objects are the same on both sides. What the Workshop adds is the plan: ${steps} that the objects alone do not say.`,
      card: `The ${f.before.length} objects are the same on both sides. The Workshop adds a plan of ${steps} the objects do not say.`,
    };
  }
  return {
    kind: "nothing",
    lead: `The ${f.before.length} objects are the same on both sides, and the plan is empty: the Catalog records no step before, during or after the apply. This chart can be applied as its objects are.`,
    card: `The same ${f.before.length} objects on both sides and an empty plan. This chart can be applied as its objects are.`,
  };
}

export function helmCard(id) {
  return helmPoint(helmFacts(id)).card;
}

function helmListingPage(id, h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock } = h;
  const f = helmFacts(id);
  const { rec, listing } = f;
  const name = HELM_NAMES[id];
  const point = helmPoint(f);
  const checkBefore = transcriptLines(read(id, "transcripts/check-before.txt"));
  const checkAfter = transcriptLines(read(id, "transcripts/check-after.txt"));
  const base = listing.identity.base;
  const page = BEFORE_AFTER_PAGES.find((row) => row.id === id);

  check(listing.identity.id === rec.listing, `${ROOT}/${id} records ${rec.listing}, and the listing names ${listing.identity.id}`);
  check(f.after.length === listing.flattened.objectCount, `site/listings/${rec.listing}.json counts ${listing.flattened.objectCount} objects, and the retained file holds ${f.after.length}`);
  check(checkBefore.some((line) => line.includes(`${f.before.length} objects:`)) && checkBefore.some((line) => line.includes(`Helm hooks: ${f.hooks.length}`)), `${ROOT}/${id}/transcripts/check-before.txt does not report ${f.before.length} objects and ${f.hooks.length} hooks`);
  check(checkAfter.some((line) => line.includes(`${f.after.length} objects:`)) && checkAfter.some((line) => /Helm hooks: 0$/.test(line)), `${ROOT}/${id}/transcripts/check-after.txt does not report ${f.after.length} objects and no hooks`);
  check(f.onlyAfter.every((doc) => doc.kind === "CustomResourceDefinition") && f.crdsOnlyAfter === rec.chart.crdsFolder, `${ROOT}/${id}: the objects only the base holds are not the ${rec.chart.crdsFolder} CRDs of the chart's crds folder`);
  if (point.kind === "random") {
    check(rec.before === "defaults" && f.rerendered.length > 0 && !f.after.some((doc) => doc.kind === "Secret") && f.onlyBefore.every((doc) => doc.kind === "Secret") && f.plan.some((step) => step.type === "target-fact"), `${ROOT}/${id}: the page says the defaults make a random Secret and the base holds none and names one, and the recording does not show that`);
  } else {
    check(rec.before === "base" && f.changed.length === 0 && f.onlyBefore.length === 0, `${ROOT}/${id}: the page says every object the two sides share is the same, and ${f.changed.length + f.onlyBefore.length} differ`);
  }
  if (point.kind === "plan" || point.kind === "nothing") check(f.hooks.length === 0 && f.same.length === f.before.length && f.after.length === f.before.length, `${ROOT}/${id}: the page says the objects are the same on both sides`);
  const rerenderLines = rec.files["transcripts/diff-rerender.txt"] ? transcriptLines(read(id, "transcripts/diff-rerender.txt")) : [];
  if (point.kind === "random") check(rerenderLines[0]?.startsWith("Configuration diff: 0 added, 0 removed, 1 changed"), `${ROOT}/${id}/transcripts/diff-rerender.txt no longer reports one changed object`);
  const schemaFail = checkBefore.some((line) => /\[FAIL\] schema validation/.test(line));

  const hookRows = f.hooks.map((doc) => [doc.kind, `<code>${escapeHtml(doc.metadata.name)}</code>`, escapeHtml(doc.metadata.annotations["helm.sh/hook"])]);
  const planRows = f.plan.map((step) => [`<code>${escapeHtml(step.id)}</code>`, escapeHtml(step.type === "target-fact" ? "must exist on the target" : "a step of the apply"), escapeHtml(step.detail)]);
  const value = (v) => (v === undefined ? "not set" : `<code>${escapeHtml(String(v).length > 60 ? `${String(v).slice(0, 57)}...` : String(v))}</code>`);
  const changedRows = f.changed.flatMap((doc) => fieldDifferences([doc], [f.afterByKey.get(f.key(doc))]).map((row) => [escapeHtml(`${doc.kind} ${doc.metadata.name}`), `<code>${escapeHtml(row.path)}</code>`, value(row.left), value(row.right)]));
  const hookJobs = f.hooks.filter((doc) => doc.kind === "Job").map((doc) => doc.metadata.name);
  const hooksUnplanned = f.hooks.length > 0 && !f.plan.some((step) => /hook/i.test(step.detail) || hookJobs.some((job) => step.detail.includes(job)));
  const planHookCount = Number(f.plan.map((step) => step.detail.match(/defines (\d+) hook object/)?.[1]).find(Boolean) ?? 0);
  const movingImage = f.changed.flatMap((doc) => fieldDifferences([doc], [f.afterByKey.get(f.key(doc))])).find((row) => /\.image$/.test(row.path) && /:latest$/.test(String(row.left)) && /@sha256:/.test(String(row.right)))?.left;
  const helmTemplate = rec.commands[0];
  const getObjects = (listing.nextSteps ?? []).find((step) => step.id === "get-objects");
  check(getObjects?.commands?.[0]?.command?.startsWith("curl -fsSL -o "), `site/listings/${rec.listing}.json has no curl command for its objects`);
  const fetchAfter = getObjects.commands[0].command.replace(/-o \S+/, "-o after.yaml");
  const setup = getObjects.commands.find((command) => command.command.startsWith("cub installer setup"));
  const upload = (listing.nextSteps ?? []).find((step) => step.id === "upload")?.commands ?? [];
  const entryPage = `./charts/${listing.identity.page.split("/").pop()}`;
  const tableRows = [
    ["", "Before, helm template", `After, the ${base} base`],
    ["Objects", String(f.before.length), String(f.after.length)],
    ["Helm hook objects in the file", String(f.hooks.length), "0"],
    ["CRDs", String(f.crdsBefore), String(f.crdsAfter)],
    ...(point.kind === "random" ? [["A Secret with a generated password", "yes, new on every render", "no"]] : []),
    ...(movingImage ? [["Images on a moving tag", "yes, :latest", "no, pinned by digest"]] : []),
    ["Objects that are the same on both sides", String(f.same.length), String(f.same.length)],
    ["Plan steps", "none", String(f.plan.length)],
  ];

  return {
    eyebrow: "Before and after",
    title: page.title,
    lead: point.lead,
    opening: `    <p><strong>What you need.</strong> <code>helm</code>, <code>curl</code> and <code>cub</code> with the Workshop plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>${rec.before === "defaults" ? `You have the ${escapeHtml(name)} chart ${escapeHtml(rec.chart.version)} and its own defaults, which is how most people start.` : `You have the ${escapeHtml(name)} chart ${escapeHtml(rec.chart.version)} with the values of the Catalog's <code>${escapeHtml(base)}</code> base${rec.files["before/values.yaml"] ? `, shown in <a href="${GITHUB}/${ROOT}/${id}/before/values.yaml">values.yaml</a>` : ", which are the chart's defaults"}.`} Helm renders it like this, and the Workshop's check reads the result.</p>
      ${terminal(escapeHtml, { title: "before: plain helm template", first: [helmTemplate], cmd: "cub config check before.yaml", output: checkBefore, mark: [/Helm hooks: [1-9]/, /setup Jobs: [1-9]/, /CRDs: 0$/, /\[FAIL\]/, /tagged latest or not tagged: [1-9]/] })}
${point.kind === "random" ? `      <p>Render it a second time and compare the two.</p>
      ${terminal(escapeHtml, { title: "before: the same chart, rendered twice", first: [helmTemplate.replace("> before.yaml", "> before-again.yaml")], cmd: "cub config diff before.yaml before-again.yaml --summary", output: rerenderLines.slice(0, 2), mark: [/1 changed/] })}
      <p>${f.rerendered.length === 1 ? "One field" : `${f.rerendered.length} fields`} changed between the two renders: ${f.rerendered.map((row) => `<code>${escapeHtml(row.path)}</code> on ${escapeHtml(row.objects.join(", "))}`).join("; ")}. Apply the second render and the Secret no longer holds the password the database was first set up with.</p>
` : ""}${f.hooks.length ? `      <p>The ${f.hooks.length} hook objects sit in the same file as everything else. Apply the file and they run at once, outside the order Helm gives them.${hooksUnplanned ? ` No step of the plan mentions them, so the base leaves out what they do.` : ""}${planHookCount && planHookCount !== f.hooks.length ? ` The plan counts the ${planHookCount} hook objects the chart's templates define, and these values turn on ${f.hooks.length} of them.` : ""}</p>
      ${markdownLikeTable([["Kind", "Name", "Helm hook"], ...hookRows], { rawColumns: [1] })}
` : ""}${f.crdsOnlyAfter ? `      <p>The file holds none of the chart's ${f.crdsOnlyAfter} CRDs. They sit in its <code>crds</code> folder, which <code>helm template</code> leaves out. Helm installs them on the first install only, and never upgrades them.</p>
` : ""}    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what the Workshop gives you</h2>
      <p>The Catalog keeps the objects of its <code>${escapeHtml(base)}</code> base for this chart${rec.files["after/values.yaml"] ? `, rendered with <a href="${GITHUB}/${ROOT}/${id}/after/values.yaml">these values</a>` : ""}, and a plan for everything that is not an object to apply.</p>
      ${terminal(escapeHtml, { title: `after: the ${base} base`, cmd: "cub config check after.yaml", output: checkAfter, mark: [/Helm hooks: 0$/, /CRDs: [1-9]/] })}
      ${f.plan.length ? `<p>The plan has ${f.plan.length} step${f.plan.length === 1 ? "" : "s"}.</p>
      ${markdownLikeTable([["Step", "What it is", "What it says"], ...planRows], { rawColumns: [0] })}` : "<p>The plan is empty. The Catalog records nothing that must exist first and no step of the apply.</p>"}
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See what changed</h2>
      ${markdownLikeTable(tableRows)}
${changedRows.length ? `      <p>These are the fields that differ in the objects both sides hold.${movingImage ? ` The chart's default image is the moving tag <code>${escapeHtml(movingImage)}</code>, and the base pins it by digest, so it pulls the same bytes every time.` : ""}${point.kind === "random" ? " The base's pods read the Secret you create." : ""}</p>
      ${markdownLikeTable([["Object", "Field", "Before", "After"], ...changedRows], { rawColumns: [1, 2, 3] })}
` : ""}    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub and the Workshop plugin</a> first.</p>
      ${commandBlock([
        { comment: "before: render the chart as Helm does", cmd: helmTemplate },
        { cmd: "cub config check before.yaml" },
        { comment: "after: fetch the objects the Catalog keeps for this base", cmd: fetchAfter },
        { cmd: "cub config check after.yaml" },
      ])}
${rec.files["before/values.yaml"] ? `      <p>Save <a href="${GITHUB}/${ROOT}/${id}/before/values.yaml">values.yaml</a> next to the commands first.</p>\n` : ""}      <p><a href="${entryPage}#plan-${rec.listing}">The entry page</a> shows the plan and every other base of this chart.</p>
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      ${setup && upload.length === 3 ? commandBlock([
        { comment: "render the base from the signed package", cmd: setup.command },
        { comment: "sign in to your organization", cmd: upload[0].command },
        { comment: "load the objects as a Space of Units, under names you choose", cmd: upload[1].command },
        { comment: "list what was loaded", cmd: upload[2].command },
      ]) : `<p>The <a href="${entryPage}">entry page</a> gives the commands to load this base.</p>`}
      ${liveScreenshot(id, escapeHtml)}
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>Both checks ran on ${escapeHtml(rec.recordedOn)} with cub ${escapeHtml(rec.tools.cub)}, Workshop plugin ${escapeHtml(rec.tools.workshopPlugin)} and helm ${escapeHtml(rec.tools.helm)}. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output on this page.</li>
        <li>Both sides render for Kubernetes ${escapeHtml(rec.render.kubeVersion)}, as the Catalog does, so only the handling differs.</li>
        ${rec.chart.lockedSha256 ? "" : `<li>The Catalog's source lock records no SHA-256 for this chart, so the receipt records the one downloaded, <code>${escapeHtml(rec.chart.sha256)}</code>.</li>`}
        ${schemaFail ? `<li>The schema step fails the chart's own render on a quantity written as a number. Kubernetes accepts a number for a quantity, so this is a false alarm in the check.</li>` : ""}
        <li>No step of the plan has been run on a cluster for this page. The plan says what a delivery workflow must do, and nothing runs it automatically.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

// Every field that differs between builds of the same objects, one column per
// build. Objects are matched by kind and name, since the namespace is what
// differs.
function multiDifferences(builds) {
  const names = Object.keys(builds);
  const key = (doc) => `${doc.kind}/${doc.metadata.name}`;
  const byName = Object.fromEntries(names.map((name) => [name, new Map(builds[name].map((doc) => [key(doc), leaves(doc)]))]));
  const rows = new Map();
  for (const object of [...byName[names[0]].keys()]) {
    const paths = new Set(names.flatMap((name) => Object.keys(byName[name].get(object) ?? {})));
    for (const path of [...paths].sort()) {
      const values = names.map((name) => byName[name].get(object)?.[path]);
      if (values.every((v) => v === values[0])) continue;
      const id = `${path}\u0000${values.join("\u0000")}`;
      if (!rows.has(id)) rows.set(id, { path, values, objects: [] });
      rows.get(id).objects.push(object);
    }
  }
  return [...rows.values()];
}

function kustomizeHelmPage(h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock } = h;
  const id = "kustomize-helm-chart";
  const rec = receipt(id);
  const envs = Object.keys(rec.files).filter((path) => /^after\/[^/]+\.yaml$/.test(path)).map((path) => path.slice(6, -5));
  const order = ["dev", "staging", "prod"].filter((env) => envs.includes(env));
  check(order.length === envs.length && order.length === 3, `${ROOT}/${id}: the page describes dev, staging and prod, and the recording holds ${envs.join(", ")}`);
  const builds = Object.fromEntries(order.map((env) => [env, objects(read(id, `after/${env}.yaml`))]));
  const diffs = multiDifferences(builds);
  const base = read(id, "before/base/kustomization.yaml");
  check(/helmCharts:/.test(base) && !/^namespace:/m.test(base), `${ROOT}/${id}: the base no longer inflates a chart without a namespace`);
  for (const env of order) check(/path: \/metadata\/namespace/.test(read(id, `before/overlays/${env}/kustomization.yaml`)), `${ROOT}/${id}: the ${env} overlay no longer patches the namespace in`);
  const nsRow = diffs.find((row) => row.path === "metadata.namespace");
  check(nsRow && order.every((env, i) => nsRow.values[i] === `storefront-${env}`), `${ROOT}/${id}: the builds no longer put each object in storefront-<env>`);
  const kinds = Object.entries(countKinds(builds.prod)).map(([kind, n]) => `${n} ${kind}`).join(" and ");
  const checkProd = transcriptLines(read(id, "transcripts/check-prod.txt"));
  check(checkProd.some((line) => line.includes(`${builds.prod.length} objects:`)), `${ROOT}/${id}/transcripts/check-prod.txt does not report ${builds.prod.length} objects`);
  const source = rec.sources[0];
  const sourceUrl = `${source.repository}/tree/${source.commit}/${source.path}`;
  const value = (v) => (v === undefined ? "not set" : `<code>${escapeHtml(String(v))}</code>`);
  const fileRows = Object.keys(rec.files).filter((path) => path.startsWith("before/")).sort().map((path) => {
    const short = path.replace(/^before\//, "");
    const what = short === "base/kustomization.yaml" ? "inflates the chart with its values and adds a label"
      : /^overlays\/.*kustomization\.yaml$/.test(short) ? `adds the environment label and patches in ${[...new Set([...read(id, path).matchAll(/path: (\/\S+)/g)].map((m) => m[1]))].map((p) => p === "/metadata/namespace" ? "the namespace" : p.replace(/^\/spec\/template\/spec\/containers\/0\//, "the container's ").replace(/^\/spec\//, "").replaceAll("/", " ")).join(", ")}`
      : short.startsWith("base/charts/") ? "part of the Helm chart, kept in the repository" : "";
    return [`<code>${escapeHtml(short)}</code>`, escapeHtml(what)];
  });
  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES.find((page) => page.id === id).title,
    lead: "This app is a Helm chart that Kustomize inflates, and Kustomize's <code>namespace:</code> setting does not reach objects that come from a chart, so each overlay patches the namespace in. Built flat, each environment is one file, and you can read the namespace every object gets.",
    opening: `    <p><strong>What you need.</strong> <code>kustomize</code>, <code>helm</code>, <code>git</code> and <code>cub</code> with the Workshop plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>The example is the checkout cache of a storefront in <a href="${sourceUrl}">confighub/examples</a>. Its base wraps a small Helm chart, and three overlays set dev, staging and prod.</p>
      ${markdownLikeTable([["File", "What it does"], ...fileRows], { rawColumns: [0] })}
      <p>To see what any environment runs, Kustomize has to call Helm. <code>kustomize build</code> refuses the chart unless you pass <code>--enable-helm</code>.</p>
    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what the Workshop gives you</h2>
      <p>Each overlay builds into one flat file of ${escapeHtml(kinds)}. The Workshop's check reads each one.</p>
      ${terminal(escapeHtml, { title: "after: prod, built flat", first: ["kustomize build --enable-helm overlays/prod > prod.yaml"], cmd: "cub config check prod.yaml", output: checkProd, mark: [/objects:/] })}
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See every field that differs</h2>
      <p>These are all the differences between the three builds.</p>
      ${markdownLikeTable([["Field", ...order, "On"], ...diffs.map((row) => [`<code>${escapeHtml(row.path)}</code>`, ...row.values.map(value), escapeHtml(row.objects.join(", "))])], { rawColumns: [0, 1, 2, 3] })}
      <p>The namespace row is the one the overlays work for. Drop a patch, and that object lands in whatever namespace Argo CD is told to use.</p>
    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub and the Workshop plugin</a>, <code>kustomize</code> and <code>helm</code> first.</p>
      ${commandBlock([
        { comment: "fetch the example at the commit this page was built from", cmd: `git clone https://github.com/confighub/examples.git && git -C examples checkout ${source.commit}` },
        { cmd: `cd examples/${source.path}` },
        { comment: "build each overlay flat; Kustomize calls Helm for the chart", cmd: "for env in dev staging prod; do kustomize build --enable-helm overlays/$env > $env.yaml; done" },
        { cmd: "cub config check prod.yaml" },
      ])}
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      <p>This app is one of the children of an Argo CD app of apps. <a href="./bring-argo-into-confighub.html">Bring your Argo CD apps into ConfigHub</a> loads the whole estate, and <code>apply.sh</code> builds each overlay as above before it saves it.</p>
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>The builds and checks ran on ${escapeHtml(rec.recordedOn)} with kustomize ${escapeHtml(rec.tools.kustomize)}, helm ${escapeHtml(rec.tools.helm)}, cub ${escapeHtml(rec.tools.cub)} and Workshop plugin ${escapeHtml(rec.tools.workshopPlugin)}. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output.</li>
        <li>What a chart inflates can change with the helm version Kustomize calls, so the flat files are the ones to review, not the overlays.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

function argoAppSetPage(h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock } = h;
  const id = "argo-applicationset";
  const rec = receipt(id);
  const plan = transcriptLines(read(id, "transcripts/argo-plan.txt"));
  const appFiles = Object.keys(rec.files).filter((path) => path.startsWith("after/apps/")).sort();
  const apps = appFiles.map((path) => readYamlText(read(id, path)));
  check(apps.length === 2, `${ROOT}/${id}: the page describes two generated Applications, and the recording has ${apps.length}`);
  check(apps.every((doc) => doc.metadata.name.startsWith("apptique-")), `${ROOT}/${id}: a generated Application is not named apptique-<directory>`);
  const appset = readYamlText(read(id, "before/bootstrap/applicationset.yaml"));
  check(appset.kind === "ApplicationSet" && /\{\{path\.basename\}\}/.test(JSON.stringify(appset.spec.template)), `${ROOT}/${id}: the ApplicationSet's template no longer uses path.basename`);
  check(plan.some((line) => line.includes("selects  2 directories")) && plan.some((line) => line.includes("applied by hand, so its template cannot be repointed under review")), `${ROOT}/${id}/transcripts/argo-plan.txt no longer says what the page restates`);
  const diffs = fieldDifferences([apps[0]], [apps[1]].map((doc) => ({ ...doc, metadata: { ...doc.metadata, name: apps[0].metadata.name } })));
  const templateLeaves = leaves(appset.spec.template);
  const templateValue = (path) => templateLeaves[path];
  const source = rec.sources[0];
  const sourceUrl = `${source.repository}/tree/${source.commit}/${source.path}`;
  const fileRows = Object.keys(rec.files).filter((path) => path.startsWith("before/")).sort().map((path) => {
    const short = path.replace(/^before\//, "");
    return [`<code>${escapeHtml(short)}</code>`, escapeHtml(short.startsWith("bootstrap/") ? "the ApplicationSet, applied by hand: one Application per directory under overlays/" : short.endsWith("kustomization.yaml") ? "a Kustomize file" : objects(read(id, path)).map((doc) => `the ${doc.kind} ${doc.metadata.name}`).join(" and "))];
  });
  check(diffs.every((row) => templateValue(row.path) !== undefined), `${ROOT}/${id}: a field the Applications differ in has no line in the template`);
  const rows = diffs.map((row) => [`<code>${escapeHtml(row.path)}</code>`, `<code>${escapeHtml(String(templateValue(row.path) ?? ""))}</code>`, `<code>${escapeHtml(String(row.left))}</code>`, `<code>${escapeHtml(String(row.right))}</code>`]);
  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES.find((page) => page.id === id).title,
    lead: `An ApplicationSet is a template with placeholders, and Argo CD fills them in on the cluster. The plan writes out the ${apps.length} Applications it would generate, so you can read them before Argo CD makes them, and ConfigHub holds a base and a variant for each.`,
    opening: `    <p><strong>What you need.</strong> <code>git</code> and <code>cub</code> with the argo plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>The example is an ApplicationSet in <a href="${sourceUrl}">confighub/examples</a>. Its git directory generator makes one Application for each directory under <code>overlays/</code>.</p>
      ${markdownLikeTable([["File", "What it is"], ...fileRows], { rawColumns: [0] })}
      <p>Nothing in these files names the Applications. They exist only once Argo CD has run the generator.</p>
    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what ConfigHub would hold</h2>
      <p>The plan reads the files and says what ConfigHub would hold. It runs nothing and changes no cluster.</p>
      ${terminal(escapeHtml, { title: "after: the plan for this ApplicationSet", cmd: "cub argo plan .", output: plan, mark: [/selects /, /^ {2}base {5}/, / variant argo-/, /^ {2}2\. ApplicationSet/] })}
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See the Applications it would generate</h2>
      <p>These are the fields where the generated Applications differ, with the template line each one comes from.</p>
      ${markdownLikeTable([["Field", "In the template", apps[0].metadata.name, apps[1].metadata.name], ["<code>metadata.name</code>", `<code>${escapeHtml(appset.spec.template.metadata.name)}</code>`, `<code>${escapeHtml(apps[0].metadata.name)}</code>`, `<code>${escapeHtml(apps[1].metadata.name)}</code>`], ...rows], { rawColumns: [0, 1, 2, 3] })}
      <p>Everything else in the two Applications is the template as written.</p>
    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub</a> and the argo plugin as <a href="./bring-argo-into-confighub.html">Bring your Argo CD apps into ConfigHub</a> shows, first.</p>
      ${commandBlock([
        { comment: "fetch the example at the commit this page was built from", cmd: `git clone https://github.com/confighub/examples.git && git -C examples checkout ${source.commit}` },
        { cmd: `cd examples/${source.path}` },
        { comment: "read the plan; it runs nothing", cmd: "cub argo plan ." },
        { comment: "write the generated Applications, and the scripts, to onboard/", cmd: "cub argo apply . --out onboard" },
      ])}
      <p>The generated Applications are in <code>onboard/apps/</code>.</p>
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      ${commandBlock([
        { comment: "sign in to your organization", cmd: "cub auth login" },
        { comment: "fill ConfigHub with the base and variants the plan names; it changes no cluster", cmd: "bash onboard/apply.sh" },
      ])}
      <p><code>apply.sh</code> also needs <code>kustomize</code>, and <code>onboard/cleanup.sh</code> takes everything back out.</p>
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>The plan ran on ${escapeHtml(rec.recordedOn)} with cub ${escapeHtml(rec.tools.cub)} and argo plugin ${escapeHtml(rec.tools.argoPlugin)}, inside a checkout of the example. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output.</li>
        <li>This ApplicationSet is applied by hand, so the handover cannot repoint its template under review. The plan says to patch the template in the cluster, or to delete it with <code>--cascade=orphan</code> and repoint each Application.</li>
        <li>Never delete every Application it generates. Their finalizer deletes everything they deployed.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

function fluxFleetPage(h) {
  const { check, escapeHtml, markdownLikeTable, commandBlock } = h;
  const id = "flux-expert-fleet";
  const rec = receipt(id);
  const plan = transcriptLines(read(id, "transcripts/flux-plan.txt"));
  const head = plan[0].match(/^Flux fleet: (\d+) clusters, (\d+) layers, (\d+) variants$/);
  check(head, `${ROOT}/${id}/transcripts/flux-plan.txt changed its summary`);
  const [, clusterCount, layerCount, variantCount] = head.map(Number);
  const inFlight = plan.find((line) => /^\s+in flight\s+/.test(line));
  check(inFlight, `${ROOT}/${id}/transcripts/flux-plan.txt no longer says which version runs where`);
  const [, imageName, placements] = inFlight.match(/in flight\s+(\S+): (.*)$/);
  const versions = placements.split("; ").map((part) => part.match(/^(\S+) on (\S+)$/)).filter(Boolean).map(([, version, cluster]) => ({ version, cluster }));
  const layerFiles = Object.keys(rec.files).filter((path) => path.startsWith("after/layers/")).sort();
  const clusters = [...new Set(layerFiles.map((path) => path.split("/")[2]))];
  const layers = [...new Set(layerFiles.map((path) => path.split("/")[3].replace(/\.yaml$/, "")))];
  check(clusters.length === clusterCount && layers.length === layerCount && layerFiles.length === variantCount, `${ROOT}/${id}: the recorded layers do not match the plan's ${clusterCount} clusters, ${layerCount} layers and ${variantCount} variants`);
  check(versions.length === clusterCount && versions.every((row) => clusters.includes(row.cluster)), `${ROOT}/${id}: the in-flight line does not name every cluster`);
  const order = ["infrastructure", "apps", "tenants", "image-automation"].filter((layer) => layers.includes(layer));
  const beforeFiles = Object.keys(rec.files).filter((path) => path.startsWith("before/"));
  const objectCount = beforeFiles.reduce((n, path) => n + objects(read(id, path)).length, 0);
  check(plan[1] === `Read ${objectCount} objects`, `${ROOT}/${id}: the plan read ${plan[1]}, and the recorded files hold ${objectCount} objects`);
  const byDir = beforeFiles.reduce((m, path) => { const dir = path.split("/")[1]; m[dir] = (m[dir] ?? 0) + 1; return m; }, {});
  const source = rec.sources[0];
  const sourceUrl = `${source.repository}/tree/${source.commit}/${source.path}`;
  check(plan.some((line) => /Clusters, one stage each, in order: dev-1 .*, staging-1 .*, prod-1 /.test(line)) && plan.some((line) => /image .* \(written by image automation\)/.test(line)), `${ROOT}/${id}/transcripts/flux-plan.txt no longer gives the stage order or the image automation the page restates`);
  const matrix = versions.map(({ cluster }) => cluster).map((cluster) => [escapeHtml(cluster), ...order.map((layer) => (rec.files[`after/layers/${cluster}/${layer}.yaml`] ? "yes" : "no")), `<code>${escapeHtml(`${imageName} ${versions.find((row) => row.cluster === cluster).version}`)}</code>`]);
  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES.find((page) => page.id === id).title,
    lead: `This Flux fleet spreads over ${clusterCount} clusters, ${layerCount} layers and ${beforeFiles.length} files, so which version runs where is a question of reading all of them. The plan makes ${variantCount} variants of it, and one line answers that question.`,
    opening: `    <p><strong>What you need.</strong> <code>git</code> and <code>cub</code> with the flux plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. See what you have today</h2>
      <p>The example is a Flux fleet in <a href="${sourceUrl}">confighub/examples</a>, with ${objectCount} objects across these directories.</p>
      ${markdownLikeTable([["Directory", "Files"], ...Object.entries(byDir).sort().map(([dir, n]) => [`<code>${escapeHtml(dir)}/</code>`, String(n)])], { rawColumns: [0] })}
      <p>Each cluster's directory names the layers it runs, the layers have overlays per environment, and image automation writes new tags into the dev overlay of the app.</p>
    </section>
    <section aria-labelledby="after">
      <h2 id="after">2. See what ConfigHub would hold</h2>
      <p>The plan reads all of it and says what ConfigHub would hold. It runs nothing and changes no cluster.</p>
      ${terminal(escapeHtml, { title: "after: the plan for this Flux fleet", cmd: "cub flux plan . --require Healthy", output: plan, mark: [/^Flux fleet:/, /^ {2}base {5}/, /in flight/] })}
    </section>
    <section aria-labelledby="point">
      <h2 id="point">3. See which version runs where</h2>
      <p>Each row is a cluster, and each column a layer it runs as a variant in ConfigHub.</p>
      ${markdownLikeTable([["Cluster", ...order, `${imageName} it runs`], ...matrix], { rawColumns: [0, order.length + 1] })}
      <p>Dev runs the newest version, which image automation wrote there, and staging and prod run older ones, set in their own overlays. In ConfigHub the three clusters are three stages in that order, so a version moves from dev to staging to prod.</p>
    </section>
    <section aria-labelledby="try">
      <h2 id="try">4. Try it yourself, with no account</h2>
      <p><a href="./try.html#install-cub">Install cub</a> and the flux plugin as <a href="./bring-flux-into-confighub.html">Bring your Flux fleet into ConfigHub</a> shows, first.</p>
      ${commandBlock([
        { comment: "fetch the example at the commit this page was built from", cmd: `git clone https://github.com/confighub/examples.git && git -C examples checkout ${source.commit}` },
        { cmd: `cd examples/${source.path}` },
        { comment: "read the plan; it runs nothing", cmd: "cub flux plan . --require Healthy" },
        { comment: "write what Flux would run after the handover, and the scripts, to onboard/", cmd: "cub flux apply . --require Healthy --out onboard" },
      ])}
    </section>
    <details class="ba-live" id="live">
      <summary>See it live in ConfigHub</summary>
      ${liveIntro()}
      <h3 id="live-own-account">With your own account</h3>
      ${commandBlock([
        { comment: "sign in to your organization", cmd: "cub auth login" },
        { comment: "fill ConfigHub with the bases and variants the plan names; it changes no cluster", cmd: "CONFIGHUB_OCI=<gateway> bash onboard/apply.sh" },
      ])}
      <p><code>onboard/cleanup.sh</code> takes everything back out. The handover is a separate step in <a href="./bring-flux-into-confighub.html#connect-deployment">the Flux Guide</a>.</p>
    </details>
    <section aria-labelledby="notes">
      <h2 id="notes">5. Technical notes and disclaimers</h2>
      <ul>
        <li>The plan ran on ${escapeHtml(rec.recordedOn)} with cub ${escapeHtml(rec.tools.cub)} and flux plugin ${escapeHtml(rec.tools.fluxPlugin)}, inside a checkout of the example. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output.</li>
        <li>The versions are what the repository says each cluster should run, read from its files. Nothing on this page reads a live cluster.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

// The version each cluster runs, from the plan's in-flight line, for the
// simple Flux page. The detail page reads the same line.
function fleetVersionsHtml({ check, escapeHtml }) {
  const id = "flux-expert-fleet";
  const inFlight = transcriptLines(read(id, "transcripts/flux-plan.txt")).find((line) => /^\s+in flight\s+/.test(line));
  check(inFlight, `${ROOT}/${id}/transcripts/flux-plan.txt no longer says which version runs where`);
  const [, imageName, placements] = inFlight.match(/in flight\s+(\S+): (.*)$/);
  const rows = placements.split("; ").map((part) => part.match(/^(\S+) on (\S+)$/)).filter(Boolean);
  check(rows.length >= 2, `${ROOT}/${id}: the in-flight line names fewer than two clusters`);
  return `<table class="ex-versions"><thead><tr><th>Cluster</th><th>${escapeHtml(imageName)} version</th></tr></thead><tbody>${rows.map(([, version, cluster]) => `<tr><td>${escapeHtml(cluster)}</td><td><code>${escapeHtml(version)}</code></td></tr>`).join("")}</tbody></table>
          <p class="ex-note">This is what the repository says each cluster should run. Nothing here reads a live cluster.</p>`;
}

// The simple pages: two pictures, three sentences, two buttons and a link to
// the detailed page. They are for someone seeing this for the first time.
const EXAMPLES_SHA = "7f1b8f2fc849bb6488bc2c58f1469172018fc9dd";
const clone = `git clone https://github.com/confighub/examples.git && git -C examples checkout ${EXAMPLES_SHA}`;
const HELM_SIMPLE = [
  ["helm-redis", "redis", "Redis"], ["helm-postgresql", "postgresql", "PostgreSQL"], ["helm-ingress-nginx", "ingress-nginx", "ingress-nginx"],
  ["helm-cert-manager", "cert-manager", "cert-manager"], ["helm-kube-prometheus-stack", "kube-prometheus-stack", "kube-prometheus-stack"],
  ["helm-argo-cd", "argo-cd", "Argo CD"], ["helm-external-secrets", "external-secrets", "External Secrets"],
  ["helm-metrics-server", "metrics-server", "metrics-server"], ["helm-gatekeeper", "gatekeeper", "Gatekeeper"], ["helm-gpu-operator", "gpu-operator", "NVIDIA GPU Operator"],
];
const GITOPS_SIMPLE = [
  {
    id: "kustomize-apptique", file: "example-kustomize-dev-and-prod.html", name: "Kustomize dev and prod", kicker: "Kustomize overlays",
    lead: "A base and two overlays become one base with dev and prod variants, and prod's changes are listed in one place.",
    before: "before/prod/kustomization.yaml", beforeLabel: "Before: the prod overlay",
    sentences: ["Prod's changes from the base are listed in one place: namespace, label, 3 replicas and its resources.", "Dev and prod stay linked to one base, so a change to the base can reach both.", "Every object is written out, with nothing left to work out from patches."],
    facts: [["after/prod.yaml", /replicas: 3/]],
    dir: "gitops/argo/intermediate-ci-to-gitops/gitops-repo/environments/apptique",
    load: ["kustomize build base > base.yaml",
      "cub variant upload --component apptique-example --variant base --namespace apptique --create-namespace --change-desc \"Seed the base from the repository base directory\" base.yaml",
      "cub function set --space apptique-example-base --unit frontend --change-desc \"Run image tag v1.3.0\" set-container-image-reference server :v1.3.0",
      "cub variant create dev apptique-example-base --namespace apptique-dev --change-desc \"Clone the base as dev\"",
      "cub variant create prod apptique-example-base --namespace apptique-prod --change-desc \"Clone the base as prod\"",
      "cub function set --space apptique-example-dev --change-desc \"Label every object environment dev\" set-label environment dev",
      "cub function set --space apptique-example-prod --change-desc \"Label every object environment prod\" set-label environment prod",
      "cub function set --space apptique-example-prod --unit frontend --change-desc \"Run three replicas in prod\" set-replicas 3",
      "cub function set --space apptique-example-prod --unit frontend --change-desc \"Give prod the requests and limits of the prod overlay\" set-container-resources server all 200m 128Mi 2"],
    laptop: ["kustomize build prod > prod.yaml", "cub config check prod.yaml"], needs: "kustomize", laptopNeeds: "kustomize and the Workshop plugin",
    laptopNote: "No account needed. This writes out every object prod runs and checks what it installs.", safety: "It touches no cluster.",
    units: "Each variant holds 4 Units in ConfigHub, one per object.",
    rows: [{ does: "Prod is the base plus an overlay of patches, labels and a namespace, so you work out prod's objects in your head.", instead: "Each variant holds its finished objects, and prod's panel lists only what prod changes." }, { does: "Nothing else. There are no CRDs and no Helm hooks.", instead: "Nothing else to move." }],
  },
  {
    id: "kustomize-helm-chart", file: "example-kustomize-helm-chart.html", name: "A Helm chart inside Kustomize", kicker: "Kustomize with a Helm chart",
    lead: "A Helm chart inflated by Kustomize becomes one base with a variant per environment, and prod's changes are listed in one place.",
    before: "before/base/kustomization.yaml", beforeLabel: "Before: Kustomize inflating a chart",
    sentences: ["Prod's changes from the base are listed in one place: namespace, label, 3 replicas and a 1Gi memory limit.", "Each object lands in the namespace you can see, not the one Argo CD happens to use.", "No one has to run Helm inside Kustomize to know what an environment runs."],
    facts: [["after/prod.yaml", /replicas: 3/], ["after/prod.yaml", /memory: 1Gi/]],
    dir: "gitops/argo/expert-app-of-apps/apps/checkout-cache",
    load: ["kustomize build --enable-helm base > base.yaml",
      "cub variant upload --component checkout-cache-example --variant base --namespace storefront --change-desc \"Seed the base from the chart Kustomize inflates\" base.yaml",
      "for env in dev staging prod; do cub variant create $env checkout-cache-example-base --namespace storefront-$env --change-desc \"Clone the base as $env\"; done",
      "for env in dev staging prod; do cub function set --space checkout-cache-example-$env --change-desc \"Label every object environment $env\" set-label environment $env; done",
      "cub function set --space checkout-cache-example-staging --unit checkout-cache --change-desc \"Run two replicas in staging\" set-replicas 2",
      "cub function set --space checkout-cache-example-prod --unit checkout-cache --change-desc \"Run three replicas in prod\" set-replicas 3",
      "cub function set --space checkout-cache-example-prod --unit checkout-cache --change-desc \"Give prod a 1Gi memory limit\" -- set-yq '.spec.template.spec.containers[0].resources.limits.memory = \"1Gi\"'"],
    laptop: ["kustomize build --enable-helm overlays/prod > prod.yaml", "cub config check prod.yaml"], needs: "kustomize and helm", laptopNeeds: "kustomize, helm and the Workshop plugin",
    laptopNote: "No account needed. This writes out every object prod runs and checks what it installs.", safety: "It touches no cluster.",
    units: "Each variant holds 2 Units in ConfigHub, one per object.",
    rows: [{ does: "Kustomize runs Helm every time it builds, so you cannot see what the chart makes without building it.", instead: "Helm runs once, and what it renders becomes the base, with a variant for each environment." }, { does: "Nothing else. The chart has no CRDs and no Helm hooks.", instead: "Nothing else to move." }],
  },
  {
    id: "argo-app-of-apps", file: "example-argo-cd-app-of-apps.html", name: "An Argo CD app of apps", kicker: "Argo CD app of apps",
    lead: "Your Argo CD apps are held in ConfigHub as a base and a variant for each cluster, while Argo CD keeps syncing Git.",
    before: "before/apps/apptique-prod.yaml", beforeLabel: "Before: an Argo CD Application",
    sentences: ["Each app becomes a base and a variant for the cluster it runs on, released and ready.", "You can read what prod runs in ConfigHub, here 3 replicas of the frontend.", "Argo CD keeps syncing Git until you choose to hand over."],
    facts: [["before/manifests/apptique/prod/deployment.yaml", /replicas: 3/]],
    dir: "gitops/argo/beginner-app-of-apps",
    load: ["cub argo apply . --out onboard", "bash onboard/apply.sh"],
    laptop: ["cub argo plan ."], needs: "the argo plugin and kustomize", safety: "It touches no cluster, and Argo CD keeps syncing Git until you run handover.sh, the step that moves each Application onto ConfigHub's releases.", ownRepo: "In your own Argo CD repository, run the last line from its root.",
    units: "Each variant is one Unit in ConfigHub, holding everything its Application deploys.",
    rows: [{ does: "A root Application makes other Applications, and each one points at a folder in Git.", instead: "The root and its Applications stay with Argo CD as the control tree. What each Application deploys is a base in ConfigHub, with a variant for its cluster." }, { does: "Argo CD syncs whatever is in Git.", instead: "Argo CD keeps syncing Git until you run handover.sh, which points each Application at ConfigHub's releases." }],
  },
  {
    id: "argo-applicationset", file: "example-argo-cd-applicationset.html", name: "An Argo CD ApplicationSet", kicker: "Argo CD ApplicationSet",
    lead: "An ApplicationSet's template becomes the Applications it would make, each a variant of one base, with prod's changes listed in one place.",
    before: "before/bootstrap/applicationset.yaml", beforeLabel: "Before: a template with placeholders",
    sentences: ["The two Applications the template would make are written out as variants of one base.", "Prod's changes from the base are listed in one place: namespace, label, 3 replicas and its resources.", "Nothing is generated on the cluster before you have read it."],
    facts: [["before/apps/apptique/overlays/prod/kustomization.yaml", /value: 3/]],
    dir: "gitops/argo/beginner-applicationset",
    load: ["cub argo apply . --prefix appset --out onboard", "bash onboard/apply.sh"],
    laptop: ["cub argo plan ."], needs: "the argo plugin and kustomize", safety: "It touches no cluster, and Argo CD keeps syncing Git until you run handover.sh, the step that moves each Application onto ConfigHub's releases.", ownRepo: "In your own Argo CD repository, run the last line from its root.",
    units: "Each variant is one Unit in ConfigHub, holding everything its Application deploys.",
    rows: [{ does: "An ApplicationSet makes Applications from a template on the cluster, so you never see them before they exist.", instead: "The template is filled in here, one Application per environment, each a variant of one base." }, { does: "The ApplicationSet was applied by hand.", instead: "It stays in the cluster. The plan says handover must patch it or repoint its Applications one by one." }],
  },
  {
    id: "flux-beginner", file: "example-flux-fleet.html", name: "A Flux fleet", kicker: "Flux fleet",
    lead: "Your Flux layers are held in ConfigHub as a base and a variant for each cluster, while Flux keeps reconciling Git.",
    before: "before/clusters/prod/apps.yaml", beforeLabel: "Before: a Flux Kustomization",
    sentences: ["Each layer becomes a base and a variant for each cluster.", "Prod's changes from the base are listed in one place: namespace, label, 3 replicas and its resources.", "Flux keeps reconciling Git until you choose to hand over."],
    facts: [["before/apps/prod/kustomization.yaml", /value: 3/]],
    dir: "gitops/flux/beginner",
    load: ["cub flux apply . --require Healthy --out onboard", "CONFIGHUB_OCI=oci.hub.confighub.com bash onboard/apply.sh"],
    laptop: ["cub flux plan . --require Healthy"], needs: "the flux plugin and kustomize", safety: "It touches no cluster, and Flux keeps reconciling Git until you run handover.sh, the step that moves each cluster onto ConfigHub's releases.", ownRepo: "In your own Flux repository, run the last line from its root.",
    units: "Each variant is one Unit in ConfigHub, holding everything its layer applies on that cluster.",
    rows: [{ does: "Each cluster's Kustomization points at an overlay in Git, and Flux applies it.", instead: "Each layer is a base in ConfigHub with a variant for each cluster. The Kustomization stays in Flux, and after handover it reads ConfigHub instead of Git." }, { does: "flux bootstrap owns flux-system.", instead: "It stays outside ConfigHub, and the plan lists it." }],
  },
  {
    id: "flux-expert-fleet", file: "example-flux-which-version-where.html", name: "Which version runs where", kicker: "Flux fleet",
    lead: "Three clusters and four layers become one base per layer with a variant for each cluster, so you can see which version Git says each cluster runs.",
    before: "before/apps/prod/kustomization.yaml", beforeLabel: "Before: one of many overlays",
    sentences: ["Each layer is one base, with a variant for each cluster that runs it.", "Prod-1's changes are listed in one place, here nginx 1.26.3 and 4 replicas.", "Dev, staging and prod are stages in that order, so a version moves from one to the next."],
    facts: [["before/apps/prod/kustomization.yaml", /newTag: 1\.26\.3-alpine/], ["before/apps/prod/kustomization.yaml", /value: 4/]],
    dir: "gitops/flux/expert-fleet",
    load: ["cub flux apply . --require Healthy --prefix fleet --out onboard", "CONFIGHUB_OCI=oci.hub.confighub.com bash onboard/apply.sh"],
    laptop: ["cub flux plan . --require Healthy"], needs: "the flux plugin and kustomize", safety: "It touches no cluster, and Flux keeps reconciling Git until you run handover.sh, the step that moves each cluster onto ConfigHub's releases.", ownRepo: "In your own Flux repository, run the last line from its root.",
    units: "Each variant is one Unit in ConfigHub, holding everything its layer applies on that cluster.",
    rows: [{ does: "Image automation writes new tags into the dev overlay.", instead: "It keeps doing so, and the plan names it, so you know dev's version can change without a review." }, { does: "A HelmRelease pins edge-router to 2.4.x, so its version can change at any reconcile.", instead: "The plan says to pin one exact version, so what runs changes only when a release says so." }],
  },
];

// Apps, not charts: the before is the app's own YAML, and the after is what
// ConfigHub says it needs and a check of a platform that carries it.
const APP_SIMPLE = [
  {
    id: "app-shop-web", file: "example-app-shop-web.html", name: "The shop-web app", kicker: "App", noClone: true,
    lead: "An app's YAML never says what the cluster must already run. ConfigHub lists what the app needs, and checks it against a platform.",
    before: "before/shop-web.yaml", beforeLabel: "Before: the app's YAML",
    beforeNote: "The app's five objects, as its team wrote them.",
    sentences: ["ConfigHub lists what the app needs from a platform: an ingress controller, cert-manager and a Prometheus operator.", "The platform check confirms shop-platform provides all three, and warns about the one thing it cannot see, the letsencrypt ClusterIssuer.", "Dev and prod are variants of one base, and prod's changes are listed in one place."],
    facts: [["transcripts/app-check.txt", /\[NEEDS\] an ingress controller/], ["transcripts/app-check.txt", /\[NEEDS\] cert-manager/], ["transcripts/app-check.txt", /\[NEEDS\] a Prometheus operator/], ["transcripts/stack-sandbox.txt", /app needs met: shop-web/], ["transcripts/stack-sandbox.txt", /ClusterIssuer\/letsencrypt/]],
    load: [
      "cub app upload shop-web --run",
      "cub variant create dev shop-web-base --change-desc \"Clone the base as dev\"",
      "cub variant create prod shop-web-base --change-desc \"Clone the base as prod\"",
      "cub function set --space shop-web-dev --change-desc \"Label every object environment dev\" set-label environment dev",
      "cub function set --space shop-web-prod --change-desc \"Label every object environment prod\" set-label environment prod",
      "cub function set --space shop-web-prod --unit shop-web --change-desc \"Run five replicas in prod\" set-replicas 5",
    ],
    laptop: ["cub app check shop-web", "cub stack sandbox shop-platform"], needs: "the Workshop plugin",
    laptopNote: "No account needed. The first line lists what the app needs, and the second checks it on a platform that carries those.",
    safety: "It touches no cluster.",
    loadNote: "Sign in, then paste the rest. It saves the app as a base in your organization, and makes a dev and a prod variant of it.",
    units: "Each variant holds 6 Units in ConfigHub: the app's 5 objects and its namespace.",
    rows: [
      { does: "The Ingress names the nginx class, and nothing in the files says the cluster must run an ingress controller.", instead: "cub app check lists an ingress controller as a need, and the platform check confirms shop-platform carries one." },
      { does: "The Certificate needs cert-manager, and a ClusterIssuer called letsencrypt that none of these files creates.", instead: "cub app check lists cert-manager, and the platform check warns that ClusterIssuer/letsencrypt must already exist on the cluster." },
      { does: "The ServiceMonitor only works if the Prometheus operator's CRDs are installed.", instead: "cub app check lists a Prometheus operator, and the platform check finds kube-prometheus-stack in shop-platform." },
      { does: "The namespace shop must already exist.", instead: "Both checks name it, before anything is applied." },
    ],
  },
];

export const SIMPLE_PAGES = [
  ...HELM_SIMPLE.map(([id, short, name]) => ({ id, file: `example-${short}.html`, name, space: `${short}-example`, kicker: "Helm chart", lead: "A Helm chart you can't read becomes objects you can." })),
  ...GITOPS_SIMPLE,
  ...APP_SIMPLE,
];

function highlightTemplate(escapeHtml, line) {
  return escapeHtml(line).replace(/\{\{.*?\}\}/g, (match) => `<span class="ex-tpl">${match}</span>`);
}

function simpleHelmSentences(f) {
  const point = helmPoint(f);
  const sentences = ["The template's image line becomes one plain value you can read, and so does every other field."];
  if (point.kind === "random") sentences.push("Your password stays put. The Helm chart makes a new one every time it runs, and here you create it once.");
  if (f.changed.some((doc) => fieldDifferences([doc], [f.afterByKey.get(f.key(doc))]).some((row) => /\.image$/.test(row.path) && /:latest$/.test(String(row.left)) && /@sha256:/.test(String(row.right))))) {
    sentences.push("The image is pinned to exact bytes, so it can't change under you.");
  }
  if (f.hooks.length) {
    sentences.push(hooksPlanned(f)
      ? `The ${f.hooks.length} setup objects Helm runs out of sight become steps you can read.`
      : `The ${f.hooks.length} setup objects Helm runs out of sight are left out, so nothing runs that you didn't see.`);
  }
  if (sentences.length < 3) sentences.push("Every object is written out, so you can review it before anything runs.");
  return sentences.slice(0, 3);
}

// The table on each simple page: what the source does that a reader never
// sees, and what happens here instead, with the objects behind each row one
// click away. Helm rows come from the receipt and the listing's plan. What
// each chart's hook Jobs do is written here, and the build stops if a Job it
// names is not in the chart's render, or a Secret the cluster must supply has
// no row.
const HOOK_STORIES = {
  "helm-ingress-nginx": {
    jobs: ["ingress-nginx-admission-create", "ingress-nginx-admission-patch"], covers: ["ingress-nginx/ingress-nginx-admission"],
    does: "Runs two short-lived Jobs while installing. The first makes a TLS certificate for the admission webhook, and the second hands that certificate to the webhook.",
    instead: "Nothing runs out of sight. The certificate, the Secret ingress-nginx/ingress-nginx-admission, must exist before delivery.",
  },
  "helm-kube-prometheus-stack": {
    jobs: ["kube-prometheus-stack-admission-create", "kube-prometheus-stack-admission-patch"], covers: ["monitoring/kube-prometheus-stack-admission"],
    does: "Runs two short-lived Jobs while installing. The first makes a TLS certificate for the admission webhook, and the second hands that certificate to the webhook.",
    instead: "Nothing runs out of sight. The plan says to run the same two Jobs, in that order, and then remove them.",
  },
  "helm-cert-manager": {
    jobs: ["cert-manager-startupapicheck"], covers: [],
    does: "Runs a Job after installing that waits until the cert-manager API answers.",
    instead: "It is left out, and nothing runs it. It only checks, and makes nothing the rest needs.",
  },
  "helm-argo-cd": {
    jobs: ["argo-cd-argocd-redis-secret-init"], covers: ["argocd/argocd-redis"],
    does: "Runs a Job before installing that makes a password Secret for Argo CD's own Redis.",
    instead: "Nothing runs out of sight. The Secret argocd/argocd-redis must exist before delivery.",
  },
  "helm-gatekeeper": {
    jobs: ["gatekeeper-update-crds-hook", "gatekeeper-update-namespace-label"], covers: [],
    does: "Runs a Job before installing or upgrading that applies its CRDs, and one after installing that labels its own namespace so Gatekeeper does not police itself.",
    instead: "Nothing runs out of sight. The CRDs are in ConfigHub and go in first, and a recorded install without the Jobs checked each step that followed.",
  },
  "helm-gpu-operator": {
    jobs: ["gpu-operator-upgrade-crd", "gpu-operator-node-feature-discovery-prune"], covers: [],
    does: "Runs a Job before each upgrade that moves its CRDs to the new version, and one after uninstalling that removes the node labels it added.",
    instead: "Nothing runs out of sight. The plan says to apply the new CRDs first on an upgrade, and to run the label clean-up Job after deleting.",
  },
};
// The kinds a reader knows each chart by, named first in the CRD row.
const CRD_EXAMPLES = {
  "helm-kube-prometheus-stack": ["Prometheus", "ServiceMonitor", "PrometheusRule"],
  "helm-cert-manager": ["Certificate", "Issuer", "ClusterIssuer"],
  "helm-argo-cd": ["Application", "ApplicationSet", "AppProject"],
  "helm-external-secrets": ["ExternalSecret", "SecretStore", "ClusterSecretStore"],
  "helm-gatekeeper": ["ConstraintTemplate", "Config", "Assign"],
  "helm-gpu-operator": ["ClusterPolicy", "NVIDIADriver", "NodeFeature"],
};
const HOOK_WORDS = { "pre-install": "before installing", "post-install": "after installing", "pre-upgrade": "before upgrading", "post-upgrade": "after upgrading", "pre-delete": "before uninstalling", "post-delete": "after uninstalling", "test": "when tested" };
// A Secret the chart makes up, or leaves for the cluster to fill in.
const SUPPLIED = {
  "redis/redis-existing-secret": ["Makes up a new Redis password every time it renders, so no two renders match.", "You create the Secret redis/redis-existing-secret once, and the chart reads the password from it."],
  "postgresql/postgresql-auth": ["Makes up a new administrator password every time it renders, so no two renders match.", "You create the Secret postgresql/postgresql-auth once, and the chart reads the password from it."],
  "external-secrets/external-secrets-webhook": ["Ships the webhook's certificate Secret empty.", "ConfigHub holds it empty too. The cert-controller fills in external-secrets/external-secrets-webhook on the cluster after apply."],
};
function hooksPlanned(f) {
  const jobs = f.hooks.filter((doc) => doc.kind === "Job").map((doc) => doc.metadata.name);
  return f.plan.some((step) => /hook/i.test(step.detail) || jobs.some((job) => step.detail.includes(job)) || (step.type === "lifecycle-action" && /\bJob\b/.test(step.detail)));
}
const listOf = (items) => ({ items });
function helmRows(id, f, check, shot) {
  const rows = [];
  const ids = new Set(f.plan.map((step) => step.id));
  const crds = f.after.filter((doc) => doc.kind === "CustomResourceDefinition");
  const story = HOOK_STORIES[id];
  if (crds.length) {
    const kinds = crds.map((doc) => doc.spec?.names?.kind ?? doc.metadata.name);
    const named = CRD_EXAMPLES[id] ?? kinds.slice(0, 3);
    for (const kind of named) check(kinds.includes(kind), `${ROOT}/${id}: CRD_EXAMPLES names ${kind}, which the chart does not define`);
    const ordered = ids.has("crd-ordering") || f.plan.some((step) => /applie[sd] (the locked CRDs )?before|established before/i.test(step.detail));
    rows.push({
      does: `Adds ${crds.length} new kind${crds.length === 1 ? "" : "s"} of Kubernetes object, such as ${named.join(", ")}.${f.crdsOnlyAfter ? ` A plain helm template leaves ${f.crdsOnlyAfter === crds.length ? "them" : `${f.crdsOnlyAfter} of them`} out.` : ""}`,
      instead: `They are in ConfigHub with everything else${ordered ? ", and they go in first, so the objects that use them are not rejected" : ""}.${ids.has("prune-protection") ? " They are also marked to stay if the rest is deleted, because deleting a CRD deletes every object of that kind." : ""}`,
      show: { title: `The ${crds.length} new kinds`, ...listOf(kinds), ...(shot?.crds ? { image: `./before-after/${id}-crds.png`, alt: `ConfigHub showing ${shot.crds.shows}` } : {}) },
    });
  }
  if (f.hooks.length) {
    check(story, `${ROOT}/${id}: the chart runs Helm hooks, and HOOK_STORIES says nothing about them`);
    const jobs = f.hooks.filter((doc) => doc.kind === "Job").map((doc) => doc.metadata.name);
    for (const job of story.jobs) check(jobs.includes(job), `${ROOT}/${id}: HOOK_STORIES names the Job ${job}, and the chart renders ${jobs.join(", ")}`);
    rows.push({
      does: story.does, instead: story.instead,
      show: { title: `What Helm runs, and when`, items: f.hooks.map((doc) => `${doc.kind} ${doc.metadata.name}: ${String(doc.metadata.annotations["helm.sh/hook"]).split(",").map((hook) => HOOK_WORDS[hook.trim()] ?? hook.trim()).join(", ")}`) },
    });
  }
  for (const step of f.plan.filter((row) => row.type === "target-fact" && row.id.includes("/"))) {
    if (story?.covers.includes(step.id)) continue;
    check(SUPPLIED[step.id], `${f.rec.listing}: no row for what the cluster supplies, ${step.id}`);
    rows.push({ does: SUPPLIED[step.id][0], instead: SUPPLIED[step.id][1] });
  }
  const steps = f.plan.filter((step) => step.type !== "target-fact" && !["crd-ordering", "lifecycle", "prune-protection"].includes(step.id));
  if (steps.length) rows.push({
    does: "Decides at install time when each of its hidden steps runs, in an order you cannot see.",
    instead: `The plan writes down ${steps.length} step${steps.length === 1 ? "" : "s"}, in order, for whoever delivers.`,
    show: { title: "The plan's steps", items: steps.map((step) => step.detail) },
  });
  if (!rows.length) rows.push({ does: `Nothing out of sight. The chart makes ${f.after.length} objects and runs no hooks.`, instead: `All ${f.after.length} are in ConfigHub as they are.` });
  return rows;
}
function helmUnits(f, check) {
  const n = f.rec.installer?.manifests;
  check(n, `${ROOT}/${f.rec.id}: the receipt has no installer manifest count; record it with --generate`);
  return `ConfigHub holds this as ${n + 1} Units, one for each of the ${n} objects the installer writes and one installer record.`;
}

// Helm examples loaded with dev and prod variants, so ConfigHub shows a base
// and its variants. These are the commands that made the graph screenshot.
const HELM_VARIANTS = {
  "helm-redis": {
    rows: [
      "cub variant create dev redis-example --change-desc \"Clone the Redis base as dev\"",
      "cub variant create prod redis-example --change-desc \"Clone the Redis base as prod\"",
      "cub function set --space redis-example-dev --change-desc \"Label every object environment dev\" set-label environment dev",
      "cub function set --space redis-example-dev --unit statefulset-redis-redis-replicas --change-desc \"Run one read replica in dev\" set-replicas 1",
      "cub function set --space redis-example-prod --change-desc \"Label every object environment prod\" set-label environment prod",
      "cub function set --space redis-example-prod --unit statefulset-redis-redis-master --change-desc \"Give the prod master its own requests and limits\" set-container-resources redis all 500m 512Mi 2",
    ],
    note: "The rest makes a dev and a prod variant of it. Dev runs one read replica, and prod gives the Redis master its own requests and limits.",
    graphNote: "Prod's panel lists what prod changes from the base, here its label and the master's requests and limits.",
  },
};
// The rest were loaded the same way: label each variant, and give prod three
// replicas of its main workload. cert-manager has only prod, for the Link quota.
const PLAIN_VARIANTS = {
  "helm-postgresql": { workload: "statefulset-postgresql-postgresql", what: "its StatefulSet" },
  "helm-ingress-nginx": { workload: "deployment-ingress-nginx-ingress-nginx-controller", what: "the controller" },
  "helm-metrics-server": { workload: "deployment-kube-system-metrics-server", what: "its Deployment" },
  "helm-gatekeeper": { workload: "deployment-default-gatekeeper-audit", what: "the audit Deployment" },
  "helm-external-secrets": { workload: "deployment-external-secrets-external-secrets", what: "the controller" },
  "helm-gpu-operator": { workload: "deployment-gpu-operator-gpu-operator", what: "the operator" },
  "helm-cert-manager": { workload: "deployment-cert-manager-cert-manager", what: "the controller", variants: ["prod"] },
  "helm-argo-cd": { workload: "deployment-argocd-argo-cd-argocd-server", what: "the server" },
};
for (const [id, spec] of Object.entries(PLAIN_VARIANTS)) {
  const space = `${HELM_SIMPLE.find(([key]) => key === id)[1]}-example`;
  const variants = spec.variants ?? ["dev", "prod"];
  HELM_VARIANTS[id] = {
    rows: [
      ...variants.map((variant) => `cub variant create ${variant} ${space} --change-desc "Clone the base as ${variant}"`),
      ...variants.map((variant) => `cub function set --space ${space}-${variant} --change-desc "Label every object environment ${variant}" set-label environment ${variant}`),
      `cub function set --space ${space}-prod --unit ${spec.workload} --change-desc "Run three replicas in prod" set-replicas 3`,
    ],
    note: `The rest makes ${variants.length === 2 ? "a dev and a prod variant" : "a prod variant"} of it, and prod runs three replicas of ${spec.what}.`,
    graphNote: `Prod's panel lists what prod changes from the base, here its label and three replicas of ${spec.what}.`,
  };
}


function simpleLayout(h, { id, beforeLabel, beforeHtml, beforeNote, shot, afterNote, afterExtra = "", graphNote = "", units, rows, rowsHeading, rowsColumns, sentences, words, loadRows, loadNote, laptopRows, laptopNote, needs, laptopNeeds = needs, wide }) {
  const { escapeHtml, commandBlock, signupUrl } = h;
  const details = BEFORE_AFTER_PAGES.find((row) => row.id === id).file;
  return `    <section aria-labelledby="pictures" class="ex">
      <h2 id="pictures" class="ex-hidden">Before and after</h2>
      <div class="ex-pair${wide ? " ex-wide" : ""}">
        <figure class="ex-card">
          <figcaption>${escapeHtml(beforeLabel)}</figcaption>
          <pre class="ex-code"><code>${beforeHtml}</code></pre>
          <p class="ex-note">${escapeHtml(beforeNote)}</p>
        </figure>
        <figure class="ex-card">
          <figcaption>After: in ConfigHub</figcaption>
          <img src="./before-after/${id}-confighub.png" alt="${escapeHtml(`ConfigHub showing ${shot.shows}`)}">
          <p class="ex-note">${escapeHtml(afterNote)}</p>
          <p class="ex-note">${escapeHtml(units)}</p>
          ${afterExtra}
        </figure>
      </div>
${shot.graph ? `      <figure class="ex-card ex-graph">
        <figcaption>In ConfigHub: one base, and a variant for each environment</figcaption>
        <img src="./before-after/${id}-graph.png" alt="${escapeHtml(`ConfigHub showing ${shot.graph.shows}`)}">
        <p class="ex-note">${escapeHtml(`${graphNote} Taken in the ${shot.organization} organization on ${shot.graph.takenOn}, showing ${shot.graph.shows}.`.trim())}</p>
      </figure>
` : ""}
      <ul class="ex-checks">
        ${sentences.map((sentence) => `<li>${escapeHtml(sentence)}</li>`).join("\n        ")}
      </ul>
      <h3 class="ex-went-h">${escapeHtml(rowsHeading)}</h3>
      <table class="ex-table">
        <thead><tr><th>${escapeHtml(rowsColumns[0])}</th><th>${escapeHtml(rowsColumns[1])}</th></tr></thead>
        <tbody>
${rows.map((row) => `          <tr><td>${escapeHtml(row.does)}</td><td>${escapeHtml(row.instead)}${row.show ? `<details class="ex-show"><summary>Show me</summary>${row.show.image ? `<img src="${row.show.image}" alt="${escapeHtml(row.show.alt ?? row.show.title)}">` : ""}<p class="ex-note">${escapeHtml(row.show.title)}</p><ul>${row.show.items.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("")}</ul></details>` : ""}</td></tr>`).join("\n")}
        </tbody>
      </table>
      <p class="ex-words">${escapeHtml(words)}</p>
      <div class="ex-actions">
        <details class="ex-button"><summary>Load it into your ConfigHub</summary>
          <p class="installer-command-note">${loadNote}</p>
          ${commandBlock(loadRows.map((cmd) => ({ cmd })))}
          <p class="ex-note">You need a <a href="${signupUrl}">ConfigHub account</a> and <a href="./try.html#install-cub">cub</a> with ${escapeHtml(needs)}.</p>
        </details>
        <details class="ex-button"><summary>Try it on your laptop</summary>
          <p class="installer-command-note">${laptopNote}</p>
          ${commandBlock(laptopRows.map((cmd) => ({ cmd })))}
          <p class="ex-note">You need <a href="./try.html#install-cub">cub</a> with ${escapeHtml(laptopNeeds)}.${/Workshop plugin/.test(laptopNeeds) ? ` Install the Workshop plugin with <code>${escapeHtml(h.workshopInstall)}</code>.` : ""}</p>
        </details>
      </div>
      <p class="ex-more"><a href="./${details}">Show me the details</a> (for experienced users)</p>
    </section>
`;
}

function simplePage(id, h) {
  const { check, escapeHtml } = h;
  const page = SIMPLE_PAGES.find((row) => row.id === id);
  const rec = receipt(id);
  const shot = rec.confighub;
  check(shot, `${ROOT}/${id} has no ConfigHub screenshot, and its simple page shows one`);
  const caption = `Taken in the ${shot.organization} organization on ${shot.takenOn}, showing ${shot.shows}.`;
  let body;
  if (page.kicker === "Helm chart") {
    const f = helmFacts(id);
    const excerpt = JSON.parse(read(id, "before/template-excerpt.json"));
    check(excerpt.lines.some((line) => /^\s+image:/.test(line)), `${ROOT}/${id}: the excerpt has no image line, and the ConfigHub picture shows one`);
    const setup = (f.listing.nextSteps ?? []).find((step) => step.id === "get-objects")?.commands.find((command) => command.command.startsWith("cub installer setup"));
    check(setup, `site/listings/${f.rec.listing}.json has no cub installer setup command`);
    const setupHere = setup.command.replace(/--work-dir \S+/, `--work-dir ./${page.space}`);
    body = simpleLayout(h, {
      id, shot, beforeLabel: "Before: the Helm chart",
      beforeHtml: excerpt.lines.map((line) => highlightTemplate(escapeHtml, line)).join("\n"),
      beforeNote: `16 lines of ${excerpt.file.replace(/^[^/]+\//, "")}, around its image line. The chart has many files like this.`,
      afterNote: `The same image line in ConfigHub, as a plain value. ${caption}`,
      sentences: simpleHelmSentences(f),
      units: helmUnits(f, check), rows: helmRows(id, f, check, shot),
      rowsHeading: "What Helm does that you never see, and what happens here instead", rowsColumns: ["What Helm does", "What happens here instead"],
      words: "ConfigHub keeps configuration as plain objects, with a history of every change. Loading puts this chart's objects in a Space, a folder in your ConfigHub organization.",
      loadRows: ["cub auth login", `${setupHere} && cub installer upload --work-dir ./${page.space} --space ${page.space} && cub component create ${page.space} && cub space update --patch ${page.space} --component ${page.space}`, ...(HELM_VARIANTS[id]?.rows ?? [])],
      graphNote: HELM_VARIANTS[id]?.graphNote ?? "",
      loadNote: `Sign in with the first line, then paste the rest. It fetches the ${escapeHtml(page.name)} package, writes its files, and saves them as a Space called <code>${escapeHtml(page.space)}</code> in your organization.${HELM_VARIANTS[id] ? ` ${escapeHtml(HELM_VARIANTS[id].note)}` : ""} It touches no cluster.`,
      laptopRows: [`${setupHere} && ls ./${page.space}/out/manifests`],
      laptopNote: `No account needed. This fetches the ${escapeHtml(page.name)} package and writes every object into a folder you can open. To check your own chart and values instead, see <a href="./ask.html">Is my configuration right?</a>`,
      needs: "its installer plugin and kustomize",
    });
  } else {
    for (const [path, pattern] of page.facts) check(pattern.test(read(id, path)), `${ROOT}/${id}/${path} no longer says what the simple page states (${pattern})`);
    const lines = read(id, page.before).replace(/\n+$/, "").split("\n");
    body = simpleLayout(h, {
      id, shot, wide: true, beforeLabel: page.beforeLabel,
      beforeHtml: lines.slice(0, 26).map((line) => escapeHtml(line)).join("\n"),
      beforeNote: page.beforeNote ?? `${page.before.replace(/^before\//, "")}${lines.length > 26 ? `, its first 26 of ${lines.length} lines` : ""}. You read files like this to work out what each environment runs.`,
      afterNote: caption,
      sentences: page.sentences, units: page.units, rows: page.rows,
      rowsHeading: "What you work out today, and what happens here instead", rowsColumns: ["Today", "Here instead"],
      words: "ConfigHub keeps configuration as plain objects, with a history of every change. A base holds what every environment shares, and a variant is one environment's copy that stays linked to its base and lists what it changes.",
      afterExtra: id === "flux-expert-fleet" ? fleetVersionsHtml(h) : "",
      loadRows: ["cub auth login", ...(page.noClone ? [] : [clone, `cd examples/${page.dir}`]), ...page.load],
      loadNote: `${page.loadNote ?? "Sign in, then paste the rest. It fetches the example, works out what each environment runs, and saves it in your organization."} ${escapeHtml(page.safety)}`,
      laptopRows: [...(page.noClone ? [] : [clone, `cd examples/${page.dir}`]), ...page.laptop],
      laptopNote: page.laptopNote ?? `No account needed. This fetches the example and shows what each environment runs.${page.ownRepo ? ` ${page.ownRepo}` : ""}`,
      needs: page.needs, laptopNeeds: page.laptopNeeds,
    });
  }
  return {
    eyebrow: "Before and after",
    title: `${page.name}, before and after`,
    lead: page.lead,
    opening: "",
    body,
    css: `
    .ex-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .ex-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 8px 0 20px; }
    .ex-pair.ex-wide { grid-template-columns: minmax(0, 1fr); }
    .ex-pair.ex-wide .ex-code { max-height: 22rem; overflow: auto; }
    @media (max-width: 860px) { .ex-pair, .ex-pair.ex-wide { grid-template-columns: 1fr; } }
    .ex-card { margin: 0; border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 8px; }
    .ex-card figcaption { font-weight: 600; }
    .ex-card img { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; }
    .ex-code { margin: 0; padding: 10px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); font-size: .72rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); }
    .ex-tpl { color: #b8501c; font-weight: 600; }
    .ex-note { margin: 0; font-size: .85rem; color: var(--muted); }
    .ex-checks { list-style: none; padding: 0; margin: 0 0 20px; }
    .ex-checks li { padding-left: 1.6em; margin: 6px 0; position: relative; font-size: 1.05rem; }
    .ex-checks li::before { content: "\\2713"; position: absolute; left: 0; color: #2f7a3a; font-weight: 700; }
    .ex-actions { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
    .ex-actions details.ex-button { border: 0; padding: 0; margin: 0; background: none; }
    .ex-actions details.ex-button > summary { display: inline-block; list-style: none; cursor: pointer; padding: 10px 18px; border: 1px solid var(--accent); border-radius: 8px; font-weight: 600; color: var(--accent); background: var(--surface); }
    .ex-actions details.ex-button > summary::-webkit-details-marker { display: none; }
    .ex-actions details.ex-button > summary::marker { content: ""; }
    .ex-actions details.ex-button[open] > summary { background: var(--accent); color: #fff; }
    .ex-actions details.ex-button[open] { flex-basis: 100%; }
    .ex-actions .terminal-body, .ex-actions .terminal-body code { white-space: pre-wrap; overflow-wrap: anywhere; }
    .ex-more { margin-top: 20px; color: var(--muted); }
    .ex-words { margin: 0 0 20px; color: var(--muted); }
    .ex-graph { margin: 0 0 20px; }
    .ex-went-h { font-size: 1rem; margin: 0 0 6px; }
    .ex-table { width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: .95rem; }
    .ex-table th, .ex-table td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
    .ex-table th { width: 50%; }
    .ex-show summary { cursor: pointer; color: var(--accent); margin-top: 6px; }
    .ex-show ul { margin: 6px 0 0; padding-left: 1.2em; }
    .ex-show img { display: block; max-width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; margin-top: 6px; }
    .ex-versions { border-collapse: collapse; font-size: .9rem; }
    .ex-versions th, .ex-versions td { border: 1px solid var(--line); padding: 4px 10px; text-align: left; }
`,
  };
}

function baCss() {
  return `
    .ba-shot { margin: 18px 0; }
    .ba-shot .terminal-card { border: 1px solid var(--line); border-radius: 12px; background: var(--term); overflow: hidden; }
    .ba-shot .terminal-title { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.12); color: #b7c3cf; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .78rem; background: #111922; }
    .ba-shot .terminal-body { margin: 0; border: 0; border-radius: 0; }
    .ba-shot .terminal-body code { white-space: pre-wrap; overflow-wrap: anywhere; }
    .ba-shot .term-catch { display: inline-block; width: 100%; padding: 0 6px; border-left: 3px solid #f0c36d; background: rgba(240,195,109,.18); color: #ffe3a1; font-weight: 700; }
    .ba-shot .terminal-body { max-height: 32rem; overflow: auto; font-size: .82rem; }
    .ba-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    @media (max-width: 900px) { .ba-pair { grid-template-columns: 1fr; } }
    .ba-live { margin: 28px 0; border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; background: var(--surface); }
    .ba-live summary { cursor: pointer; font-weight: 600; }
    .ba-ui { margin: 16px 0; }
    .ba-ui img { display: block; max-width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; }
    .ba-ui figcaption { margin-top: 6px; font-size: .85rem; color: var(--muted); }
`;
}

function appShopWebPage(h) {
  const { check, escapeHtml } = h;
  const id = "app-shop-web";
  const rec = receipt(id);
  const docs = objects(read(id, "before/shop-web.yaml"));
  const appCheck = transcriptLines(read(id, "transcripts/app-check.txt"));
  const sandbox = transcriptLines(read(id, "transcripts/stack-sandbox.txt"));
  const needs = appCheck.filter((line) => /\[NEEDS\]/.test(line));
  check(needs.length === 3, `${ROOT}/${id}/transcripts/app-check.txt no longer names three needs`);
  check(sandbox.some((line) => /app needs met: shop-web/.test(line)) && sandbox.some((line) => /=> CHECKED/.test(line)), `${ROOT}/${id}/transcripts/stack-sandbox.txt no longer checks the app on its platform`);
  const source = rec.sources[0];
  return {
    eyebrow: "Before and after",
    title: BEFORE_AFTER_PAGES.find((page) => page.id === id).title,
    lead: `shop-web is ${docs.length} objects, and three of them only work if the cluster already runs something the files never mention. This page shows what ConfigHub reads in them.`,
    opening: `    <p><strong>What you need.</strong> <code>cub</code> with the Workshop plugin. No account and no cluster.</p>\n`,
    body: `    <section aria-labelledby="before">
      <h2 id="before">1. The app's files</h2>
      <p>The app is <a href="${source.repository}/blob/${source.commit}/${source.path}">${escapeHtml(source.path)} in confighub/cub-workshop</a>, at the commit the Workshop's app list checked.</p>
      <pre><code>${escapeHtml(read(id, "before/shop-web.yaml"))}</code></pre>
    </section>
    <section aria-labelledby="needs">
      <h2 id="needs">2. What the app needs</h2>
      <p>The check reads the files and names what a platform must provide. It runs nothing.</p>
      ${terminal(escapeHtml, { title: "what shop-web needs", cmd: "cub app check shop-web.yaml", output: appCheck, mark: [/\[NEEDS\]/] })}
    </section>
    <section aria-labelledby="platform">
      <h2 id="platform">3. Check it on a platform that carries those</h2>
      <p>shop-platform is a stack the Workshop plugin ships: ingress-nginx, cert-manager, kube-prometheus-stack and RabbitMQ, with shop-web on them. The check renders all of it and tests the app's needs against the platform.</p>
      ${terminal(escapeHtml, { title: "shop-web on shop-platform", cmd: "cub stack sandbox shop-platform", output: sandbox, mark: [/app needs met/, /ClusterIssuer\/letsencrypt/, /=> CHECKED/] })}
      <p>One thing stays outside the stack. The Certificate asks for a ClusterIssuer called letsencrypt, and nothing in the stack creates it, so it must already exist on the cluster.</p>
    </section>
    <section aria-labelledby="notes">
      <h2 id="notes">4. Technical notes and disclaimers</h2>
      <ul>
        <li>Both checks ran on ${escapeHtml(rec.recordedOn)} with cub ${escapeHtml(rec.tools.cub)} and Workshop plugin ${escapeHtml(rec.tools.workshopPlugin)}. <a href="${GITHUB}/${ROOT}/${id}">The recorded files and their receipt</a> hold every input and output.</li>
        <li>Neither check contacts a cluster. A check that passes is not proof the app runs.</li>
      </ul>
    </section>
`,
    css: baCss(),
  };
}

export function beforeAfterPage(id, helpers) {
  if (id === "helm-gpu-operator") return helmPage(helpers);
  if (id === "kustomize-apptique") return kustomizePage(helpers);
  if (id === "argo-app-of-apps") return argoPage(helpers);
  if (id === "flux-beginner") return fluxPage(helpers);
  if (id === "kustomize-helm-chart") return kustomizeHelmPage(helpers);
  if (id === "argo-applicationset") return argoAppSetPage(helpers);
  if (id === "flux-expert-fleet") return fluxFleetPage(helpers);
  if (id === "app-shop-web") return appShopWebPage(helpers);
  if (HELM_NAMES[id]) return helmListingPage(id, helpers);
  throw new Error(`no before-and-after page for ${id}`);
}

// The gallery at the top of the Apps page. Each card opens a simple page.
export function beforeAfterGalleryHtml(escapeHtml) {
  const cardText = (page) => {
    if (page.kicker !== "Helm chart") return page.lead;
    const f = helmFacts(page.id);
    return `The ${page.name} chart makes ${f.before.length} objects. ${simpleHelmSentences(f)[1]}`;
  };
  const groups = [["helm", "Helm charts"], ["kustomize", "Kustomize"], ["argo", "Argo CD"], ["flux", "Flux"], ["app", "Apps"]];
  const firstOf = new Map(groups.map(([prefix]) => [SIMPLE_PAGES.find((page) => page.id.startsWith(`${prefix}-`))?.id, prefix]));
  const jumps = groups.map(([prefix, label]) => `<a href="#ba-${prefix}">${label}</a>`);
  const cards = SIMPLE_PAGES.map((page) => `        <article class="door"${firstOf.has(page.id) ? ` id="ba-${firstOf.get(page.id)}"` : ""}>
          <span class="kicker">${escapeHtml(page.kicker)}</span>
          <h3><a href="./${page.file}">${escapeHtml(`${page.name}, before and after`)}</a></h3>
          <p>${escapeHtml(cardText(page))}</p>
        </article>`).join("\n");
  return `<section aria-labelledby="before-and-after">
      <h2 id="before-and-after">See a config before and after</h2>
      <p>Each example shows the files you may have today next to the same thing in ConfigHub. You can load any of them into your own ConfigHub with one paste.</p>
      <p>Go to ${jumps.slice(0, -1).join(", ")} or ${jumps.at(-1)}.</p>
      <div class="doors ba-gallery">
${cards}
      </div>
      <style>.ba-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); } @media (max-width: 1100px) { .ba-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); } } @media (max-width: 700px) { .ba-gallery { grid-template-columns: 1fr; } }</style>
    </section>`;
}

export function simpleBeforeAfterPage(id, helpers) {
  return simplePage(id, helpers);
}
