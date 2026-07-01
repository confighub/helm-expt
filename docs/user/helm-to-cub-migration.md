# Coming from Helm? How your habits map to cub

**UNOFFICIAL/EXPERIMENTAL.** A Helm-fluent dev's cheat-sheet. `cub installer` uses **declared,
typed inputs** and **named bases** — not free-form `--set` — so a little muscle-memory
translation is needed. The good news: cub **safely rejects** Helm idioms (it never silently
mishandles them); the gap this page fills is the migration guidance cub's error messages
don't yet give you (measured in the Helm-fluent-migrant friction lane: every Helm idiom is
rejected, but with a generic "unknown flag/input" and no hint toward the cub way).

## The one big difference

- **Helm:** *any* `--set path=value` is accepted — including typos, which vanish silently.
- **cub:** inputs are **declared** by the package. Run `cub installer doc <pkg>` to see the
  exact inputs and bases. An unknown input or flag is a **hard error** (so the typo footgun
  Helm absorbs is caught at the tool). You customize via declared `--input`s, a named
  `--base`, `--set-image`, or by editing the base (config-as-data).

## The cheat-sheet

| In Helm you'd… | cub's error today | Do this in cub instead |
| --- | --- | --- |
| `--set replicaCount=3` | `unknown flag: --set` | `--input replicaCount=3` **if** it's a declared input (`cub installer doc`); otherwise choose/author a `--base`, or edit the base |
| `-f values.yaml` / `--values v.yaml` | `unknown shorthand flag: 'f'` | cub has no values-file flag — pass declared values as `--input k=v` (repeatable), or author a **base variant** that bakes in your values |
| `--set image.tag=v2` | `unknown flag: --set` | `--set-image <name>=<ref>` (the base must declare an `images:` block) |
| `--set-string key=val` | `unknown flag: --set-string` | `--input key=val` — inputs are typed by the package, so no `--set-string` needed |
| `--set-file key=cert.pem` | `unknown flag: --set-file` | provide it as a declared input or a **staged target fact** (e.g. an existing Secret) |
| `--set nested.deep.path=x` for a path the chart exposes but the package doesn't | `unknown input "nested.deep.path"` | that path isn't an **exposed** input — pick a `--base` that customizes it, or edit/author the base (the change becomes reviewable config-as-data) |
| `--set arr[0]=x` (array index) | `unknown input "arr[0]"` | set the whole structured value via a declared input, or in the base |
| `helm install NAME chart` (release name) | n/a — different model | cub renders into a `--namespace`; the "name" is the ConfigHub **space / unit**, not a Helm release |

## What the managed setup guidance should say

The managed setup guidance proof records five common Helm habits and the plain-language
hint a user should get. This is the adoption bar: safe rejection is not enough when the
user is trying something normal from Helm.

| User tries | Better guidance |
| --- | --- |
| `--set replicaCount=2` | cub has no `--set`. Declared values use `--input KEY=VALUE`; run `cub installer doc <pkg>` to see the inputs. Values that are not declared belong in a base. |
| `--values values.yaml` or `-f values.yaml` | cub has no values-file flag. Choose, edit, or author a base variant instead of passing a Helm values file at runtime. |
| `--set-string image.tag=7.4` | Use `--set-image` when the package declares images; otherwise make the image change in the base. |
| `--input replicaCount=2` but the input is not declared | The hard error is intentional. Confirm the input exists, or edit the base so the change is visible as config. |
| A base bakes a placeholder password | Treat it as a demo placeholder. The safer default is an existing-secret or reuse-existing-secret base; stage your own Secret before apply. |

Source: [managed setup guidance](../../data/managed-setup-guidance/summary.md).

## Why cub works this way (the upside of the friction)

The declared-input model is what makes cub **catch the typo footgun Helm silently absorbs** —
in the careless-dev fuzz, Helm swallowed ~66% of bad `--set` keys with no error; the same key
as a cub `--input` is a hard `unknown input`. And because customization is a declared input,
a named base, or a base edit, **your change is reviewable config-as-data** before it reaches a
cluster, instead of a transient flag. The cost is this translation step — which is why this
page (and, ideally, guidance baked into cub's own error messages) exists.

## Quickest path

1. `cub installer doc <pkg>` — see the bases and the exact declared inputs.
2. Use `--base <name>` to pick a variant, `--input <name>=<value>` for declared inputs, and
   `--set-image <name>=<ref>` for image overrides.
3. Anything else: edit or author a base (config-as-data) rather than spraying `--set`.

→ see also: [choosing-commands](choosing-commands.md) ·
[cub-deployment-path](cub-deployment-path.md) · [how-it-works](how-it-works.md)
