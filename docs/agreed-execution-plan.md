# Agreed Execution Plan

This is the current agreement for the Helm/ConfigHub proof.

## One-Line Mission

```text
Use Helm charts. Ship ConfigHub variants.
```

The user-facing promise:

```text
Helm generates Kubernetes objects. ConfigHub captures those objects as
immutable variant revisions. You approve the exact rendered objects, scan them
before install, promote the same revision to prod, see why environments differ,
and get receipts proving what changed and what was observed.
```

## Repos and Roles

| Repo / system | Role |
| --- | --- |
| `confighub/installer` | Implementation substrate for `cub install`: packages, `installer.yaml`, Kustomize bases/components, inputs, selection, facts, function chains, validators, dependency locks, OCI artifacts, sign/verify, render/upload/day-2 lifecycle. |
| `confighub/helm-expt` | Proof repo: Redis end-to-end proof, top-500 control-point matrix, example schemas, receipts, rendered objects, scan/gate examples. |
| ConfigHub Server | Workerless system of record for recipes, variants, variant revisions, target assignments, desired state, operation records, receipts, approvals, initiatives, and scan/gate result aggregation. |
| Pilot | Workflow/orchestration surface for installs, promotions, scans, and observation submission where useful. |
| `cub-scout` / external observers | Live observation receipts with observer, method, timestamp, result, and freshness. |

## Defaults

Working folder:

```text
/Users/alexis/code/helm-expt
```

Default ConfigHub organization for demos and proofs:

```text
ConfigHub Helm
```

Do not use `ConfighubOps` for this project. That org is for internal
operations/infrastructure, not Helm demos, proofs, Redis examples, top-500
evidence, or installer experiments.

## Execution Rule

Every step in the product flow must be executable through `cub` CLI, ConfigHub
Server UI/API, Pilot, or an external observer integration.

No step should require a hand-maintained spreadsheet, a Slack instruction, or
an undocumented CI script.

This is the target execution contract. Some command names below are target UX
until the Redis proof lands. The important rule is that every durable input,
decision, output, and observation is produced by one of the supported surfaces
and leaves a receipt or addressable artifact.

| Flow step | Primary execution surface | Durable output |
| --- | --- | --- |
| Resolve chart source | `cub` / installer | `SourceLock`, chart digest |
| Resolve chart dependencies | `cub` / installer | `DependencyLock` |
| Import chart to recipe candidate | `cub` / installer | `RecipeCandidate` |
| Classify Helm complexity | `cub` / installer | `ControlPoints` |
| Create/edit install variant | `cub`, ConfigHub Server UI/API, or Pilot | `Variant` |
| Provide overlays, values, umbrella selections, or Kustomize pieces | `cub`, ConfigHub Server UI/API, or Pilot | explicit variant inputs / extension slots |
| Provide capability, target, or generated facts | `cub`, installer collectors, ConfigHub Server UI/API, Pilot, or observer integration | fact profiles / fact receipts |
| Render exact objects | `cub` / installer | `VariantRevision`, `RenderedReleaseObjects`, `RenderReceipt` |
| Scan rendered objects | `cub` function chain, CI, Pilot, or ConfigHub initiative | `ScanReceipt` |
| Gate install | `cub`, ConfigHub Server UI/API, or Pilot | `InstallGate` |
| Approve/promote revision | ConfigHub Server UI/API, Pilot, or `cub` | approval / promotion receipt |
| Apply revision | `cub`, Pilot, GitOps handoff, or CI/CD | operation receipt |
| Observe live/applied state | `cub-scout`, Pilot, GitOps report, CI/CD, customer observer, or human-triggered `cub` | `ObservationReceipt` with freshness |

## Happy Path UX

The default Redis demo should be two commands:

```sh
cub install redis
cub apply redis
```

`cub install redis` should do the boring work automatically:

```text
resolve source
create/update recipe candidate
create default install variant
render immutable variant revision
scan exact rendered objects
prepare Verified Install Gate
write receipts
```

`cub apply redis` should:

```text
apply the approved variant revision
write operation receipt
optionally publish/update ConfigHub Server state
```

The detailed subcommands may exist for advanced users and CI, but the happy path
must not require eight visible steps.

## Easy Variant UX

Standalone to HA:

```sh
cub variant redis ha
cub diff redis redis-ha
cub apply redis-ha
```

Existing secret:

```sh
cub variant redis reuse-existing-secret --secret redis-password
cub apply redis-existing-secret
```

The point is not "better values files". The point is:

```text
create named install variant
render exact objects
compare to another variant/revision
scan/gate
apply/promote approved revision
```

## First Detailed Proof

Use `bitnami/redis` as the first complete, usable proof of concept.

Redis is small enough to demo, but rich enough to prove:

- Generated passwords/secrets.
- Stateful/PVC behavior.
- Standalone vs HA variants.
- Reuse existing secret vs generated secret.
- Capability/profile checks.
- Bitnami-style chart complexity.
- Realistic production knobs.
- Obvious user value.

Target Redis artifacts:

```text
recipes/bitnami/redis/25.5.3/
  README.md
  recipe-candidate.yaml
  source-lock.yaml
  dependency-lock.yaml
  control-points.yaml

  variants/
    standalone/variant.yaml
    ha/variant.yaml
    reuse-existing-secret/variant.yaml

  revisions/
    standalone/r001/
      variant-revision.yaml
      rendered/release-objects.yaml
      render-receipt.yaml
      scan-receipt.yaml
      install-gate.yaml

    reuse-existing-secret/r001/
      variant-revision.yaml
      rendered/release-objects.yaml
      render-receipt.yaml
      scan-receipt.yaml
      install-gate.yaml
```

