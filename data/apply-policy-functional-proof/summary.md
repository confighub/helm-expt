# How the live catalog checks behave

This page comes from a committed live receipt. Rerun the isolated fixtures with
`npm run config-catalog:policy:run`, or check the committed result without contacting
ConfigHub with `npm run config-catalog:policy:verify`.

The test created temporary configuration records in the live `helm-catalog` organization. It then asked ConfigHub to perform dry-run applies. No fixture configuration was sent to Kubernetes.

| Configuration tested | What ConfigHub did |
| --- | --- |
| A ConfigMap containing an unresolved placeholder | Blocked it |
| A Deployment whose replica count was text instead of a number | Blocked it |
| A Deployment with an unpinned image and no health probes | Reported both warnings and allowed the dry run |
| System configuration with no approval | Blocked it |
| The same system configuration after its exact revision was approved | Allowed the dry run |
| A lifecycle route claiming automatic work without evidence | Blocked it in the separately recorded Hooks and CRDs test |

The first three fixtures used the seven common checks. The two AICR checks did
nothing to these ordinary Kubernetes objects, as intended. The
system-configuration fixture used the same checks plus required approval. Its first
dry run was blocked. After the test approved that exact revision, the second dry run
was allowed. This confirms that approval is added where it is needed without turning
ordinary warnings into blockers or leaving an approved revision permanently blocked.

The [AI change review proof](../ai-change-review-live-proof/summary.md) tests the
other side of the same rule: an AICR training runtime receives checks for its actual
nested image and API-key fields, while the ordinary Deployment checks leave it alone.

All temporary Spaces were deleted. The target was used only to exercise ConfigHub's apply boundary with `--dry-run`; this did not test a Kubernetes rollout or application health.

- [Committed functional receipt](../../runs/config-catalog-policy-functional-proof/receipt.yaml)
- [Live filter and Space assignments](../apply-policy-profiles/live-helm-catalog.yaml)
- [Hooks and CRDs policy receipt](../hooks-crds-app/live-receipt.yaml)
- [Maintained policy definition](../../config-catalog/policies/catalog-standard.yaml)
