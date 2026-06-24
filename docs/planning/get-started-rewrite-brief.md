# Get Started rewrite brief

**UNOFFICIAL/EXPERIMENTAL.** A brief for Codex: restructure the generated Get Started page
(`site/try.html`, built in `scripts/generate-public-site.mjs`) around the parity-of-outcomes
message, lead with the whole install, then decompose, then offer GitOps — and finally explain
the `--pull` flag and where packages live. House voice (`house-voice.md`) throughout.

## What's wrong now

- The page leads with `helm template` vs a cub render — a **render** comparison. The core
  message is that **`helm install` and `cub installer` reach the same running outcome** for a
  reasonable chart. Lead with the install, not the template.
- `--pull packages/prometheus-community/prometheus/29.8.0` appears with no explanation of what
  the flag does or where those packages live.

## The new structure

1. **Install it — both paths, same outcome** (the parity message, up top).
2. **How it works** — Helm hides render+apply in one step; cub splits it into two you can watch,
   and the gap is where you confirm parity.
3. **The other delivery — GitOps via OCI** (the alternative to `kubectl apply`).

All commands below are verified: the cub render produces 24 objects in `monitoring` (helm's 23
plus an explicit `Namespace`); the namespace is honored; prometheus `default` has **no baked
Secret**, so there is no `out/secrets` for this chart.

---

## The copy

### Get Started

Install one chart two ways and watch both land in the same place. That is the whole idea: for a
reasonable chart, `helm install` and `cub installer` reach the **same running result**. What
changes is how much you can see on the way there. We'll use Prometheus, on any throwaway cluster
(kind is fine). No ConfigHub account.

#### Install it — both paths, same outcome

Plain Helm, one step:

```sh
helm install prom prometheus-community/prometheus --version 29.8.0 -n monitoring --create-namespace
```

Prometheus comes up in the `monitoring` namespace.

The ConfigHub way — render the reviewed package, then apply it:

```sh
cub installer setup --pull packages/prometheus-community/prometheus/29.8.0 \
  --base default --work-dir ./prom --non-interactive --namespace monitoring
kubectl apply -f ./prom/out/manifests
```

The same Prometheus comes up in the same namespace. Same outcome — that is **parity**.

> **What is `--pull packages/…`?** Everything here lives in this repo — nothing is fetched
> from outside. We review each chart as a *recipe* (`recipes/<helm-repo>/<chart>/<version>/`:
> its values, variants, and version locks), then publish that recipe as an installer
> *package* under `packages/<helm-repo>/<chart>/<version>/`. A package is the chart's reviewed,
> pre-rendered form plus a short `installer.yaml` naming its *bases* — here, `default` and
> `server-only-ephemeral`. `--pull` tells cub which package to load: a local path (as above),
> an `oci://…` address, or a `.tgz`. `--base` picks the shape; `--namespace` says where it
> lands.

#### How it works — Helm hides one step, cub shows it

`helm install` renders the chart and applies it in a single step, so you meet the objects only
once they are already running. `cub installer` does the same work in two steps you can watch:

1. **Render.** `cub installer setup` writes the exact Kubernetes objects to `./prom/out/manifests`
   — plain files, readable before anything reaches the cluster.
2. **Apply.** `kubectl apply -f ./prom/out/manifests` installs them.

The gap between the two is the point. There you can hold the render up against Helm's own and
check they match:

```sh
helm template prom prometheus-community/prometheus --version 29.8.0   # 23 objects
ls ./prom/out/manifests                                              # the same objects, plus an explicit Namespace
```

Same objects, confirmed before you install. (cub writes the `Namespace` as its own file; Helm
leaves it implicit — that is the one extra.)

#### The other delivery — GitOps via OCI

Already running Argo or Flux from an OCI registry? Skip `kubectl`. Push the same rendered output
to your registry and let the controller you already trust pull it in:

```sh
flux push artifact oci://<your-registry>/prometheus:v1 --path=./prom/out --source=cub-render --revision=v1
```

Same render, delivered the way your cluster already works. The
[serverless guide](../user/serverless-mode.md) has the full, proven sequence.

---

## Generator notes for Codex

- `site/try.html` is byte-checked by `npm run site:verify`, so this is a `generate-public-site.mjs`
  change, not a hand-edit.
- Update the `guideOpeningChecks` header terms for `try.html` in `scripts/verify-site-ux-contract.mjs`:
  the current terms (`"run Helm directly"`, `"render the same chart with"`, `"same Kubernetes
  objects"`) describe the old render-first opening. New opening leads with the install — pick
  stable terms like `"same running result"`, `"helm install"`, and `"cub installer"`.
- The `checks` entry for `try.html` references `"out/secrets"`. Prometheus `default` has no baked
  Secret and renders no `out/secrets`, so drop that term (or switch the example's secret note to
  the chart that actually has one).
- Keep the parity wording consistent with the homepage's existing definition: "When both paths
  get the same deployment, we call that parity."
