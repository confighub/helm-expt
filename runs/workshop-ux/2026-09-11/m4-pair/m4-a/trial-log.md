# Trial log

All commands were run with shell workdir `./plugin`. Every `cub` invocation prefixed `CUB_CONFIG=./cli/config.yaml`. Output and error streams are retained under `outcomes/`.

1. Read `http://127.0.0.1:8767/site/index.html`, then the linked plugin README and `examples/match/README.md`.
2. Copied original fixtures to `inputs/` and edited only the GPU quantity for mismatch and removed only that line for unknown.
3. Candidate command: `CUB_CONFIG=./cli/config.yaml ./bin/cub-app match ./inputs/model.yaml --target ./inputs/nodes.yaml --json --out ./outcomes/candidate.json` — exit 0. Streams: `candidate.stdout`, `candidate.stderr`.
4. Mismatch command: same command with target `inputs/mismatch-nodes.yaml` and output `outcomes/mismatch.json` — exit 1. Streams: `mismatch.stdout`, `mismatch.stderr`.
5. Initial unknown attempt accidentally retained the GPU line and wrote `outcomes/unknown.json` — exit 0, candidate; retained as evidence of the corrected-copy friction.
6. Corrected unknown command with target `inputs/unknown-nodes.yaml` and output `outcomes/unknown-final.json` — exit 3, unknown. Streams: `unknown-final.stdout`, `unknown-final.stderr`.

Initial harness path error: a command run from the plugin directory referenced `plugin/examples/...`, causing missing-file errors and exit 127; no trial receipt was created. This was not a plugin behavior finding.
