# Synthetic Torture Suite

Charts written to break the model (sceptic plan T3). The standing rule:
every fixture ends in a NAMED outcome — pass, a named refusal, or a named
route — never silence. Recording hard-fails on any fixture whose behavior
does not match its declared outcome, so a new breaker chart fails the build
until it is classified and routed. That is the point: a sceptic's breaking
chart becomes a regression fixture here.

Colored rendering: [torture.html](torture.html). Fixture sources live under
[charts/](charts/), one directory per fixture with a `fixture.yaml`
declaring the attack and the expected outcome.

## Current Status

| Metric | Count |
| --- | ---: |
| Fixtures | 8 |
| Pass (deterministic, no traps fired) | 1 |
| Named refusals | 5 |
| Named routes (policy, not refusal) | 2 |
| Silent outcomes | 0 by construction |

## Fixtures

| Fixture | Attack | Outcome | Detail |
| --- | --- | --- | --- |
| `alias-collision` | The same subchart is included twice under different aliases, and the child hardcodes an object name - both instances render the identical object identity. | ⛔ `refused-object-identity-collision` | `v1|ConfigMap||child-shared-cm` |
| `import-values-chain` | import-values pulls child chart exports into the parent values space; a value-source map that only scans the parent values.yaml cannot explain where the rendered field came from. | ✅ `pass-deterministic` | — |
| `lookup-in-spec` | lookup reads the live cluster at render time to fill a spec field, so a factory render cannot equal an in-cluster render. | 🔀 `routed-lookup-target-facts` | — |
| `random-selector` | Random generation inside spec.selector.matchLabels: every render produces a different immutable selector, so no two renders describe the same workload. | ⛔ `refused-nondeterministic-render` | — |
| `sprig-env-access` | sprig env reads the rendering machine's environment variables into the output, leaking machine state and making renders machine-dependent. | ⛔ `refused-template-error` | `Error: parse error at (sprig-env-access/templates/configmap.yaml:6): function "e` |
| `timestamp-annotation` | now baked into an annotation: the rendered bytes change every run, so byte-level parity is impossible by construction. | ⛔ `refused-nondeterministic-render` | — |
| `tpl-self-recursion` | A values entry that tpl-renders itself recurses forever; a naive renderer hangs or crashes without a named outcome. | ⛔ `refused-template-error` | `runtime: goroutine stack exceeds 1000000000-byte limit runtime: sp=0x4afb347803a` |
| `verb-branch` | The template branches on .Release.IsUpgrade, so the chart renders differently on install and upgrade - a single captured render is not the chart. | 🔀 `verb-dependent-render` | — |

## Adding a breaker

Add `charts/<name>/` with the chart and a `fixture.yaml` declaring
`attack` and `expected_outcome`, then run `npm run torture:record`.
If the harness cannot land your chart in a named outcome, recording fails —
which means you found a real gap: file it with the failing fixture attached.

## Regenerate

~~~sh
npm run torture:record   # needs helm; charts are vendored, no network
npm run torture:suite    # offline: summary/html from committed results
npm run torture:suite:verify
~~~
