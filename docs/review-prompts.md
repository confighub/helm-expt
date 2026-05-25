# Review Prompts

Use these prompts to review the ConfigHub Helm plan and the proposed `helm-expt` rewrite.

Primary source:

- `docs/chart-recipe-manifest-flow.md`
- `docs/agreed-execution-plan.md`
- `outputs/helm_top500_matrix/helm_top500_import_feature_matrix.xlsx`
- `outputs/helm_top500_matrix/helm_top500_import_feature_matrix.raw.json`
- `confighub/installer`: https://github.com/confighub/installer

Core thesis:

```text
Use Helm charts. Ship ConfigHub variants.
```

60-second story:

```text
Helm generates Kubernetes objects. ConfigHub captures those objects as
immutable variant revisions. You approve the exact rendered objects, scan them
before install, promote the same revision to prod, see why environments differ,
and get receipts proving what changed and what was observed.
```

The repo should prove:

```text
500 charts
  -> 500 core recipe candidates
  -> N base variants per recipe
  -> explicit control points
  -> rendered variant revisions
  -> bulk scans and install gates
```

Implementation thesis:

```text
Build this by extending confighub/installer.
Do not invent a separate Helm platform.
```

Installer is the substrate for `cub install`, `installer.yaml`, Kustomize
bases/components, inputs, selection, `out/spec/`, collector facts, function
chains, validators, dependency locks, OCI artifacts, sign/verify, render,
upload, and day-2 lifecycle. Helm import should add chart-to-recipe import,
install variants, variant revision receipts, Helm control-point diagnostics,
scan/gate receipts, and external observation receipts.

## Quick Alignment Check

Important review distinction:

```text
Current repo state:
  useful legacy/render-and-vendor evidence, plus top-500 source feature scan.

Target repo state:
  proof that Helm charts become ConfigHub installer recipe candidates,
  install variants, immutable variant revisions, rendered objects, scans,
  gates, and receipts.
```

Do not mark the current repo as "failed" merely because it does not already
contain the target rewrite. The useful review is: what parts of the current repo
can be retained as evidence, what must be moved or relabeled, and what new
artifacts are required to prove the target story?

The proposed repo rewrite matches the whole plan if it answers these questions clearly:

1. Can a popular Helm chart become a stable core recipe?
2. Which bounded base variants does the recipe need?
3. Which control point handles each chart's Helm complexity?
4. Can every variant revision render deterministically?
5. Can every rendered variant revision be scanned and gated?
6. Can ConfigHub Server store intended variant state without pretending to be the live watcher?
7. Can `cub-scout`, Pilot, GitOps, CI/CD, or other external observers submit live observation receipts with freshness?
8. Does the repo prove real recipe/variant behavior, not just chart-count benchmark theater?
9. Is every step executable through `cub`, ConfigHub Server UI/API, Pilot, or an external observer integration, with no hidden manual process?

If the repo does not make those answers obvious, the repo is still too much of a Helm-render experiment and not enough of a ConfigHub variants proof.

## Council Review Prompt

Copy/paste this into the council review.

```text
You are a product/technical council reviewing ConfigHub's Helm mission.

The mission is:

  Never have Helm pain again.

The crisp positioning is:

  Use Helm charts. Ship ConfigHub variants.

The 60-second story is:

  Helm generates Kubernetes objects. ConfigHub captures those objects as
  immutable variant revisions. You approve the exact rendered objects, scan them
  before install, promote the same revision to prod, see why environments differ,
  and get receipts proving what changed and what was observed.

The plan is not to replace Helm, Git, Argo CD, Flux, scanners, or cluster observers.

The plan is also not greenfield. It should be built by extending
confighub/installer:

  https://github.com/confighub/installer

Installer already provides cub install, installer.yaml packages, Kustomize
bases/components, inputs, selection, out/spec state, collector facts, function
chains, validators, dependency locks, OCI packaging, sign/verify, render,
upload, and day-2 lifecycle.

The Helm mission should add Helm Recipe Import, install variants, variant
revision receipts, Helm control-point diagnostics, scan/gate receipts, and
external observation receipts.

The plan is:

  Helm chart source
    -> Helm Recipe Import
    -> ConfigHub Install Variants
    -> immutable variant revisions
    -> environment facts used during render
    -> exact rendered Kubernetes objects
    -> scan exact objects before install
    -> Verified Install Gate
    -> ConfigHub operate/day-2 lifecycle

ConfigHub Server is workerless in this story. It stores recipes, variants, variant revisions, operation records, receipts, target assignments, and desired state. It does not have a built-in live view. Live observations come from cub-scout, Pilot, GitOps controller reports, CI/CD jobs, customer-owned agents/integrations, or human-triggered cub observations. Those observations are submitted as receipts with observer, method, timestamp, result, and freshness.

Hard rule:

  ConfigHub stores desired/config truth and submitted observation receipts.
  It does not claim fresh runtime truth unless a current receipt says so.

The repo proof should become:

  500 Helm charts
    -> 500 core recipe candidates
    -> a small set of bounded install variants per recipe
    -> explicit control points
    -> rendered variant revisions
    -> bulk scan results and install gates

Review the plan against these user pains:

1. I do not want to approve a values file and hope. I want to approve the exact Kubernetes objects that will be applied.
2. I deployed the same thing to prod and got something subtly different. I have no idea why.
3. I need the thing we tested in staging to be the exact thing we promote to prod, not a generator we rerun and hope produces the same output.
4. Our vendor pushed a chart upgrade. Half my customisations still work, half conflict.
5. SecOps patched the base image. I need to roll it across many customer environments without breaking any of them.
6. I cannot tell what changed, what landed, or whether prod saw the same thing dev approved.

Please be blunt. Produce:

1. A one-paragraph verdict: is this actively, obviously better and simpler than Helm alone?
2. The three strongest parts of the plan.
3. The five biggest objections a real Helm/GitOps user will still have.
4. For each objection, the crispest answer we should give.
5. Any places where the plan sounds like platform ceremony instead of reduced pain.
6. Whether the variants model is doing enough work, or whether the plan still sounds like values-file management.
7. Whether the workerless server boundary is clear and credible.
8. Whether the top-500 chart evidence proves the right thing.
9. What the helm-expt repo must contain to make the claim believable.
10. What to cut, rename, or sharpen.
11. Whether "variant" means a real approval/promotion/operation object, or just a renamed values file.

Use this standard:

  If a skeptical platform engineer cannot understand the value in 60 seconds,
  the story is not crisp enough.
```

