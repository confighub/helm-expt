// The before-and-after examples: one page each, and the gallery at the top of
// the Apps page. Every count, table and terminal on a page is read from the
// files that scripts/generate-before-after.mjs recorded under
// examples/before-after/, and the builder checks the counts against the
// recorded command output, so a page cannot show a result that was not run.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readYamlText, repoRoot } from "./proof-common.mjs";

const ROOT = "examples/before-after";
const GITHUB = "https://github.com/confighub/helm-expt/tree/main";
export const GPU_ENTRY = "nvidia-gpu-operator-v26-3-3-default";
const HELM_TEMPLATE = "helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v26.3.3 --namespace gpu-operator > before.yaml";

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
      <p>These are the commands on the entry page. The Catalog has not run the upload for this entry.</p>
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
`;
}

export function beforeAfterPage(id, helpers) {
  if (id === "helm-gpu-operator") return helmPage(helpers);
  if (id === "kustomize-apptique") return kustomizePage(helpers);
  if (id === "argo-app-of-apps") return argoPage(helpers);
  throw new Error(`no before-and-after page for ${id}`);
}

// The gallery at the top of the Apps page.
export function beforeAfterGalleryHtml(escapeHtml) {
  const cards = BEFORE_AFTER_PAGES.map((page) => `        <article class="door">
          <span class="kicker">${escapeHtml(page.kicker)}</span>
          <h3><a href="./${page.file}">${escapeHtml(page.title)}</a></h3>
          <p>${escapeHtml(page.card)}</p>
        </article>`).join("\n");
  return `<section aria-labelledby="before-and-after">
      <h2 id="before-and-after">See a config before and after</h2>
      <p>Each example starts from files you may have today and shows what the Workshop gives you instead. Every output is recorded from a real run, and you can run each one yourself with no account.</p>
      <div class="doors ba-gallery">
${cards}
      </div>
      <style>.ba-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); } @media (max-width: 900px) { .ba-gallery { grid-template-columns: 1fr; } }</style>
    </section>`;
}
