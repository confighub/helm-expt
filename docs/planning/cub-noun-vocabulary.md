# The cub noun and verb table

This records the `cub <noun>` vocabulary as one table, mapped onto the Config
Workshop journey. It follows the `cub server` pattern: one noun per layer, one verb
per operation, the way `gh` reads. It pairs with
[custom-stacks-and-apps.md](./custom-stacks-and-apps.md), which names the nouns, and
the running prototype under `examples/cub-stack/` and `examples/cub-app/`.

Three things are settled here and drive the table.

- **A config's life crosses the entry-to-mid seam.** The same config is inspected for
  free, installed, kept, and promoted. The vocabulary has to hold across that seam
  rather than belong to one band.
- **Installation is the through-line, not a band.** The same config can be installed
  anonymously at the entry or governed at the mid. The account does not gate
  installation; it adds custody and promotion to it.
- **Anonymous install is free (Option A).** You can check and install a config with no
  account. The account buys keep and promote. Paid buys govern. This protects the
  anonymous look-before-you-install wedge the site already proves, and the mid still
  earns the account by being the only way to keep and promote.

## The table

Access is the three tiers of the funnel: **free** (entry, anonymous), **account**
(mid), **paid** (keystone).

| `cub …` | Band | Access | What it does |
| --- | --- | --- | --- |
| `cub config load <chart>` | entry | free | Pull a chart into the workshop from a registry or the catalog. The load half of load and save. |
| `cub config sandbox <chart>` | entry | free | Render the chart and run the checks. Is it right, what will it install, what must already exist. This is the site's Check. |
| `cub config install <chart>` | entry | free | Pull the reviewed OCI and hand it to your own Argo CD or Flux. Anonymous. |
| `cub config keep <chart>` | mid | account | Save the reviewed config as its base variant in ConfigHub, via `cub variant upload`. The custody moment, and the account line. |
| `cub app sandbox <name>` | entry | free | Render the workload and work out whether it is standalone or needs a platform for its dependencies. |
| `cub app install <name>` | entry | free | Deliver the workload from OCI to your reconciler. Anonymous. |
| `cub app score <name>` | entry | free | Export the workload to Score (score.dev), ready for score-k8s. |
| `cub app keep <name>` | mid | account | Save the app in ConfigHub. |
| `cub app promote <name>` | mid | account | Make dev, staging, and prod variants and promote the reviewed change, gated on review. |
| `cub stack sandbox <name>` | entry | free | Certify the composition and render every object. |
| `cub stack certify <name>` | entry | free | The certify gate alone. Exits non-zero on a conflict. |
| `cub stack install <name>` | entry | free | Install the certified composition through OCI to your reconciler. Anonymous. |
| `cub stack keep <name>` | mid | account | Bring the certified composition into ConfigHub. |
| `cub stack promote <name>` | mid | account | Promote the stack through environments, gated on review. |
| `cub platform <name>` | keystone | paid | Govern an installed stack: identity, approvals, digest releases, rollback, drift repair, a fleet matrix. A platform is a stack put under governance. |
| `cub server install` | substrate | — | Install self-hosted ConfigHub locally. The twenty-second on-ramp the whole ladder sits on. |

## How to read it

Read one config down its column of verbs and the journey appears:

**load → check → install (free) → keep → promote → govern.**

The account line sits between `install` and `keep`. Everything above it is free and
anonymous, including installing onto your own cluster. Everything below it needs an
account, because keeping and promoting are what ConfigHub adds. Governing a stack is
the paid keystone.

`sandbox` is the free-mode qualifier that means no cluster and no account. It is the
same mode at every noun, and the operation inside it is what the noun cares about: a
config is checked, a stack is certified, an app is analyzed for its dependencies.

## How a config becomes a component

A config's life is a load and a save, and the save is where it becomes a component.

`cub config load` pulls a chart into the workshop. `cub config sandbox` renders and
checks it. Both are free and local, with no ConfigHub. Then `cub config keep` saves it,
and the save is not a plain copy. It runs `cub variant upload`, which creates the
config's **base variant**: a Space labeled `Component=<chart>, Variant=base`, holding
the config as one Unit per resource, with no target.

That base variant is the component. A component in ConfigHub is not a stored object. It
is the set of Spaces that share a `Component` label, and the base is its first Space, so
keeping a config is what turns it into a component. From there a promotion clones
deployment variants off the base, one per environment, each with its own target:

```
config --load--> workshop --keep--> base variant (Component=redis, Variant=base, no target)
                                        |
                                        +--promote--> dev / staging / prod (cloned, with targets)
```

This is why `keep` is the account line. The load and the checks are free. Creating and
holding the base variant is the custody ConfigHub adds.

## The engine underneath

`cub installer` is not a peer noun. It is the engine every `… install` drives: it
pulls the OCI package, materializes it, and hands it to the reconciler. `cub config
install`, `cub app install`, and `cub stack install` all route through it, and the
band decides the governance. At the entry it runs anonymously; at the mid a governed
release hands it the reviewed digest. That is why installation is a through-line and
`cub installer` sits under all of it rather than beside the nouns.

## Decisions settled

- **`cub check` is retired as a command.** Checking is a config's entry operation, so
  it is `cub config sandbox`, not a verb-first `cub check`. "Check" stays as the name
  of the entry experience on the site; the command is `cub config`.
- **Anonymous install is free (Option A).** The account line is at `keep`, not at
  `install`.
- **A platform is a governed stack.** There is no separate platform install verb;
  governing an installed `cub stack` is what makes it a platform.
- **`sandbox` is the free mode at every noun**, so the entry band is one mode across
  config, app, and stack.
- **The acquire verb is `load`, not `get`.** In cub, `get` reads an existing entity, so
  pulling a chart into the workshop is `cub config load`, which also names the load half
  of load and save.

## Still open

- The naming, to settle with the author of `cub server`. In particular the config
  noun is `cub config` here, but the data model calls a single chart a *component*, so
  it is `config` versus `component` for that one noun. `config` reads better for the
  entry Check.
- The exact verb spellings once these are real cub subcommands rather than the
  prototype under `examples/`.
