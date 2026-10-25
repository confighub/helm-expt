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
    return shot ? [{ site: `before-after/${page.id}-confighub.png`, from: join(ROOT, page.id, shot.file) }] : [];
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

export function beforeAfterPage(id, helpers) {
  if (id === "helm-gpu-operator") return helmPage(helpers);
  if (id === "kustomize-apptique") return kustomizePage(helpers);
  if (id === "argo-app-of-apps") return argoPage(helpers);
  if (id === "flux-beginner") return fluxPage(helpers);
  if (HELM_NAMES[id]) return helmListingPage(id, helpers);
  throw new Error(`no before-and-after page for ${id}`);
}

// The gallery at the top of the Apps page.
export function beforeAfterGalleryHtml(escapeHtml) {
  // Helm charts first, then the other formats, each group in its own order.
  const ordered = [...BEFORE_AFTER_PAGES.filter((page) => page.kicker === "Helm chart"), ...BEFORE_AFTER_PAGES.filter((page) => page.kicker !== "Helm chart")];
  const cards = ordered.map((page) => `        <article class="door">
          <span class="kicker">${escapeHtml(page.kicker)}</span>
          <h3><a href="./${page.file}">${escapeHtml(page.title)}</a></h3>
          <p>${escapeHtml(page.card ?? helmCard(page.id))}</p>
        </article>`).join("\n");
  return `<section aria-labelledby="before-and-after">
      <h2 id="before-and-after">See a config before and after</h2>
      <p>Each example starts from files you may have today and shows what the Workshop gives you instead. Every output is recorded from a real run, and you can run each one yourself with no account.</p>
      <div class="doors ba-gallery">
${cards}
      </div>
      <style>.ba-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); } @media (max-width: 1100px) { .ba-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); } } @media (max-width: 700px) { .ba-gallery { grid-template-columns: 1fr; } }</style>
    </section>`;
}
