# Independent Review Brief

Use this brief for independent reviews of the current ConfigHub Helm plan.

## Scope

Review the new pathway:

```text
public Helm chart catalog proof
enterprise-internal chart variants are out of scope

new chart proof repos
  -> HelmPlan
  -> ChartDossier
  -> recipe candidate
  -> variants
  -> variant revisions
  -> rendered release objects
  -> scans and gates
  -> ConfigHub OCI artifact receipts
  -> generated proof spreadsheets
```

Explicitly exclude legacy/reference artifacts:

```text
data/top500-catalog-analysis/source/source-feature-scan.raw.json
```

The old render-and-vendor top-20 payload has been removed from the active tree.
The source-feature scan may be mentioned only as input to the generated
top-500 catalog analysis, not as the current proof path.

## Source Docs

Read:

- `README.md`
- `data/adversarial10/summary.md`
- `data/adversarial10/proof-readiness.csv`
- `docs/planning/agreed-execution-plan.md`
- `docs/reference/chart-recipe-manifest-flow.md`
- `docs/planning/current-pathway-review.md`
- `docs/planning/issue-backlog.md`
- `docs/corpus/known-adversarial-charts.md`
- `docs/planning/review-prompts.md`
- `confighub/installer` docs and package/render/upload/OCI/facts behavior

## Review 1: Product Clarity

Review focus:

```text
Would a skeptical Helm/GitOps user understand in 60 seconds why this is less
Helm pain rather than more platform ceremony?
```

Public framing:

```text
Approve the Kubernetes objects Helm produced,
not the values you hope produced them.
```

Return:

- Verdict.
- Whether the happy path is no more complex than Helm for the first successful
  install.
- Whether the happy path feels safer and more correct than Helm, not merely
  more instrumented.
- Whether the value appears immediately: exact rendered objects, diff/review,
  scan/gate, and safe publish to ConfigHub OCI for GitOps pickup.
- Three strongest claims.
- Five likely user objections.
- Crisp answer to each objection.
- Any terms to cut, rename, or demote.
- Whether `variant` sounds like a real governed object or just a values file.

Adoption standard:

```text
The first demo should be no harder than Helm for a successful install.
Proof should appear automatically.
The workflow should feel safer and more correct than Helm alone.
```

## Review 2: Architecture And Artifact Proof

Review focus:

```text
Do the proposed artifacts prove chart -> recipe -> variant -> revision ->
rendered object -> scan/gate -> receipt?
```

Return findings:

- P0: false, unsupported, or missing proof.
- P1: gaps that weaken belief.
- P2: clarity, structure, or naming improvements.

Also return:

- Required repo tree.
- Required schema list.
- Minimal Redis proof.
- What belongs in `confighub/installer`.
- What requires ConfigHub model/API support.

## Review 3: At-Scale Adversarial Verification

Review focus:

```text
Can the plan prove itself against 20, 100, and 500 real charts, including
complex Helm behavior?
```

For the next milestone, "20 charts" means 20 full public-chart proof slices.
It does not mean a broad readiness spreadsheet plus a handful of examples.
Review [top20-full-proof-target.md](./top20-full-proof-target.md) as the concrete
target list and acceptance contract.

Review whether the plan covers:

- source and dependency locks
- `lookup`
- generated secrets/certs/time/random functions
- `.Capabilities`
- `required` / `fail`
- hooks/tests
- CRDs/webhooks/RBAC/APIService
- `tpl`
- raw/extra manifest slots
- mutable image tags
- schema gaps and unknown values
- upgrade, rollback, and live observation freshness

Return:

- Required adversarial run matrix.
- Required result objects.
- Required spreadsheet tabs and columns.
- Failure taxonomy.
- P0 blockers before scaling.
- Whether any P0 issue in `docs/planning/issue-backlog.md` is being ignored or bypassed
  by the written plan.
