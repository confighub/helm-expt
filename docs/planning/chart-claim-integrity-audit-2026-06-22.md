# Chart-page claim-integrity audit (2026-06-22)

**UNOFFICIAL/EXPERIMENTAL.** An adversarial "Brian/Jesper" audit of the generated chart pages,
hunting two failure modes where a page implies a Helm chart's behaviour is replicated but the
claim is false: **(a) an untested/broken alternative is proposed**, or **(b) a check was
forgotten and the gap is left visible**. Every finding below was verified against the receipt
the page cites. The audit is now backed by a permanent gate —
[`scripts/verify-chart-claim-integrity.mjs`](../../scripts/verify-chart-claim-integrity.mjs)
(`npm run chart-claim-integrity:verify`) — whose machine output is
[data/chart-claim-integrity-audit-2026-06-22/](../../data/chart-claim-integrity-audit-2026-06-22/summary.md).

## The verified false claims

| Chart | Mode | The claim | The reality (verified receipt) | Sev | Gate |
| --- | --- | --- | --- | --- | --- |
| **kube-prometheus-stack** | b | "supported / Open dispositions: none" (85.3.3) | the cited two-cluster-kind receipt is **`result: blocked`** (10 CRDs missing) **and version 86.1.0** | 🔴 | HARD |
| **external-secrets** | a+b | default + no-crds GitOps lanes shown **green** | the GitOps receipts are **`result: blocked`** (CRDs absent, deployments 0/1); `no-crds` is recommended as the CRD fix | 🔴 | HARD |
| **argo-cd** | a | `no-crds` GitOps lane **green** | its GitOps receipt is **`result: blocked`** | 🔴 | HARD |
| **ingress-nginx** | a+b | `default` base **8/8 green / supported / covered** | the admission-webhook patch **hook Jobs are omitted**; the **4 receipts its webhook lifecycle route requires do not exist on disk** (incl. `admission-webhook-observation-receipt`); "supported" is scoped to `internal-clusterip`, *the base that deletes the webhook* | 🔴 | HARD |
| **strimzi-kafka** | a | recommends base `no-crds` + shows it green (G/P/V) | its receipt has a **blocked live-apply leg: operator `0/1 Error`, `pod-runtime-failure`** — crash-loops without its CRDs | 🟠 | manual¹ |
| **vault** | b | "webhook readiness — none open / ready-to-try / no open gap" | nothing proves the injector serves or Vault **unseals**; the only HA/Raft base sits at `L=no / P=watch`, folded into "no open gap"; green `V` rests on a receipt that disclaims convergence | 🟠 | manual¹ |
| **cert-manager** | b | accepts "hook and lifecycle phase policy" + "webhook readiness" disposition, "supported / none open"; `default` base shown all-green | the support artifact marks the hook **"observed, not Helm-hook execution"** and **excludes the `default` base from scope**; the page drops both hedges | 🟠 | warn² |
| **redis / postgresql** | a | recommend `reuse-existing-secret` / `existing-secret` for the password | the support decision covers **only `default` / `generated-passwords`** — following the page's own security advice steps you **off the supported base** | 🟡 | warn |

¹ Not auto-detected: the drift is in a `watch` receipt + a recommended-base, not a clean
lane-vs-receipt contradiction. Documented here; candidate for a future gate check.
² Surfaced as a version-skew warn; the hook-observe-vs-execute flattening is a renderer fix.

## Two systemic root causes

1. **"Green lane ≠ it works."** The V (variant-promotion), G (GitOps), P (parity) lanes prove
   *objects render and promote identically to Helm* — **not** that the workload functions.
   Receipts say so verbatim: *"It does not prove… target apply, GitOps sync, or Kubernetes
   workload convergence."* For an operator (Kafka reconciling), a webhook (ingress/cert-manager
   cert), or a stateful app (Vault unsealing), a green lane is silent on whether the thing works.
2. **The HTML flattens a careful, honest data layer.** The underlying `support-decision.yaml`,
   `lifecycle-policy.yaml`, and receipts are honest — they scope to the right base, mark legs
   "not-tested", and call the hook "observed not executed." The **site generator collapses**
   "supported for the webhook-removing base + render-only hook handling" into "8/8 green,
   supported, none open, covered." The truth is in the repo; the page mis-renders it.
   Secondary: **"Open dispositions: none"** is a terminology collision (it means the *policy*
   axis, not lane completeness), and support decisions sometimes cite **cross-version** receipts.

## Clarity findings (the "do the cards make sense" pass)

- The **"ConfigHub Actions" section is empty** ("No action route attached yet") on exactly the
  hook/webhook charts where it matters most — **cert-manager, ingress-nginx, vault** — even
  though those charts' headline quirk *is* a hook/webhook (and the data models it).
- **Boilerplate leaks:** strimzi shows a literal `create-namespace: unknown` placeholder, a
  "Not yet tested: [lanes]" line directly above the same lanes shown *passing*, an "F2b rendered
  standard fork" generic descriptor, and a top install command missing `--namespace`.
- **Redis** (the flagship) is clean except a `--work-dir <tmp>` placeholder in the hero that
  won't paste, while the teaching cards below use a concrete path.

## The fix

- **Prevention is built:** the claim-integrity gate re-checks every page claim against its cited
  receipt and fails CI on a contradiction (13 HARD findings across 6 charts at audit time). It also protects the data —
  you cannot make a red page green by editing a support-decision, because the gate reads the
  receipt's real `result`.
- **Generator-side fixes (Codex owns the renderer):** derive lane colour from the receipt
  `result` (single source of truth); carry the receipt's own disclaimers onto the page (a green
  V must not read as "it works"); qualify cross-version evidence; render the modelled hook/webhook
  in the ConfigHub Actions section instead of "No action route attached"; show the support scope
  next to "supported"; remove the boilerplate placeholders. The per-chart + systemic Codex prompt
  is in this PR's description and tracked as GitHub issues.

## Strategy gap this closes
This was **not** covered as a lane. The spirit existed (adversarial-strategy, claims-register,
what-we-refuse-to-claim) but nothing checked that a *rendered chart page matches its own cited
receipts*. The new `chart-claim-integrity` lane (test-map group A) closes it; re-run it after any
chart-page or receipt change. Companion to the [persona UX strategy](../../tests/persona-ux-strategy.md).
