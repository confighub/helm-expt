# Verification For Agents

**UNOFFICIAL/EXPERIMENTAL**

The npm scripts in this repo are proof checks. They are not the product path a
Helm user follows. Use this page to choose the smallest proof command that
answers the claim.

## Short Rules

- Use `cub`, `helm`, `kubectl`, Argo, or Flux when doing product work.
- Use `npm run ...` when checking committed repo evidence.
- Prefer scoped verifiers over `npm run verify`.
- CI runs the whole chain in six parallel shards, so a gate cannot go red
  unnoticed the way several did before 2026-08-08.
- Treat fresh live runs as evidence-producing work.
- Never claim a live lane changed without a receipt and verifier.

## Claim-To-Command Map

| Claim or question | Check |
| --- | --- |
| Markdown files are in valid locations and links resolve. | `npm run docs:verify` |
| Static site output is current. | `npm run site:verify` |
| Public site UX contract still holds. | `npm run site:ux:verify` |
| Generated data index is current. | `npm run data:index:verify` |
| Helm render intents match the matrix and lifecycle data. | `npm run helm-render-intents:verify` |
| Master catalog matrix is current. | `npm run master-matrix:verify` |
| Doc freshness data is current. | `npm run doc-freshness:verify` |
| NPM script catalog is current. | `npm run npm-scripts:catalog:verify` |
| `cub installer` examples use current syntax. | `npm run installer:command-surface:verify` |
| `cub variant` examples use current syntax. | `npm run variant:command-surface:verify` |
| Lane status vocabulary is valid. | `npm run lane-tests:verify` |
| Committed two-cluster parity receipts validate. | `npm run kind-parity:verify` |
| Committed ConfigHub/OCI live receipts validate. | `npm run live-parity:verify` |
| The whole committed repo proof chain is consistent. | `npm run verify` |
| One slice of that chain, the way CI runs it. | `npm run verify:shard -- --shard 1 --of 6` |

## Generate Versus Verify

The common pattern is:

```text
npm run <surface>          # regenerate files
npm run <surface>:verify   # fail if committed files are stale
```

Examples:

```sh
npm run helm-render-intents
npm run helm-render-intents:verify

npm run data:index
npm run data:index:verify

npm run npm-scripts:catalog
npm run npm-scripts:catalog:verify
```

Do not run a generate command unless the user asked to update that surface or a
verifier says the generated output is stale.

## Fresh Evidence Versus Committed Evidence

Committed evidence already lives in the repo. Verifiers read it and check that
summaries, receipts, and generated views are internally consistent.

Fresh evidence creates new proof. It may need kind, ConfigHub, an OCI registry,
Argo, Flux, cloud-provider-kind, or a user-supplied cluster. Fresh evidence can
write receipts under `runs/` or `data/`.

Run fresh live commands only when fresh evidence is the task.

## Useful References

- [User Verification](../user/verification.md)
- [Verify It Yourself](../user/verify-it-yourself.md)
- [Verification Lanes](../user/verification-lanes.md)
- [Chain Of Proof](../user/chain-of-proof.md)
- [NPM Test And Verification Scripts](../../tests/npm-scripts.md)

## What CI Runs

CI runs the entire `npm run verify` chain on every pull request, split into six
shards that run in parallel. Before this, six gates ran in CI and the rest were
checked only by whoever remembered to run the chain locally, which is how
twenty-four of them came to be failing on main with nothing reporting it.

Two jobs, because the chain is not quite uniform. Most steps read committed
bytes and need nothing installed. Thirty-two re-render a package through the
cub installer, read an OCI artifact through oras, or template a chart through
helm, and those are listed in
[tests/verify-chain-cli-steps.yaml](../../tests/verify-chain-cli-steps.yaml) and
run in their own job with those tools installed once.

The gates that were already red are declared in
[tests/verify-chain-known-red.yaml](../../tests/verify-chain-known-red.yaml)
with the error each produces. A declared gate that fails is carried; a declared
gate that starts passing fails the run and asks to be removed from the list, so
it can only shrink.
