# Roadmap: corpus, tests, fuzz, and migration-UX

**UNOFFICIAL/EXPERIMENTAL.** Planning doc for the non-website work — corpus, tests, fuzz, and
the doc/data surfaces that feed UX. Filed as source-only PRs (no self-merge). **Codex owns
website UX**; this roadmap deliberately stays out of the site renderer.

## Principle: test OUR tool, honestly

The pivot that drives this roadmap: stop cataloging Helm's footguns and asserting our model is
better — **test `cub` itself for bugs**, and report findings (rough edges) honestly rather than
taking a victory lap. The cub-installer fuzz already earned that posture (0 serious bugs, but 2
real namespace-validation rough edges surfaced, not buried).

## The persona taxonomy — who breaks the tool

| Lane | Persona | Input | Failure mode | Status |
| --- | --- | --- | --- | --- |
| **F** adversarial | attacker | crafted to break | exploit | torture-suite / adversarial-10 (existing) |
| **G** careless-dev | unskilled | random garbage (`replicaCount=-1`) | footgun | `bad-decisions:fuzz` (shipped) |
| **cub-installer fuzz** | careless+adversarial → cub | bad/weird input to `cub installer` | **cub bug** | shipped |
| **H** Helm-fluent migrant | **skilled in Helm, new to cub** | **valid *Helm*** (`replicaCount=3`, `-f values.yaml`) | **model mismatch / friction** | shipped |

Lane **H** is the adoption-friction lane: the dev does everything right *by Helm's rules*, and it
breaks anyway because cub's model (declared inputs / bases / kustomize) isn't Helm's free-form
`--set`. The question that decides adoption isn't "does cub reject it" — it's **does cub reject it
*with guidance*** or opaquely. Its classification is therefore about error-message quality:
`guided` / `opaque` / `silent-wrong` / `supported`.

## PR sequence (offline-first)

1. **cub-installer fuzz + #1006 reframe** *(shipped)* — fuzz `cub installer` with careless +
   adversarial input; classify cub's behavior (reject-unknown / reject-validation / rendered /
   crash / injection / silent-swallow) + honest rough-edge findings. Reframe the merged Helm
   comparison (#1006) to drop the unmeasured "config-as-data surfaces 100%" claim → "Helm's
   footgun profile," pointing to the cub fuzz as the measured lane.
2. **Helm-fluent migrant friction lane** *(shipped)* — feed *valid Helm idioms* to `cub installer`
   (`--input replicaCount=3`, `-f values.yaml`, `--set image.tag`, `--set-string`, array syntax,
   release-name semantics) and classify the **guidance quality**. Headline metric: how often does
   cub guide the Helm migrant vs leave them stuck? Current result: safe but opaque, with a
   user-facing Helm→cub migration guide.
3. **cub-installer determinism** *(shipped first cut)* — same input twice → byte-identical
   render, across the current package sample. This proves the diff premise for that sample.
4. **cub-installer fuzz expansion** — more packages (8 → ~20 that render), more input classes
   (bad values for *declared* inputs, `--select`/`--components` fuzzing, `--set-image` ref
   fuzzing, edge values: unicode / empty / huge / whitespace). Hunt more cub rough edges.
5. **Careless-dev corpus broadening** — more charts (10 → 20+ that baseline-render) and more
   decision types, including **security-relevant** ones (privileged, hostPath, capabilities,
   runAsRoot) so the footgun profile covers the dangerous cases, not just the silly ones.
6. **Helm→cub migration cheat-sheet** *(shipped)* — turn the lane-H findings into a user-facing
   "you did X in Helm; here's the cub way" surface (md + csv + colored HTML). UX *content* that
   Codex's site can render; not the site itself.
7. **Default-credential check** *(shipped first cut)* — detect deterministic placeholder
   credentials in default bases and keep them visible as `watch` until names, warnings, and
   production routes are clear.
8. **cub-direct prune gap proof** *(shipped first cut)* — prove the no-controller apply path
   does not prune removed resources unless it uses `kubectl apply --prune` or an equivalent
   delete-set.
9. **Test-map + doctrine update** — fold the cub-installer fuzz and lane H into
   `tests/README.md` and `tests/doctrine.md`; refresh the persona taxonomy above.

## Constraints (so this survives an unattended session)

- **Offline-first.** `helm template` and `cub installer setup` are local renders — no cluster,
  no quota, robust to the Mac sleeping. Prefer them while unattended.
- **Honest disposition.** Findings (rough edges) are surfaced, not buried; bugs flagged; never a
  victory lap. `watch ≠ pass`.
- **One source of truth** for shared corpora (the `scripts/lib/bad-decisions.mjs` pattern).
- **Source-only; no self-merge.** Codex / the user owns merges and all website UX.

## Deferred — needs an attended session (live cub-lk, sleep-kill risk)

- Real catalog hook charts through the OCI 3-controller proof (extend `run-oci-hook-delivery-proof`).
- Day-2 upgrade + rollback live receipt (back `day2-upgrade-rollback.md` with evidence).

These are valuable but need a live rig that survives the run; do them at-keyboard.
