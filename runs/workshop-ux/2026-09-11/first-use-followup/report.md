# Workshop plugin first use trial

Date: 2026-09-11 (UTC)

Scope: bounded first-use setup followed by one read-only inspection. The repository and public site were read only. All `cub` commands used `CUB_CONFIG=$TRIAL/cli/config.yaml`; the user’s existing configuration was not touched. No cluster or ConfigHub Server mutation was attempted.

Public entry points consulted:

- https://confighub.github.io/helm-expt/site/
- https://confighub.github.io/helm-expt/site/try.html
- https://confighub.github.io/helm-expt/site/d/docs/user/what-config-workshop-is.html
- Pinned public repository checkout: `confighub/cub-workshop` at `56e261a87dc3b060a86474bc796d379dd9bb7f3d` (0.6.21), recorded in `cub-workshop-commit.txt`.

## Commands and results

Existing `cub` was detected before setup (`$HOME/.confighub/bin/cub`, client/server v0.4.4; see `cub-version.txt`). Therefore this trial does not claim a clean CLI installation. The public Guide currently says `cub plugin install confighub/installer`, while the pinned Workshop README says `cub plugin install confighub/cub-workshop`; the latter was used for this requested Workshop trial.

1. `git clone --quiet https://github.com/confighub/cub-workshop.git $TRIAL/cub-workshop` and checkout of the requested commit: succeeded. This is a public clone only.
2. `CUB_CONFIG=$TRIAL/cli/config.yaml cub plugin install $TRIAL/cub-workshop`: succeeded in 0.070 seconds. Output says plugin `workshop` installed with commands `config, app, stack, fleet`.
3. `CUB_CONFIG=$TRIAL/cli/config.yaml cub config list`: succeeded in 0.06 seconds (available public configs listed; no account or server interaction observed).
4. `CUB_CONFIG=$TRIAL/cli/config.yaml cub config check redis`: succeeded in 0.107 seconds. Read-only result: Redis renders 14 objects, namespace `redis` must already exist, and CRDs/hooks/setup Jobs/certificate webhooks are all zero/pass.

## Friction and findings

Setup from the pinned local checkout was straightforward and required no login. The main discoverability issue is an instruction mismatch: the public `try.html` Guide names the `installer` plugin, whereas the pinned Workshop README names `cub-workshop`; a first-time user following the Guide would not automatically reach the Workshop `config` command family. The Guide also describes `cub installer setup`, which is a different command family from the requested Workshop plugin’s `cub config check`.

The inspection was clear and cheap. It explicitly says it is free and uses no infrastructure, and reports lifecycle prerequisites in a compact form. The output reports a Secret among the 14 rendered objects, while the Guide’s Redis walkthrough discusses a `reuse-existing-secret` configuration with no Secret; this difference may reflect the default `redis` config versus the Guide’s selected variant and is worth making explicit to avoid first-use confusion.

Evidence files are in this directory: command stdout/stderr, `plugin-list-after.txt`, `cub-version.txt`, `cub-workshop-commit.txt`, `timing.log`, and `result.json`.
