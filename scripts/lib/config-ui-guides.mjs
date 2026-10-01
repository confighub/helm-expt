// Introductory paths based on released Scout and Commander documentation.
// Keep cluster observation separate from intended configuration and mutation.
const scoutSource = 'https://github.com/confighub/cub-scout/blob/v2.12.4';
const commanderSource = 'https://github.com/confighub/cub-commander/blob/v0.3.0';

export function scoutUiGuide() {
  return {
    title: 'See what is running with cub scout',
    lead: 'Pick one workload and discover who manages it. Start with a read-only view of your cluster, without a ConfigHub account.',
    ask: 'Help me inspect one workload with cub scout. Confirm the cluster context with me, explain its owner and any missing evidence, and do not change configuration or delivery.',
    body: `<section aria-labelledby="scout-start">
      <h2 id="scout-start">1. Open your cluster map</h2>
      <p><strong>You need:</strong> the <a href="./try.html#install-cub">cub CLI</a>, kubectl and read access to a Kubernetes cluster. No cluster yet? Start with a <a href="./guides.html#guides-journeys">local demo</a>; this Guide is for an existing cluster.</p>
      <p>First check the context name below. Stop if it is not the cluster you intend to inspect; select the right kubeconfig before continuing.</p>
      <pre><code>kubectl config current-context
cub plugin install confighub/cub-scout@v2.12.4
cub scout map</code></pre>
      <p><strong>Your first result:</strong> an interactive terminal map of the objects Scout can read. Choose one familiar workload and look for its namespace and ownership. You have made no deployment or ConfigHub change.</p>
      <p>If the map is empty or access is refused, check the context and permissions. Missing observations do not mean that the cluster is empty or healthy. Use the map’s displayed help for navigation.</p>
    </section>
    <section aria-labelledby="scout-read">
      <h2 id="scout-read">2. Read one workload</h2>
      <p>Record three things: the object’s name and namespace, the controller or tool reported as its owner, and anything marked unknown. An owner might be Argo CD, Flux or Helm; it tells you where to investigate the next change.</p>
      <p>For a readable summary outside the map, run:</p>
      <pre><code>cub scout doctor
cub scout gitops status</code></pre>
      <p>The first command identifies issues to investigate; the second shows what delivery controllers report. A healthy object alone does not prove the intended release was delivered or that the application works.</p>
      <p><strong>You can stop here.</strong> A useful result is knowing which system owns the workload and what to investigate next. No import or handover is required.</p>
    </section>
    <section aria-labelledby="scout-next">
      <h2 id="scout-next">3. Choose where the change belongs</h2>
      <p>If Git and Argo CD or Flux own the object, inspect that source before changing live YAML. A reconciler can overwrite a direct edit. If ConfigHub holds the intended configuration, continue with <a href="./view-and-change-config-with-uis.html">the official ConfigHub GUI</a>.</p>
      <p>For a reviewed move into ConfigHub, use the <a href="./bring-argo-into-confighub.html">Argo CD</a> or <a href="./bring-flux-into-confighub.html">Flux</a> Guide. That is a separate decision from viewing your cluster.</p>
      <details><summary>Versions and deeper reference</summary><p>This introduction follows <a href="${scoutSource}/README.md">Scout v2.12.4</a>. See its <a href="${scoutSource}/docs/getting-started/start-here.md">getting-started guide</a> for additional workflows. These instructions were checked against released documentation; this page does not record a new live-cluster trial. Avoid sharing raw observations containing private operational information.</p></details>
    </section>`,
  };
}

