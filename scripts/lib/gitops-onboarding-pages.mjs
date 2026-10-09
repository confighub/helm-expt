// Short, on-site starting points for the released Argo CD and Flux onboarding
// plugins. The full upstream guide remains the authority for generated scripts,
// handover checks, and recovery steps.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function link(url, text) {
  return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
}

function commandBlock(command) {
  return `<pre><code>${escapeHtml(command)}</code></pre>`;
}

const guides = {
  argo: {
    title: "Bring your Argo CD apps into ConfigHub",
    lead: "Argo CD stays your delivery controller. ConfigHub adds reviewed configuration, approvals, and immutable releases; begin by reading the repository it already delivers.",
    plan: "cub argo plan .",
    apply: "cub argo apply . --out onboard",
    status: "cub argo status . --kube-context <argo-context> --watch --hard-refresh",
    planAnchor: "#1-see-the-plan",
    handoverAnchor: "#3-hand-the-estate-over",
    statusAnchor: "#what-confighub-hears-back-live-status",
    setup: "Argo CD keeps reading Git while you review the generated setup.",
    connect: "The handover repoints the root and related app-of-apps layers in their required order. Generated Applications are moved later, stage by stage; this is an estate operation, not a one-app shortcut.",
    secret: "Exporting cluster registration data for planning must remove credentials. Keep workload Secrets and OCI pull credentials out of the repository and out of ConfigHub review data.",
    fixturePath: "gitops/argo/beginner-app-of-apps",
    object: "Application",
    sync: "syncs each Application",
    becomesIntro: "<code>cub argo apply . --out onboard</code> writes files only. For each Application it writes the copy Argo CD has today under <code>onboard/control/</code>, and the copy it would have after the handover under <code>onboard/repointed/</code>. Each copy sits in a folder named for the Space that holds it, which is <code>argo-apptique-apps-children</code> on the fixture. The two copies of <code>apptique-dev</code> differ in three lines.",
    becomesDiff: ` kind: Application
 metadata:
   name: apptique-dev
 spec:
   source:
-    repoURL: https://github.com/confighub/examples.git
-    targetRevision: main
-    path: gitops/argo/beginner-app-of-apps/manifests/apptique/dev
+    repoURL: oci://<gateway>/space/argo-apptique-dev-in-cluster
+    path: .
+    targetRevision: latest`,
    becomesAfter: "The Application keeps its name, project, destination and sync policy. It reads the Space the plan names as its variant, <code>argo-apptique-dev-in-cluster</code>.",
    becomesHelm: "An Application with <code>helm</code> or <code>kustomize</code> settings under <code>source</code> loses those settings in the repointed copy, because what Argo CD reads afterwards is already rendered. The fixture has no such Application, so this page shows none.",
    outside: "The Argo CD install, AppProject permissions, sync windows and cluster credentials stay where they are.",
    backAfterHandover: "Put each Application's source back to Git first, leaves before parents. The script records each source before it changes it and prints the commands. Do not delete the ConfigHub Spaces first. Never delete the Applications, because their finalizer deletes what they deployed.",
  },
  flux: {
    title: "Bring your Flux fleet into ConfigHub",
    lead: "Flux stays your delivery controller. ConfigHub adds reviewed configuration, approvals, and immutable releases; begin by reading the repository it already delivers.",
    plan: "cub flux plan . --require Healthy",
    apply: "cub flux apply . --require Healthy --out onboard",
    status: "cub flux status . --cluster <cluster> --kube-context <kubectl-context> --watch",
    planAnchor: "#1-see-the-plan",
    handoverAnchor: "#3-hand-one-cluster-over",
    statusAnchor: "#5-tell-confighub-what-the-cluster-is-running",
    setup: "Flux keeps reading Git while you review the generated setup.",
    connect: "The handover installs one small bootstrap root, then moves the layers it manages. Use the separate join script only for a new Flux cluster that has none of those layers already.",
    secret: "Keep SOPS-encrypted workload Secrets and registry credentials outside review output. The generated bootstrap pull Secret is delivery access, not an application Secret.",
    fixturePath: "gitops/flux/beginner",
    object: "Kustomization",
    sync: "reconciles each layer",
    becomesIntro: "<code>cub flux apply . --require Healthy --out onboard</code> writes files only. For each cluster and layer it writes what Flux would run after the handover under <code>onboard/layers/</code>. On the fixture, <code>onboard/layers/dev/apps.yaml</code> holds the <code>apps</code> Kustomization from <code>clusters/dev/apps.yaml</code> with two fields changed, and one new OCIRepository beside it.",
    becomesDiff: ` kind: Kustomization
 metadata:
   name: apps
   namespace: flux-system
 spec:
-  path: ./gitops/flux/beginner/apps/dev
+  path: ./
   sourceRef:
-    kind: GitRepository
-    name: apptique-examples
+    kind: OCIRepository
+    name: apps`,
    becomesAfter: "The Kustomization keeps its name, so Flux keeps its record of what it applied. The new OCIRepository reads the Space the plan names as the variant, <code>flux-apps-dev</code>. The generated file holds placeholders for the gateway address, and the scripts fill them in.",
    becomesHelm: "A HelmRelease is stored as it is, and helm-controller goes on resolving it. The plugin does not render Helm charts. The fixture has no HelmRelease, so this page shows none.",
    outside: "The <code>flux-system</code> bootstrap and the Flux controllers stay outside ConfigHub, and the plan lists them.",
    backAfterHandover: "Stop the root pruning, restore both fields on each layer as the script recorded them, then remove the root. The script prints the commands in that order. Do not delete the ConfigHub Spaces first.",
  },
};

