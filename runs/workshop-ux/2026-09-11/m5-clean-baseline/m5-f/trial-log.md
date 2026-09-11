# M5-F trial log

Guide discovery: `curl -fsS http://127.0.0.1:8768/site/index.html` (exit 0). The Guide/installed plugin README states that custom resources are checked against exact bundled CRD group, kind, and served API version; an unserved version is refused before sandbox output.

Inputs were preserved under `./handoff/` and the pinned plugin checkout under `./plugin/`. All `cub` commands below used the installed CLI `$HOME/.confighub/bin/cub` and `CUB_CONFIG=./cli/config.yaml`.

## Refusal attempt

Created `./trial/` as a copy of the handoff. Added `ExternalSecret/workshop-refusal` to `trial/components/04-external-secrets.yaml` with `apiVersion: external-secrets.io/v1beta1`; the bundled CRD in that same component serves `external-secrets.io/v1`.

Command:

```sh
CUB_CONFIG=./cli/config.yaml CONFIGHUB_AGENT=1 cub stack certify ./trial/stack.yaml --json > ./refusal.json 2> ./refusal.err
```

Exit code: `1`.

Receipt: `./refusal.json` proves `certified:false`, 185 objects, and the precise failure `external-secrets.io/v1beta1|ExternalSecret|external-secrets|workshop-refusal: version-not-served; externalsecrets.external-secrets.io serves v1`. `./refusal.err` is empty; the structured JSON is the error record. No sandbox command was run on the refused copy and no output was created for it.

## Recovery

Created `./recovery/` as a separate copy of `trial/`, then changed only `workshop-refusal` to `apiVersion: external-secrets.io/v1`.

Certification command exit code: `0`; receipt `./recovery.json` proves `certified:true` and the served-version check passes for 3 custom resources. Sandbox command exit code: `0`:

```sh
CUB_CONFIG=./cli/config.yaml CONFIGHUB_AGENT=1 cub stack sandbox ./recovery/stack.yaml --out ./recovery-rendered.yaml
```

`./recovery-rendered.yaml` proves a separate recovery render containing 185 objects in plane order. `./sandbox.out` records the CLI receipt and `./sandbox.err` is empty.

The decisive evidence was the Guide rule plus the refusal receipt naming the requested and served versions. The next action for a real deployment would be to verify the listed namespaces, issuer, and secret stores on a selected target; this trial did not do that.

Proven: exact API-version refusal, preserved failed attempt, successful repair, successful certification, and recovery sandbox output. Unknown: target availability, namespace/readiness, admission CA issuance, repository binding, and live application health. Not run: login, cluster, ConfigHub, registry, OCI publication, or credentials.

Friction: `cub stack certify --help` was interpreted as a stack name; the actual trial commands worked with an explicit manifest path. Setup was supplied and no additional setup was performed.
