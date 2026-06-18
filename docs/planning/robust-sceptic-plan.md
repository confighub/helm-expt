# helm-expt: the robust sceptic plan

Planning doc. Status: active adversarial test plan. Companion to the
serverless design doc and the verify-commercial doc.

## 1. Purpose and posture

Assume helm-expt gets the audience it wants. Then it gets the audience that comes with it: Helm maintainers defending their project, security people probing the trust claims, practitioners with a quirky chart that breaks the model, and the standard internet pattern of finding the one overclaim and using it to dismiss the rest.

The posture that wins is to turn every attack into a fixture. A sceptic with a
breaking chart is useful adversarial QA, and the correct response to "your
model breaks on X" is a public receipt that either passes X or refuses X with a
named reason. The repo's existing discipline (every claim narrow, every
exception visible, every strict BLOCK routed to a watchlist row or a named
rule) is the right foundation. This doc is the threat model on top of it: who
attacks what, what already defends, what tests are missing, and where we are
honestly still weak.

## 2. What already defends

Inventory of existing defenses, so the plan builds rather than duplicates:

- `what-we-refuse-to-claim.md` and `why-this-does-not-collapse.md`: the claims discipline and the quirks-as-catalog-facts doctrine.
- Verification lanes with a generated outcome coverage: one chart can pass one lane and lack another, stated per row.
- The watchlist and named normalization rules: every strict live BLOCK has a public route.
- `known-adversarial-charts.md`: eleven real public charts chosen for stress features (CRDs, webhooks, hooks, generated certs, capability branching, umbrella deps), each with a proof focus.
- `data/adversarial10`: the first scale-out harness over real charts, recording render context (Helm version, capability version, flags, values profile) and per-chart status including determinism.
- `independent-review-brief.md`: a written brief for outside review.
- Zero-dependency clone-and-verify design and signed receipts: the proofs are re-runnable without trusting us.
- Per-chart residue lists, support tiers, and the maintenance SLA separating presence, proof, and recommendation.

This is more than most projects have. The gaps are specific, and section 4
names them as tests. T1 through T4 now have committed machinery; they are still
coverage-growing work, not finished proof of the full product. T5 through T8
remain open proof work.

## 2a. Product Frontiers

The sceptic work should keep these product boundaries visible. Passing render
parity or a live row does not close these frontiers by itself.

| Frontier | Current status |
| --- | --- |
| Field-complete provenance | Blast-radius prediction is scored by a generated accuracy harness: [13 measured cases](../../data/blast-radius-accuracy/summary.md), 13 passing, 0 failing, and 0 unmeasured value-source rows. The claim remains per measured case; not every rendered field in every chart has provenance. |
| Full change authority | ConfigHub can record and gate operations, but the repo does not yet prove a complete per-field authority model for every agent or user. |
| Reverse live-to-desired flow | Live observations are recorded. Authorized live fixes flowing back into desired state are future product work. |
| Universal hook execution | Hooks are inventoried, routed, observed, refused, or marked per-target. This is not a claim that every Helm hook in the top-100 runs automatically. |
| Fleet-wide bounded propagation | Derived variants, blast-radius cases, and promotion examples exist, but a complete fleet propagation product is still being built. |
| Signatures as trust | The [claims register](../../data/claims-register/summary.md) enforces this as reviewer discipline: no evidence means no current claim, partial stays partial, and refused claims stay visible. Signatures still prove integrity and transport only within a named signer, authority, and verification context. |

## 3. The attack taxonomy

Grouped by which claim is attacked. Each entry: the attack, the current defense, and a status (HELD, PARTIAL, WEAK).

### A. Attacks on the render claim ("your render equals Helm's")

