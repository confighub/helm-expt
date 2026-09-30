# Argo installation recipes and reusable component profiles

Status: implementation in progress for #2043. Reviewed 30 September 2026.

## User result

A person or agent describes where Argo will run, which teams may deploy where,
and whether it will read ConfigHub. The tool produces explicit Helm values,
AppProjects and unmet prerequisites. Users can inspect and render that result
before deciding to install it. Credentials never belong to a reusable base.

The current source is the Catalog chart **10.2.1 / Argo CD v3.4.5**, locked by
[the source receipt](../../recipes/argo-cd/argo-cd/10.2.1/source-lock.yaml).
The issue's 9.5.15 snapshot is older. Use the chart as the single rendering
source; upstream install.yaml rehearsals do not qualify this chart revision.
Do not mark these candidates supported by inheriting default-base evidence.

## Delivery sequence

| Block | Concrete result | Evidence required | Boundary |
| --- | --- | --- | --- |
| 1 | Four recipe choices with optional delivery settings, validated non-secret input and exact source identity | Unit refusals and all eight Helm renders | Static candidate only |
| 2 | Safe bootstrap and delivery prerequisites satisfied without hand patches | Serial demo install, gateway sync, argobot refresh/status and plugin handover receipts | Needs explicit targets and local credentials |
| 3 | Hardened and hub qualification | Admin denial, unmapped-user permissions, forbidden resource/repository/destination, sync-window and second-cluster tests | Needs test IdP and two targets |
| 4 | Published Catalog bases and example reuse | Render equivalence, scans, installer/lifecycle gates and publication receipts for exact candidates | Use existing proof generators; no hand-edited receipt digests |
| 5 | Apply validated patterns to other components | Component-specific behavior and authority tests | No support claim from a common schema alone |

Block 1 uses bounded lower-cost implementation and review. Planning envelope:
roughly 15–30k agent tokens for implementation/audit, plus primary integration
and review; actual credits depend on cache and account pricing and are not
measured here. Avoid repeated broad gates after unchanged code. Later live
blocks need an environment inventory before a defensible cost estimate.

## Decisions and safeguards

Keep topology, posture and delivery independently expressed, but flatten their
result into explicit objects. Do not require a ConfigHub Space per layer just
to inspect a candidate. Sharing layers at authoring time and storing a release
as explicit data are compatible. Preserve input and source hashes so a later
session can reconstruct what produced it.

The four names are demo-in-cluster, demo-hub, hardened-in-cluster and
hardened-hub. Their names describe intent, not production certification.
Delivery enabled doubles the render matrix to eight combinations. Unknown
input fields must fail instead of silently becoming ignored settings.

Hardened candidates close the default AppProject, scope tenant destinations
and resource types, and keep platform privileges separate. Readonly is broad
read visibility, not tenant secrecy. Disabling admin before a working IdP is
available can lock out operators; offline rendering cannot establish access.
An isolated platform project must not grant tenant applications access to the
Argo control-plane namespace or cluster administration.

ConfigHub delivery settings alone do not install argobot, provision worker
credentials, register clusters or overcome a Git-managed project's self-heal.
Modify the authoritative source of each AppProject before handing it over.
Enabling Helm inside Kustomize is optional and expands repo-server execution;
a named Kustomize binary path requires a verified image/binary prerequisite.

No Secret import/export is implemented by this candidate builder. Future
credential handling must reject persisted Secret bytes in both data fields
and last-applied annotations, including retained bundles and diagnostic logs.
Use external Secret references and validate the actual reader's auth behavior.

## Wider applications

| Component | Reusable question | Component-specific proof |
| --- | --- | --- |
| Flux | Tenant identity, destinations and source permissions | Cross-namespace denial, service-account impersonation and reconcile authority |
| Sveltos | Management/managed-cluster topology and delegated identity | Profile permission boundaries, Secret handling and live status |
| cert-manager | Issuer scope and tenant permission | Unauthorized issuance refused; webhook and renewal behavior |
| External Secrets | Who can read which store | Cross-tenant reads refused and refresh/rotation behavior |
| Monitoring | Minimal component needs versus broad default bundle | App discovery and actual scrape success, not only ServiceMonitor rendering |
| GPU infrastructure | Operator ownership, target hardware and app requirements | Compatible target, rollout and recovery evidence; no hardware inference from values |

These become useful Catalog facets: topology, posture intent, delivery mode,
required facts, exact versions and evidence level. A future Workshop/Pilot
consumer can ask for missing facts and propose a candidate through the same
CLI/API contract. It must not advertise a runnable platform when credentials,
operators or live checks are absent. No Pilot change is needed for this block.

Do not generate every cross-product of every component. First prove one useful
recipe, then share only the controls with genuinely common semantics. HA,
federated Argo agents, apps-in-any-namespace, self-management, namespaced
installs, backup/restore and other Argo charts remain separate qualification
work. They are not consequences of an in-cluster/hub label.

## Sources

- [Tracking issue #2043](https://github.com/confighub/helm-expt/issues/2043)
- [Argo declarative setup](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/)
- [Argo projects](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/)
- [Argo RBAC](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)

Upstream documentation informs the design; pinned render receipts and live
behavior determine what this repository can claim.