/**
 * Return the content consumed by generate-public-site.mjs's splitGuideHtml.
 * install and referenceUrl are supplied from the current plugin registry so a
 * page cannot silently retain an older plugin version.
 */
// The whole output of the plan command on each public beginner fixture, at the
// commit the page links, with the plugin release the page installs. The page
// calls it actual output, so it is the output and not an excerpt. Run the
// command on the fixture again when the commit or the plugin release moves.
const ARGO_FIXTURE_PLAN = `Argo CD estate: 1 cluster, Argo CD's own (in-cluster), 2 components, 2 variants
Read 9 objects

Control tree (stays as it is: this is the management record)
  Application apptique-apps                  wave   0  root, applied by hand
    Application apptique-dev                 wave   0  deploys workloads; planned below
    Application apptique-prod                wave   0  deploys workloads; planned below

One stage, fleet (pass --stage-label and --stages to roll out in waves)

apptique-dev  (Application, project default, wave 0)
  base     argo-apptique-dev-base  reaches no cluster: its destination is empty
  each variant differs from the base in spec.destination
  stage fleet
    in-cluster  variant argo-apptique-dev-in-cluster  ->  Target argo-targets/in-cluster
                Application apptique-dev, namespace apptique-dev
                gitops/argo/beginner-app-of-apps/manifests/apptique/dev
  note     a plain directory of manifests, read as Argo CD reads it: every .yaml, .yml and .json file at the top level

apptique-prod  (Application, project default, wave 0)
  base     argo-apptique-prod-base  reaches no cluster: its destination is empty
  each variant differs from the base in spec.destination
  stage fleet
    in-cluster  variant argo-apptique-prod-in-cluster  ->  Target argo-targets/in-cluster
                Application apptique-prod, namespace apptique-prod
                gitops/argo/beginner-app-of-apps/manifests/apptique/prod
  note     a plain directory of manifests, read as Argo CD reads it: every .yaml, .yml and .json file at the top level

Handover, when this estate is live (apply will write it as handover.sh; plan runs nothing)
  1. check Argo CD is v3.1 or newer, which is where an oci:// source is read natively; an older one cannot do this at all
  2. repoint Application apptique-apps at argo-apptique-apps-children, which would hold Application apptique-dev, Application apptique-prod. Publish that Space first: a parent left syncing an empty source prunes its children. Nothing above it syncs it, so patch its spec.source in the cluster.
  3. never delete apptique-apps, apptique-dev, apptique-prod: resources-finalizer.argocd.argoproj.io deletes everything it deployed. Every step above is a patch for exactly this reason

Next
  cub argo apply . --out ./argo-onboarding
  That writes apply.sh, handover.sh and cleanup.sh. It runs nothing.`;

