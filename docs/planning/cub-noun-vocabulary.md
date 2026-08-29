# The cub noun and verb table

This is the `cub <noun>` vocabulary as one table. It follows the `cub server`
pattern, one noun per layer and one verb per operation, the way `gh` reads. It pairs
with [custom-stacks-and-apps.md](./custom-stacks-and-apps.md) and the running
prototype under `examples/cub-stack/` and `examples/cub-app/`.

## Read it as a ladder

A config climbs a ladder, and each verb is a rung.

The first rungs are free and need no account. You **check** a config, then **install** it
onto the Argo CD or Flux you already run. The next rungs need an account. You **keep**
the config in ConfigHub, then **promote** it across environments. The last rung is paid.
You **govern** a running stack as a platform.

A stack climbs the same ladder with two extra free rungs. You **certify** that the
composition holds together, and you **sandbox** it to render the whole thing for free
with no infrastructure. That is the eks-inference model.

The account line falls between install and keep. Everything below it is free, including
installing onto your own cluster. Everything above it is what ConfigHub adds.

## The table

Access is the three tiers of the funnel. Free is the entry and needs no account.
Account is the middle. Paid is the keystone.

| `cub …` | Band | Access | What it does |
| --- | --- | --- | --- |
| `cub config check <chart>` | entry | free | See what it installs and whether it is right, in your browser. No cluster. This is the Check. |
| `cub config install <chart>` | entry | free | Install it **from OCI** onto the Argo CD or Flux you already run. No account. |
| `cub config keep <chart>` | mid | account | Save it in ConfigHub so it is versioned and reusable. This is the account line. |
| `cub config promote <chart>` | mid | account | Make dev, staging, and prod, and move a reviewed change. ConfigHub cuts the signed OCI. |
| `cub app check <name>` | entry | free | See what the workload installs, and whether it needs a platform for ingress, TLS, or monitoring first. |
| `cub app score <name>` | entry | free | Export it to Score (score.dev), if your team works that way. |
| `cub app install <name>` | entry | free | Install the workload **from OCI** onto your reconciler. No account. |
| `cub app keep <name>` | mid | account | Save the app in ConfigHub. |
| `cub app promote <name>` | mid | account | Move a reviewed change through dev, staging, and prod. ConfigHub cuts the signed OCI. |
| `cub stack certify <name>` | entry | free | Check that the whole composition holds together. Pass or fail, and it stops on a conflict. |
| `cub stack sandbox <name>` | entry | free | Render the whole composition for free, with no infrastructure. See every object, run nothing. |
| `cub stack install <name>` | entry | free | Install the certified composition **from OCI** onto your reconciler. No account. |
| `cub stack keep <name>` | mid | account | Save the composition in ConfigHub. |
| `cub stack promote <name>` | mid | account | Move it through environments safely. ConfigHub cuts the signed OCI. |
| `cub platform <name>` | keystone | paid | Run an installed stack under governance. It adds approvals, signed releases, rollback, drift repair, and a fleet view. |
| `cub server install` | substrate | — | Run ConfigHub yourself, locally, in about twenty seconds. |

## Three ways to look, all free

The entry has three inspection verbs, and they do not overlap.

- **check** inspects one thing. Is this config or app right, and what will it install.
  This is the mission, and the site calls it the Check.
- **certify** judges a whole composition. Do the stack's pieces fit together, pass or
  fail. It is the stack's form of checking, and the composition verdict is the moat.
- **sandbox** renders a whole composition for free with no infrastructure. You see every
  object without standing anything up. This is how eks-inference works.

You check a config. You certify and sandbox a stack. None of them touches a cluster or
needs an account.

## Where OCI comes in

OCI shows up twice, and the rule is simple. You install from an OCI that already exists.
Once you keep a config, ConfigHub makes you a new, governed one.

| What you are doing | Verb | The OCI |
| --- | --- | --- |
| Install onto your cluster | `cub config install` (free) | You pull a bundle that already exists, from the Catalog or your own push. You are consuming OCI. |
| Promote across environments | `keep`, then `promote` (account) | ConfigHub makes a signed, locked, versioned bundle and moves it dev to prod. It is producing OCI. |

`keep` on its own makes no OCI. It saves the config in ConfigHub. The OCI appears when
you release and promote. So install consumes OCI and promote produces it, and both end
as OCI on the cluster your reconciler already runs.

## How a config becomes a component

This is the deeper mechanism behind `keep`, for readers who want it.

`cub config keep` runs `cub variant upload`. That creates the config's **base variant**,
a Space labeled `Component=<chart>, Variant=base`, holding the config as one Unit per
resource, with no target. A component in ConfigHub is the set of Spaces that share a
`Component` label, so the base is the component's first Space. Keeping a config is what
turns it into a component. From there `promote` clones deployment variants off the base,
one per environment, each with its own target and its own signed OCI release.

```
config --check--> --install--> your Argo / Flux              (free)
   |
   +--keep--> base variant (Component=redis, Variant=base)
                 |
                 +--promote--> dev / staging / prod          (account)
                               each a signed OCI release
```

## The engine underneath

`cub installer` is not a noun of its own. It is the engine every `… install` drives. It
pulls the OCI package and hands it to your reconciler. `cub config install`,
`cub app install`, and `cub stack install` all run through it. At the entry it runs
anonymously. At the mid a governed release hands it a reviewed digest.

## Decisions settled

- **`cub check` becomes `cub config check`.** Retiring `cub check` was about grammar,
  going noun-first like `cub server`, not about the word. Checking a chart is the whole
  mission, so the verb stays `check`, now after the noun.
- **check, certify, and sandbox are three different free looks.** `check` inspects one
  config or app. `certify` judges a stack's composition. `sandbox` renders a whole
  composition for free with no infrastructure, the eks-inference way. They act on
  different nouns, so they never overlap.
- **Anonymous install is free (Option A).** The account line is at `keep`, not at
  `install`.
- **A platform is a governed stack.** There is no separate platform install verb.
  Governing an installed `cub stack` is what makes it a platform.
- **No `load` verb.** You name a chart directly to `check` or `install` it, so a
  separate acquire rung would be redundant.

## Still open

- The naming, to settle with the author of `cub server`. The config noun is `cub config`
  here, but the data model calls a single chart a *component*, so it is `config` versus
  `component` for that one noun. `config` reads better for the entry Check.
- The prototype under `examples/` still uses `sandbox` for the single-config render. It
  should move to `check` for config and app, and keep `sandbox` for a stack.
