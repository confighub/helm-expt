# Issue Backlog

This document mirrors the GitHub issues that must not be lost in the planning
docs. GitHub remains the execution tracker; this file keeps reviewers aligned
with the written plan.

Last synced: 2026-05-26.

## Rule

```text
P0 issues are gates.
P1 issues strengthen the proof after P0.
P2 issues preserve important design depth without blocking the first proof.
```

The current plan is not credible at 20/100/500 chart scale until every P0 is
either completed or deliberately reclassified.

## Execution Order

The council review made the first implementation slice explicit:

1. [#24](https://github.com/confighub/helm-expt/issues/24) **Schema and verifier first.**
   Without this, artifacts and spreadsheets are decorative.
2. [#10](https://github.com/confighub/helm-expt/issues/10) **Redis courtroom-grade proof.**
   Redis is where the full chain becomes real.
3. [#26](https://github.com/confighub/helm-expt/issues/26) **Five-minute UX proof.**
   Keep proving the path is easier, safer, and correct versus Helm.
4. **Close the missing determinism/freshness gates**:
   [#29](https://github.com/confighub/helm-expt/issues/29),
   [#28](https://github.com/confighub/helm-expt/issues/28),
   [#30](https://github.com/confighub/helm-expt/issues/30), and
   [#27](https://github.com/confighub/helm-expt/issues/27).
5. [#25](https://github.com/confighub/helm-expt/issues/25) **Top-N adversarial harness.**
   Only scale after the artifact chain and UX proof work. Use
   [known-adversarial-charts.md](known-adversarial-charts.md) to choose
   public charts that exercise CRDs, hooks, generated facts, capabilities,
   `tpl`, raw manifests, RBAC/webhooks/APIService, and stateful behavior.

## P0 Gates

| Issue | Area | Why it is a gate |
| --- | --- | --- |
| [#24](https://github.com/confighub/helm-expt/issues/24) Add artifact schema and receipt verifier | Proof integrity | Reviewers need machine verification that artifacts, hashes, and receipts are consistent. |
| [#10](https://github.com/confighub/helm-expt/issues/10) Create complete Redis HelmPlan and ChartDossier artifacts | Redis proof | Redis is the first detailed proof that the model works end to end. |
| [#26](https://github.com/confighub/helm-expt/issues/26) Prove simple UX is easier, safer, and correct versus Helm | UX / trust | Users will not adopt this if it feels harder, riskier, or wrong compared with Helm. |
| [#4](https://github.com/confighub/helm-expt/issues/4) Emit a HelmPlan pain report for each analyzed chart | HelmPlan | Every chart needs a visible pain/mitigation report before it can be trusted. |
| [#5](https://github.com/confighub/helm-expt/issues/5) Produce EffectiveValues@sha with value precedence and provenance | Values / provenance | Helm users need to know which inputs actually produced the result. |
| [#6](https://github.com/confighub/helm-expt/issues/6) Detect dead, unknown, or ignored Helm values where possible | Values / safety | Silent ignored values are a core Helm pain point. |
| [#7](https://github.com/confighub/helm-expt/issues/7) Add value-to-rendered-field explanation for key chart settings | Explainability | The proof must show why rendered objects differ between variants. |
| [#8](https://github.com/confighub/helm-expt/issues/8) Prove Helm equivalence for Redis and classify every ConfigHub difference | Correctness | ConfigHub must be correct versus Helm, with every intentional difference explained. |
| [#9](https://github.com/confighub/helm-expt/issues/9) Bind rendered-object scans and install gates to exact manifest digests | Safety / scans | Scans and gates are only meaningful when bound to exact rendered objects. |
| [#29](https://github.com/confighub/helm-expt/issues/29) Define capability profile catalog for Helm proofs | Capability profiles | Top charts branch on Kubernetes/API capabilities; profiles must be finite and digest-bound. |
| [#28](https://github.com/confighub/helm-expt/issues/28) Define generated fact receipt schema | Generated facts | Passwords, certs, UUIDs, and time values must be generated once and bound into revisions. |
| [#30](https://github.com/confighub/helm-expt/issues/30) Add upgrade and rollback simulation receipts | Day-2 proof | First install is not enough; upgrades and rollback need digest-bound proof. |
| [#27](https://github.com/confighub/helm-expt/issues/27) Define observation freshness SLO for workerless proof | Observation | Workerless ConfigHub is credible only if freshness is explicit and machine-checkable. |
| [#25](https://github.com/confighub/helm-expt/issues/25) Build top-N adversarial chart run harness | Scale proof | 20/100/500 chart claims require a repeatable generated run, not manual analysis. |

## P1 Strong Next Proof

| Issue | Area | Why it matters |
| --- | --- | --- |
| [#11](https://github.com/confighub/helm-expt/issues/11) Add ConsequencePreview for rendered variant revisions | Review UX | Shows effects, not just YAML noise. |
| [#12](https://github.com/confighub/helm-expt/issues/12) Generate GitOpsCompatibilityReport for Argo CD and Flux paths | GitOps | Proves ConfigHub works with existing delivery tools. |
| [#13](https://github.com/confighub/helm-expt/issues/13) Add CRDCompatibilityReport for CRD-heavy charts | CRDs / day-2 | CRD-heavy charts are common and risky. |
| [#14](https://github.com/confighub/helm-expt/issues/14) Add CI/PR comment mode for chart analysis results | Workflow | Lets teams adopt analysis in existing review flows. |
| [#15](https://github.com/confighub/helm-expt/issues/15) Diagnose existing Helm release state and upgrade footguns | Migration / day-2 | Helps existing Helm users move without blind spots. |
| [#16](https://github.com/confighub/helm-expt/issues/16) Generate suggested fixes for common Helm pain findings | Remediation | Turns analysis into action. |

## P2 Design Depth

| Issue | Area | Why it matters |
| --- | --- | --- |
| [#17](https://github.com/confighub/helm-expt/issues/17) Build shared chart dossier and HelmPlan index for curated charts | Catalog / dossiers | Enables reusable chart knowledge over time. |
| [#18](https://github.com/confighub/helm-expt/issues/18) Add full field-level governance and ownership model | Governance | Prevents tool/controller ownership conflicts. |
| [#19](https://github.com/confighub/helm-expt/issues/19) Design deep typed secret reference system | Secrets | Keeps secret handling safe without hiding needed proof. |
| [#20](https://github.com/confighub/helm-expt/issues/20) Model lifecycle contracts for migrations, readiness, and rollback | Lifecycle | Captures complex day-2 behavior. |
| [#21](https://github.com/confighub/helm-expt/issues/21) Explore typed/enriched value model beyond Helm values | Value model | May improve explainability beyond raw values. |
| [#22](https://github.com/confighub/helm-expt/issues/22) Design cross-controller consequence engine | Operations | Supports deeper multi-controller reasoning. |
| [#23](https://github.com/confighub/helm-expt/issues/23) Track pure serverless cub install as deferred option | Deferred option | Preserves the idea without putting it on the current proof path. |

## Planning Sync Checklist

When a GitHub issue is added, closed, or reclassified:

- update this file
- update `docs/current-pathway-review.md` if it changes P0 gates
- update `docs/agreed-execution-plan.md` if it changes doctrine or acceptance
- update `docs/independent-review-brief.md` if it changes review scope

Do not let the written plan describe a proof path that ignores open P0 gates.
