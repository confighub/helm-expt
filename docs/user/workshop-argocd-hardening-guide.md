# Harden Argo CD before production, as a variant you can check and keep

A fresh Argo CD install is set up for a demo. The local `admin` account is on,
there is no single sign-on, every signed-in user falls back to no role, and
any Application may sync to any namespace. Articles on production security,
such as the Stackademic piece *Argo CD in Production: The Security
Configuration Nobody Told You About*, list the changes that close those gaps.
This Guide turns that kind of advice into configuration you can check,
compare and keep.

You start from the Catalog's Argo CD base, ask your assistant to write the
hardening as a values file, and check every key the assistant wrote. Then you
compare the result with the base, object by object, and keep it as a variant of
the base with its own staging and production path.

The example uses the Catalog's `argo-cd` 10.2.1 chart and one set of
assumptions. Your team signs in through Okta, every signed-in user can read,
and developers may sync staging but not production. If your team signs in
with GitHub instead, keep Dex on and give it a GitHub connector under
`configs.cm.dex.config`, as the chart's own defaults show; everything else in
this Guide stays the same. Another set of
assumptions gives a sibling variant, and [the last section](#keep-it-as-a-variant-in-confighub)
shows where those live.

Every step before the last runs on your machine with no ConfigHub account
and no cluster. The last step needs an account or a server you run yourself.

## Set up the tools

Install [the cub CLI](https://confighub.github.io/helm-expt/site/try.html#install-cub)
and [Helm](https://helm.sh/docs/intro/install/). Then install the Workshop
plugin at the exact source revision this Guide was checked with (version
0.6.50), because the plugin publishes no release yet.

```sh
cub plugin install confighub/cub-workshop@ace677618705d278b5b859fcd508b2c2ba77a864 --source-repo
```

## 1. Start from the Catalog base

Open the [argo-cd 10.2.1 chart page](https://confighub.github.io/helm-expt/site/charts/argo-cd-argo-cd-10-2-1.html).
Its `default` configuration uses the chart's own defaults, and the page lists
what a static scan of those objects found, including ClusterRoles that can
read Secrets. Hardening the settings does not change those roles, so read that
list before you rely on the result.

Render the base the same way you will render your variant, so the comparison
in step 4 shows only your changes. The Catalog records no values for the
`default` configuration, so the base values file is empty.

```sh
echo '{}' > base-values.yaml
cub config values argo-cd --repo https://argoproj.github.io/argo-helm --version 10.2.1 \
  --release argo-cd --namespace argocd \
  --values base-values.yaml --out base-report.json --render-out base-render.yaml
```

To keep the Catalog's exact package files as well, install the installer
plugin and run the page's setup command with a namespace.

```sh
cub plugin install confighub/installer
cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/argo-cd-argo-cd:10.2.1@sha256:b933436ed879e10c1b684a2d5f89670a35e759264849ec7bfd7c2f2cec1dd5f8 \
  --base default --namespace argocd --work-dir ./argo-base --non-interactive
```

## 2. Ask your assistant to write the hardening as values

Give your assistant the article, or your own security requirements, with this
task.

```text
Write a values file for the argo-cd Helm chart, version 10.2.1, from
https://argoproj.github.io/argo-helm. Apply only the settings the chart's
values control: single sign-on, the local admin account, RBAC and the
default role, and component settings. Leave AppProjects, sync windows and
repository credentials out, and list them separately. Put no secret value in
the file; refer to secrets by key. Do not tell me the file is correct; I will
check it.
```

A first pass that follows the article closely looks like this. It sets the
URL, turns off `admin`, adds Okta as the identity provider, sets RBAC and log
levels, and turns off Dex, the built-in identity broker that Okta replaces. Save it
as `hardened-values.yaml`.

```yaml
configs:
  cm:
    url: https://argocd.example.com
    admin.enabled: false
    oidc.config: |
      name: Okta
      issuer: https://example.okta.com
      clientID: argocd
      clientSecret: $oidc.okta.clientSecret
      requestedScopes: [openid, profile, email, groups]
      requestedIDTokenClaims:
        groups:
          essential: true
  rbac:
    policy.default: role:readonly
    policy.csv: |
      p, role:platform-admin, applications, *, */*, allow
      p, role:developer, applications, get, */*, allow
      p, role:developer, applications, sync, production/*, deny
      p, role:developer, applications, sync, staging/*, allow
      g, platform-engineers, role:platform-admin
      g, app-developers, role:developer
  params:
    server.log.level: info
    application-controller.log.level: info
dex:
  enabled: false
```

## 3. Check every key the assistant wrote

The values check renders the chart with your file, then again with each key
taken out, and says what each key did.

```sh
cub config values argo-cd --repo https://argoproj.github.io/argo-helm --version 10.2.1 \
  --release argo-cd --namespace argocd \
  --values hardened-values.yaml --out report.json --render-out hardened.yaml --exit-code
```

On the first pass it exits 1 and reports two keys that did nothing.

```text
  [IGNORED]    configs.cm.url                                   matched no key under configs.cm, and it changed nothing. Consider the chart-declared candidate notifications.argocdUrl; review before changing your values.
  [APPLIED]    configs.cm.admin.enabled                         changed 4 objects: ... ConfigMap argocd-cm
  [IGNORED]    configs.params.server.log.level                  matched no key under configs.params, and it changed nothing.
  [APPLIED]    configs.params.application-controller.log.level  changed 6 objects: ... (not in the chart's documented values)
  [APPLIED]    dex.enabled                                      changed 12 objects: ...

  2 of 8 values did nothing.
```

Read each line against the chart before you change anything.

- `configs.cm.url` exists, but this chart computes it from `global.domain`,
  whose default is `argocd.example.com`. The article's URL equals that
  computed default, so it changed nothing. The check suggests
  `notifications.argocdUrl`, which sets only the notifications URL. Set
  `global.domain` to your own host instead; it sets both.
- `configs.params.server.log.level` also exists, and the chart computes every
  component's log level from `global.logging.level`, whose default is `info`.
  The setting is already in force, so leave it out.
- `application-controller.log.level` changed the rendered objects, and Argo CD
  still ignores it. The key Argo CD reads is `controller.log.level`. The check
  cannot see this, because any key under `configs.params` lands in the
  ConfigMap. Compare each `configs.params` key with Argo CD's reference file,
  [argocd-cmd-params-cm.yaml](https://github.com/argoproj/argo-cd/blob/master/docs/operator-manual/argocd-cmd-params-cm.yaml),
  and each `configs.cm` key with [argocd-cm.yaml](https://github.com/argoproj/argo-cd/blob/master/docs/operator-manual/argocd-cm.yaml).

The reviewed file sets the domain, drops the log levels, and keeps the rest.

```yaml
global:
  domain: argocd.internal.example
configs:
  cm:
    admin.enabled: false
    oidc.config: |
      name: Okta
      issuer: https://example.okta.com
      clientID: argocd
      clientSecret: $oidc.okta.clientSecret
      requestedScopes: [openid, profile, email, groups]
      requestedIDTokenClaims:
        groups:
          essential: true
  rbac:
    policy.default: role:readonly
    policy.csv: |
      p, role:platform-admin, applications, *, */*, allow
      p, role:platform-admin, clusters, *, *, allow
      p, role:platform-admin, repositories, *, *, allow
      p, role:platform-admin, projects, *, *, allow
      p, role:developer, applications, get, */*, allow
      p, role:developer, applications, sync, production/*, deny
      p, role:developer, applications, sync, staging/*, allow
      p, role:developer, applications, delete, */*, deny
      g, platform-engineers, role:platform-admin
      g, app-developers, role:developer
      g, auditors, role:readonly
dex:
  enabled: false
```

Run the same check again. The command does not overwrite an existing report
or render, so delete `report.json` and `hardened.yaml` from the first pass
before you rerun it. Every key reports `APPLIED` and the command exits 0.
The `$oidc.okta.clientSecret` reference names a key in the `argocd-secret`
Secret. You add that key on the cluster; the rendered Secret carries no data.

## 4. See exactly what the hardening changes

Compare the base with your variant.

```sh
cub config diff base-render.yaml hardened.yaml --summary
cub config diff base-render.yaml hardened.yaml
```

For this example the summary reports 0 added, 6 removed, 9 changed and 44
unchanged. The six removed objects are Dex's Deployment, Service,
ServiceAccount, Role, RoleBinding and NetworkPolicy. The full diff shows the
changes in `argocd-cm`, `argocd-rbac-cm`, `argocd-cmd-params-cm` and the
notifications URL. It also shows new checksum annotations on five workloads,
so applying the variant restarts those pods.

`cub config check hardened.yaml` then lists what delivery must handle. There
are 53 objects, the `argocd` namespace must already exist, and the three CRDs
must be established before any Application or AppProject. The chart render
includes a Job that is a Helm pre-install hook and creates the `argocd-redis`
Secret. The Catalog's package leaves that hook out and lists the Secret as
something you supply, with
`kubectl -n argocd create secret generic argocd-redis --from-literal=auth=<value>`.
Use one route or the other, not both. The [lifecycle Guide](./workshop-lifecycle-guide.md)
shows how to handle hooks.

## 5. Check the advice the tools cannot check

Security articles are recipes, and recipes carry mistakes. The values check
proves which keys changed the objects; it cannot tell whether a setting does
what the article claims. These are the claims in the article above that need
correcting before they reach a base.

| The article says | What is true | How to check it yourself |
| --- | --- | --- |
| GitHub sign-in uses the issuer `token.actions.githubusercontent.com` | That issuer is for GitHub Actions workload identity. Argo CD signs users in with GitHub through Dex's GitHub connector, so keep Dex enabled for GitHub. | The chart's own `dex.config` GitHub example in `helm show values argo-cd` |
| The `application-controller.log.level` key sets the controller's log level | The key is `controller.log.level` | Argo CD's `argocd-cmd-params-cm.yaml` reference |
| `PruneLast=true` protects an Application from deletion | It only makes pruning run last during a sync | Argo CD's sync options documentation |
| The API server needs `--grpc-web` | `--grpc-web` is a flag of the `argocd` CLI, for proxies that cannot carry gRPC | `argocd --help` |
| A resource allowlist keeps out PodSecurityPolicy | Kubernetes removed PodSecurityPolicy in version 1.25 | The Kubernetes deprecation guide |

Ask your assistant to cite the reference file or documentation page for each
setting it writes. A setting with no reference is one to test on a cluster
before production.

## Keep team settings apart from the base

AppProjects, sync windows and repository credentials belong to each team and
each environment, not to the Argo CD install. Keep them as separate files,
one AppProject per team, and check each one.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: payments
  namespace: argocd
spec:
  sourceRepos:
    - https://github.com/example/payments-gitops
  destinations:
    - namespace: payments-staging
      server: https://staging.cluster.internal
    - namespace: payments-production
      server: https://production.cluster.internal
  clusterResourceBlacklist:
    - group: ""
      kind: Namespace
    - group: rbac.authorization.k8s.io
      kind: ClusterRole
    - group: rbac.authorization.k8s.io
      kind: ClusterRoleBinding
  syncWindows:
    - kind: deny
      schedule: "0 0 * * FRI"
      duration: 24h
      applications:
        - "*-production"
```

`cub config check team-payments.yaml` reports one AppProject in the `argocd`
namespace. It needs the AppProject CRD from the base, so deliver it after the
base. Repository credentials should come from a secret manager, for example
through External Secrets, and never sit in either file.

## Keep it as a variant in ConfigHub

The reviewed values are a variant of the Catalog's Argo CD base for one set
of assumptions. Other assumptions give sibling variants of the same base.

- A platform shared by many teams adds one AppProject per team and a separate
  project for cluster-wide resources.
- Change-controlled production adds sync windows and manual production sync.
- A GitHub organization keeps Dex and uses its GitHub connector instead of
  Okta.

Each variant then has its own staging and production copies, promoted in
order. Files are enough while one person looks after one install. ConfigHub
helps once several clusters or teams share these settings. It keeps each
variant with its lineage to the Catalog base, records every later edit as a
change, carries those edits through the next chart version, and gates
production on approval.

These commands need an account or a server you run yourself, and they were
not run for this Guide. Preview the upload with `--dry-run` first; the preview
also needs you signed in.

```sh
cub variant upload --component argocd --variant okta-readonly --namespace argocd hardened.yaml
cub variant create staging argocd-okta-readonly --target staging/cluster \
  --space-pattern "template:argocd-staging"
cub variant promote argocd-staging --dry-run
cub variant approve argocd-staging
```

A variant you make this way is data other teams can pull, just as you pulled
the Catalog base. That is the loop the Workshop is built around: pull a
checked base, make your variant with your assistant, check it, and keep it
where the next team can find it.

## What this proves, and what it does not

The checks are local and static. They show which values changed the rendered
objects, what the variant adds and removes compared with the base, and what
delivery must handle. They do not show that Okta signs anyone in, that the
RBAC policy grants what you intend, or that the pods start. Test those on a
staging cluster before production.
