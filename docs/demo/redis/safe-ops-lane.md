# Redis Safe Operation Lane

## Purpose

This lane proves that Redis operation is explicit and gated in ConfigHub. It
does not perform a live deployment. The point is to show safe behavior when a
target is not attached: ConfigHub must not pretend it can apply to a cluster.

## Acceptance Contract

Accepted when:

- a changeset is created or reused for the proof;
- the changeset can be listed and updated;
- a reviewed Redis Unit can be approved;
- dry-run apply is attempted through `cub unit apply --dry-run`;
- the apply path blocks clearly if no target exists;
- cancel is safe and does not damage the reviewed Unit set.

## Run

Run date: 2026-05-27

Context:

```text
Organization: Kubara
Server: https://hub.confighub.com
Space: helm-redis-use-more-now
Selector: Labels.Proof = 'redis-use-more-now'
```

Create the operation record:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub changeset create \
  redis-safe-ops-20260527 \
  --space helm-redis-use-more-now \
  --description "Redis use-more-now safe operation proof lane" \
  --label Proof=redis-use-more-now \
  --label Lane=safe-ops \
  --allow-exists
```

Update it with the proof scope:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub changeset update \
  redis-safe-ops-20260527 \
  --space helm-redis-use-more-now \
  --description "Redis safe-ops proof: approve reviewed revisions, dry-run apply only" \
  --annotation proof.confighub.com/scope=local-test \
  --annotation proof.confighub.com/live-apply=false
```

Approve a representative reviewed Unit:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub unit approve \
  statefulset-redis-redis-master \
  --space helm-redis-use-more-now \
  --revision HeadRevisionNum \
  --verbose \
  --wait
```

Result:

```text
Unit statefulset-redis-redis-master (...) has been approved
Awaiting triggers...
```

Attempt dry-run apply:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub unit apply \
  --space helm-redis-use-more-now \
  --where "Labels.Proof = 'redis-use-more-now'" \
  --dry-run \
  --wait \
  --timeout 2m
```

Result:

```text
Failed: cannot invoke action on a unit without a target
```

Cancel is safe:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub unit cancel \
  --space helm-redis-use-more-now \
  --where "Labels.Proof = 'redis-use-more-now'"
```

Result:

```text
No units found matching the filter
```

Receipt:

```text
runs/redis-use-more-now/latest/safe-ops-receipt.yaml
```

## Interpretation

This is a good result. The proof space has reviewed Redis Units but no attached
target, so ConfigHub blocks even a dry-run apply at the operation boundary. For
workerless ConfigHub, this is the behavior we want:

```text
no target or observation receipt -> no claim that anything was deployed
```

The next live-safe step is to attach a disposable local target and repeat this
lane with a dry-run or local-kind apply receipt.

