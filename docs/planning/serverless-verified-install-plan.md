# Serverless Verified Install Model

Design doc. Status: draft for discussion. Derived from the helm-expt repo (current main), the package and recipe catalog, and prior strategy sessions.

## 1. The question

Can a user get a useful subset of the total benefits without logging into ConfigHub? Three candidate shapes:

- (a) No server at all: some iteration of `cub installer` plus the YAML recipes and packages.
- (b) Git used as a server somehow.
- (c) No login, but a default or vanilla anonymous use of ConfigHub is possible.

In all cases the target experience is that the speed of `helm install redis`
is matched by a verified installer path against an appropriate Kubernetes
cluster. The current substrate is `cub installer setup`. A shorter one-command
wrapper may be useful later, but this document does not treat that wrapper as
shipped CLI. Restricting the demo set is acceptable. The main thing is that a
wide range of default charts just work, and build trust.

## 2. Prior conclusions that scope the design

Three earlier findings bound what this mode can honestly be.

The right axis is capture versus live-graph, not serverless versus server. The capture layer (render, equivalence, provenance, named variants, scan, signing, single-artifact review) is genuinely serverless. The operational payoff (propagation, blast-radius queries, fleet operations, live state with freshness, authority) is the graph and stays server-side. A serverless mode is honest exactly as long as it claims the first list and not the second.

Of the roughly twenty-eight catalogued problems, about seventeen are Helm problems fixable in the capture layer. That is a real, sellable subset: the "verifiably replace Helm" half. The other eleven are System-of-Record problems that need the Server, and the serverless mode must not imply otherwise.

The idea has both founders' fingerprints already. Alexis: the serverless option, if it can be made good enough, "is a nice entry wedge." Brian, independently: minimal scope, open source, no server, no GUI, config in git or OCI, no deployment functionality, rely on existing GitOps tools, CLI plus terminal AI agents. This design is that wedge made concrete, and it is the persona-1 wedge from the Helm community PRD: as fast as helm install, but you can see and prove more.

## 3. What the repo already has

Most of the model exists in the current tree. Path 1 of `try-now.md` uses
`cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --non-interactive --namespace redis`
to pull the package, pick a named base variant, and render locally.
`npm run redis:verify-install:render` proves the rendered objects match the
catalog acceptance contract. No login is needed in that path. Login first
appears in Path 2 (upload to ConfigHub Units), exactly where the
capture-versus-graph line says it should.

The live half exists as harness lanes: the redis-local-kind run applies to a kind cluster and runs cub-scout locally, producing closed-world, object-set, and workload observation receipts plus a liveness check (redis answers PING). The honesty discipline is doctrine: what-we-refuse-to-claim, current-proof-status, and chain-of-proof, with the rule that every strict live BLOCK gets a public route (watchlist row or named normalization rule). And the scoping question is measured, not estimated: per-chart confighub-proof runs and top20-base-readiness give the data for which charts just work.

### The gap, in three items

1. **One composed path.** Today the path is setup, then an npm verify, then a
   harness lane for apply, then cub-scout. A future high-level installer wrapper
   could compose resolve, pull, verify, collect facts, apply, and record. Every
   stage exists; nothing composes them yet. Plumbing, not invention.
2. **Name resolution without a clone.** `--pull packages/bitnami/redis/25.5.3` assumes the user knows the vendor/chart/version triple and has cloned a five-thousand-file repo, which breaks the as-fast-as-helm bar. The fix is a static, signed catalog index ("redis" resolves to the latest promoted bitnami/redis package), served from GitHub Pages or OCI, with packages pulled as signed OCI artifacts. The index must be correct and current; its date is printed in the transcript (section 7), which makes staleness user-visible and puts the right pressure on the refresh pipeline.
3. **In-cluster install record.** Receipts currently land in runs/ directories on local disk, so list, upgrade, rollback, and uninstall have no durable anchor. The Helm-style answer: write the receipt and object inventory as a ConfigMap or Secret per install. The cluster is the server. Day-2 verbs read that record; local cub-scout supplies the diff and observe halves.

## 4. The design

### Future Serverless Installer Flow

