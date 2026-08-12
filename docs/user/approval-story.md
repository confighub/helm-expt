# One change, dev to production, with the records to prove it

Teams ask what an approval actually looks like here. This is the recorded
cycle, from the Kubara fleet work, with the receipts and screens that exist
today and one honest limit named at the end.

## The cycle

1. A value changes in a development variant. The change is a diff against a
   recorded revision, not an edit to a template.
2. The change is previewed: the exact objects that would ship, before
   anything ships.
3. Production Spaces carry an approval gate. The approval binds to the exact
   observed revision head, so approving yesterday's revision authorizes
   nothing about today's. This mechanism is proven: hash-stable,
   head-bound, blocked-then-allowed, in the change-review receipt.
4. Promotion moves the exact reviewed revision downstream. No rebuild from a
   tag, no re-render between review and delivery.
5. Rollback restores one production target to an exact earlier recorded
   release while its twin keeps the newer one. The
   [upgrade and rollback proof](./day2-upgrade-rollback.md) shows it on redis;
   the Kubara fleet pages show it across four clusters.

The [GUI tour](../demo/kubara/gui-tour.md) walks the screens with receipts
behind each frame.

## The honest limit

Our approval receipt does not yet record the approver's identity
(`approverIdentityRecordedInReceipt: false` in the committed record), and the
recorded apply was a dry run. The binding mechanism is proven; the named-person
production claim is not, and this page will say so until the receipt exists.
That gap is on the build list, not hidden under this page.
