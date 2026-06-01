# What a full test run verifies — and what you can expect to be true

This page is the **acceptance contract** of the catalog: when a chart passes a
full test run, these are the properties you can rely on. Each property names how
it is verified and at which layer, and the honest limitations are listed at the
end. (Experimental & unofficial, like the rest of this repo.)

## The verified properties

For a catalog chart that passes a full test run, you can expect:

1. **Helm-equivalent render.** The chart's `cub installer` render is
   *semantically equivalent* to `helm template` — the same Kubernetes objects
   with the same key fields — apart from declared governance additions (a
   generated `Namespace` object; rendered `Secret`s are deliberately not stored
   in the artifact, see property 5).
   *Verified by:* `npm run <chart>:compare` (helm template vs the installer render).

2. **Installs via `cub installer` — never the `helm` CLI — governed end to end.**
   The chart becomes ConfigHub units, is published to an OCI artifact at
   `oci.hub.confighub.com`, and is pulled + reconciled by your in-cluster
   Argo/Flux into a running workload.
   *Verified by:* local-kind e2e receipts (this repo) + the live
   ConfigHub→OCI→Argo/Flux gate (Pilot; receipts in `confighub-ai-demo`).

3. **Deterministic, pinned, pull-based delivery.** The OCI artifact is
   content-addressed (digest); the controller pulls and reconciles it, so drift
   self-heals. No plaintext secret ever sits in the artifact.

4. **Your chosen namespace is honored.** `cub installer --namespace X` puts the
   workload in `X` (via the `set-namespace` transformer in the package).
   *Limitation (F1b):* complex charts with a namespace embedded in spec fields
   (RBAC `subjects`, webhook `clientConfig`) are not yet fully re-namespaced —
   install those in their canonical namespace for now.

5. **Secrets are never in the artifact.** Default password-generating bases
   render a `Secret` that is *not* shipped in the OCI artifact (a security
   choice — better than `helm install`, which ships plaintext inline). Such
   charts therefore need the **existing-secret / External-Secrets** path to run
   under GitOps.
   *Limitation (F3):* a default password-generating base will deliver "green"
   but the workload cannot start until the secret is provided out-of-band or via
   ESO. *Proven good path:* redis `reuse-existing-secret` deploys fully healthy.
   Design for tiered secrets: `confighub-ai-demo#1132`.

6. **Day-2 changes flow through the governed path.** A change made through
   ConfigHub (e.g. replicas) republishes the OCI artifact and reconciles to the
   exact runtime field via Argo/Flux — no out-of-band `kubectl edit`.
   *Verified by:* live Day-2 proof (e.g. nginx replicas 1→2 → 2/2).

7. **Three-way agreement.** ConfigHub revision ↔ controller (Argo/Flux) sync ↔
   live cluster all match. A PASS requires exact runtime field proof, not just a
   controller "Synced".

8. **Every claim has a receipt.** Render, equivalence, scan, upload, and live
   observation are recorded as committed proof artifacts you can inspect.

## What a full per-chart run exercises

`render-equivalence → install (default base) → install (a non-default
variant) → namespace honored → secret path → Day-2 edit → three-way agreement`,
each backed by a receipt. A chart "passes" only when every applicable row holds.

## Current coverage (honest)

- **Render-equivalence, scan, upload, local-kind e2e:** 20/20 TOP20 charts;
  100 charts have recipe/package proof artifacts.
- **Live ConfigHub→OCI→Argo/Flux + Day-2:** proven on representative charts
  today (nginx default; redis `reuse-existing-secret`; nginx Day-2). The broader
  live sweep (all 20, then 100+) runs on dedicated machines — see the test plan
  in `confighub-ai-demo` (`pilot/HELM_EXPT_TEST_STRATEGY.md`).

## Known limitations / open items

- **F1b** — complex charts: namespace refs embedded in spec aren't re-namespaced
  (install in canonical namespace).
- **F3** — default password-generating bases need the existing-secret/ESO path;
  silent until then (design: `confighub-ai-demo#1132`).
- **F4** — changing a package's `installer.yaml` requires regenerating its proof
  artifacts, or `:compare`/proof fails a source-SHA check (issue #97).
- Environment caveats — e.g. metrics-server needs `--kubelet-insecure-tls` on
  kind; heavy charts need real cluster resources.

## Where to look

- Per-chart proof: `npm run <chart>:proof` / `npm run <chart>:compare`.
- Live gate receipts + the full test strategy + findings:
  `confighub-ai-demo` → `pilot/HELM_EXPT_TEST_STRATEGY.md`,
  `pilot/HELM_WAVE1_FINDINGS.md`, `reports/pilot-ax-audits/`.