- **"Which Helm?"** Different Helm versions, flag profiles (`--include-crds`, `--no-hooks`, `--skip-tests`), and post-renderers produce different output. Defense: render context is recorded on the adversarial10 harness (Helm v4.1.4, capability 1.30.0, exact flags). Status: PARTIAL. The context is recorded per harness run but a flag-profile and Helm-version matrix on the equivalence receipt itself is not yet systematic.
- **Non-determinism.** Charts using random generation, generated certs, or timestamps render differently every time, "so your parity proof is meaningless." Defense: this is a solved classification, not a hole: the scan flags determinism per chart (redis is recorded `deterministic: false`), and generated-fact binding captures the generated values once. Status: HELD for classified charts, PARTIAL for the long tail not yet scanned on this axis.
- **`lookup` and live-cluster reads.** Some templates read the cluster at render time, so a factory render cannot match. Defense: classified as a control point; such charts need facts or refusal. Status: PARTIAL. The honest answer is that lookup charts get a narrower claim, and that narrowing must be visible on the chart page.
- **Capability branching.** Render differs by cluster version and available APIs, "your pre-render is wrong for my cluster." Defense: capability profiles are a named control point with a linked P0 gate. Status: PARTIAL. One profile per package is recorded; the combinatorial envelope (which profiles a package is valid for) is not yet declared per package.
- **Environment skew.** OS, arch, timezone, locale affecting renders. Defense:
  the environment matrix records timezone, locale, and flag-profile cells for
  the measured corpus. Status: PARTIAL. Other operating systems,
  architectures, Helm versions, and CI runners remain open columns.

### B. Attacks on the values-space claim ("you proved points, not the space")

- **"My values combo is unproven."** The catalog proves enumerated variants; a user's custom values are outside the proof. Defense: this is fundamentally true and must be owned, not argued. The mitigation is that `cub installer setup` renders locally, so a custom overlay gets the same verification run on the user's machine: the proof machinery travels, even where the catalog proof does not. Status: HELD if framed correctly, WEAK if any page implies the whole values space is proven.
- **Density hotspots.** One value touching dozens of objects, where a sceptic shows an unexpected interaction. Defense: density is measured in the scan and is the basis of blast radius. Status: PARTIAL, see the prediction-accuracy test below; measuring density is not the same as predicting effects correctly.

### C. Attacks on the lifecycle claim ("hooks are the install; you skipped the install")

- **Hooks.** Pre/post hooks with weights and delete policies are load-bearing in many charts (cert bootstrap, migrations). "A no-hooks render is not the chart." Defense: hook-lifecycle receipts exist; tiering refuses or degrades honestly; `--allow-hooks` must mark the receipt degraded. Status: PARTIAL. Lifecycle proof is the least mature link and sceptics will find it first.
- **CRD install-once and upgrades.** Helm's own footgun, turned around: "how do you upgrade CRDs?" Defense: no-crds variants, CRD-before-CR ordering, refusal with residue. Status: PARTIAL. CRD upgrade is a per-chart decision today, not a solved mechanism, and the docs should say that sentence verbatim.
- **Admission and controller mutation.** "What lands in etcd is not what you applied; your desired state is fiction." Defense: this is Helm pain 14 turned against us, and the answer is the observation receipt plus named normalization rules: divergence is recorded and justified, not hidden. Status: HELD in design, PARTIAL in coverage; every normalization rule is also attackable as "explaining away a diff," so each needs its justification on the page.
- **Install-versus-upgrade divergence.** Charts render differently on upgrade. Defense: both renders captured. Status: WEAK as a live verb; the capture exists, the exercised upgrade path does not.

### D. Attacks on the provenance and edges claim (the newest, least-tested layer)

- **Wrong blast radius.** The sharpest technical attack available: change one
  value, and the predicted set of affected objects misses something or includes
  phantoms. A single public demonstration of a wrong prediction damages the
  whole edges story. Defense today: the blast-radius scoreboard measures a
  small committed case set and publishes both passes and known misses. Status:
  PARTIAL. Whole-release identity paths currently expose under-prediction and
  need better source-map scope before the claim grows.
- **Incomplete source maps.** Aliases, import-values, library charts, post-render fills: value paths the source map does not cover yield "you cannot explain this field." Defense: scanner axes were extended; coverage per axis is in quirk-coverage. Status: PARTIAL.

### E. Attacks on freshness and coverage

