# Live Witness Normalization Rules

This file records the normalization choices used by strict cub-scout live
witness checks.

The rule is simple: every strict-witness `BLOCK` needs a route. It is either
kept as a row in [cub-scout-watchlist.csv](./cub-scout-watchlist.csv), or it is
covered by a named normalization rule here with a short justification.

Normalization is only for fields the Kubernetes API predictably drops or
defaults after apply. If a field could be meaningful, target-specific, or
version-specific, keep it on the watchlist until the route is clear.

## Current Rules

The live witness helper writes a cub-scout desired manifest from the rendered
objects before comparison. It currently prunes these API-dropped no-op fields:

| Rule | Paths | Reason |
| --- | --- | --- |
| probe-zero-delay | `*.livenessProbe.initialDelaySeconds`, `*.readinessProbe.initialDelaySeconds`, `*.startupProbe.initialDelaySeconds` when the value is `0` | Kubernetes omits probe delay fields when the authored value is the default. |
| min-ready-seconds-zero | `spec.minReadySeconds` when the value is `0` | Kubernetes omits this deployment-style default on live objects. |
| empty-ca-bundle | webhook `clientConfig.caBundle` and CRD conversion `spec.caBundle` when empty | Controllers or the API server may omit an empty CA bundle. Non-empty CA bundles are preserved and compared. |
| empty-volume-mount-subpath | `spec.template.spec.containers[*].volumeMounts[*].subPath` when empty | Kubernetes omits empty `subPath` values on live container volume mounts. Non-empty `subPath` values are preserved and compared. |
| false-host-flags | pod template `hostIPC`, `hostNetwork`, `hostPID` when `false` | Kubernetes omits false host namespace flags after apply. |
| publish-not-ready-false | `spec.publishNotReadyAddresses` when `false` | Kubernetes omits the false service default. |
| empty-security-context-lists | `securityContext.supplementalGroups` and `securityContext.sysctls` when empty | Kubernetes omits empty optional security context lists. |
| empty-metadata-maps | empty `metadata.annotations` and `metadata.labels` maps | Empty metadata maps are not preserved on live objects. |

The helper deliberately does not prune every empty array. Some empty arrays are
semantic, such as `NetworkPolicy.spec.ingress: []`.

## Watchlist Decisions

Grafana `generated-passwords` currently remains on the watchlist for empty RBAC
`rules: []` shape differences. The workload converges, but the rule has not yet
been accepted as a general Kubernetes normalization across target profiles.

cert-manager and External Secrets selectable-field rows also remain on the
watchlist. They are target-profile findings for Kubernetes 1.30 CRD behavior,
not Helm-vs-installer semantic parity defects.
