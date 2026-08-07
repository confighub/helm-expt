# Brief: Pilot variants for AICR platform shapes

Status: proposal, 2026-08-07. Written after the three AICR entries and their
proof ladders landed, so it starts from what the receipts already show rather
than from a blank page.

## The question this answers

The Pilot model generates variants on demand and lets parity decide whether
they exist: an agent authors intent, a deterministic gate re-renders and
compares, and a variant that fails the comparison is refused with a receipt
rather than shipped. That model was prototyped on a single chart. AICR
entries are platform shapes, so the question is what parity means when the
unit of change is a whole platform rather than one chart, and whether the
same anti-hallucination guarantee survives the move.

## What the entries already prove about variance

Three reviewed changes exist across the entries, and they are three different
shapes of change:

1. The training entry changed one Grafana credential in one Application. The
   blast radius was one document, and correctness meant that document's value.
2. The CPU starter changed one storage class in one Application, and the
   change was later synced on a cluster where the Prometheus claim bound with
   the reviewed class. Correctness meant a cluster accepted it.
3. The inference entry renamed one shared claim across sixteen model shapes
   while ten serving runtimes stayed untouched. Correctness meant the blast
   radius, not the value.

That third case is the interesting one for Pilot. Its risk is not a wrong
value; it is a change that lands in too few or too many places. A single-chart
parity gate cannot see that risk, because it compares one render against one
render.

## What parity has to mean here

For a platform shape, parity should be checked at three levels, and a variant
should exist only when all three hold.

1. **Document-set parity.** The variant renders exactly the documents the base
   renders, with the same identities. Additions and deletions are the loudest
   possible failure and must be refused unless the intent explicitly asked for
   them.
2. **Blast-radius parity.** The set of documents the change touches equals the
   set the intent declared. The inference rename declared sixteen shapes and
   touched sixteen shapes. An intent that says "rename the cache claim" and
   touches a serving runtime is wrong even if every value it wrote is
   plausible.
3. **Field-level parity.** Inside each touched document, only the declared
   fields differ. The existing per-chart parity machinery already does this
   and carries over unchanged.

The middle level is the new one, and it is the level the entries' receipts
already record. The inference receipt lists `changedDocuments` and asserts
`servingRuntimesUnchanged`; that is a hand-written instance of what the gate
should compute generically.

## The switch-effect map for a platform shape

Pilot's per-chart work starts from a switch-effect map that records what each
value change does to the render. The platform equivalent is a control-point
map per entry, and the entries already name their control points in prose:

- The training entry has exactly four open choices, named on its page: the
  storage class, the accelerated-node selector, the workload selector, and
  the source the delivery controller reads.
- The CPU starter inherits those and adds the recorded cloud residue as its
  first reviewed override.
- The inference entry's control points are the shared cache claim name, the
  per-shape GPU counts, and the telemetry setting the product terms document.

The first build increment is to turn those prose lists into one committed
control-point record per entry, with each control point naming the documents
it is expected to touch. That record is what blast-radius parity compares
against, and writing it costs nothing beyond reading the entries we already
retain.

## Where the boundary stays

Two refusals matter more here than in the chart case, and both follow the
license read and the config-plane boundary.

- A generated variant may never introduce a new gated artifact reference. The
  inference entry's compiler already refuses embedded credentials; the variant
  gate should equally refuse an intent that invents an `nvcr.io` reference the
  retained tree does not contain.
- A generated variant may never claim workload behavior. Parity is a
  config-plane comparison, and the receipt should say so in the same words the
  entry receipts already use.

## First increment

Write the control-point record for the CPU starter, because it is the entry
with the complete ladder, and implement blast-radius parity as a checker over
that record using the existing starter proofs as fixtures. The gp3 override
and the inference rename become the two positive fixtures, and a deliberately
over-broad rename becomes the refusal fixture. Nothing in that increment needs
a cluster, a GPU, or a live organization.