- **"Your redis is three versions old."** Staleness of the catalog against upstream. Defense: pinning is a feature (production users pin deliberately); the refresh pipeline exists (latest-top20-refresh with promotion work orders); the catalog date is printed in the install transcript, making staleness visible rather than discovered. Status: PARTIAL. The defense is only as good as the refresh SLA actually achieved, and that SLA is unproven at top-100 scale.
- **"Cherry-picked corpus."** "Forty-seven families out of thousands of charts." Defense: top-N by usage covers the large majority of real installs; breadth was frozen deliberately for depth; the coverage matrix is published. Status: HELD if the coverage numbers stay public and honest.
- **Abandonment risk.** "What happens when you stop maintaining it" (the Bitnami precedent cuts both ways: it proves the market and the fear). Defense: the maintenance SLA doc separates presence, proof, and recommendation. Status: PARTIAL; this is ultimately a commercial-model answer, see the companion doc.

### F. Attacks on trust and security

- **"You signed your own homework."** The catalog signs its own renders, so the signature proves origin, not safety. Defense: correct, and the claim must be scoped exactly that way; signature equals provenance and integrity, the scan receipts carry the safety-relevant findings, and everything is locally re-runnable. Status: HELD if claims stay scoped; one overclaim turns this into the "security theater" headline.
- **Key compromise and signing infrastructure.** Who holds the key, where is the transparency log. Status: WEAK. Cosign exists in the flow; a key ceremony and a public transparency log (rekor) do not yet. This must precede any commercial security claim.
- **Single-party verification.** Every proof so far was produced and checked by us. Status: WEAK by definition until test T6 runs.
- **Supply chain of helm-expt itself.** The verifier is also software; "who verifies the verifier." Defense: zero npm dependencies is a real and unusual answer, plus clone-and-verify. Status: HELD, and worth stating more loudly; it is the project's quietest strong card.

### G. Positioning and social attacks

- **"This is just the rendered manifests pattern."** Defense: yes, plus provenance, variants, facts, signing, and receipts; rendered manifests is step one of six in the journey, and saying so disarms rather than concedes. Status: HELD.
- **"kpt tried this."** Defense: config-as-data lineage is acknowledged openly (the generative GitOps doc now cites it); what is new is the proof chain and the variant model, not the data model. Status: HELD; never argue the lineage, own it.
- **Helm maintainer pushback.** "This misrepresents Helm; we have --atomic, the diff plugin, OCI charts." Defense: tone discipline already in force, never "Helm is bad," always the import-path framing; every Helm pain named has a receipt or a citation, not an adjective. Status: HELD, but fragile under marketing pressure; one snarky tweet undoes it.
- **"AI-generated catalog."** "The proofs are model-generated and circular." Defense: the receipts are deterministic machine checks, re-runnable by anyone, and no model output is part of any proof. Status: HELD; put that sentence in the FAQ verbatim.
- **"Vendor funnel."** "Free catalog is bait for lock-in." Defense: the serverless tier is complete at N=1 by design, the artifacts are standard KRM YAML applied by standard means, and the exit is `kubectl get -o yaml`. Status: HELD if the never-degrade-local rule from the serverless doc holds.

## 4. The adversarial test plan

Eight tests, ordered by leverage. T1 and T2 first: T1 is cheap and converts every other test into a public scoreboard; T2 covers the weakest high-value claim.

**T1. Claims register.** The generated register lives at
`data/claims-register/summary.md`. It maps public claims to status, evidence,
verification commands, and limits. Anything claimed without a receipt, route, or
explicit planning status should be re-scoped or removed. The ongoing task is to
keep this register current as new proof lanes and product claims are added.

**T2. Blast-radius prediction accuracy harness.** The decisive test for the edges layer. For each chart and variant: mutate one input value, predict the affected objects and fields from the inheritance graph and value-source map, then actually re-render and diff. Score predicted-versus-actual (misses and phantoms), publish accuracy per chart per axis. The generated scoreboard at `data/blast-radius-accuracy/summary.md` measures committed base-pair diffs plus recorded single-value rerender receipts (`scripts/record-blast-radius-case.mjs`), each rescored offline against the committed value-source-map. That is a growing benchmark, not a general claim. Whole-release identity paths (namespace, releaseName) are measured with rename-aware object pairing and currently fail: the source maps under-predict paths that reach every object through labels, selectors, and embedded names. Failing rows are published with their changed-field evidence, and the route is to make the source maps honest about whole-release scope, then re-record.