1. **Resolve.** "redis" resolves via the static signed catalog index to a pinned package (vendor, chart, version, digest). No clone, no login.
2. **Pull and verify.** Fetch the signed OCI artifact; cosign-verify locally against the published catalog key. Trust requires no server by design; proofs must be checkable without trusting the store.
3. **Pick the base.** `installer.yaml` already declares named bases with a default. The current command uses `--base default`; a future wrapper could choose the default when no base is specified. No values file, no render: a menu of pre-rendered, pre-scanned bases.
4. **Collect facts.** Run the package's collector against the current kubeconfig context. Resolve declared target facts; refuse loudly and early if a required fact (an existing Secret, a StorageClass) is missing. Helm fails late and silently; this fails early and loudly, or passes with prerequisites proven present.
5. **Apply and record.** Server-side apply the object set in CRD-before-CR order. Write the receipt (inventory, artifact digest, variant, facts used) into the cluster. Note: direct apply dodges the GitOps secret-delivery hole (issue 113) entirely, because that hole is specific to the upload path; serverless mode ships the Secret because it applies it itself.
6. **Observe.** Run the local cub-scout pass and report the observation receipt: not "the apply returned zero" but "the workloads are up and answering."
7. **Operate.** Day-2 commands read in-cluster receipts. Inventory diff compares live state against the recorded inventory. Upgrade preview pulls the next pinned revision and shows the object-level diff before touching anything. Rollback re-applies the previous inventory. Uninstall deletes by inventory.

### Resolving shapes (a), (b), (c)

(a) is the product. (b) demotes to an optional future flag that commits the artifact reference and receipt to a repo for teams wanting shared history, and the same artifact hands to Argo or Flux unchanged; making git the default would break the speed bar persona 1 lives or dies on. (c) shrinks to its anonymous-read core: the static index needs no server at all; an anonymous ConfigHub catalog UI is a marketing surface, not a dependency.

## 5. Which charts just work

No hand-picked demo set. The scan corpus already computes the boundary: vanilla charts (no hooks, no webhooks, no required facts) flow through untouched; standard charts work with a declared fact or two; complex charts (hooks, webhook cert bootstrap, CRD upgrade) are refused honestly in serverless mode, with the chart's residue list surfaced at install time: "this chart needs lifecycle steps; install with --allow-hooks runs them best-effort without proof, or use the server." Refusals follow the existing watchlist-or-named-rule discipline. "A wide range of default charts just work" is true by construction for the vanilla and standard tiers, and the boundary is disclosed rather than discovered.

## 6. What people see (the value beyond "it worked like Helm")

"It worked like Helm" is the bar, not the value. The value is three visible moments around the install, each one a thing Helm users already do today with pain.

**See before.** The exact objects that will deploy and the effective values, with no render and no values-file spelunking. A menu of named variants instead of reverse-engineering values.yaml. The pain report: what the scan flagged. Required facts checked up front, before apply, instead of a CrashLoopBackOff twenty minutes after.

**Prove during.** The artifact is signed and verified on pull: what is being applied is exactly what the catalog rendered from exactly that chart at exactly that version, checked locally. The install writes a receipt recording what was applied, which variant, which facts, which digest.

**Check after.** Where this beats Helm most visibly. Object-level drift can be checked from the recorded inventory, where Helm needs a plugin and two renders. Upgrade preview can show the exact object diff before applying, the view Helm cannot produce. Rollback can return to the precise prior inventory. The observation receipt proves the thing is alive.

The demo line: Helm tells you "deployed." This tells you deployed, here is what it was, here is proof it came from the chart it claims, here is proof it landed, and here is proof it is alive, and next month you can ask "has anything drifted" and get an answer in one command. The value is least visible on day 1 and most visible at the first moment of doubt, so the upgrade-preview and drift-check moments belong in the first five minutes of the tutorial.

One more audience: the receipts are machine-readable, so an AI agent that ran the install can hand its operator the proof, or a second agent can check it. The first taste of verification-as-query, delivered serverless.

## 7. The entry page

Design insight: the best entry page for a CLI is a faithful transcript of a great run. The terminal output is the documentation, which means the page and the CLI output are designed together, and most of the docs work is CLI output design. Draft:

---

# Install any Helm chart. Keep the proof.

```
cub installer setup --pull oci://example/catalog/bitnami/redis:25.5.3 --base default --namespace redis --non-interactive
```

Works like `helm install`. Same speed, same result, one difference: you can see everything before it happens, and prove everything after.