const FLUX_FIXTURE_PLAN = `Flux fleet: 2 clusters, 2 layers, 4 variants
Read 16 objects

Clusters, one stage each, in order: dev (clusters/dev), prod (clusters/prod)
Reconcile order (dependsOn): infrastructure -> apps

infrastructure
  base     flux-infrastructure-base  from gitops/flux/beginner/infrastructure/base
  stage dev
    dev         variant flux-infrastructure-dev  ->  Target flux-targets/dev
                Kustomization flux-system/infrastructure, path gitops/flux/beginner/infrastructure/dev
  stage prod
    prod        variant flux-infrastructure-prod  ->  Target flux-targets/prod
                Kustomization flux-system/infrastructure, path gitops/flux/beginner/infrastructure/prod

apps  (after infrastructure)
  base     flux-apps-base  from gitops/flux/beginner/apps/base
  stage dev
    dev         variant flux-apps-dev  ->  Target flux-targets/dev
                Kustomization flux-system/apps, path gitops/flux/beginner/apps/dev
                  adds namespace.yaml
                  namespace apptique-dev
                  label environment=dev
                  Deployment/frontend replace /spec/replicas = 1
                  Flux spec.healthChecks[0].namespace = apptique-dev
                  Flux spec.targetNamespace = apptique-dev
  stage prod
    prod        variant flux-apps-prod  ->  Target flux-targets/prod
                Kustomization flux-system/apps, path gitops/flux/beginner/apps/prod
                  adds namespace.yaml
                  namespace apptique-prod
                  label environment=prod
                  Deployment/frontend replace /spec/replicas = 3
                  Deployment/frontend replace /spec/template/spec/containers/0/resources/requests/cpu = 200m
                  Deployment/frontend replace /spec/template/spec/containers/0/resources/requests/memory = 128Mi
                  Deployment/frontend replace /spec/template/spec/containers/0/resources/limits/cpu = 400m
                  Deployment/frontend replace /spec/template/spec/containers/0/resources/limits/memory = 256Mi
                  Flux spec.healthChecks[0].namespace = apptique-prod
                  Flux spec.targetNamespace = apptique-prod

Sources
  - GitRepository apptique-examples  https://github.com/confighub/examples  (gitops/flux/beginner/infrastructure/base/sources/apptique-examples.yaml)
      branch: dev main, prod main

Bootstrap (stays outside ConfigHub)
  - gitops/flux/beginner/clusters/dev/flux-system
  - gitops/flux/beginner/clusters/prod/flux-system

Handover (apply will write it as handover.sh; plan runs nothing)
  1. keep each layer's Flux Kustomization under its own name and switch its sourceRef to an OCIRepository on the ConfigHub gateway, so Flux keeps its inventory and nothing is reinstalled
  2. first prove each variant renders exactly what Git renders today: infrastructure, apps prune, so anything the release lacks is deleted
  3. leave flux-system alone: flux bootstrap owns it, like the Sveltos management record

Next
  cub flux apply . --require Healthy --out ./flux-onboarding
  That writes apply.sh, handover.sh and cleanup.sh. It runs nothing.`;

