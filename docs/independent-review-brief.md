# Independent Review Brief

Use this brief for independent reviews of the current ConfigHub Helm plan.

## Scope

Review the new pathway:

```text
public Helm chart catalog proof
not enterprise-internal broken chart archaeology

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
archive/render-and-vendor-top20/
outputs/helm_top500_matrix/
```

Those old artifacts may be mentioned only if docs accidentally present them as
the current proof path.

## Source Docs

Read:

- `README.md`
- `data/adversarial10/summary.md`
- `data/adversarial10/proof-readiness.csv`
- `docs/agreed-execution-plan.md`
- `docs/chart-recipe-manifest-flow.md`
- `docs/current-pathway-review.md`
- `docs/issue-backlog.md`
- `docs/known-adversarial-charts.md`
- `docs/review-prompts.md`
- `confighub/installer` docs and package/render/upload/OCI/facts behavior

## Review 1: Product Clarity

Question:

```text
Would a skeptical Helm/GitOps user understand in 60 seconds why this is less
Helm pain rather than more platform ceremony?
```

Preferred public framing:

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

Hard standard:

```text
If the first demo feels like Helm plus homework, the plan fails.
The complexity may exist underneath, but proof must appear automatically.
If it appears harder than Helm, riskier than Helm, or wrong compared with Helm,
users will not adopt it.
```

## Review 2: Architecture And Artifact Proof

Question:

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

Question:

```text
Can the plan prove itself against 20, 100, and 500 real charts, including ugly
Helm behavior?
```

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
- Whether any P0 issue in `docs/issue-backlog.md` is being ignored or bypassed
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
```

`data/adversarial10/` is a readiness and blocker harness, not final
certification. Review it for whether each row is clear, generated, and
receipt-backed, then identify what is still missing before those charts become
full recipe/variant/revision proofs.

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