## Background Evidence

Keep the top-500 matrix in the background. It is important, but it is not the
hero demo.

Its job:

```text
show that the control-point model was designed against real Helm ecosystem
complexity, not a toy chart
```

Target files:

```text
data/top500/
  raw-feature-scan.json
  control-point-summary.csv
  helm-top500-control-point-matrix.xlsx
  methodology.md
```

The top-500 summary should answer:

- Core recipe viable?
- Base/install variants needed?
- Primary control point?
- Secondary control point?
- Can bulk scan rendered variants?
- Install readiness?

It should not lead with ten intimidating feature columns.

## Archived Top-20 Artifacts

The archived top-20 artifacts prove the older render-and-vendor path. They are
useful, but they do not prove the new recipe/variant mission.

Disposition:

```text
archive/render-and-vendor-top20/
```

Label them as compatibility/legacy evidence:

```text
These examples show that rendered Helm output can be wrapped and verified.
They are not the main proof of ConfigHub variants.
```

## Control Points

Every Helm complexity should map to a control point:

| Helm complexity | Control point |
| --- | --- |
| Mutable chart source | Source lock / digest / signature |
| Chart dependencies | Dependency lock |
| `lookup` | Target facts |
| Random/cert/time/password functions | Generated facts or secret handles |
| `.Capabilities.*` | Named capability profile |
| `required` / `fail` | Recipe validation |
| Hooks | Lifecycle policy: test hook, install phase, or unsupported |
| `tpl` | Explicit extension slot or reject |
| Raw/extra manifests | Explicit extension slot plus scans |
| CRDs/webhooks/APIService/RBAC | Operate policy and rendered-object scans |
| Mutable image tags | Optional image digest resolution receipt |
| Scanner DB/policy drift | Scanner/policy bundle receipt |
| Live cluster truth | External observation receipt with freshness |

## Workerless Server Rule

ConfigHub Server stores desired/config truth and submitted receipts.

It does not claim fresh runtime truth unless a current observation receipt says
so.

Example UI language:

```text
Observed by cub-scout 4m ago.
Argo report 17m old.
No runtime receipt yet.
```

## Target Runnable Examples

The proof repo should eventually expose runnable examples like:

```sh
npm run redis:proof
npm run top500:summary
npm run verify
```

`redis:proof` should generate or verify the Redis recipe candidate, variants,
variant revisions, rendered release objects, scan receipt, and install gate.

`top500:summary` should regenerate the control-point summary from raw scan data.

`verify` should verify hashes and references for receipts and fail on missing or
changed content.

## Current Executable Redis Demo

The root README is the current demo script. It uses real `cub install`
commands from `confighub/installer`, not target command names.

The executable path is:

```sh
go install sigs.k8s.io/kustomize/kustomize/v5@v5.8.1
export PATH="$PATH:$(go env GOPATH)/bin"
cub plugin install confighub/installer --source-repo --name install --force
make -C ~/.confighub/plugins/install build
cub install doc ./archive/render-and-vendor-top20/charts/06-bitnami-redis
cub install setup \
  --pull ./archive/render-and-vendor-top20/charts/06-bitnami-redis \
  --work-dir /tmp/confighub-helm-redis \
  --non-interactive \
  --namespace redis
cub install upload \
  --work-dir /tmp/confighub-helm-redis \
  --space helm-redis-proof \
  --component Redis \
  --environment Demo \
  --variant default
```

This demo proves the current installer path for Helm-derived artifacts:

```text
Helm-rendered Redis package
  -> installer.yaml package
  -> cub install setup
  -> exact rendered Kubernetes objects
  -> cub install upload
  -> ConfigHub Units, revisions, and diffs
```

The older direct `cub helm install` concept is preserved in
`docs/old-cub-helm-model.md` as background only.

## Agreed Target Artifacts

Minimum Redis proof artifacts:

- `RecipeCandidate`.
- `SourceLock`.
- `DependencyLock`.
- `ControlPoints`.
- `Variant`.
- `VariantRevision`.
- `RenderedReleaseObjects`.
- `RenderReceipt`.
- `ScanReceipt`.
- `InstallGate`.
- Optional `ObservationReceipt` example.

Minimum top-500 artifacts:

- Raw source feature scan.
- Human-friendly summary.
- Control-point matrix spreadsheet.
- Methodology note.

Minimum docs:

- 60-second skeptical engineer walkthrough.
- Happy path.
- Easy variants.
- Control points.
- Workerless observation boundary.
- What this repo proves today vs what it does not prove yet.

## Current Agreement

1. Redis is the first detailed, usable proof of concept.
2. The top-500 matrix stays as background evidence.
3. The implementation should extend `confighub/installer`.
4. The happy path should be `cub`-first and simple.
5. ConfigHub variants are the product spine.
6. Variant revision is the object users approve, scan, promote, deploy, and roll back.
7. ConfigHub Server is workerless and does not claim fresh live truth without external observation receipts.
8. Pilot and `cub-scout` can participate, but should not make the happy path feel heavy.
9. Current top-20 render-and-vendor artifacts are archived as compatibility evidence, not hero proof.
10. The target proof is:

```text
Helm complexity
  -> explicit ConfigHub control point
  -> deterministic variant revision
  -> scanned/gated rendered objects
```