export function gitopsOnboardingGuide(kind, { install, referenceUrl } = {}) {
  const guide = guides[kind];
  if (!guide) throw new Error(`gitops onboarding kind must be argo or flux, not ${kind}`);
  if (!install) throw new Error(`${kind} onboarding needs the released plugin install command`);
  if (!referenceUrl) throw new Error(`${kind} onboarding needs its upstream reference URL`);

  const upper = kind === "argo" ? "Argo CD" : "Flux";
  const installCommand = escapeHtml(install);
  const plan = commandBlock(`cd <your-${kind}-gitops-repository>
${guide.plan}`);
  const upstreamPlan = `${referenceUrl}${guide.planAnchor}`;
  const upstreamHandover = `${referenceUrl}${guide.handoverAnchor}`;
  const upstreamStatus = `${referenceUrl}${guide.statusAnchor}`;
  const fixture = kind === "argo"
    ? { url: "https://github.com/confighub/examples/tree/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/gitops/argo/beginner-app-of-apps", output: ARGO_FIXTURE_PLAN }
    : { url: "https://github.com/confighub/examples/tree/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/gitops/flux/beginner", output: FLUX_FIXTURE_PLAN };

  return {
    title: guide.title,
    lead: guide.lead,
    ask: `“Help me inspect my ${upper} repository. You may run read-only investigation and the plan, explain the output, and ask me before any command that writes local files, ConfigHub, or a cluster.”`,
    body: `    <section aria-labelledby="migration-shape">
      <h2 id="migration-shape">1. What changes, and what does not</h2>
      <p>${upper} stays the delivery controller. Preview has no account or cluster mutation; import makes a parallel ConfigHub copy while Git still delivers; handover then moves sources to reviewed releases. Handover has checks and recovery steps, not zero risk.</p>
${kind === "argo" ? '      <p>For an app-of-apps estate, ConfigHub keeps the root management structure and its parent-to-child relationships visible. Argo CD still renders charts and reconciles the descendants. The plan inventories descendant Applications and their rendered objects so you can inspect what the root governs; controller-generated or live objects remain evidence unless you deliberately choose them as desired configuration.</p>\n' : ""}
      <p>Start with a small disposable estate. Roots, generators, and pruning can make production migration an ordered fleet operation.</p>
      <h3 id="who-does-what">Who does what, before and after</h3>
      <div class="card"><table>
        <thead><tr><th></th><th>Before the handover</th><th>After the handover</th></tr></thead>
        <tbody>
          <tr><td>Source of truth</td><td>Git</td><td>ConfigHub</td></tr>
          <tr><td>${upper}</td><td>${guide.sync} from Git</td><td>still ${guide.sync}, from the release ConfigHub published</td></tr>
          <tr><td>A change</td><td>is a commit to the Git path</td><td>is an edit in ConfigHub, released after the approvals its stage asks for</td></tr>
          <tr><td>A commit to the old Git path</td><td>reaches the cluster</td><td>no longer reaches the cluster</td></tr>
        </tbody>
      </table></div>
      <p>The handover is the step that moves the source of truth. Until <code>handover.sh</code> runs, ConfigHub holds a copy that nothing reads. ${guide.outside}</p>
      <p>${kind === "argo" ? 'Some teams on Flux? <a href="./bring-flux-into-confighub.html">Bring your Flux fleet into ConfigHub</a> follows the same steps.' : 'Some teams on Argo CD? <a href="./bring-argo-into-confighub.html">Bring your Argo CD apps into ConfigHub</a> follows the same steps.'}</p>
    </section>

    <section aria-labelledby="preview-setup">
      <h2 id="preview-setup">2. Preview the setup</h2>
      <p>Install ${link("./try.html#install-cub", "the cub CLI")} and this released plugin:</p>
      <pre><code>${installCommand}</code></pre>
      <p><strong>What you need:</strong> a local checkout of the Git repository this ${upper} installation reads, the <code>cub</code> CLI, and this plugin. Start in that repository's root; replace the directory placeholder below with its path. Planning reads the repository and needs no ConfigHub account or cluster.</p>
${plan}
${kind === "flux" ? '<p><code>--require Healthy</code> makes later promotions wait for live health. Layers with workloads need <code>wait</code> or <code>healthChecks</code>; otherwise the reporter records health as Unknown. Planning itself does not prove health.</p>' : ""}
      <p><strong>Read the result.</strong> The summary gives the estate or fleet size and the component and variant counts. The following lines map shared configuration to bases and cluster differences to variants. Check the stage order and warnings before continuing. This plan does not validate the destination.</p>
      <details open><summary>Illustrative plan output</summary>
        <p>This is actual output from the ${link(fixture.url, "public beginner fixture")}, not from your repository.</p>
        <pre><code>${escapeHtml(fixture.output)}</code></pre>
      </details>
      <p>${link(upstreamPlan, `Read the full ${upper} planning reference`)} for layouts and limits.</p>
      <h3 id="try-the-fixture">Try it on the fixture first</h3>
      <p>These commands print the output above. They need no repository of your own.</p>
${commandBlock(`git clone https://github.com/confighub/examples.git
cd examples
git checkout 7f1b8f2fc849bb6488bc2c58f1469172018fc9dd
cd ${guide.fixturePath}
${guide.plan}`)}
      <p>Run the plan inside a Git checkout. In a copy with no <code>.git</code> directory the plan reports source paths as missing, and <code>--repo-root &lt;checkout&gt;</code> tells it where the repository starts.</p>
      <h3 id="what-it-becomes">What one ${guide.object} becomes</h3>
      <p>${guide.becomesIntro}</p>
      <pre><code>${escapeHtml(guide.becomesDiff)}</code></pre>
      <p>${guide.becomesAfter}</p>
      <p>${guide.becomesHelm}</p>
    </section>

    <section aria-labelledby="go-back">
      <h2 id="go-back">How to go back</h2>
      <div class="card"><table>
        <thead><tr><th>After this step</th><th>Go back by</th></tr></thead>
        <tbody>
          <tr><td><code>${escapeHtml(guide.plan)}</code></td><td>Nothing to undo.</td></tr>
          <tr><td><code>${escapeHtml(guide.apply)}</code></td><td>Delete <code>onboard/</code>.</td></tr>
          <tr><td><code>bash onboard/apply.sh</code></td><td>Run <code>bash onboard/cleanup.sh</code>. It removes what the script made in ConfigHub. ${upper} still reads Git.</td></tr>
          <tr><td><code>bash onboard/handover.sh</code></td><td>${guide.backAfterHandover}</td></tr>
        </tbody>
      </table></div>
    </section>

    <p><strong>You can stop here.</strong> The plan is read-only. To generate local scripts, connect delivery, or make a reviewed change, open the advanced steps below.</p>
    <details id="after-preview">
      <summary>After the preview: save, connect delivery and make a change</summary>

    <section aria-labelledby="save-confighub">
      <h2 id="save-confighub">3. Save the reviewed setup in ConfigHub</h2>
      <p>When the plan is clear, generate the setup directory. This writes files and scripts only.</p>
${commandBlock(guide.apply)}
      <p>Read <code>onboard/</code>; delete it to discard this step. ${guide.setup}</p>
      <p>Only the next command saves ConfigHub data. It needs <code>cub auth login</code>, <code>kustomize</code>, and any requested gateway. It creates bases, variants, stages, and releases, not cluster changes.</p>
${commandBlock(kind === "flux" ? "CONFIGHUB_OCI=<gateway> bash onboard/apply.sh" : "bash onboard/apply.sh")}
      <p>Keep this import separate from production handover; practice first with a disposable estate.</p>
    </section>

    <section aria-labelledby="connect-deployment">
      <h2 id="connect-deployment">4. Connect deployment</h2>
      <p>This first cluster-changing step checks the reviewed release against the controller record before moving a source. Replace every angle-bracket value below.</p>
      <p>${guide.connect} Do not assume production can move one application at a time.</p>
      <p><strong>Review ownership first.</strong> Pruning can delete an object absent from the reviewed release. Confirm the printed way back, ownership, backups, and objects. ${guide.secret}</p>
      <details open><summary>Contexts, gateway, and fleet handover parameters</summary>
        <p>A gateway is the OCI address controllers use to pull ConfigHub releases: ConfigHub Cloud uses <code>oci.hub.confighub.com</code>, without a scheme. A context is the named kubeconfig context that reaches the stated cluster.</p>
${kind === "argo" ? `        <p>Argo CD needs its own context and one destination context per remote cluster. This is an example for a remote cluster named <code>prod-1</code>; use the variables the generated script names for your own estate.</p>
${commandBlock("# Example only: remote cluster prod-1\nARGOCD_CONTEXT=<argo-context> DEST_CONTEXT_prod_1=<prod-1-context> CONFIGHUB_OCI=oci.hub.confighub.com bash onboard/handover.sh")}` : `        <p>Flux runs handover one existing cluster at a time:</p>
${commandBlock("CONFIGHUB_OCI=oci.hub.confighub.com CLUSTER=<cluster> FLUX_CONTEXT=<kubectl-context> bash onboard/handover.sh")}`}
      </details>
      <p>${link(upstreamHandover, "Advanced handover and recovery reference")}. Do not delete ConfigHub spaces as rollback: restore controller sources first, then use the script’s printed order.</p>
    </section>

    <section aria-labelledby="change-approve-release">
      <h2 id="change-approve-release">5. Change, approve, and release</h2>
      <p>After handover, a reviewed ConfigHub change moves through stages. Independent approval is not default; configure it and separate credentials when needed.</p>
      <details><summary>A small change, approval, and first release</summary>
${kind === "argo" ? `        <p>The released Argo example first writes a local <code>apptique.yaml</code> input, edits it, then stores, promotes, approves, and publishes it:</p>
${commandBlock("cub unit data --space argo-apptique-base apptique > apptique.yaml\n# edit apptique.yaml before the next command\ncub unit update --space argo-apptique-base apptique apptique.yaml --change-desc \"Raise the frontend to 4 replicas\"\ncub changeorder create --space argo-apptique-base more-replicas --change-workflow argo-apptique-base/rollout --description \"Raise replicas\"\ncub variant promote --change-order argo-apptique-base/more-replicas --target-stage canary\ncub variant approve --change-order argo-apptique-base/more-replicas --stage canary\ncub release publish argo-apptique-dev-1 --revision ChangeOrder:argo-apptique-base/more-replicas")}
        <p>${link(`${referenceUrl}#making-a-change-afterwards`, "Read the released worked example")} before using its example Space names.</p>` : `        <p>For Flux, make the change in ConfigHub after the layer has moved, then promote it through the stages the generated workflow created. The released guide gives this approval form:</p>
${commandBlock("cub variant approve --change-order <space>/<order> --stage <stage>")}
        <p>The server refuses a later stage until the earlier release has been approved and published.</p>`}
      </details>
      <p>Live status is also a write. This sends the observed revision and health to ConfigHub.${kind === "argo" ? " Argo CD also gets a hard refresh." : ""}</p>
${commandBlock(guide.status)}
      <p>${link(upstreamStatus, `Read the ${upper} status details`)}. A release, controller sync, and workload health are separate results; record the exact revision and target for each.</p>
    </section>
    </details>`,
  };
}