## What you'll see

```
$ cub installer setup --pull oci://example/catalog/bitnami/redis:25.5.3 --base default --namespace redis --non-interactive

  resolved   bitnami/redis 25.5.3 (catalog: 2026-06-09, signed)
  base       default        (also: ha, no-crds, reuse-existing-secret)
  preview    14 objects -> namespace redis (run with --show-objects to inspect)
  checks     no hooks, no CRDs, 0 warnings from scan
  facts      needs StorageClass: found "standard"
  verify     signature OK (cosign, catalog key)

  apply? [y/N] y

  applied    14/14 objects
  recorded   receipt -> cluster
  observed   redis answers PING -> PONG

  done in 41s
```

Every line above is a question Helm can't answer. What exactly will deploy, before it deploys. Whether the cluster has what the chart needs, before it fails. Whether this is really the chart it claims to be. Whether it actually landed and actually runs.

## The first moment of doubt

A month from now, something looks off. Ask:

```
inventory diff        # what changed vs. what I installed, object by object
upgrade preview       # shows the exact diff of the new version before applying
rollback by receipt   # returns to the exact prior state, not a guess
```

No second render, no plugin, no archaeology. The install remembered itself.

## What this is, honestly

Every chart here was rendered once from the real chart, compared against Helm's own output, scanned, and signed. You can re-verify all of it yourself, locally, without trusting us. Some charts need decisions we won't make for you (CRD upgrades, secrets you must supply); each chart's page lists exactly what those are. What we refuse to claim is written down [link: what-we-refuse-to-claim].

## When you have more than one

The second time you install the same chart, you'll have two copies that nothing connects. That's where this stops and ConfigHub starts: one base, many variants, a change made once propagating everywhere it should and nowhere it shouldn't, with the blast radius shown before you commit and proof of arrival after. Everything you've installed here imports in one command. [link: see it on your own installs]

---

Notes on the draft. The hero is the transcript, and each output line maps one-to-one to a catalogued pain point, so the page teaches the value proposition without arguing it. "The first moment of doubt" is deliberately the second section: that is where this beats Helm most, and a day-1 reader needs to be shown their day-30 self. The honesty block is short but load-bearing: in a catalog whose brand is proof, the credibility section is a feature. The closing paragraph states the second-install wall in advance, so when the CLI later says it, it reads as a reminder rather than an ad. Product implication: this page commits to the installer path as the command surface; any later short wrapper must preserve the same output shape. The catalog date in line one carries the up-to-date requirement; index staleness becomes user-visible.

## 8. The upsell

Principle: a strong upsell sells the next recurring feared event, and fires at the exact moment the user feels the wall. Three mechanisms.

**Put the wall in the product, not the pricing page.** The serverless tool detects its own limits and says so when they bind. The sharpest instance is the second install: the moment someone installs the same base into a second namespace or cluster, the tool knows (the in-cluster records make it knowable) and says: "You now have 2 unrelated copies of bitnami/redis. Nothing connects them. Sign in to make them variants of one base: change the base once, both update, overrides protected." Same pattern at first upgrade ("this chart moved from 25.5.3 to 26.0.0 upstream; signed-in users got the diff, the override check, and one-click propagation across environments") and at first drift detection ("drift found; locally you can revert it; signed in you'd know who made it and whether it was authorized").

**Sell the event, not the feature.** Nobody wants "fleet management." They dread a critical CVE, a chart upgrade that broke prod last time, an auditor asking who changed a value. So the upsell is three questions with dates attached: When the next critical CVE lands, can you answer in one minute where you run that image, what to change, and what breaks if you change it? When the next chart release ships, can you see exactly what it would change in every environment before touching any of them? When someone asks who changed this value and whether they were allowed to, do you have an answer or a shrug? Serverless answers each for one install. The graph answers for everything you run.

**Make the loss visible.** Every serverless install already produces proofs: provenance, receipts, signatures. Unsigned-in, those proofs sit on a laptop and in scattered ConfigMaps, unqueryable and decaying. The upsell line is not "get more features" but "stop throwing away what you're already producing." `cub login && cub import` lifts every existing install into the graph in one step, nothing re-rendered. The first thing the user sees post-import is the high-fanout demo run on their own estate: change one base value, watch the blast radius compute across their actual installs, see the reached-everywhere ledger. The demo machinery exists (data/high-fanout-demo). The import-to-wow path must land within five minutes of login.

