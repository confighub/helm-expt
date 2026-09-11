# Trial log

Guide discovered at `http://127.0.0.1:8768/site/index.html`; its “Inspect a configuration” route points to the local adapt Guide and specifies `cub config diff`, preserving inputs and hashes and using `--exit-code` to flag differences.

All CLI commands used the required prefix `CUB_CONFIG=./cli/config.yaml` and the installed `cub` binary (`$HOME/.confighub/bin/cub`).

1. Copied the supplied example to `trial/before.yaml` and `trial/after.yaml`; plugin source was preserved.
2. Changed only `spec.replicas: 1` to `2` in `trial/after.yaml`.
3. Ran the requested diff, retaining stdout `trial/diff.stdout` (`./trial/diff.stdout` in workspace archive), stderr `trial/diff.stderr` (`./trial/diff.stderr` in workspace archive), exit code `trial/diff.exitcode` (`./trial/diff.exitcode` in workspace archive), and receipt `trial/diff.json` (`./trial/diff.json` in workspace archive).
4. Copied both inputs to `moved/` and reran the diff, retaining `moved/diff.json` (`./moved/diff.json` in workspace archive), `moved/diff.stdout` (`./moved/diff.stdout` in workspace archive), `moved/diff.stderr` (`./moved/diff.stderr` in workspace archive), and `moved/diff.exitcode` (`./moved/diff.exitcode` in workspace archive). `moved/cmp.exitcode` (`./moved/cmp.exitcode` in workspace archive) is `0`.
5. Created the deliberate extra-change candidate `trial/extra-after.yaml` (`revisionHistoryLimit: 10 -> 11`) and ran `cub config diff ... --json --exit-code`, retaining `trial/extra-diff.json` (`./trial/extra-diff.json` in workspace archive), `trial/extra.stdout` (`./trial/extra.stdout` in workspace archive), `trial/extra.stderr` (`./trial/extra.stderr` in workspace archive), and `trial/extra.exitcode` (`./trial/extra.exitcode` in workspace archive), which is `1`.