// Sveltos has a different starting input: exported ClusterProfiles and
// SveltosClusters. Its published guide deliberately separates that read from
// the offline plan, and only hands over profiles that are already live.
export function sveltosOnboardingGuide({ install, referenceUrl } = {}) {
  if (!install) throw new Error("sveltos onboarding needs the released plugin install command");
  if (!referenceUrl) throw new Error("sveltos onboarding needs its upstream reference URL");
  return {
    title: "Bring your Sveltos fleet into ConfigHub",
    lead: "Sveltos stays the controller that delivers and repairs drift. ConfigHub adds reviewed configuration, approvals, and releases for the same cluster targets.",
    ask: "“Help me inspect my Sveltos fleet. You may run read-only investigation and explain the plan; ask me before any command that writes local files, ConfigHub, or a cluster.”",
    body: `    <section aria-labelledby="sveltos-preview">
      <h2 id="sveltos-preview">1. Preview the setup</h2>
      <p>Install ${link("./try.html#install-cub", "the cub CLI")} and the released plugin:</p>
      <pre><code>${escapeHtml(install)}</code></pre>
      <p><strong>Confirm the management context.</strong> Check that kubectl is pointed at the Sveltos management cluster before exporting:</p>
${commandBlock("kubectl config current-context")}
      <p><strong>Prepare the inputs.</strong> The exports can contain sensitive configuration. Keep Secrets and credentials out of review files. On the confirmed Sveltos management cluster, export the profiles and clusters the first input file should describe:</p>
${commandBlock("kubectl get clusterprofiles,sveltosclusters -A -o yaml > my-fleet.yaml")}
      <p>This reads the management cluster; it requires access to a cluster running Sveltos v1.14.0 or newer. For each ConfigMap named by a profile's <code>policyRefs</code>, export that ConfigMap as a separate YAML input and pass it after <code>my-fleet.yaml</code>. For example, if a profile refers to the <code>kyverno-policies</code> ConfigMap in the <code>default</code> namespace:</p>
${commandBlock("kubectl get configmap -n default kyverno-policies -o yaml > kyverno-policies.yaml")}
      <p>Once these YAML files are ready, planning is offline and needs no ConfigHub account or cluster mutation:</p>
${commandBlock("cub sveltos plan my-fleet.yaml kyverno-policies.yaml --stage-label env --stages staging,prod")}
      <p>The plan shows the shared base, a variant for each selected cluster, the rollout stages, and the objects rendered from charts and policy ConfigMaps. Review its exclusions and warnings too: hooks and unsupported ownership may need a deliberate decision. A hooks refusal is a prompt to review the lifecycle, not a reason to add <code>--include-hooks</code> blindly.</p>
      <p>${link(`${referenceUrl}#1-export-what-sveltos-knows`, "Prepare the example inputs")} · ${link(`${referenceUrl}#2-see-the-plan`, "read the planning reference")}.</p>
    </section>

    <p><strong>You can stop here.</strong> The plan reads the exported YAML and does not change the cluster. To generate setup scripts, connect delivery, or make a reviewed change, open the advanced steps below.</p>
    <details id="after-preview">
      <summary>After the preview: save, connect delivery and make a change</summary>

    <section aria-labelledby="sveltos-save">
      <h2 id="sveltos-save">2. Review setup before running it</h2>
      <p>Generate scripts first. This writes files only.</p>
${commandBlock("cub sveltos apply my-fleet.yaml kyverno-policies.yaml --stage-label env --stages staging,prod --out onboard")}
      <p>Read <code>onboard/apply.sh</code> before running it. Running it needs ConfigHub login and a management-cluster context. It can change that cluster: for profiles that are not already live, it creates the gateway Secret and delivery profiles. Sveltos then begins delivering ConfigHub releases. Existing live profiles are deferred to handover and remain in control until then.</p>
${commandBlock("MGMT_CONTEXT=<management-cluster-context> bash onboard/apply.sh")}
      <p>Use a disposable fleet first. A missing Unit can mean a released profile removes objects it no longer holds.</p>
    </section>

    <section aria-labelledby="sveltos-connect">
      <h2 id="sveltos-connect">3. Connect live profiles</h2>
      <p>Only live profiles need handover. The generated script checks the planned render, Helm’s recorded release, cluster reachability, and current ownership before changing a profile.</p>
${commandBlock("MGMT_CONTEXT=<management-cluster-context> bash onboard/handover.sh")}
      <p>It is a managed fleet operation, not a universal single-profile shortcut. Keep workload Secrets out of exported review files, review the printed recovery order, and retain backups. The guide records open limits around handover rollback and chart-rendered Secret handling.</p>
      <p>${link(`${referenceUrl}#if-your-profiles-are-live`, "Advanced handover and recovery reference")}.</p>
    </section>

    <section aria-labelledby="sveltos-change">
      <h2 id="sveltos-change">4. Change, approve, and release</h2>
      <p><a href="./ai-chaos-in-production.html">See agents repair a fleet and prevent recurrence</a> in the recorded Deep Dive, then decide whether to run the disposable demonstration.</p>
      <p>The released guide shows this field change. Use your generated plan for real Space names. This stores configuration; it does not publish a release.</p>
${commandBlock("cub function set --space sveltos-kyverno-base --unit kyverno --change-desc \"Admission controller at 4 replicas\" -- \\\n  set-yq '(select(.kind == \"Deployment\" and .metadata.name == \"kyverno-admission-controller\") | .spec.replicas) = 4'")}
      <p>To deliver the change, follow the linked reference to create its change order, promote, approve and publish each stage. The starter workflow allows the author to approve; set <code>AllowAuthors: false</code> when independent approval is required.</p>
      <p>Live status writes Sveltos observations to ConfigHub:</p>
${commandBlock("cub sveltos status --context <management-cluster-context> --watch")}
      <p>${link(`${referenceUrl}#making-a-change-afterwards`, "Read change, approval, release, and status details")}.</p>
    </section>
    </details>`,
  };
}