- Whether [#24](https://github.com/confighub/helm-expt/issues/24) really comes
  first, before the repo generates more evidence artifacts.

## Acceptance Standard

Every generated spreadsheet row must trace to artifacts and receipts:

```text
row -> chart source -> lock -> HelmPlan -> recipe candidate -> variant ->
variant revision -> rendered digest -> scan/gate -> receipt -> next action
```

If a claim cannot be traced, it is not proof.

Current generated evidence to inspect:

```text
recipes/bitnami/redis/25.5.3/
packages/bitnami/redis/25.5.3/
docs/demo/redis/
data/adversarial10/
docs/planning/top20-full-proof-target.md
recipes/metrics-server/metrics-server/3.13.0/
packages/metrics-server/metrics-server/3.13.0/
recipes/ingress-nginx/ingress-nginx/4.15.1/
packages/ingress-nginx/ingress-nginx/4.15.1/
recipes/jetstack/cert-manager/v1.20.2/
packages/jetstack/cert-manager/v1.20.2/
recipes/external-secrets/external-secrets/2.5.0/
packages/external-secrets/external-secrets/2.5.0/
recipes/argo-cd/argo-cd/9.5.15/
packages/argo-cd/argo-cd/9.5.15/
recipes/bitnami/postgresql/18.6.7/
packages/bitnami/postgresql/18.6.7/
recipes/bitnami/rabbitmq/16.0.14/
packages/bitnami/rabbitmq/16.0.14/
recipes/prometheus-community/kube-prometheus-stack/85.3.3/
packages/prometheus-community/kube-prometheus-stack/85.3.3/
recipes/grafana/loki/7.0.0/
packages/grafana/loki/7.0.0/
recipes/longhorn/longhorn/1.11.2/
packages/longhorn/longhorn/1.11.2/
recipes/bitnami/mysql/14.0.3/
packages/bitnami/mysql/14.0.3/
recipes/grafana/grafana/10.5.15/
packages/grafana/grafana/10.5.15/
recipes/hashicorp/vault/0.32.0/
packages/hashicorp/vault/0.32.0/
recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
recipes/prometheus-community/prometheus/29.8.0/
packages/prometheus-community/prometheus/29.8.0/
recipes/bitnami/mongodb/19.0.7/
packages/bitnami/mongodb/19.0.7/
recipes/bitnami/nginx/24.0.2/
packages/bitnami/nginx/24.0.2/
recipes/grafana/tempo/1.24.4/
packages/grafana/tempo/1.24.4/
recipes/hashicorp/consul/2.0.0/
packages/hashicorp/consul/2.0.0/
```

`data/adversarial10/` is a readiness and blocker harness, not final
certification. Review it for whether each row is clear, generated, and
receipt-backed, then identify what is still missing before those charts become
full recipe/variant/revision proofs.

`metrics-server/metrics-server@3.13.0` is the first row promoted from that
harness. Review whether its target fact, APIService, RBAC, scan/gate, and
`cub installer` package evidence are convincing enough to serve as the repeatable
pattern after Redis.

`ingress-nginx/ingress-nginx@4.15.1` is the second row promoted from that
harness. Review whether its `default` and `admission-disabled` variants,
admission webhook, Helm hook lifecycle, RBAC, scan/gate, and `cub installer`
package evidence are convincing enough to serve as the repeatable pattern for
admission-webhook charts.

`jetstack/cert-manager@v1.20.2` is the third row promoted from that harness.
Review whether its `default` and `crds-enabled` variants, CRD lifecycle,
admission webhook, Helm startup hook lifecycle, RBAC, scan/gate, and
`cub installer` package evidence are convincing enough to serve as the repeatable
pattern for CRD-heavy control-plane charts.

`external-secrets/external-secrets@2.5.0` is the fourth row promoted from that
harness. Review whether its `default` and `no-crds` variants, 23-CRD default
render, disabled dependency lock, admission webhook, webhook Secret/cert
controller, RBAC, scan/gate, and `cub installer` package evidence are convincing
enough to serve as the repeatable pattern for CRD-heavy controller charts.

`argo-cd/argo-cd@9.5.15` is the fifth row promoted from that harness. Review
whether its `default` and `no-crds` variants, three-CRD default render, disabled
`redis-ha` dependency lock, hook lifecycle policy, generated Secret ownership,
StatefulSet policy, GitOps handoff, RBAC, scan/gate, and `cub installer` package
evidence are convincing enough to serve as the repeatable pattern for GitOps
controller charts.

`bitnami/postgresql@18.6.7` is the sixth row promoted from that harness. Review
whether its `generated-passwords` and `existing-secret` variants, generated
fact binding, target Secret binding, Bitnami `common` dependency lock, hook
lifecycle policy, StatefulSet/PVC policy, extension-slot review, scan/gate, and
`cub installer` package evidence are convincing enough to serve as the repeatable
pattern for stateful generated-credential charts.

`bitnami/rabbitmq@16.0.14` is the seventh row promoted from that harness.
Review whether its `generated-passwords` and `existing-secret` variants,
generated fact binding for password and Erlang cookie, target Secret binding
for both external Secrets, Bitnami `common` dependency lock, StatefulSet/PVC
policy, clustering policy, extension-slot review, scan/gate, and `cub installer`
package evidence are convincing enough to serve as the repeatable pattern for
stateful generated-credential charts with clustering material.

`prometheus-community/kube-prometheus-stack@85.3.3` is the eighth row promoted
from that harness. Review whether its `default` and `no-crds` variants,
generated fact binding for Grafana admin password, 10-CRD default render,
umbrella dependency lock, admission webhook observation gates, cluster RBAC,
dashboard ConfigMap normalization, extension-slot review, scan/gate, and
`cub installer` package evidence are convincing enough to serve as the repeatable
pattern for large umbrella monitoring charts.

`grafana/loki@7.0.0` is the ninth row promoted from that harness. Review
whether its blocked default render, `single-binary-filesystem` and
`simple-scalable-minio` variants, storage/schema binding, MinIO object-store
fixture, dependency lock, cluster RBAC, StatefulSet/PVC policy, Loki ConfigMap
normalization, extension-slot review, scan/gate, and `cub installer` package
evidence are convincing enough to serve as the repeatable pattern for charts
that cannot render safely from defaults.

`longhorn/longhorn@1.11.2` is the tenth row promoted from that harness. Review
whether its `default` and `ui-ingress` variants, 22 Longhorn CRDs, pre-upgrade
hook policy, admission/recovery observation, cluster RBAC, privileged storage
workload policy, StorageClass/default-setting policy, UI ingress policy,
scan/gate, and `cub installer` package evidence are convincing enough to serve as
the repeatable pattern for storage control-plane charts.

`bitnami/mysql@14.0.3` is the eleventh row promoted from that harness. Review
whether its `generated-passwords` and `existing-secret` variants, generated
fact binding for root/user/replication passwords, target Secret binding,
Bitnami `common` dependency lock, hook lifecycle policy, StatefulSet/PVC
policy, extension-slot review, scan/gate, and `cub installer` package evidence
are convincing enough to serve as the repeatable pattern for stateful
generated-credential charts.

`grafana/grafana@10.5.15` is the twelfth row promoted from that harness. Review
whether its chart-deprecation marker, `generated-passwords` and
`existing-secret-ingress` variants, generated admin credential binding, target
Secret binding, UI ingress policy, cluster RBAC review, deployment and
extension-slot gates, scan/gate, and `cub installer` package evidence are
convincing enough to serve as the repeatable pattern for dashboard/control-plane
application charts.

`hashicorp/vault@0.32.0` is the thirteenth full public-chart proof row. Review
whether its `default` and `ha-raft-ui` variants, TLS posture review, injector
admission webhook review, StatefulSet storage and HA Raft policy, init/unseal
operate-policy gates, service exposure review, RBAC review, Secret/env
extension-slot gates, scan/gate, and `cub installer` package evidence are
convincing enough to serve as the repeatable pattern for security-sensitive
stateful control-plane charts.

`secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` is the fourteenth
full public-chart proof row. Review whether its `default` and
`sync-secret-rotation` variants, SecretProviderClass CRD lifecycle, CSIDriver
kubelet integration, Linux DaemonSet and hostPath policy, cluster RBAC review,
synced Secret ownership, rotation/provider-health policy, provider identity
integration gates, scan/gate, and `cub installer` package evidence are
convincing enough to serve as the repeatable pattern for node-level CSI driver
charts.

`prometheus-community/prometheus@29.8.0` is the fifteenth full public-chart
proof row. Review whether its `default` and `server-only-ephemeral` variants,
bundled dependency lock, Alertmanager/exporter/pushgateway component
selection, scrape ConfigMap review, server PVC/storage retention policy,
cluster RBAC review, remote read/write and exposure extension slots, scan/gate,
and `cub installer` package evidence are convincing enough to serve as the
repeatable pattern for bundled monitoring stack charts.

`bitnami/mongodb@19.0.7` is the sixteenth full public-chart proof row. Review
whether its `generated-passwords` and `existing-secret-replicaset` variants,
generated root password binding, target Secret binding, replica-set and arbiter
StatefulSets, persistent storage, NetworkPolicy/PDB policy, hook lifecycle
review, `tpl` configuration slots, scan/gate, and `cub installer` package
evidence are convincing enough to serve as the repeatable pattern for stateful
database topology charts.

`bitnami/nginx@24.0.2` is the seventeenth full public-chart proof row. Review
whether its `http-clusterip` and `existing-tls-ingress` variants, generated TLS
mitigation, declared TLS target Secrets, ingress exposure, NetworkPolicy, PDB,
service exposure, static-site supply-chain slots, metrics add-ons, raw/template
extension slots, scan/gate, and `cub installer` package evidence are convincing
enough to serve as the repeatable pattern for simple web-service charts.

`grafana/tempo@1.24.4` is the eighteenth full public-chart proof row. Review
whether its deprecated-chart marker, `local-persistent` and
`s3-query-observability` variants, local/S3 storage backend policy, target S3
credential Secret, query ingress, ServiceMonitor capability, NetworkPolicy,
StatefulSet/headless-Service runtime risk, raw/template extension slots,
scan/gate, and `cub installer` package evidence are convincing enough to serve
as the repeatable pattern for observability storage charts.

`hashicorp/consul@2.0.0` is the nineteenth full public-chart proof row and
twentieth target chart. Review whether its `default-control-plane` and
`secure-mesh-existing-secrets` variants, 28 CRDs, cluster RBAC, injector
webhooks, TLS/ACL/gossip target Secrets, gateway topology, UI ingress,
lifecycle Jobs, rendered Secrets, StatefulSet storage, raw/template extension
slots, scan/gate, and `cub installer` package evidence are convincing enough to
serve as the repeatable pattern for service-mesh/control-plane charts.

Every happy-path demo must also pass the simple UX test:

```text
one install command
one review/diff path
one publish path to ConfigHub OCI for GitOps pickup
clear scan/gate status
receipts available after the fact
Helm-equivalent output where expected
every intentional difference explained
```
