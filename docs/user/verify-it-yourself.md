# Verify It Yourself

**UNOFFICIAL/EXPERIMENTAL**

You do not need to trust a screenshot or a README claim. The repo is built so a
reader can rerun checks and inspect receipts.

## Check The Offline Corpus

These checks do not need a cluster or network:

```sh
npm run site:verify
npm run docs:verify
npm run data:index:verify
```

For a broader release gate, run:

```sh
npm run verify
```

That command is intentionally larger. Use it before publishing or reviewing a
large change, not after every small edit.

## Check A Rendered Install

For Redis, render a catalog base and verify that your rendered output matches
the catalog acceptance contract:

```sh
cub installer setup \
  --pull oci://ghcr.io/confighub/helm-expt/bitnami-redis:25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis

npm run redis:verify-install:render -- \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --namespace redis
```

Expected result:

```text
PASS redis:verify-install:render bitnami/redis/25.5.3 default
```

## Rerun A Two-Cluster Parity Check

Use this when you want to compare regular Helm in one vanilla kind cluster with
`cub installer` output in another:

```sh
npm run kind-parity:run -- \
  --chart bitnami/redis \
  --version 25.5.3 \
  --base default
```

Then verify the committed receipts:

```sh
npm run kind-parity:verify
```

The current generated report is:

[Two-Cluster Kind Parity](../../data/live-kind-parity/summary.md)

Run these jobs serially. The parity harness creates and removes kind clusters
owned by the run.

## Rerun A ConfigHub/OCI Live Parity Check

Use this when you want the stricter live path: regular Helm, direct
`cub installer` apply, and ConfigHub OCI/Argo delivery for the same committed
recipe/base.

```sh
npm run live-parity:run -- \
  --recipe recipes/external-dns/external-dns/1.21.1 \
  --base no-crds
```

Then regenerate and verify the summary:

```sh
npm run live-parity:top20:summary
npm run live-parity:verify
npm run outcomes:generate
npm run status:dashboard
```

Run this lane serially. It creates kind clusters and uses the live ConfigHub
and OCI path.

## Validate A cub-scout Receipt

When you have a cub-scout receipt file, validate its fingerprint:

```sh
cub-scout receipt validate <receipt.json>
```

To create fresh live receipts against a cluster, use `receipt verify` with the
predicate that matches the question:

```sh
cub-scout receipt verify \
  --file <rendered-objects.yaml> \
  --scope namespace/<namespace> \
  --predicate object-set-matches \
  --ttl 1h \
  --out .tmp/object-set.receipt.json
```

Useful predicates for installs are:

| Predicate | Question |
| --- | --- |
| `object-set-matches` | Are the desired objects present, and do authored fields match? |
| `prerequisites-met` | Are required target facts such as Secrets present? |
| `workloads-converged` | Did workload resources reach the expected live state? |

Use the cub-scout example for a self-contained runtime test:

[confighub/cub-scout examples/helm-expt](https://github.com/confighub/cub-scout/tree/main/examples/helm-expt)

## Read The Claim Before Trusting It

Every status row has a scope. Check the chart, version, base, lane, and target
profile before quoting it.

Start with:

- [Current Proof Status](./current-proof-status.md)
- [Live Parity](./live-parity.md)
- [What We Refuse To Claim](./what-we-refuse-to-claim.md)
