<!-- Catalog customization guidance for helm-expt. Validated live by the Pilot test harness (confighub-ai-demo#1134). -->

# Helm → ConfigHub customization decision tree (draft for confighub-ai-demo#1133)

**Status:** DRAFT / design-pending (#1133). Sources: installer
`docs/consumer-guide.md` (the authoritative consumer-facing model) + helm-expt
`docs/reference/customization-algorithm.md` & `docs/user/change-routing-before-oci.md`.
Grounded by the #1134 campaign for the early forks. Tags: **[proven]** =
demonstrated live this campaign · **[observed]** · **[design]** = still to decide.

## The one rule
> Don't ask users to abandon Helm behavior. Capture it, classify the change,
> render exact objects, prove Helm-equivalence, then deliver only digest-bound
> variants with receipts. **The package source tree (`./package/`) is read-only
> to consumers** — never `kustomize edit` it; the next `setup --pull` overwrites it.

## The model behind the menu (chart → recipes → base variants → derived variants)
```
1 Helm chart
 └─ N recipes  (incl. a default recipe)                     — the cub installer mapping(s)        [helm-expt]
      └─ N base variants, placeholdered  (incl. a default)  — render-time shapes; placeholders    [helm-expt]
         │                                                     are the fill surface. Each base is
         │                                                     rendered, Helm-equivalent, pinned.
         │                                                     (no-crds · existing-secret · ha · ingress-tls · …)
         └─ N×M derived variants                            — env / region / customer fills on a   [ConfigHub only]
                                                              chosen base (cub variant create;
                                                              no re-render). NAMED, LISTED, and
                                                              TESTED in helm-expt; instances live
                                                              in ConfigHub.
```
- **helm-expt owns** the recipes + base variants (rendered, equivalence-proven, placeholdered) and the *names / list / tests* of the derived variants.
- **ConfigHub owns** the derived-variant *instances* (the long tail).
- **The render boundary is the rule:** changes the rendered object set → a new **base variant** (re-render + Helm-equivalence); only changes operating context (target/env/region/gates/fills) → a **derived ConfigHub variant** (no re-render). This is Lens B below.

### Support outcomes
A chart is **supported** when every Helm quirk it uses — `lookup`, hooks, `.Capabilities`, generated
secrets, `tpl`, raw / post-renderers, CRDs / webhooks — is either **modeled** (static: declared fact ·
named capability profile · generated-fact receipt) or **explicitly disclosed** (operator-decision · honest
blocker). **Zero silent gaps.** That faithful disclosure *is* the support — not a claim that runtime
behavior was statically replicated.

For the public catalog outcome, the bar is higher:

```text
Every supported default and declared main choice should have reproducible
render evidence plus live-cluster evidence. Missing live evidence stays visible
as `missing` lane backlog.
```

Analysis-tier rows can be proof-grade without live coverage. A chart choice
should not be described as fully catalog-supported, production-supported, or
live-verified until the relevant live lanes have committed receipts. Variant
richness is an enhancement; every variant that is advertised as supported needs
the same outcome tracking as the default.

## Two complementary lenses (read both)
The consumer guide and the routing doc answer different questions. Use them together.

**Lens A — "which knob do I turn?" (installer consumer guide: 3 override layers, use the lowest that fits)**
| Layer | Mechanism | Use for | Reversibility |
|---|---|---|---|
| 1. Wizard inputs | edit `out/spec/inputs.yaml` → `installer setup` (re-render) | author-exposed inputs: replicas, names, components, tunables | highest (re-render) |
| 2. `--set-image` | `installer setup --set-image NAME=REF` (needs an `images:` block in the base) | image tag/digest bumps | high (persisted in `spec.imageOverrides`) |
| 3. Post-install mutation | `cub function do --space S set-container-image …` | ad-hoc edits tracked in cub revision history; survive re-render via `--merge-external-source` | lowest |

**Lens B — "where does the change live?" (helm-expt: 3 decisions, in order)**
1. Changes rendered K8s objects? → **`cub installer` base variant** (re-render + Helm-equivalence).
2. Only changes how a reviewed set is *operated* (target/env/region/gates/labels)? → **derived ConfigHub variant** (clone Units, no re-render).
3. Neither, but required before delivery? → **delivery prerequisite** (facts, scans, gates, approval, OCI digest, controller config).

**How they map:** Lens-A Layers 1–2 (inputs / `--set-image`) are object changes → Lens-B **base path**. Layer 3 (post-install cub mutation) is a narrow post-render edit → Lens-B **derived/operating** (survives re-render). Plain user wording: *"changes the Kubernetes objects → new installer base"* vs *"changes operating context → ConfigHub variant"* vs *"delivery prerequisite → satisfy/record before the OCI artifact is used."*

## Step 0 — pick a named fork (the menu the user sees first)
Every catalog-supported chart presents a small, predictable menu (shared vocabulary —
`HELM_FORK_VOCABULARY.md`), not a values free-for-all:

- **`default`** — works out of the box, zero required input. *(Start here.)*
- **`parameterized`** — same shape as `default`, with the fill-safe fields exposed as placeholders to fill.
- **standard forks (only those that apply):** `existing-secret` · `ingress-tls` · `ha` · `no-crds` · `minimal` · `tls`. These *change the rendered object shape*, so each is a real, Helm-equivalent, pinned base. Forks compose (e.g. `existing-secret + ingress-tls`).

Pick one fork (or a composition), then customize *within* it by **filling placeholders / facts**
(derived variant, no re-render). The forks below (F1–F3) are the checks each chosen fork must pass.

## Early forks a newcomer hits FIRST (campaign-grounded)
```
START — pull a public package → setup → upload → ConfigHub → OCI → Argo/Flux
│
├─ Fork 1 · NAMESPACE  (F1 / F1b)                                  [proven]
│   `installer setup --namespace <ns>`. Does the package honor it?
│   • Simple charts (18/20): yes (PR #95 set-namespace transformer) → any ns.
│   • Complex charts w/ ns refs embedded in spec (consul, kube-prometheus-stack):
│       install at the CANONICAL namespace. (helm-expt#96, F1b.)
│   GUARD: render must contain a single namespace; abort if >1.
│
├─ Fork 2 · IMAGE PINNING  (F2)                                   [observed]
│   Default bases ship floating/`:latest` tags (e.g. bitnami/nginx:latest) —
│   non-reproducible over digest-bound OCI delivery.
│   • Bump/pin via Layer 2: `installer setup --set-image NAME=myrepo/img@sha256:…`
│     — REQUIRES an `images:` block in the chosen base. If absent, it fails fast;
│     fall back to Layer 3 (`cub function do set-container-image`).
│   • Catalog gap: default bases should ship pinned digests (no helm-expt issue yet).
│
├─ Fork 3 · SECRETS  (F3)                                          [proven]
│   Does the base render a Secret?
│   • No (e.g. nginx http-clusterip) → proceed.
│   • Yes — default "generated-passwords"/"default" base over OCI→Argo is
│       GREEN-BUT-BROKEN: `installer upload` never uploads rendered Secrets, the
│       pod sits in CreateContainerConfigError ("secret not found"), and Argo
│       still reports Synced (SILENT). Do NOT use the password-generating default
│       for GitOps delivery.
│       → Use the chart's existing-secret base + provide the Secret out-of-band
│         (kubectl / ExternalSecrets / Vault). [proven: postgresql, redis, mysql, mongodb → Ready]
│       → [design] required-secret validation gate (confighub-ai-demo#1132) +
│         typed secret reference system (helm-expt#19) are the planned guards.
│
└─ then classify the change & route via the two lenses ↓
```

## Classify the customization (sets base-vs-variant)
`values-only` · `target fact` (existing Secret/StorageClass/IngressClass/CRD) ·
`generated fact` (password/cert generated once, before render) · `capability profile` ·
`lifecycle / hook / CRD policy` · `extension slot` · `Kustomize overlay / patch` ·
`post-renderer / script` · `operate / observation`.

| Customization | Route |
|---|---|
| Replicas, storage, ingress/TLS, RBAC, args/env, component on/off | Layer 1 wizard input → base re-render |
| Image bump | Layer 2 `--set-image` (or Layer 3 post-install) |
| Existing Secret | base if object shape changes; derived only if base already exposes the ref |
| Generate password/cert once | generated fact binding *before* render (then immutable) |
| CRDs enable/disable | base lifecycle policy (enable → + CRD review gate; CRD before CR) |
| Kustomize patch | base overlay if it mutates objects; narrow approved cub function only post-render |
| Target / env / region / labels / gates / observation | derived ConfigHub variant |
| Helm hook | lifecycle policy. Rendering proves the hook resources are explicit; it does not prove hook execution. Production support needs a chosen route and a lifecycle or observation receipt for that route. |
| Cluster lookup | recipe fact requirement + variant fact binding |

## Day-2 lifecycle (from the consumer guide)
```
edit inputs / --set-image / cub mutation
        │
   installer plan        ← read-only diff per Space (Package=<pkg> filter); shows + ~ - and an Images: footer
        │
   installer upload      ← reconcile: opens ONE ChangeSet per Space; updates/adds/empties
        │                   (a Unit that left the render is EMPTIED, not deleted;
        │                    DestroyGate-guarded Units are refused)
        ▼
   revert: cub unit update --patch --restore Before:ChangeSet:<id> …   (printed by upload)
            • updates → reverted by the restore
            • creates → NOT auto-reverted (delete the Unit)
            • empties → restore the pre-empty revision (not in the ChangeSet)
```

## Upgrade (re-pull a new version)
`installer setup --pull oci://…:<new-ref>` against the existing work-dir →
schema-diff machinery: new-with-default adopted (logged), new-required-without-default
prompted (non-interactive fails fast naming them), removed dropped, type-changed errors.
Components: if prior selection == old default preset, adopt the new default preset.
Then `installer plan` → `installer upload --yes`. Image-only upgrade = `--set-image` (no `--pull` needed).

## Multi-package, signing, recovery
- **Multi-package** (parent declares deps): `setup` runs `deps update` automatically;
  `installer upload --space-pattern '{{.PackageName}}-prod'` gives each package its own Space. `installer deps tree` audits the DAG.
- **Signing/trust:** `installer verify <ref> --key cosign.pub` (or keyless); enforce on every pull via `~/.config/installer/policy.yaml` (`enforce: true`).
- **Recovery** (lost work-dir): the `installer-record` Unit on ConfigHub holds the spec + `upload.yaml`; re-pull + `cub unit data … installer-record` + `installer render`.

## Variant lineage & the OCI boundary
`recipe` → `base variant` (rendered shape; Helm-equivalent) → `derived ConfigHub variant`
(operating context) → `custom overlay` (wrapper+platform+customer values; usually ConfigHub
Server / managed tier). Each digest-bound to its parent. **After OCI publication the artifact
IS the desired object set** — no untracked GitOps patch / manual edit / post-render script;
object changes route back to the base path and republish.

## Pipeline, confidence labels, tiers
render → compare vs `helm template` (equivalence) → scan rendered objects →
gate (`allow`/`warn`/`block`) → promote/reject → settle delivery prereqs → OCI publish (digest+sig) → Argo/Flux.
Labels: `proof-grade` · `catalog-candidate` · `catalog-supported` · `deprecated` · `blocked`.
Tiers: public catalog proof → ConfigHub managed variants → managed overlay import → enterprise fleet.

## What #1134 grounded vs what's still open
- **Proven (use with confidence):** Fork 1 (namespace), Fork 3 (secret silent-fail + existing-secret fix on 4 DBs), Helm-equivalence 20/20, render→OCI→Argo→runtime pipeline, rollback via ConfigHub revision (prior pass: replicas 1→2).
- **Observed:** Fork 2 (`:latest`).
- **Not exercised live this campaign:** Layer-2 `--set-image`, derived/custom variants, hooks lifecycle, upgrade schema-diff, multi-package `--space-pattern`, signing enforcement — all from the consumer guide, all still to validate end-to-end.
- **Open issues this maps to:** helm-expt#96 (F1b namespace refs), #97 (F4 proof regen), #19 (typed secret system), #20 (lifecycle/rollback contracts); confighub-ai-demo#1132 (required-secret gate). **F2 image-pinning has no issue yet.**

## Sources
installer: `docs/consumer-guide.md`, `author-guide.md`, `principles.md`.
helm-expt: `docs/reference/customization-algorithm.md`, `docs/user/change-routing-before-oci.md`,
`docs/user/creating-variants.md`, `docs/user/custom-overlays.md`, `docs/user/product-support-tiers.md`,
`docs/user/hook-lifecycle-strategy.md`.
Campaign: `reports/pilot-helm-sweep/SCORECARD.md`, findings F1–F4.
