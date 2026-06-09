# Helm Catalog Test Findings

Findings from earlier live runs of the helm-expt catalog test lanes. The project
claim is that the catalog path should match Helm where it claims parity and add
reviewable ConfigHub controls. Silent wrong output is therefore a release
blocker for any affected path.

---

## F1 — `cub installer --namespace X` silently splits the install (HIGH)

**Severity:** HIGH — silent wrong result; worse than vanilla Helm. Must fix
before newcomers touch the catalog.

**Symptom.** `cub installer setup --pull <pkg> --base <base> --namespace X`
where `X` ≠ the package's frozen namespace produces an **incoherent render**:
- the generated `Namespace` object is named `X`;
- every workload resource keeps the frozen namespace (`nginx` for bitnami/nginx).

Applied as-is, the workloads target a namespace nothing in the bundle creates.
First observed: `--namespace nginx-wave1` → Namespace `nginx-wave1`, but
Deployment/Service/NetworkPolicy/PDB/ServiceAccount all in `nginx`.

**Root cause (verified, not inferred).** Three facts together:
1. The installer generates the `Namespace` object from `--namespace` and exposes
   it to chain templates as `{{ .Namespace }}` (`installer setup --help`).
2. The base's `bases/<base>/upstream.yaml` has the namespace **baked in as a
   literal** (`namespace: "nginx"`) — frozen at recipe-generation time from the
   upstream Helm render. It is *not* `{{ .Namespace }}`.
3. The base's `bases/<base>/kustomization.yaml` is just
   `resources: [upstream.yaml]` — it has **no kustomize `namespace:`
   transformer**, so nothing rewrites the frozen literals.

So the install-namespace knob reaches the *generated Namespace object* but never
reaches the *frozen workload resources*. The package is internally inconsistent
w.r.t. namespace parameterization.

**Scope: systemic, not nginx-only.** Confirmed the same shape in
`bitnami/redis/25.5.3/bases/default` (14 resources hardcode `namespace: "redis"`,
no kustomize `namespace:` transformer). This is how the recipe-generation
pipeline froze every package, so it likely affects the whole catalog.

**Why it matters for the thesis.** `helm install -n my-ns` namespaces everything
correctly. `cub installer setup --namespace my-ns` currently does **not** (for
any ns ≠ frozen) and fails *silently* — that is strictly worse than Helm. A
newcomer choosing their own namespace would get a broken install with no error.

**Fix — CORRECTED after reading the installer source (2026-06-01).** My first
draft put the fix on the installer; that was wrong. The installer is **not** the
primary culprit:

- The installer already provides namespace parameterization — a `set-namespace`
  transformer fed `{{ .Namespace }}` (`installer/internal/render/compose.go`,
  `chain.go`, `multipkg_test.go`), and it generates the Namespace object from
  `--namespace`.
- **Proof the mechanism works:** `helm-expt/packages/istio/istiod/1.30.0/bases/default/upstream.yaml`
  parameterizes its namespace with `{{ .Namespace }}` and would honor
  `--namespace`. It is the **only 1 of ~47 packages** that does. nginx, redis,
  and the rest were generated with the namespace **hardcoded** and **no**
  `set-namespace` transformer — so `--namespace` makes the Namespace object but
  never re-namespaces their workloads.

So:
- **Primary fix — `helm-expt` package generation:** emit every package the way
  `istio/istiod` is built (parameterized namespace / `set-namespace`
  transformer), so `--namespace` is honored. This is the real bug.
- **Secondary — `installer` hardening (optional, NOT a blanket rewrite):** when
  `--namespace` is set but the package has no namespace transformer (Namespace
  object and workloads will disagree), **warn or refuse** rather than silently
  emit a split render. A blanket "force all resources into one namespace" is
  unsafe — it would break packages that legitimately span multiple namespaces.
- **Guard (already in the runbook):** abort if the render has more than one
  distinct `namespace:` value.

