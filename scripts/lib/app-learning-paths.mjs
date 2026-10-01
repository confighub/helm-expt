// Customer-facing app examples for the existing Apps page.
export function appLearningPathsHtml() {
  return `<section aria-labelledby="apps-change-path">
      <h2 id="apps-change-path">How configuration changes the work</h2>
      <p>For an existing Argo CD or Flux estate, ConfigHub can make rendered changes, ownership, approvals, and releases easier to follow while your controller remains responsible for applying them.</p>
      <ol>
        <li><strong>Preview.</strong> Read the plan and compare the objects first. This stage needs no cluster.</li>
        <li><strong>Import alongside Git.</strong> Create a parallel ConfigHub record while Git remains the controller’s source.</li>
        <li><strong>Review handover.</strong> Check which source and owner will change, inspect the generated recovery steps, then hand over when the team is ready.</li>
      </ol>
      <p>Handing back restores the controller’s source; it does not restore database contents or other application effects. Use the <a href="./bring-argo-into-confighub.html">Argo CD guide</a> or <a href="./bring-flux-into-confighub.html">Flux guide</a> for this estate path.</p>

      <div class="app-learning-cards">
        <article class="door">
          <span class="kicker">Small app and database</span>
          <h3>Change the frontend; keep its database context</h3>
          <p><strong>App and dependencies:</strong> a frontend, backend, and PostgreSQL StatefulSet, connected through a layered recipe.</p>
          <p><strong>Before ConfigHub:</strong> the example starts with development settings. Its flattened configuration is fully rendered Kubernetes YAML, rather than chart templates. App code, images, and delivery stay in their own workflows.</p>
          <p><strong>With ConfigHub:</strong> inspect the plan and local replica change, then retain component ancestry and app-level provenance. A <em>base</em> is shared starting configuration; a <em>variant</em> adds choices for one environment. A target and apply are separate steps.</p>
          <p><strong>Try:</strong> raise the frontend replica count in a deployment variant and compare it with the shared base.</p>
          <aside class="agent-note"><strong>For your agent:</strong> “Show how a frontend replica change flows from the shared base to its deployment variant. Flag database risks; do not apply anything.”</aside>
          <p><a href="./ai.html">AI guide</a> · <a href="https://github.com/confighub/examples/blob/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/catalog/FIRST_APP.md">Manual next: the first-app walkthrough</a></p>
          <p><a href="https://github.com/confighub/examples/tree/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/global-app-layer/realistic-app">Open the realistic-app example</a>. Its local preview is read-only; successful Unit verification does not prove that the app is serving requests.</p>
        </article>

        <article class="door">
          <span class="kicker">Development and production</span>
          <h3>Promote the tag you reviewed</h3>
          <p><strong>App and dependencies:</strong> one frontend, two Git repositories, and separate Argo CD Applications for dev and prod.</p>
          <p><strong>Before ConfigHub:</strong> CI proposes the dev image tag; a second pull request promotes that same tag to prod.</p>
          <p><strong>With ConfigHub:</strong> render each environment into its own Space and inspect the actual image-field diff alongside Git’s separate promotion record.</p>
          <p><strong>Try:</strong> change the prod tag without updating its promotion record; the example’s verifier catches the mismatch.</p>
          <aside class="agent-note"><strong>For your agent:</strong> “Compare the dev and prod image tags with the promotion record. Show the object field that changes; do not open a pull request or deploy.”</aside>
          <p><a href="./ai.html">AI guide</a> · <a href="./bring-argo-into-confighub.html">Manual next: bring an Argo CD estate into ConfigHub</a></p>
          <p><a href="https://github.com/confighub/examples/tree/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/gitops/argo/intermediate-ci-to-gitops">Open the dev-to-prod example</a>. Its CI and promotion workflows are illustrative; the example does not install Argo CD or deploy to a live cluster.</p>
        </article>

        <article class="door">
          <span class="kicker">GPU inference</span>
          <h3>Shape a RAG app for NIM</h3>
          <p><strong>App and dependencies:</strong> rag-server, NIM language and embedding services, and a vector database.</p>
          <p><strong>Before ConfigHub:</strong> model images, GPU placement, and service connections sit across several component configurations.</p>
          <p><strong>With ConfigHub:</strong> the example layers the four components and records direct, Flux, and Argo variants so a model-profile change has a traceable path.</p>
          <p><strong>Try:</strong> change the LLM and embedding model names at the shared profile layer, then inspect how that choice flows toward each deployment variant.</p>
          <aside class="agent-note"><strong>For your agent:</strong> “Trace how an LLM and embedding model change flows through the Enterprise RAG recipe. List what the NIM target needs; do not claim a live result.”</aside>
          <p><a href="./ai.html">AI guide</a> · <a href="./try-aicr.html">Manual next: compare GPU nodes and AICR requirements</a></p>
          <p><a href="https://github.com/confighub/examples/tree/7f1b8f2fc849bb6488bc2c58f1469172018fc9dd/global-app-layer/enterprise-rag-blueprint">Open the Enterprise RAG example</a>. Its runnable NIM path requires x86_64, NVIDIA hardware, and NGC credentials. This Apps page does not claim live GPU success; recipe verification and local Ollama queries do not prove NIM runtime on your cluster.</p>
        </article>
      </div>
    </section>`;
}