## Codex Review Prompt

Copy/paste this into Codex for an implementation-oriented review.

```text
You are Codex, acting as a senior engineering and product reviewer.

Repository: confighub/helm-expt.

Read:

- docs/chart-recipe-manifest-flow.md
- docs/agreed-execution-plan.md
- outputs/helm_top500_matrix/helm_top500_import_feature_matrix.xlsx
- outputs/helm_top500_matrix/helm_top500_import_feature_matrix.raw.json
- README.md
- archive/render-and-vendor-top20/charts/
- confighub/installer, especially README.md, docs/author-guide.md, package model, collector/facts, render, deps, OCI/sign/verify, validators, and lifecycle docs

The intended repo story is:

  Use Helm charts. Ship ConfigHub variants.

60-second story:

  Helm generates Kubernetes objects. ConfigHub captures those objects as
  immutable variant revisions. You approve the exact rendered objects, scan them
  before install, promote the same revision to prod, see why environments differ,
  and get receipts proving what changed and what was observed.

The repo should prove:

  500 Helm charts
    -> 500 core recipe candidates
    -> bounded base variants per recipe
    -> explicit control points
    -> deterministic rendered variant revisions
    -> bulk scans and install gates

Important constraints:

- ConfigHub variants are the product spine.
- If a variant is just a values file with a label, the plan fails.
- A core recipe is not the same thing as a Helm release.
- A variant revision is the thing users approve, scan, promote, deploy, and roll back.
- Helm source weirdness should map to control points, not just "bad chart" labels.
- lookup must become target facts; no hidden live cluster reads during render.
- generated random/cert/time/password behavior must become generated facts or secrets.
- capabilities must become named capability profiles.
- hooks must become lifecycle policy: test hook, install phase, or unsupported.
- raw/tpl escape hatches must become explicit extension slots or be rejected.
- rendered manifests are where market scanners run.
- ConfigHub Server is workerless; live state comes from cub-scout, Pilot, GitOps/CI reports, or other external observation receipts.
- ConfigHub Server must not claim fresh runtime truth unless a current external observation receipt says so.
- The implementation should extend confighub/installer, not create a parallel Helm system.
- Map every proposed concept to an existing installer concept where possible: package, `installer.yaml`, base, component, input, selection, facts, dependency lock, function chain, validator, render output, OCI artifact, signature, upload, day-2 lifecycle.

Review task:

1. Check whether the current repo structure proves the intended story or still tells the old "render Helm and wrap it" story.
2. Check whether the top-500 spreadsheet/raw data supports the plan.
3. Identify mismatches between docs/chart-recipe-manifest-flow.md and the current repo contents.
4. Propose a concrete repo rewrite with file tree, schemas, and example files.
5. Propose a simpler top-500 summary table focused on:
   - core recipe viable?
   - base variants needed
   - primary control point
   - secondary control point
   - can bulk scan rendered variants?
   - install readiness
6. Define acceptance criteria for the proof repo.
7. Identify the smallest useful implementation slice.
8. Identify any places the plan is technically false, underspecified, or overclaiming.
9. Identify any places the repo is doing benchmark theater instead of proving recipe/variant behavior.
10. Identify which pieces can be implemented directly in confighub/installer and which require new model/API concepts.

Output format:

Findings first:

- P0: claims that are false or unsupported
- P1: gaps that weaken the proof
- P2: clarity and repo-structure improvements

Then provide:

- Proposed repo tree
- Proposed YAML schemas for recipe candidate, variant, variant revision, control point, render receipt, scan receipt, and observation receipt
- Top-500 summary shape
- Recommended first PR
- Open questions

Do not optimize for making the plan look good.
Optimize for finding whether the repo can actually prove:

  Helm complexity -> explicit ConfigHub control point -> deterministic variant revision -> scanned/gated install.
```

## Optional One-Line Review Prompt

For a fast sanity check:

```text
Does this plan make Helm simpler by turning charts into managed ConfigHub variants, or does it just rename Helm complexity? Be specific.
```
