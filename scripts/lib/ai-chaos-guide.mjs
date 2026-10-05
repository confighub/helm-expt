// Upstream receipts and images are pinned together; this page reports those
// recorded runs, not a fresh live qualification by Workshop.
export const AI_CHAOS_REVISION = "9838de43597e0ea3946e1cebb489e8ae92cd195c";
export const AI_CHAOS_SOURCE = `https://github.com/confighub/sveltos-confighub/blob/${AI_CHAOS_REVISION}/demo`;
export const AI_CHAOS_IMAGES = ["r1-10-outage1-degraded.jpg", "r1-21-outage2-half-degraded.jpg", "r2-gui-refused-order.jpg"];

export function aiChaosGuide() {
  const source = AI_CHAOS_SOURCE;
  const image = (name, alt, caption) => `<figure><a href="./assets/ai-chaos/${name}"><img src="./assets/ai-chaos/${name}" alt="${alt}" loading="lazy"></a><figcaption>${caption} Select the image to enlarge it.</figcaption></figure>`;
  return {
    title: "Can AI fix my fleet and prevent the next outage?",
    eyebrow: "A Deep Dive",
    lead: "Watch agents investigate an outage, propose a repair and ask for approval. ConfigHub keeps the configuration, decisions and releases together; Sveltos delivers the approved changes. This recorded demonstration uses six local kind clusters standing in for production.",
    ask: `Read <a href="${source}/README.md">the pinned demo README</a> and <a href="${source}/agents/README.md">agent contract</a>. Explain the recorded results first. If I ask to run it, confirm a disposable fleet, the ConfigHub organization, prerequisites and budget before setup. Keep approval authority separate from repair authority. Do not run an outage or change delivery without my approval.`,
    css: ".chaos-story figure { margin: 20px 0 28px; } .chaos-story img { display:block; width:100%; height:auto; border:1px solid var(--line); border-radius:8px; } .chaos-story figcaption { font-size:.88rem; margin-top:8px; color:var(--muted); } .chaos-story article + article { margin-top:36px; padding-top:24px; border-top:1px solid var(--line); }",
    body: `<section aria-labelledby="choose-depth">
      <h2 id="choose-depth">Start with the story</h2>
      <p><strong>Read:</strong> about five minutes, no account or setup. <strong>Check the parity gate:</strong> about two minutes <em>after onboarding</em>, using the running demo. <strong>Run everything:</strong> two to three hours; the recorded agent runs cost about $20–$30. Your cost can differ.</p>
      <p><a href="#recorded-moments">See the three moments</a> · <a href="#check-without-agents">Check without agents</a> · <a href="#run-it">Run it yourself</a></p>
      <p>You leave with a concrete model for agent-assisted operations: propose a repair, review the change, release it, observe the result, then add a rule to prevent recurrence.</p>
    </section>
    <section class="chaos-story" aria-labelledby="recorded-moments">
      <h2 id="recorded-moments">Three moments from the recorded runs</h2>
      <article>
        <h3>My secret rotated and my app kept the old one</h3>
        <p>The first run rotated a Secret, but the web pods kept the old environment value. All four shop deployments became Degraded. The repair agent proposed a fix through ConfigHub and an admission policy requiring workloads to declare how they pick up Secret rotations. A person approved the changes.</p>
        ${image(AI_CHAOS_IMAGES[0], "ConfigHub shows all four shop deployments Synced but Degraded after the Secret rotation.", "First run: configuration was synced, but the applications were unhealthy.")}
        <p><strong>What prevents recurrence:</strong> Kubernetes admission control enforces the approved policy. That rejection is a cluster policy verdict, not an AI opinion. <a href="${source}/diary/first-run.md#outage-1-a-rotation-nobody-picked-up">Read the incident, repair and policy check</a>.</p>
      </article>
      <article>
        <h3>One manual change took down half my fleet</h3>
        <p>A hand-applied Sveltos ClusterProfile blocked the shop on the two US clusters. Staging and the European cluster stayed healthy. The repair restored service and added an admission rule requiring delivery profiles to come from the managed record.</p>
        ${image(AI_CHAOS_IMAGES[1], "Two US shop deployments are Degraded; the staging and European deployments remain Live.", "First run: the affected half of the fleet is visible beside the healthy clusters.")}
        <p><strong>What ConfigHub adds:</strong> one place to review the repair and its prevention rule, with an approval and release record. Sveltos still delivers the configuration. <a href="${source}/diary/first-run.md#outage-2-half-the-fleet-at-once">Read the incident and admission-policy proof</a>.</p>
      </article>
      <article>
        <h3>It passed staging—but the reviewer stopped the production change</h3>
        <p>The first run demonstrated a production memory failure. In the second run, the reviewing agent refused a proposed production-only memory limit of 40Mi before the outage happened: reducing the limit did not reduce cost, and the change had not been tested in staging. The run ended at that refusal.</p>
        ${image(AI_CHAOS_IMAGES[2], "An aborted production memory change order, with the reviewing agent's explanation and its promotion path.", "Second run: an agent refused the proposal. This image does not show the deterministic parity gate.")}
        <p><strong>What this proves:</strong> a recorded reviewer caught this proposal. It does not guarantee that an agent will catch every unsafe change. The separate scripted check below demonstrates enforcement of a declared staging-to-production gate. <a href="${source}/diary/verification-run.md#outage-3-refused-before-it-happened">Read the refusal and where the run stopped</a>.</p>
      </article>
    </section>
    <section aria-labelledby="why-confighub">
      <h2 id="why-confighub">Why put ConfigHub in the middle?</h2>
      <p>The repair is only part of the work. A team also needs to know what changed, who accepted it, which clusters received it and what will stop the same mistake next time.</p>
      <ul>
        <li><strong>Separate authority.</strong> The chaos and repair agents cannot approve. A reviewer or person can; the operating agents cannot edit the governed workflow.</li>
        <li><strong>Review the configuration and the rule.</strong> Both are versioned configuration, with changes that can be inspected before release.</li>
        <li><strong>Keep approvals and check results.</strong> ConfigHub records approvals and parity attestations with the change order. In the recorded agent-refusal case, the explanation lived in the transcript and the abort reason; it was not a refusal attestation.</li>
        <li><strong>Connect intent to observations.</strong> Sveltos delivers releases and reports cluster status back to ConfigHub. Synced and healthy are different facts.</li>
      </ul>
      <p>The demo uses Kubernetes ValidatingAdmissionPolicy with CEL for admission enforcement, and a separate ConfigHub release prerequisite for parity. Other policy engines have different check and preview support. <a href="https://github.com/confighub/sveltos-confighub/blob/${AI_CHAOS_REVISION}/docs/user/policy-checks.md#which-policy-engine-does-what">Compare the policy paths</a>.</p>
    </section>
    <section aria-labelledby="check-without-agents">
      <h2 id="check-without-agents">Check the parity gate without agents</h2>
      <p><strong>Needs:</strong> the demo already onboarded, its ConfigHub contexts and Spaces, and no outage in progress. This is a mutating check on the disposable demo, not a read-only inspection or a two-minute setup.</p>
      <pre><code>source demo/env.sh
bash "$DEMO/proof/parity-gate-check.sh"</code></pre>
      <p>The script adds the parity prerequisite if needed, proposes a production-only 128Mi-to-96Mi memory limit, checks that release is refused and that parity names the differing field, then restores the Units and removes the gate only if it added it.</p>
      <p><strong>Look for:</strong> <code>The parity gate works.</code> A failed expectation exits nonzero. If interrupted, inspect the change order, Units and workflow before continuing; do not assume restoration completed. <a href="${source}/proof/parity-gate-check.sh">Read the script</a>.</p>
      <p>The <a href="${source}/recording/check-2026-10-04.md">4 October recheck</a> covers stand-up, onboarding and gates on ConfigHub v0.8.3. It did not rerun the agents' outage scenarios.</p>
    </section>
    <section aria-labelledby="run-it">
      <h2 id="run-it">Run it yourself</h2>
      <p><strong>Needs:</strong> Docker with room for six kind clusters; a dedicated ConfigHub organization with an admin user and 20 free Spaces; the documented tools; and an agent account if you run the AI scenarios. The recorded machine had 18 cores and 48 GB of memory. Confirm your selected organization before any setup or teardown.</p>
      <p>The recorded versions include cub v0.8.1, cub sveltos v0.13.0, cub helm v0.1.1, Sveltos v1.15.0 and kind v0.31.0. <a href="${source}/README.md#versions">Read the complete version and installation list</a>. The hosted server may have moved on.</p>
      <pre><code>git clone https://github.com/confighub/sveltos-confighub
cd sveltos-confighub
git checkout ${AI_CHAOS_REVISION}
bash demo/standup.sh --check</code></pre>
      <p><strong>Your first result:</strong> a prerequisites report. This command checks tools, sign-in and plugins; it does not stand up the fleet.</p>
      <ol>
        <li><a href="${source}/README.md#stand-it-up">Create the disposable fleet</a> with <code>bash demo/standup.sh</code>, then <code>source demo/env.sh</code>.</li>
        <li><a href="${source}/scenarios/00-onboard.md">Onboard it into ConfigHub</a>, review the organization and permissions, and choose human or agent approval.</li>
        <li>Follow the scenarios in order: <a href="${source}/scenarios/01-rotation.md">Secret rotation</a>, <a href="${source}/scenarios/02-blast-radius.md">blast radius</a>, and <a href="${source}/scenarios/03-parity.md">staging/production parity</a>. A reviewer refusing the unsafe proposal is a useful outcome; do not force an outage to finish the story.</li>
        <li><a href="${source}/teardown.sh">Review and run teardown</a>: <code>bash demo/teardown.sh --confighub</code> removes the demo's clusters and ConfigHub resources. Keep the same dedicated context and save evidence you want to retain first.</li>
      </ol>
    </section>
    <section aria-labelledby="agent-run">
      <h2 id="agent-run">Or let your agent run it</h2>
      <p>The recorded runs used Claude Code. The <a href="${source}/agents/README.md">agent contract</a> describes how another runtime can follow the roles; that is not a claim that a Codex replay has been recorded. Start by asking your agent to explain prerequisites, changes and estimated cost, then approve the scope.</p>
    </section>
    <section aria-labelledby="evidence">
      <h2 id="evidence">Evidence and where to go next</h2>
      <p>This page summarizes <a href="${source}/PROOF.md">the upstream proof record</a> and <a href="${source}/diary/README.md">two recorded runs</a>, pinned with these images to source revision <code>${AI_CHAOS_REVISION.slice(0, 12)}</code>. Workshop has not rerun this fleet demonstration.</p>
      <p><a href="./bring-sveltos-into-confighub.html">Bring your own Sveltos fleet</a> · <a href="./confighub.html#start-managing">Deploy, promote and manage with ConfigHub</a> · <a href="./guides.html#guides-deep-dives">Explore the other Deep Dives</a></p>
    </section>`,
  };
}
