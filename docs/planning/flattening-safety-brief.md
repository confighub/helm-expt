# Brief: a flattening-safety verdict for every catalog chart

Status: proposal, 2026-08-07. Companion to the certified-bundle model brief; this is the audit lane that makes that model decidable.

## Purpose

Give every chart version in the catalog a receipted answer to one question: what happens if you ship this chart as literal rendered YAML instead of running Helm? The eks-inference example ships flattened bundles and honestly documents five constructs that break when flattened. Our taxonomy counts well past ten, and several of the missing classes bite flattened delivery in ways a first release never reveals. The catalog already holds the evidence to answer per chart; this lane assembles it into a verdict.

## The verdict

Each audited chart version gets exactly one of:

- `safe-to-flatten` — no construct present that render-time discards.
- `flatten-with-routes` — flattening is safe only with named companion artifacts; the verdict lists each one.
- `do-not-flatten` — the chart's behavior cannot be discharged at render time; the render-late installer path remains its certified route.

## The disposition table behind the verdict

One row per quirk class, each with a finding (absent, present-where) and a disposition. The classes, superset of the eks-inference five:

| Class | Failure when flattened | Disposition when present |
| --- | --- | --- |
| Helm hooks (creation, delete, succeeded, certgen, support classes already tested per chart) | Hook Jobs never fire, or fire under Argo's different hook dialect | Lifecycle route executed by the delivery runtime |
| `helm.sh/resource-policy: keep` | Argo prunes what Helm promised to keep | Prune-protection configuration emitted beside the bundle |
| `lookup()` | Renders valid but wrong | Usually `do-not-flatten`; narrow cases route to a target-facts read |
| Webhook CA generation | Empty `caBundle`, admission fails closed | Route to cert-manager or a certgen lifecycle route |
| `.Capabilities` / kubeVersion branching | Wrong apiVersion for the target | Render with pinned `--api-versions`, recorded in the receipt |
| Generated secrets | Every render mints new values; a bundle freezes one draw into a public artifact | External Secret reference; never a literal in the bundle |
| CRD-before-CR ordering | Per-file Units race their CRDs | Explicit ordering in the bundle index or sync waves |
| Immutable-field changes across versions | Second release fails on selectors or similar | Versioned replacement route; the retained journaled-replacement pattern |
| Namespace creation, subchart conditions, test hooks | Missing namespace, wrong subchart set, stray test resources | Emit, prune, or route per finding |

## Mechanics

Offline static analysis over the packaged chart plus the hook-test evidence the catalog already records. No live access. The verdict and table are written as a receipt beside the package (SHA-256 bound to the chart version), rendered on the chart's public page, and enforced by a gate in the claim-integrity style: a page may not claim a chart is flattenable without a current verdict receipt.

## First increment

Run the audit over the charts the examples already use (traefik, cert-manager, external-secrets, kube-prometheus-stack, metrics-server, kyverno, redis) and publish their verdicts. That immediately tells the eks-inference stack which of its own components carry undisclosed dispositions, and gives the certified-bundle model its first decided inputs.
