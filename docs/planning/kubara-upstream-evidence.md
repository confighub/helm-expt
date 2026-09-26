# Kubara upstream evidence

The maintained Kubara live-proof home is
[confighub/kubara-confighub](https://github.com/confighub/kubara-confighub).
The Catalog retains its own packages, listings and stack composition data.
The [snapshot lock](../../data/kubara-upstream-evidence/lock.json) records the
exact upstream commit and the nine receipt/data files used by the Kubara page.
Their existing paths and bytes are preserved during this first cutover step.

## Verify or refresh the snapshot

Offline integrity check against the reviewed lock:

```sh
node scripts/sync-kubara-upstream-evidence.mjs --verify
```

Check that the files actually belong to the named upstream commit:

```sh
node scripts/sync-kubara-upstream-evidence.mjs --verify-upstream
```

The second check fetches the GitHub tree for the immutable commit and compares
Git blob identities as well as local SHA-256 digests. Missing files, changed
bytes, symlinks in the upstream tree and truncated responses fail closed.
The dedicated CI workflow runs this source check when any pinned input changes.
The ordinary verify chain checks local integrity without a network dependency.
An offline check alone trusts the reviewed lock; it is not a fresh upstream check.

After a reviewed upstream re-proof, update all nine files together:

```sh
node scripts/sync-kubara-upstream-evidence.mjs --pin <full-upstream-commit>
```

This downloads data only. It never executes upstream code or runs a live lane.
All downloaded files are validated against the source tree before writes begin.
Review the resulting evidence diff, regenerate dependent Catalog/site surfaces
with the pinned site timestamp, and force-add any changed receipts under `runs/`.
Run the source check and normal repository gates before opening a pull request.

## Proof limits and cutover state

The initial pin is `a5bbe1fd20838d162e53cd8802293420c7ae53b5`. All nine files
were byte-identical to the existing Catalog copies when pinned. Integrity means
these are the upstream files; it does not establish freshness, a successful
current run, or a passing live verdict. Existing receipt and site status rules
still apply. No new live receipt was created.

This first step establishes the provenance gate. Local live executors and the
three known-red entries remain until their dependent readers and command paths
are transferred together. Removing a red gate without transferring its contract
would hide the problem. Track that remaining cutover in
[#1759](https://github.com/confighub/helm-expt/issues/1759) and the
[Option A handoff](https://github.com/confighub/helm-expt/issues/1956#issuecomment-5844165038).
The website stream will expose the source pin on the page after its reader update.