**Open:** exactly what the installer does when `--namespace` is set on a
hardcoded/no-transformer package (attempts a transform and no-ops, or never
attempts one) needs a closer read of `compose.go`; the behavioral result (split
render) is confirmed either way.

**RESOLVED 2026-06-01 (18/20).** Root cause confirmed 100% from the installer
source: `internal/render/compose.go` wires the transform pass when `--namespace`
is set, but with **zero author groups it only runs `ensureNamespace`** (creates
the Namespace object) — it does NOT rewrite resource namespaces. Real
re-namespacing requires the package to include the `set-namespace` transformer in
its chain (the installer's own `examples/hello-app/installer.yaml` does this; so
does the catalog's `istio/istiod` via `{{ .Namespace }}` templating).

Fix: added the canonical `spec.transformers: [set-namespace "{{ .Namespace }}"]`
block to each package's `installer.yaml` via the reusable, idempotent
`scripts/helm-expt-fix-namespace-transformer` (PyYAML-validated). Applied to all
20 proof packages. **Verified: 18/20 now render coherently with an arbitrary
namespace** (e.g. nginx `--namespace nginx-fixtest` → all resources + Namespace
object in `nginx-fixtest`); previously 0 honored a non-frozen namespace.

**Status:** primary fix in place for 18/20; see F1b for the 2 that need more.
The helm-expt `installer.yaml` edits are made in the helm-expt working tree (a
separate repo); committing them there is a deliberate cross-repo step.

---

## F1b — `set-namespace` doesn't rewrite namespace refs embedded in spec (MEDIUM)

After the F1 fix, 2 of 20 still render split with an arbitrary namespace:
`kube-prometheus-stack` (keeps `monitoring`) and `consul` (keeps `consul`).
`set-namespace` sets `metadata.namespace` on namespaced resources, but does
**not** rewrite namespace strings buried in spec fields — RBAC
`subjects[].namespace`, webhook `clientConfig.service.namespace`, ConfigMap data,
etc. Complex charts (RBAC/webhooks/operators) therefore retain their canonical
namespace in those refs.

Implications:
- For the 20-chart test, each chart is installed in its **canonical** namespace
  (the TOP20 entry's `namespace`), so embedded refs are correct and this is moot.
- Full arbitrary-namespace support for complex charts needs either rendering the
  chart at the target namespace up front (helm-style `-n` at generation), or a
  deeper transformer that also rewrites known embedded ref fields. Recommend
  capturing as a helm-expt generation-pipeline issue.

---

## F2 — default base ships `bitnami/nginx:latest` (MEDIUM, observe)

The running image is `registry-1.docker.io/bitnami/nginx:latest`. A `:latest`
tag is non-deterministic (defeats pinned, reproducible delivery — the whole
point of OCI-pinned GitOps). This is the upstream chart's default, carried
through unchanged. A stress-test/scan should flag it; the catalog may want to
pin digests in the default base. Not a Wave 1 blocker; recorded for the scan/Day-2
waves.

---

## F3 — secret-dependent charts deliver "green" but can't start (HIGH)

**Severity:** HIGH — *silent*: Argo **and** cub-scout report `Synced` while the
workload sits in `CreateContainerConfigError`. ~6/20 charts affected.

**Symptom.** Charts whose default base renders a Secret (the `generated-passwords`
bases + redis `default`) deploy via OCI→Argo to a pod stuck in
`CreateContainerConfigError`. Verified live on grafana: pod needs `secret
'grafana'` (admin-user/admin-password, `Optional: false`); no such secret in the
namespace; deploy `0/1`.

**Root cause (confirmed).** `cub installer upload` never uploads rendered Secrets
(`installer upload --help`: *"Files in out/secrets/ are never uploaded… apply
them out-of-band"*). The Secret is rendered to `out/secrets/` but is not a
ConfigHub unit, not in the OCI bundle; Argo never creates it. The local-kind e2e
applies `out/secrets` by hand; the OCI→Argo path has no equivalent step. This is
the **correct** security choice (no plaintext in the artifact) with a **missing
replacement** (a GitOps secret-delivery mechanism).

**Scope.** ~6/20 proof charts render a Secret in their default base: redis,
postgresql, mysql, mongodb, rabbitmq, grafana. (nginx `http-clusterip` needs no
Secret — why Wave 1 passed.)

**Verified via cub-scout (read-only).** `cub-scout explain deployment/grafana`
confirmed the chain (Owner ArgoCD; Source `oci://oci.hub.confighub.com…`;
ConfigHub OCI → Application/grafana → Deployment/grafana; Health Synced).
`cub-scout doctor` reported `Error: 0`. So the chain delivered correctly and the
failure is **silent at the governance/diagnosis layer** — the strongest argument
for a required-secret validation gate.

**Side-finding:** `scripts/cub-check-diagnosis-contradiction` watches for
ImagePullBackOff/CrashLoopBackOff/Error but **not `CreateContainerConfigError`**,
so it didn't fire here — a one-line coverage gap to fix.

**Fix / design.** Not a per-package typo — a delivery-architecture capability,
designed as a tiered secrets ladder (anonymous secret-free → connected "safe dev"
out-of-band → paid ESO+Vault+rotation) with a universal **required-secret
validation gate** as the first buildable.

**Status:** found and verified live. Secret-needing
charts must be tested via the existing-secret / ESO path, not the
password-generating default.

## F4 — F1's installer.yaml change (PR #95) breaks the proof/compare suite (MEDIUM-HIGH)

**Severity:** MEDIUM-HIGH — the catalog's own proof/compare suite is red for the
20 changed charts until proof artifacts are regenerated.

**Symptom.** After helm-expt PR #95 (the F1 set-namespace fix) merged,
`npm run <chart>:compare` and the proof suite fail for the 20 charts:
`Error: source file SHA mismatch for installer.yaml` (`scripts/lib/proof-common.mjs`).

**Root cause.** The proof scripts verify a recorded SHA of each package's
`installer.yaml`. PR #95 changed `installer.yaml` without regenerating the proof
artifacts that record that SHA → mismatch. (redis's *dedicated* comparator skips
the SHA check, so it still passed — masking the breakage in a quick look.)

**Confirmed — not a render diff.** Reverting the 20 `installer.yaml` to pre-#95
(`f3efc50~1`) and re-running the full compare sweep → **20/20 PASS**
(helm-equivalent; redis 14/14 + 13/13 semantic object matches). So the underlying
installer↔Helm equivalence is intact; only the recorded SHA is stale.

**Fix.** Regenerate the proof artifacts for the 20 changed packages (recorded
`installer.yaml` SHA + dependent rendered/receipt artifacts) and commit alongside
the change. Rule: **any `installer.yaml` edit pairs with a proof-artifact regen.**
Tracked: confighub/helm-expt#97; flagged on PR #95.

**Strategy lesson:** a package-source change and its proof-artifact regen are
coupled; CI correctly treats an unregenerated source change as BLOCK. (It also
means my F1 PR was incomplete — the namespace fix is right, but it needed the
companion regen.)

## Phase 2 — Helm equivalence: 20/20 (positive result, not a finding)

On the pristine tree, **all 20 TOP20 charts' `cub installer` render is
semantically equivalent to `helm template`** (`npm run <chart>:compare` → 20/20
PASS; the only cub-only object is the generated `Namespace`). This is the "same
as Helm" half of the thesis, proven across the catalog (read-only, no cluster).

## What Wave 1 still PROVED despite F1

F1 is a *catalog-content* defect, not a pipeline failure. With a coherent render,
the full chain — `cub installer` → ConfigHub units → OCI at `oci.hub.confighub.com`
→ Argo (app-of-apps) → running workload — worked end-to-end and three-way agreed.
The mechanism is sound; the catalog packaging needs the namespace fix.
