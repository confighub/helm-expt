# Put the value ladder on the site's spine

Status, 2026-09-01: phase 1 landed earlier (the ladder table lives on the deployment
page and the ConfigHub page leads with upload, release, promote, and the chaining
story). Phase 2's homepage work landed with the six starting questions and the
hero ladder terminal; the nav decision stays parked with the maintainer. Phase 3
moved past this brief's assumption: the composition rung is no longer only a
report, because the workshop plugin ships `cub stack certify` and `cub stack
sandbox` as an installable prototype, while the in-product gate remains proposed.
The deployment and platform pages now say exactly that.

Planning brief. A three-lens review of the site (an AI-cloud / GPU-platform operator, a
GitOps platform architect, and a product-accuracy pass) converged on one structural
finding: the site jumps from **check** to **promote** and skips the middle of the value
ladder. `upload` and `release` have no first-class page, the composition (`stack`) rung
is shown as a report rather than a step, and there is no path that reads as an
inference-shaped spine. The `cub` vocabulary is now settled
([cub-noun-vocabulary.md](./cub-noun-vocabulary.md)), so the middle can be named.

## The ladder

```
free      check · deploy
account   upload · release · promote
paid      govern
stack     certify · sandbox   (the composition rung)
```

`upload` = `cub variant upload`, `release` = `cub release publish`, `promote` =
`cub variant promote`. The site jumps check → promote and never shows `upload` (into
ConfigHub, where public config chains into private) or `release` (go live, the cluster
pulls) as steps.

## Honesty guardrails

These keep the site's best asset, which the same review named the crown jewel: every
claim receipt-backed, nothing overclaimed.

1. **Only shipped verbs become first-class spine steps.** `check`, `deploy`, `upload`,
   `release`, `promote`, `govern` are real commands. `cub stack` and the composition
   `certify` gate are proposals, so the composition rung is presented through what is
   proven (the Kubara receipts and the certified-bundle evidence), with the certify gate
   marked as roadmap. Do not render a gate the product does not have.
2. **Helm-first stays the front door.** The ladder is the depth behind it, not a new
   pitch. A Helm-grounded surface is the credibility a cautious operator trusts.
3. **Do not over-elevate the frontier.** The AI/GPU path is answered with evidence, not
   volume. Prominence does not fix "unproven"; proof does.
4. **Do not add to the link farm.** The ladder organizes existing links; it does not pile
   on more. The homepage is already dense.

## Phase 1 — the spine anchor

One PR, highest value, entirely from shipped verbs.

- **One ladder diagram.** A single picture of `check · deploy → upload · release · promote
  → govern`, with the free/account/paid bands and the real `cub` command under each verb.
  The one-glance view of the whole CLI the review asked for. It lands on the deployment
  page and is linked from the homepage.
- **Reframe the ConfigHub page as the account spine.** Today it argues "keep a result,"
  which is custody-lite. Make it `upload → release → promote`, and lead with the chaining
  story: `upload` brings a public base into your private org, links inject your private
  values, protection keeps your choices while upstream fixes still flow down. That is the
  value a plain registry cannot offer, and it fixes two findings at once (the missing
  middle and the undersold moat).

## Phase 2 — align the frame

- **Nav that reflects the ladder.** Give the account spine a nav home and fix the
  Deployment / Deploy label blur. Minimal, no bloat.
- **Homepage doors acknowledge the middle.** Between "is it right?" (check) and "can I
  promote it?" (promote) sits "put it in ConfigHub and go live" (upload, release). A light
  touch, not a new section.
- **Wire the certified-bundle receipts into the platform page.** The one artifact that
  looks like composition evidence is linked once from deep in the catalog and never from
  the platform page.

## Phase 3 — the composition rung, honestly

The parts that are site work now, with the product builds marked as roadmap.

- **Present the composition step through proven evidence.** The Kubara path and the
  certified-bundle receipts are the stack rung today; show them as the rung, with the
  composition `certify` gate marked proposed (it is a report, not a gate — see
  [composition-certification.md](./composition-certification.md)).
- **Surface the inference-shaped path honestly.** The eks-inference bundles, the AICR
  proofs, and the one real inference request already exist; present them as the AI/GPU
  reading of the same ladder, evidence-forward, without claiming a GPU runtime or a
  certify gate that is not built.
- **Product gaps stay filed, not faked.** The disruptive-change classifier (#1660) and
  the composition-certify gate are builds; the site names them as roadmap and does not
  render them as shipped.

## Sequencing

Phase 1 closes the structural gap and tells the chaining story. Phase 2 aligns the frame
around it. Phase 3 gives the stack and inference rungs an honest home. Each phase is a
site change from shipped material; nothing waits on a product build except the parts
explicitly marked roadmap.
