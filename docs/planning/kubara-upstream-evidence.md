# Kubara upstream evidence

The maintained Kubara live-proof home is
[confighub/kubara-confighub](https://github.com/confighub/kubara-confighub).
The Catalog retains its own packages, listings and stack composition data.
The [snapshot lock](../../data/kubara-upstream-evidence/lock.json) records the
exact upstream commit, the seventeen receipt/data files the Kubara page and its
readers use, and the identities of the two live executors those receipts cite.
Snapshot files keep their existing paths and bytes.

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
Git blob identities as well as local SHA-256 digests, for the snapshot files and
for the pinned executors. It also reads that commit's `package.json` and
`.github/workflows/verify.yml`, requires the `offline-verify` job to run the four
receipt and matrix gates named in the table below under their exact commands,
and requires that job's check run at the commit to have passed. Missing files,
changed bytes, symlinks in the upstream tree, truncated responses, a missing
gate and a failed or absent upstream run all fail closed.
The dedicated CI workflow runs this source check when any pinned input changes.
The ordinary verify chain checks local integrity without a network dependency.
An offline check alone trusts the reviewed lock; it is not a fresh upstream check.

After a reviewed upstream re-proof, update all files together:

```sh
node scripts/sync-kubara-upstream-evidence.mjs --pin <full-upstream-commit>
```

This downloads data only. The executors are downloaded only to hash them and
are never written or run here. No live lane runs. All downloaded files are
validated against the source tree, and the upstream gates are checked, before
writes begin. Review the resulting evidence diff, regenerate dependent
Catalog/site surfaces with the pinned site timestamp, and force-add any changed
receipts under `runs/`. Run the source check and normal repository gates before
opening a pull request.

## Proof limits

The pinned proof is the Kubara v0.13 four-cluster `hx-app-*` reference
organization, recorded in August 2026. By the owner's decision of 2026-09-30
that organization is retired and frozen: it is not rerun, its receipts predate
the cub 0.4 field renames, and the proof is accepted and labelled historical.
[`proof-status.yaml`](../../data/kubara-upstream-evidence/proof-status.yaml)
records that decision, and the site labels every accepted pill from it as
"retained (historical)". The current live proof is the
[kind lab](https://github.com/confighub/kubara-confighub/tree/86884faae853b12e552354d0b7cb898bc8df59fa/examples/kind-lab)
in kubara-confighub v0.2.3, at the pinned commit: its
[recorded run](https://github.com/confighub/kubara-confighub/blob/86884faae853b12e552354d0b7cb898bc8df59fa/examples/kind-lab/run-2026-09-30.log),
[recorded hand-back](https://github.com/confighub/kubara-confighub/blob/86884faae853b12e552354d0b7cb898bc8df59fa/examples/kind-lab/handback-2026-09-30.log)
and [run on Kubara v0.16](https://github.com/confighub/kubara-confighub/blob/86884faae853b12e552354d0b7cb898bc8df59fa/examples/kind-lab/run-v0.16-2026-09-30.log).
Those logs were recorded with `cub kubara` built from the branches v0.2.3
released, not with the released binary. `proof-status.yaml` names the commit
and the logs, and the reader test requires that commit to be the pin.

The pin is `86884faae853b12e552354d0b7cb898bc8df59fa`, kubara-confighub v0.2.3. It moved there on 2026-09-30 from
`a5bbe1fd20838d162e53cd8802293420c7ae53b5`; every snapshot file and both
executor identities are byte-identical at the two commits, so only the commit
changed. Integrity means these are the upstream files; it does not establish
freshness or a new live run of the four-cluster proof. Existing receipt and
site status rules still apply. No new live receipt was created by the pin or by
the cutover below.

## Cutover: the live proof leaves helm-expt

The first step (#1995) established the provenance gate while the local executor
copies and three known-red gates stayed. The cutover (#1759, the
[Option A handoff](https://github.com/confighub/helm-expt/issues/1956#issuecomment-5844165038))
is now done:

- Deleted from helm-expt: `reconcile-kubara-mini-idp.mjs`,
  `audit-kubara-mini-idp-orphans.mjs`, `import-kubara-git-revision.mjs`,
  `run-kubara-app-release.mjs`, the matrix re-derivation
  `generate-kubara-platform-matrix.mjs`, the release verifier and
  selected-organization workflow compiler that only drove those executors
  (`verify-kubara-release-acceptance.mjs`,
  `compile-kubara-selected-org-workflow.mjs`), and the helpers only the
  executors used (`scripts/lib/kubara-protected-namespace.mjs`,
  `scripts/lib/kubara-kind-traefik.mjs`,
  `scripts/lib/mini-idp-workflow-approval.mjs`). Their npm lanes and verify
  steps went with them. kubara-confighub carries all of them under the same
  paths and lane names.
- The known-red register is empty.
- The site's evidence reader, `scripts/lib/kubara-site-live-evidence.mjs`,
  stays here. It no longer runs any executor: it reads the pinned receipts and
  binds them to the pinned executor identities in the lock.

### Where each guarantee of the retired gates lives

| Retired gate | Guarantee | Where it is enforced now |
| --- | --- | --- |
| `generate-kubara-platform-matrix.mjs --self-test` | The committed matrix passes the live publication gate: the mini-IDP overlay is accepted as current live, all 36 cells parse, every mini-IDP source digest verified, the faithful receipt passes, and the orphan receipt is accepted as scoped-residue clean. | Here: the site reader's matrix gate checks every one of those fields on the pinned `matrix.json`, and [tests/kubara-site-live-evidence.test.mjs](../../tests/kubara-site-live-evidence.test.mjs) (in `npm run verify`) proves it rejects a rejected, partial, stale-faithful or unclean overlay. The upstream generator's own synthetic self-test is not in kubara-confighub CI; its real-data half is repeated there by `--verify --all` below. |
| `generate-kubara-platform-matrix.mjs --verify --all` | Every matrix output, current and historical, is exactly what the generator re-derives from the committed receipts, and the current matrix is publishable as live (including the orphan audit accepted through the auditor's `--receipt-verify`). | kubara-confighub: `npm run kubara-platform-matrix:verify` in the `offline-verify` job of `.github/workflows/verify.yml`, which passed at the pin. Here: all nine `data/kubara-platform-matrix/` files are pinned byte for byte in the lock (`--verify` in `npm run verify`), and `--verify-upstream` checks the upstream job ran that command and passed. |
| `reconcile-kubara-mini-idp.mjs --receipt-verify` | The mini-IDP receipt is structurally exact and its reconcile runs share the execution fingerprint of the reconciler that verifies it. | kubara-confighub: `npm run kubara-mini-idp:receipt-verify` in the same job, passed at the pin. Here: the site reader counts the receipt as verified only while it is the pinned bytes, and requires the receipt's recorded reconciler digest to equal the pinned upstream reconciler; the orphan audit must name the pinned upstream auditor and reconciler and the accepted plan digest. The reader test covers each refusal. |

The orphan and performance receipts keep their other checks here unchanged:
`verify-kubara-mini-idp-performance.mjs --receipt-verify` still runs in
`npm run verify`, and upstream CI runs its own copy together with
`kubara-mini-idp:orphan-audit:receipt-verify`.

### What changed for the site

The reader previously compared the orphan receipt with helm-expt's own copies
of the auditor and reconciler. Those copies had drifted from the ones that
produced the receipts, so the page's orphan gate, and therefore its complete
chain, reported the receipts as stale. Bound to the pinned kubara-confighub
executors that produced and verified them, the chain is complete and
consistent. Following the owner's decision, the Kubara pages say exactly that
and label it frozen historical evidence, not current or live: accepted pills
read "retained (historical)", the page state is `historical`, and the pages
point to the kind lab as the current live proof. Unaccepted or inconsistent
evidence still shows its warning pill. The pill rule and the proof-status
checks are in `scripts/lib/kubara-site-live-evidence.mjs` and are covered by
[tests/kubara-site-live-evidence.test.mjs](../../tests/kubara-site-live-evidence.test.mjs).

### Not transferred

- `prepare-kubara-git-handoff.mjs` stays here as an offline generator. Its
  self-test no longer compiles the prepared subtree through the importer; that
  round trip belongs to kubara-confighub, whose CI runs the importer self-test
  but not this preparer's.
- `data/kubara-adoption-screenshots/` and the pinned
  `data/kubara-release-acceptance/contract.yaml` were only read by the deleted
  release verifier. They remain here unchanged and are identical to the pinned
  commit; the contract's integrity is locked, the screenshot contract's is not.
- The receipts predate the ChangeWorkflow/ChangeOrder attestation migration and
  the cub 0.4 field renames. The four-cluster organization is retired, so they
  are not refreshed; they stay pinned as historical evidence.
