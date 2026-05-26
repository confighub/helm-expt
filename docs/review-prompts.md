# Review Prompts

Use these prompts to review the ConfigHub Helm plan and the proposed `helm-expt` rewrite.

Primary source:

- `docs/chart-recipe-manifest-flow.md`
- `docs/agreed-execution-plan.md`
- `docs/current-pathway-review.md`
- `docs/independent-review-brief.md`
- `docs/issue-backlog.md`
- `docs/known-adversarial-charts.md`
- `confighub/installer`: https://github.com/confighub/installer

Scope exclusions:

- `archive/render-and-vendor-top20/` is legacy reference only.
- `outputs/helm_top500_matrix/` is an old source-feature spreadsheet and is
  legacy reference only.
- Do not judge the current plan by whether those old artifacts prove it. They
  do not. The current plan requires new chart proof repos, new recipe artifacts,
  new generated spreadsheets, and new receipts.

Core thesis:

```text
Use Helm charts. Ship ConfigHub variants.
```

Phase 1 scope:

```text
public Helm chart catalog proof
not enterprise-internal broken chart archaeology
```

Lead with:

```text
Approve the Kubernetes objects Helm produced,
not the values you hope produced them.
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

Above all, it must prove simple UX:

```text
one install command
one review/diff path
one publish path to ConfigHub OCI for GitOps pickup
proof generated automatically
```

If the first demo feels like Helm plus homework, the plan fails.
If the result appears harder than Helm, riskier than Helm, or wrong compared
with Helm, users will not adopt it.

Council execution guidance:

```text
Do #24 first: schemas and verifier.
Then make Redis courtroom-grade.
Then prove the five-minute UX continuously.
Only then should top-20/top-100/top-500 count as product evidence.
```

Implementation thesis:

```text
Build this by extending confighub/installer.
Do not invent a separate Helm platform.
```

Execution boundary:

```text
The current fast install story uses ConfigHub's OCI endpoint.
GitHub is the public catalog/proof surface, currently confighub/helm-expt.
A pure serverless cub install path is deferred and should be tracked as an
issue, not reviewed as part of the current proof plan.
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
  planning docs, legacy reference evidence, and old source-feature scan.

Target repo state:
  new chart repos prove that Helm charts become ConfigHub installer recipe
  candidates, install variants, immutable variant revisions, rendered objects,
  scans, gates, OCI artifact receipts, and generated evidence spreadsheets.
```

Do not treat archived top-20 folders or the old top-500 spreadsheet as the main
pathway. They are already archived/reference-only. The useful review is: are
the new pathway, required artifacts, acceptance criteria, and proof strategy
clear enough for independent implementation and verification?

The proposed repo rewrite matches the whole plan if it answers these questions clearly:

1. Can a popular Helm chart become a stable core recipe?
2. Which bounded base variants does the recipe need?
3. Which control point handles each chart's Helm complexity?
4. Can every variant revision render deterministically?
5. Can every rendered variant revision be scanned and gated?
6. Can ConfigHub Server store intended variant state without pretending to be the live watcher?
7. Can `cub-scout`, GitOps, CI/CD, or other external observers submit live observation receipts with freshness?
8. Does the repo prove real recipe/variant behavior, not just chart-count benchmark theater?
9. Is every step executable through `cub`, ConfigHub Server UI/API, or an external observer integration, with no hidden manual process?

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

ConfigHub Server is workerless in this story. It stores recipes, variants, variant revisions, operation records, receipts, target assignments, and desired state. It does not have a built-in live view. Live observations come from cub-scout, GitOps controller reports, CI/CD jobs, customer-owned agents/integrations, or human-triggered cub observations. Those observations are submitted as receipts with observer, method, timestamp, result, and freshness.

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
8. Whether the proposed new top-20/top-100/top-500 evidence will prove the
   right thing.
9. What the new chart repos and generated spreadsheets must contain to make the
   claim believable.
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
- README.md
- confighub/installer, especially README.md, docs/author-guide.md, package model, collector/facts, render, deps, OCI/sign/verify, validators, and lifecycle docs

Explicitly exclude from current-pathway proof review:

- archive/render-and-vendor-top20/charts/
- outputs/helm_top500_matrix/

Those are legacy/reference artifacts only. Mention them only if current docs
still accidentally present them as the main execution path.

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
- The happy path must be no more complex than Helm for a first successful
  install, while producing more proof.
- The happy path must feel safer and more correct than Helm, not merely more
  instrumented.
- Every intentional difference from Helm output must be explained before
  publish.
- If a variant is just a values file with a label, the plan fails.
- A core recipe is not the same thing as a Helm release.
- A variant revision is the thing users approve, scan, promote, deploy, and roll back.
- Helm source weirdness should map to control points, not just "bad chart" labels.
- lookup must become recipe-declared target fact requirements; no hidden live
  cluster reads during render.
- generated random/cert/time/password behavior must become generated facts or secrets.
- capabilities must become named capability profiles.
- hooks must become lifecycle policy: test hook, install phase, or unsupported.
- raw/tpl escape hatches must become explicit extension slots or be rejected.
- rendered manifests are where market scanners run.
- ConfigHub Server is workerless; live state comes from cub-scout, GitOps/CI reports, or other external observation receipts.
- ConfigHub Server must not claim fresh runtime truth unless a current external observation receipt says so.
- The fast install path uses ConfigHub's OCI endpoint; pure serverless is deferred.
- The implementation should extend confighub/installer, not create a parallel Helm system.
- Map every proposed concept to an existing installer concept where possible: package, `installer.yaml`, base, component, input, selection, facts, dependency lock, function chain, validator, render output, OCI artifact, signature, upload, day-2 lifecycle.

Review task:

1. Check whether the current docs clearly exclude legacy artifacts from the
   main proof pathway.
2. Check whether the proposed happy path proves simpler UX and faster value
   than plain Helm.
3. Check whether the proposed new chart repo / new spreadsheet pathway can
   prove the intended story.
4. Identify mismatches between docs/chart-recipe-manifest-flow.md,
   docs/agreed-execution-plan.md, and the target artifacts.
5. Propose a concrete new chart repo file tree, schemas, and example files.
6. Propose a new generated top-20/top-100/top-500 summary table focused on:
   - core recipe viable?
   - base variants needed
   - primary control point
   - secondary control point
   - can bulk scan rendered variants?
   - install readiness
   - evidence artifact / receipt link
7. Define acceptance criteria for the proof repo.
8. Identify the smallest useful implementation slice.
9. Identify any places the plan is technically false, underspecified, or overclaiming.
10. Identify any places the proposed new evidence path risks becoming benchmark
   theater instead of proving recipe/variant behavior.
11. Check whether any issue in `docs/issue-backlog.md`, especially P0 gates,
    is missing from or bypassed by the written plan.
12. Identify which pieces can be implemented directly in confighub/installer and which require new model/API concepts.

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