export function configUiGuide() {
  return {
    title: 'View and change configuration with ConfigHub UIs',
    lead: 'Start with the official ConfigHub GUI, available with Enterprise Server and SaaS. Find one saved configuration and understand its environment before changing it.',
    ask: 'Help me find one configuration in ConfigHub, explain its environment and revision, and compare it with another environment if one exists. Keep this first task read-only; propose any change separately.',
    body: `<section aria-labelledby="ui-choose">
      <h2 id="ui-choose">1. Start with the official GUI</h2>
      <p><strong>You need:</strong> access to a ConfigHub organization containing configuration you are allowed to inspect. No saved configuration yet? Follow <a href="https://docs.confighub.com/get-started/tutorial/">the official introductory tutorial</a> first. A cluster is not needed just to browse stored configuration.</p>
      <table><thead><tr><th>Use</th><th>When you want</th><th>Start</th></tr></thead><tbody>
      <tr><td><strong>ConfigHub GUI — official main route</strong></td><td>To view and operate on configuration with Enterprise Server or SaaS</td><td>Open your team’s ConfigHub server or SaaS instance and sign in</td></tr>
      <tr><td>ConfigHub UI SDK</td><td>To adapt the interface to new use cases and plugins, including standalone, disconnected use</td><td>Choose this when building a custom interface; it is not required for this walkthrough</td></tr>
      <tr><td>cub-commander — early experimental TUI</td><td>To try browsing, querying and comparing configuration in a full-screen terminal</td><td>Use the commands below</td></tr>
      <tr><td>cub scout</td><td>To inspect what a cluster reports now</td><td><a href="./see-what-is-running.html">Use the separate Scout Guide</a></td></tr>
      </tbody></table>
      <p>A <strong>Unit</strong> is a stored piece of configuration. A <strong>Space</strong> groups Units. A <strong>revision</strong> records a version of that configuration. These are intended settings; live observations answer a different question.</p>
    </section>
    <section aria-labelledby="ui-browser">
      <h2 id="ui-browser">2. Find one configuration in the official GUI</h2>
      <ol><li>Confirm the organization you are viewing.</li><li>Find a component or Space you recognize, then open one Unit. If you have no entries or lack permission, ask for a tutorial Space or access; do not create production data just to follow this Guide.</li><li>Read its configuration and revision. Identify the environment from its labels and relationships, rather than guessing from its name.</li></ol>
      <p><strong>Your first result:</strong> you can name the configuration, the environment it belongs to and the revision you inspected. Keep the view read-only for now. Saving an edit changes stored configuration; it is a separate step from opening a Unit. For the next hands-on task, the official <a href="https://docs.confighub.com/get-started/tutorial/change/">Make a Change tutorial</a> shows editing the base, promoting and releasing as separate steps.</p>
    </section>
    <section aria-labelledby="ui-terminal">
      <h2 id="ui-terminal">3. Optional: try the experimental terminal UI</h2>
      <p>Install the <a href="./try.html#install-cub">cub CLI</a> and sign in to the same server and organization you intend to inspect. cub-commander is an early experimental terminal UI (TUI), not the main product interface. Its interface can change between versions.</p>
      <pre><code>cub auth login
cub plugin install confighub/cub-commander@v0.3.0
cub commander</code></pre>
      <p>Start at the <strong>browse by</strong> chooser. Follow Space → Unit, or the labels your organization provides. Open a row to inspect it. Use <code>Ctrl+/</code> for help and <code>Ctrl+Q</code> to quit.</p>
      <p>When two environments exist, mark one selection with <code>m</code>, mark the other with <code>m</code>, then press <code>d</code> to compare matching Units. Differences show intended configuration, not proof of what either cluster runs. Commander can also explain a query as a cub command.</p>
      <p><strong>Stop after inspection.</strong> On a Unit’s Data tab, <code>e</code> opens an editor and saving writes a revision. That is a write operation, not another viewing shortcut. Review the environment and diff before saving; promotion and release are separate operations with their own consequences.</p>
    </section>
    <section aria-labelledby="ui-live">
      <h2 id="ui-live">4. Connect intended configuration to a live observation</h2>
      <p>This is optional. You need cluster read access and an explicit mapping from a ConfigHub Target ID to a kubeconfig context. Do not infer that mapping from a similar name.</p>
      <details><summary>Use Commander’s Resource Evidence tab</summary>
      <p>The documented v0.3.0 pairing uses Scout v2.10.0. Replace both placeholders with your confirmed Target ID and context; angle brackets are not literal values.</p>
      <pre><code>cub plugin install confighub/cub-scout@v2.10.0
cub commander --scout-binding '&lt;target-id&gt;=&lt;kube-context&gt;'</code></pre>
      <p>If Scout is already installed, follow the <a href="${commanderSource}/docs/releases/v0.3.0.md">version-specific install and upgrade instructions</a> rather than replacing a newer installation blindly.</p>
      <p>Open a Resource and choose <strong>3 Evidence</strong>. Check the identity, observation time and omissions. Press <code>r</code> to refresh; revisiting a tab does not refresh its snapshot. Missing bindings or unavailable evidence are not a health verdict. This view is neither a desired/live diff nor proof of successful delivery.</p></details>
    </section>
    <section aria-labelledby="ui-next">
      <h2 id="ui-next">5. Make your next step deliberate</h2>
      <p>For a first managed change, continue with <a href="https://docs.confighub.com/get-started/tutorial/change/">the official change tutorial</a>. To understand deployment and promotion first, use <a href="./confighub.html">Deploy and manage with ConfigHub</a>. To investigate the live side, return to <a href="./see-what-is-running.html">Scout</a>.</p>
      <p>The official GUI is the main product route. The UI SDK is for adapting that interface to new use cases and plugins; it can also run standalone and disconnected. Disconnected use does not provide a live server or cluster view. The experimental TUI and CLI offer other ways to work with the ConfigHub model; their features and permissions can differ. Source review for this Guide: <a href="${commanderSource}/README.md">Commander v0.3.0</a> and the official tutorial. No new authenticated UI or live-cluster acceptance is claimed here.</p>
    </section>`,
  };
}
