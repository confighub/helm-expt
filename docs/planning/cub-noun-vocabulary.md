# The cub noun and verb table

This is the `cub <noun>` vocabulary as one table. It follows the `cub server` pattern,
one noun per layer and one verb per operation, the way `gh` reads. The verbs are the
get-started tutorial's own commands, so Config Workshop and the product speak the same
language. It pairs with [custom-stacks-and-apps.md](./custom-stacks-and-apps.md) and the
running prototype under `examples/cub-stack/` and `examples/cub-app/`.

Status, 2026-09-01: the proposed nouns now run as an installable plugin prototype,
`cub plugin install confighub/cub-workshop`, which carries `cub config`, `cub app`,
`cub stack`, and `cub fleet` with their free verbs and examples. The account and
governed verbs below remain ConfigHub's own released commands, unchanged.

## Read it as a ladder

A config climbs a ladder, and each verb is a rung.

The first rungs are free and need no account. You **check** a config, then **deploy** it
onto the Argo CD or Flux you already run. The next rungs need an account. You **upload**
it into ConfigHub, **release** it so the cluster pulls it, and **promote** it across
environments. The last rung is paid. You **govern** a running stack as a platform.

A stack adds two free rungs. You **certify** that the composition holds together, and you
**sandbox** it to render the whole thing for free with no infrastructure. That is the
eks-inference model.

The account line falls at **upload**. Everything below it is free, including running the
config on your own cluster with `deploy`. Everything above it is ConfigHub: custody, a
governed release, promotion, and the chaining of public config into your private org.

## The free entry, no account

| verb | nouns | what it does |
| --- | --- | --- |
| `check` | config, app | Inspect it: what it installs, whether it is right, in your browser. No cluster. This is the Check. |
| `certify` | stack | Check that the whole composition holds together. Pass or fail, and it stops on a conflict. |
| `sandbox` | stack | Render the whole composition for free, with no infrastructure. See every object, run nothing. |
| `score` | app | Export the workload to Score (score.dev). |
| `deploy` | config, app, stack | Run the reviewed OCI on the Argo CD or Flux you already run. No account. |

## The account ladder, on config, app, or stack

| verb | what it does | maps to |
| --- | --- | --- |
| `upload` | Bring it into ConfigHub as a base. This is where public config starts chaining into your private org. | `cub variant upload` |
| `release` | Go live. Create the deployment and publish, so the cluster pulls. | `cub variant create` + `cub release publish` |
| `promote` | Flow a reviewed change base → dev → prod, with protection, then release it. | `cub variant promote` |

These are the tutorial's own commands. `upload` is `cub variant upload` (the tutorial's
install-a-component step), `release` is `cub release publish`, and `promote` is
`cub variant promote`. The verb you type is the command that runs.

## The keystone and the substrate

| `cub …` | Access | What it does |
| --- | --- | --- |
| `cub platform <name>` | paid | Run a stack under governance. It adds approvals, signed releases, rollback, drift repair, and a fleet view. A platform is a governed stack. |
| `cub server install` | — | Run ConfigHub yourself, locally, in about twenty seconds. |

## Chaining public config into your private org

`upload` is the hinge, and it is what makes ConfigHub more than a registry.

A base seeded by `upload` can be **public**, pulled from a shared catalog. Your
deployment is **private**. `release` clones the public base into your private deployment,
and links carry your private values into it as it goes. A `TransformPaths` or
`NeedsProvides` link extracts a value from one of your units and fills a placeholder in
the cloned config, so the public base arrives already wired to your private data.
Protection keeps the values you chose, and later changes to the public base still flow
down to everything you did not protect.

So the public base keeps sending you improvements, a fixed image or a new version, and
they land in your private deployment without erasing your local choices. That chaining of
public into private is the value a plain OCI registry cannot offer, and it is where a
commercial layer of scanning, conformance, and org patterns would attach.

## Where OCI comes in

OCI shows up in two places, and the rule is simple. `deploy` consumes an OCI that already
exists. `release` makes ConfigHub produce a new, governed one.

| What you are doing | Verb | The OCI |
| --- | --- | --- |
| Run it on your own cluster, no account | `deploy` (free) | You pull a bundle that already exists, from the catalog or your own push. You are consuming OCI. |
| Go live and promote through environments | `release`, then `promote` (account) | ConfigHub makes a signed, locked, versioned bundle and moves it dev to prod. It is producing OCI. |

`upload` makes no OCI of its own. It saves the config in ConfigHub as a base. The OCI
appears at `release`.

## How upload seeds a base

Uploading a config runs `cub variant upload`, which creates the config's **base variant**,
a Space labeled `Component=<chart>, Variant=base`, holding the config as one Unit per
resource, with no target. A component in ConfigHub is the set of Spaces that share a
`Component` label, so the base is the component's first Space. From there `release` clones
a deployment variant off the base, with a target and its own signed OCI release, and
`promote` flows later base changes down to it.

```
config --check--> --deploy--> your Argo / Flux                    (free)
                     |
   public base --upload--> base variant (Component=redis, Variant=base)
                             |
                             +--release--> dev (private, links inject your values)   (account)
                                             |
                                             +--promote--> staging / prod, each a signed OCI
```

## The engine underneath

`cub installer` is the engine `deploy` and `release` both drive to move an OCI bundle to a
reconciler. It pulls the OCI package and hands it over. At the entry `deploy` runs it
anonymously. At the mid a governed `release` hands it a reviewed digest.

## Decisions settled

- **The verbs are the tutorial's commands.** `upload` seeds a base in ConfigHub
  (`cub variant upload`), `release` goes live (`cub release publish`), and `promote` flows
  a change (`cub variant promote`). Config Workshop and the product use one language.
- **`upload`, not `install`, is the account verb.** It matches the real command,
  `cub variant upload`, and it keeps the account line clear of `cub installer`, the free
  per-package engine. `cub installer setup` (free) and `cub … upload` (account) are now
  plainly different, not one suffix apart. The word `install` stays out of the table.
- **`check` is the free inspect, `deploy` is the free run.** Both need no account. `check`
  looks without running. `deploy` runs the reviewed OCI on your own reconciler.
- **The account line is at `upload`.** Everything below it is free. `upload` is also where
  public config begins chaining into your private org, so it is the natural line.
- **check, certify, and sandbox are three different free looks.** `check` inspects one
  config or app. `certify` judges a stack's composition. `sandbox` renders a whole
  composition free with no infrastructure.
- **A platform is a governed stack.** Governing a `cub stack` is what makes it a platform.

## Still open

- The config noun. The data model calls a single chart a *component*, and the tutorial
  says component throughout. `config` reads better for the entry Check, so this is
  `config` versus `component` to settle with the author of `cub server`.
- The prototype under `examples/` predates this and still uses `sandbox` for a single
  config. It should move to `check` for config and app, keep `sandbox` for a stack, and
  rename its live install to `upload` and `release`.
