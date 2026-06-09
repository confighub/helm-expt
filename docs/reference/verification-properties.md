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
   *Verified by:* Helm-equivalence receipts plus installer package setup checks.
   `npm run redis:compare` reruns the clearest fresh Helm-vs-installer example;
   most curated `<chart>:compare` commands verify installer setup against the
   stored Helm-rendered object set.

2. **Installs via `cub installer` on the maintained catalog path.**
   For rows with the relevant receipts, the chart becomes ConfigHub Units, can
   be published or applied through OCI, and can be reconciled by an in-cluster
   Argo or Flux controller into a running workload.
   *Verified by:* ConfigHub proof receipts, local-kind e2e receipts, runtime
   GitOps receipts, and the live parity lanes recorded in the lane-test matrix.

3. **Deterministic, pinned, pull-based delivery.** The OCI artifact is
   content-addressed (digest); the controller pulls and reconciles it, so drift
   self-heals. No plaintext secret ever sits in the artifact.

4. **Your chosen namespace is honored.** `cub installer setup --namespace X`
   puts the workload in `X` (via the `set-namespace` transformer in the
   package).
   *Limitation (F1b):* complex charts with a namespace embedded in spec fields
   (RBAC `subjects`, webhook `clientConfig`) are not yet fully re-namespaced —
   install those in their canonical namespace for now.

5. **Secrets are never in the artifact.** Default password-generating bases
   render a `Secret` that is *not* shipped in the OCI artifact (a security
   choice — better than `helm install`, which ships plaintext inline). Such
   charts therefore need the **existing-secret / External-Secrets** path to run
   under GitOps.
   *Limitation (F3):* a default password-generating base can reconcile while the
   workload cannot start until the secret is provided out-of-band or via
   External Secrets. *Proven good path:* redis `reuse-existing-secret` deploys
   fully healthy. The product path needs required-secret validation and typed
   secret references so this cannot become a silent green.

6. **Day-2 changes flow through the governed path.** A change made through
   ConfigHub (e.g. replicas) republishes the OCI artifact and reconciles to the
   exact runtime field via Argo/Flux — no out-of-band `kubectl edit`.
   *Verified by:* live Day-2 proof (e.g. nginx replicas 1→2 → 2/2).

7. **Three-way agreement.** ConfigHub revision ↔ controller (Argo/Flux) sync ↔
   live cluster all match. A PASS requires exact runtime field proof, not just a
   controller "Synced".

8. **Every claim has a receipt.** Render, equivalence, scan, upload, and live
   observation are recorded as committed proof artifacts you can inspect.

## Outcome-First Reading

Read "full test run" as an outcome, not as a script name. For every supported
chart default and declared main choice, the desired end state is:

```text
fresh or receipt-backed Helm equivalence
-> deterministic cub installer setup
-> ConfigHub upload, scan, clone/check, and safe-ops receipts
-> live Kubernetes apply and observation
-> ConfigHub OCI through Argo or Flux with runtime evidence
-> live Helm-vs-ConfigHub comparison across Helm, ConfigHub/OCI, and ConfigHub/kubectl
```

Default-only verification is not enough when the catalog advertises another
main choice. For example, an existing-secret, no-crds, server-only, ingress, HA,
or storage-mode base needs the same outcome tracking as the default base. A
derived ConfigHub variant needs clone/check/mutation receipts and live evidence
for the post-render choices it claims to support.

## What a full per-chart run exercises

`render-equivalence → install (default base) → install (a non-default
variant) → namespace honored → secret path → Day-2 edit → three-way agreement`,
each backed by a receipt. A chart "passes" only when every applicable row holds.

## Current coverage (honest)

- **Render-equivalence and installer setup:** passing for every current
  chart-recipe-variant row in `data/lane-test-matrix/`.
- **ConfigHub proof, local-kind e2e, runtime GitOps, and live parity:** tracked
  separately in `data/outcome-coverage/summary.md` and
  `data/status-dashboard/summary.md`; current coverage is partial by variant.
- **Strict two-cluster Helm-vs-installer parity:** committed for all maintained
  top-20 base variants in `data/live-kind-parity/summary.md`; non-pass rows are
  classified separately from semantic parity defects.
- **Controller-owned or hook-like lifecycle behavior:** cert-manager and
  External Secrets lifecycle observations are tracked in
  `data/lifecycle-observations/cert-manager-eso/summary.md`.

## Known limitations / open items

- **F1b** — complex charts: namespace refs embedded in spec aren't re-namespaced
  (install in canonical namespace).
- **F3** — default password-generating bases need the existing-secret or
  External Secrets path before they can be called ready on GitOps targets.
- **F4** — changing a package's `installer.yaml` requires regenerating its proof
  artifacts, or `:compare`/proof fails a source-SHA check (issue #97).
- Environment caveats — e.g. metrics-server needs `--kubelet-insecure-tls` on
  kind; heavy charts need real cluster resources.
- Live Helm-vs-ConfigHub comparison is committed for selected rows, and strict
  two-cluster parity is committed for all maintained top-20 bases. Remaining
  non-pass rows are target, lifecycle, storage, hook, or operating-policy work
  unless a receipt reports a semantic parity defect.

## Where to look

- Per-chart proof: `npm run <chart>:verify-proof`, `npm run <chart>:verify-package`,
  and where supported `npm run <chart>:compare`.
- Corpus lane matrix: `data/lane-test-matrix/summary.md`.
- Lane doctrine: `docs/reference/lane-test-doctrine.md`.
