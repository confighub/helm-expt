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
  },
};

/**
 * Return the content consumed by generate-public-site.mjs's splitGuideHtml.
 * install and referenceUrl are supplied from the current plugin registry so a
 * page cannot silently retain an older plugin version.
 */
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
    ? { url: "https://github.com/confighub/examples/tree/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/gitops/argo/beginner-app-of-apps", output: "Argo CD estate: 1 cluster, Argo CD's own (in-cluster), 2 components, 2 variants\nRead 9 objects\n\nControl tree (stays as it is: this is the management record)\n  Application apptique-apps  wave 0  root, applied by hand" }
    : { url: "https://github.com/confighub/examples/tree/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/gitops/flux/beginner", output: "Flux fleet: 2 clusters, 2 layers, 4 variants\nRead 16 objects\n\nClusters, one stage each, in order: dev (clusters/dev), prod (clusters/prod)\nReconcile order (dependsOn): infrastructure -> apps" };

  return {
    title: guide.title,
    lead: guide.lead,
    ask: `“Help me inspect my ${upper} repository. You may run read-only investigation and the plan, explain the output, and ask me before any command that writes local files, ConfigHub, or a cluster.”`,
    body: `    <section aria-labelledby="migration-shape">
      <h2 id="migration-shape">1. What changes, and what does not</h2>
      <p>${upper} stays the delivery controller. Preview has no account or cluster mutation; import makes a parallel ConfigHub copy while Git still delivers; handover then moves sources to reviewed releases. Handover has checks and recovery steps, not zero risk.</p>
${kind === "argo" ? '      <p>For an app-of-apps estate, ConfigHub keeps the root management structure and its parent-to-child relationships visible. Argo CD still renders charts and reconciles the descendants. The plan inventories descendant Applications and their rendered objects so you can inspect what the root governs; controller-generated or live objects remain evidence unless you deliberately choose them as desired configuration.</p>\n' : ""}
      <p>Start with a small disposable estate. Roots, generators, and pruning can make production migration an ordered fleet operation.</p>
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
