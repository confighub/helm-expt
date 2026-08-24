# How the live catalog checks behave

This page comes from a committed live receipt. Rerun the isolated fixtures with
`npm run config-catalog:policy:run`, or check the committed result without contacting
ConfigHub with `npm run config-catalog:policy:verify`.

The test created temporary configuration records in the live `helm-catalog`
organization and assigned an OCI target so ConfigHub would evaluate its managed
checks. It read the resulting ApplyGates from each Unit. No apply command ran and
no fixture configuration was sent to Kubernetes.

## One configuration from review to promotion

The NGINX example starts with values proposed by a coding agent. The rendered
Deployment contains a literal `AI_API_KEY`. Local `cub check` reports
`CCVE-2025-5019` against 5 objects
with object-set hash `sha256:9a0d28228065d3cab5a8c38acfce5800e71116c69696b3795d00fce1d3774c35`.
ConfigHub then checks those same objects independently and records a blocking
ApplyGate on the stored revision.

The reviewed version removes the literal and refers to an existing Secret.
Local `cub check` no longer reports `CCVE-2025-5019`, and ConfigHub leaves the
reviewed revision eligible for delivery. The reviewed 5-object result
is stored in `byo-nginx-ai-values-24-0-2-reviewed` at revision
`1`. Its scanner object-set hash is
`sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397`.

That saved result is the base of the existing development-to-staging example.
ConfigHub promoted `spec.replicas` from
`3` to `4` without
removing the Secret reference or the other reviewed settings. The remaining
local `CCVE-2025-3745` result is an
advisory about `emptyDir`; it was not relabeled as a credential failure.

This is the boundary: `cub check` gives local advice for exact files. ConfigHub
runs a managed gate against the stored revision and can keep that revision in a
promotion chain.

| Configuration tested | What ConfigHub did |
| --- | --- |
| A ConfigMap containing an unresolved placeholder | Blocked it |
| A Deployment whose replica count was text instead of a number | Blocked it |
| A Deployment containing a literal AI API key | Blocked it |
| The same environment variable using a Secret reference | Left it eligible for delivery |
| A Deployment with an unpinned image and no health probes | Reported both warnings without adding an ApplyGate |
| System configuration with no approval | Blocked it |
| The same system configuration after its exact revision was approved | Cleared the approval gate |
| A lifecycle route claiming automatic work without evidence | Blocked it in the separately recorded Hooks and CRDs test |

The first five fixtures used the eight common checks. The two AICR checks did
nothing to these ordinary Kubernetes objects, as intended. The
system-configuration fixture used the same checks plus required approval. Its first
revision carried the approval gate. After the test approved that exact revision, the
gate cleared. This confirms that approval is added where it is needed without turning
ordinary warnings into blockers or leaving an approved revision permanently blocked.

The literal credential test maps the local scanner finding `CCVE-2025-5019` to
the managed ConfigHub gate `platform/workload-sensitive-env-secret-refs`. The
local result remains advice; ConfigHub evaluates its own gate against the stored
revision before delivery.

The [AI change review proof](../ai-change-review-live-proof/summary.md) tests the
other side of the same rule: an AICR training runtime receives checks for its actual
nested image and API-key fields, while the ordinary Deployment checks leave it alone.

All temporary Spaces were deleted. The target was used only to cause managed check
evaluation; this did not test a Kubernetes rollout or application health.

- [Committed functional receipt](../../runs/config-catalog-policy-functional-proof/receipt.yaml)
- [Proposed local scan](../../runs/config-catalog-policy-functional-proof/proposed-cub-check.json)
- [Reviewed local scan](../../runs/config-catalog-policy-functional-proof/reviewed-cub-check.json)
- [Reviewed values and rendered objects](../byo-helm-values-review/summary.md)
- [Development-to-staging promotion](../byo-helm-values-promotion-proof/summary.md)
- [Live filter and Space assignments](../apply-policy-profiles/live-helm-catalog.yaml)
- [Hooks and CRDs policy receipt](../hooks-crds-app/live-receipt.yaml)
- [Maintained policy definition](../../config-catalog/policies/catalog-standard.yaml)