Receipt footer line, on every serverless receipt: "This receipt proves one install. Sign in to prove all of them, and to be asked before a change, not after."

Discipline that keeps the wedge healthy: never gate the local basics (diff, rollback, observe-once) to force the upgrade. The upsell argument is "the graph does what local provably cannot," and it stays credible only if nothing local was artificially limited to make it.

## 9. What changes when you sign in

The user keeps using the installer path. The flags and transcript shape should stay as close as possible before and after login. What changes is not the base command model but three things underneath it.

**Where desired state lives.** Serverless, the only durable record is the in-cluster receipt. Signed in, the install also creates Units in a Space: the desired state enters the graph. Path 2 of try-now (the explicit upload) happens implicitly as part of install. The in-cluster record is still written, so the cluster-side truth never disappears; the graph is additive.

**Who is accountable.** Serverless, the apply is anonymous and local. Signed in, every value written carries the user's identity and authority: change provenance starts accruing from the first install. The second install of the same chart is no longer an unrelated copy; it lands as a variant related to the first, with the base-to-variant edges live in the graph.

**What runs around the apply.** Serverless, nothing: resolve, verify, apply. Signed in, the org's gates and policies run before apply (and can block), the receipt goes to the queryable ledger as well as the cluster, observation becomes continuous instead of on-demand, and the apply can flow through the org's delivery path (worker, or hand-off to the org's Argo/Flux) instead of a direct kubectl-style apply.

Resolution also gains a layer: signed in, "redis" resolves first against the org's catalog (pinned versions, approved variants, org defaults) before falling back to the public index, and the transcript says so: `resolved bitnami/redis 25.5.3 (org pin; public catalog has 26.0.0)`. Governance becomes visible in line one rather than discovered at gate time.

Concretely, the signed-in transcript is the serverless transcript with a few added lines and none removed:

```
$ cub installer setup --pull oci://example/catalog/bitnami/redis:25.5.3 --base default --namespace redis --non-interactive

  resolved   bitnami/redis 25.5.3 (org pin; public catalog has 26.0.0)
  base       default        (org-approved: default, ha)
  preview    14 objects -> namespace redis
  facts      needs StorageClass: found "standard"
  verify     signature OK (cosign, catalog key)
  gates      org policy: 2 checks passed, 0 blocked

  apply? [y/N] y

  applied    14/14 objects (via space: payments-dev)
  recorded   receipt -> cluster + ledger  (unit: redis, space: payments-dev)
  related    1 other install of bitnami/redis found -> linked as variant
  observed   redis answers PING -> PONG  (continuous observation: on)

  done in 47s
```

Design rules that make this work:

- One command family, two substrates. The installer inspects the auth context: no context, local mode; authenticated context, graph mode. `--local` would force serverless behavior even when logged in, for the user who wants it.
- Same receipt schema in both modes. This is what makes `cub import` lossless and the upsell promise ("keep everything, add the graph") literally true. The serverless receipts are graph receipts that haven't been shipped yet.
- The transcript only ever gains lines at login. If the signed-in flow requires relearning the command or changes the meaning of any existing line, the continuity promise is broken and the wedge stops feeding the funnel.

## 10. Open items and honest gaps

- **Catalog freshness is a correctness requirement, not an ops nicety.** Name resolution from the package and recipe catalog means the index must be regenerated and signed on every promotion, and the printed catalog date makes staleness visible. The refresh pipeline (latest-top20-refresh and its promotion work orders) is the dependency.
- **Upgrade across install-vs-upgrade-divergent charts.** The capture exists (both renders recorded); the apply logic for choosing the upgrade render is not yet a serverless verb.
- **In-cluster record spec.** Namespace, naming, size limits, and pruning need a short spec so the record does not reinvent Helm's three-way-merge wedging.
- **Multi-writer is out of scope by design.** Serverless mode is single operator, one cluster, the regime where graph-less is safe. The moment of concurrency is a wall message, not a feature request.
- **The output format is product surface.** The transcript in sections 7 and 9 is the contract; spec it alongside the entry page, not after.
- **--allow-hooks semantics.** Best-effort hook execution without lifecycle proof must be visibly marked degraded in the receipt, per the refuse-to-claim discipline.