**T3. Synthetic torture suite. [BUILT 2026-06, growing]** Lives at `data/torture-suite/`: charts written to break the model (randomness in selector labels, lookup in a spec field, sprig env access, tpl self-recursion, subchart alias collisions with hardcoded names, import-values chains, install-vs-upgrade branching), each landing in a named pass, refusal, or route, recording hard-fails on silence, so a new breaker chart fails the build until it is classified. Found along the way: helm v4 rewrites aliased subcharts' .Chart.Name (defending alias-derived names), blocks sprig env at parse, and blows the goroutine stack on tpl self-recursion, all recorded as named outcomes. Future fixtures: a hook that mutates non-hook resources (needs live semantics), dry-run detection. Public problem-chart intake is open through the GitHub issue template; a reported chart still has to become a fixture, receipt, named refusal, or routed gap before it is claimed.

**T4. Environment determinism matrix.** The recorded matrix lives at `data/environment-matrix/summary.md`: the proof-grade corpus rendered across timezone and locale variations and flag profiles, each cell rendered twice for per-cell determinism, with digests recorded per flag profile. Open columns, other operating systems, architectures, and Helm versions, are intended to ride on CI runners rather than bespoke local infrastructure. A divergent cell is recorded, not hidden.

**T5. Cluster matrix.** Capability profiles and admission on/off across kind versions: verify that facts and capability profiles catch every divergence, and that each webhook mutation lands as a named normalization rule with its justification. This is what makes attack C's "etcd is not what you applied" answerable line by line.

**T6. External reproduction.** Execute the independent-review brief with outsiders: CI on public runners reproducing the proofs, plus at least one named third party rerunning the verification end to end. Publish the failure budget (what failed to reproduce and why). Single-party verification is a structural weakness no internal test can fix.

**T7. Time-travel re-verification.** Re-run six-month-old receipts: are the artifacts still pullable, signatures still valid, proofs still green. Exercises key rotation and registry durability before a customer does.

**T8. Upgrade gauntlet.** The install-versus-upgrade divergent charts exercised live on kind: upgrade applied, divergence observed, rollback receipts produced. Converts the weakest lifecycle status from captured to exercised.

## 5. Where we are still weak (the honest register)

Stated plainly so nobody inside the project is surprised by an outsider saying it:

1. Lifecycle proof (hooks, weights, delete policies) is the least mature link; today it is classification and refusal more than proof.
2. CRD upgrade is a per-chart decision, not a mechanism.
3. The values space is point-covered by construction; the proof travels (local render-verify) but the catalog claim is and will remain per-variant.
4. Blast-radius prediction accuracy is measured on a small case set. The
   current known miss is whole-release identity propagation, where source maps
   under-predict labels, selectors, checksums, DNS names, and immutable
   identity paths.
5. Reach and live-freshness links are partial; the chain of proof must be claimed only as far as it holds.
6. Authority capture does not exist; nothing should imply it does.
7. The refresh SLA is unproven at top-100 scale, and the staleness attack is only answered by an SLA actually met.
8. Signing infrastructure (key ceremony, transparency log) is not in place; commercial security claims wait on it.
9. Most verification to date is still internal to this project. External
   reproduction remains a separate proof step.
10. Catalog economics: the abandonment question has a commercial answer or no answer.

## 6. Response playbook

Rules for the public conversation, matching the existing tone discipline:

- Concede fast and specifically. "Correct, lifecycle proof is our weakest link; here is the watchlist row and the plan" beats any defense.
- Answer with a receipt or a route, never an adjective. Every reply should contain a link to a lane, a receipt, a residue list, or a named rule.
- Never "Helm is bad." The import-path framing is the only framing.
- Invite the breaker in. Any chart that breaks the model goes into the torture suite with credit; the reply to "I broke it" is "thank you, fixture merged, here is its receipt."
- Keep the refuse-to-claim page one click from everything. The strongest credibility asset is the list of things we will not say.
