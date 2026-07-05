# Pilot demo-proof plan

**UNOFFICIAL/EXPERIMENTAL.** The goal, in one sentence: prove with receipts
that Pilot gives better demos than a frontier model on its own. Pilot here
means the assembled system: a Claude-class model plus the knowledge (catalog,
receipts, doctrine, findings), the skills (verb discipline, change
descriptions, quota protocols), the scenarios (live-verified runbooks), and
the deterministic rails (parity gates, verifiers, apply gates). "Claude on
its own" means the same class of model with plain helm and no substrate.

Three workstreams. Each produces demo material and evidence; none needs new
org quota or a cluster.

## 1. The head-to-head benchmark lane (the proof instrument)

Same tasks, two arms, scored on outcomes. Without this lane the claim is an
argument; with it the claim is a table.

### Arms

- **Arm A, bare:** a fresh agent session with `helm`, `kubectl`, and a kind
  cluster. No helm-expt checkout, no skills, no catalog, no receipts.
- **Arm B, Pilot:** the same model driving the helm-expt substrate: catalog
  packages, cub, skills, verifiers, parity gates.

The honest-run protocol matters more than the tasks. Arm A must not be
sabotaged: it gets a clean environment, the chart's own docs, and the same
task wording. Arm B must not be coached: the task wording is identical, and
Pilot finds its own way through the substrate. Both arms run the same model
version. Each run's full transcript is kept as the receipt.

### Task set (first cut, one per failure class we have receipts for)

| Task | The trap it contains | Bare-arm failure mode we expect |
| --- | --- | --- |
| Install redis, change replicas, upgrade the chart, keep the change | Helm wipes local edits on upgrade | Change lost silently, or manual values-file surgery |
| Install a hook-carrying chart and prove the hook ran | Hooks are invisible in render output | Asserts success without observing the Job |
| Install kube-prometheus-stack no-crds on a bare cluster | CRD ordering | CR apply fails or is applied blind |
| Repoint every image in a three-env fleet to a mirror, prove it landed | No fleet visibility, no record | Grep-and-hope, no proof, one env missed |
| "Give me a standalone redis with metrics" | The 2,392-line values file | Hand-written values or hallucinated YAML, no parity proof |
| A same-field local edit exists; pull an upstream release | Silent merge behavior | Divergence not detected (we only found it via receipts) |

### Scoring (per task, both arms)

- **Correct:** the end state is what the task asked for, verified by
  inspection, not by the agent's claim.
- **Silent failures:** count of things wrong that the arm did not report.
- **Receipts:** what evidence exists afterward that a third party could check.
- **Reversibility:** can the change be undone from the record alone.
- **Time and turns:** secondary, reported not scored.

### Status

Designed here; not yet run. The fuzz lanes (`run-bad-decisions-fuzz`,
cub-installer fuzz) are the harness precedent. The bare arm needs a clean
sandbox definition so it is honestly bare; that is the main build item.

## 2. The Pilot wiring gap (make the variant demo honestly Pilot-driven)

`scripts/pilot-generate-variant.mjs` proved the mechanism with the intent
frozen as a constant. For a demo to say "Pilot did this," the intent-to-
switches step must come from outside at run time:

- The script accepts `--intent "<words>" --switches <file>` where the switches
  file is produced by whatever agent ran the mapping (the Pilot checkout at
  `$HOME/code/confighub-ai-demo`, or any agent). The frozen constant becomes
  the default fixture so the script still runs standalone and in CI.
- The receipt records who mapped the intent (`mappedBy`), so a demo receipt
  says "Pilot chose these switches; the gate proved the render."
- Status: shipped alongside this plan (`--intent/--switches/--mapped-by`).

## 3. Switch-effect maps across the top charts (demo breadth)

The redis map generalizes: the toggles are auto-extracted from
`helm show values` (top-level `<key>.enabled` plus the architecture axis when
present), rendered flipped, classified by object-set diff. One command per
chart, one committed map per chart. Status: shipped alongside this plan
(`npm run pilot:switch-map -- --chart <name>`; registry starts with redis,
postgresql, rabbitmq, nginx, grafana). Maps regenerate on chart bumps.

## What a "better demo" looks like, concretely

The demo Pilot can give that bare Claude cannot, using only shipped pieces:

1. "Show me what `sentinel.enabled` actually does" — answered in seconds from
   the committed map, with the exact object diff, for any mapped chart.
2. "Give me a standalone redis with metrics" — variant generated from words,
   parity-gated, receipted, landed as governed config.
3. "Upgrade it without losing my change" — the ladder story, recorded as
   revisions.
4. "Prove the hook ran" — the three-consumer OCI receipt.
5. "Move every environment off this registry" — the fleet migration
   walkthrough, run live, with the laggard visible.

Each of these is a receipt-backed set piece; the benchmark lane turns the
contrast with the bare arm into numbers.
## Task 1 status: RUN (2026-07-05)

Executed live on kind cluster hx-bench-1, both arms, torn down after. Receipt:
[task1-upgrade-keeps-edit.md](../../data/pilot-benchmark/task1-upgrade-keeps-edit.md).
Honest result: both arms can keep the change; plain helm silently reverts it on
one forgotten upgrade flag, the substrate keeps it by merge and records why.
