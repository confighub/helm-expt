# A run of cub package install, 2026-11-26

**UNOFFICIAL/EXPERIMENTAL**

This log records one run of `cub package install` for one Helm entry,
`bitnami-nginx-24-0-2-http-clusterip`. The run put the entry's signed installer
package into a ConfigHub Space with one command. It then ran the two-step form
the entry page already printed, `cub installer setup` then `cub installer
upload`, into a second Space, and compared the two Spaces.

This is a dated record of one run. It is not a Guide and it is not a receipt for
the entry. Every line that starts with `$` is a command that was run, and the
text under it is the output it printed. Temporary directories are written
`<temp>` and the run's scratch directory is written `$HOME/<work>`.

## Versions and setting

- The client is cub v0.11.23 (commit c95bcee9, built 2026-11-26).
- The server is a throwaway local ConfigHub server at v0.11.1 (commit 00b8b23a), started from a confighub-mini package with `cub mini install`. `cub version` reported it as the server version.
- `cub package install` ran the installer that cub v0.11.23 links. Nothing else was installed for it, and it printed no installer version of its own.
- The `cub installer` plugin was not installed when `cub package install` ran. cub downloaded it on the first `cub installer` command, and `cub installer version` printed `installer 0.6.1`.
- The package was `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67`, the `digest_pinned_ref` in `data/installer-oci-packages/packages.json`. Its default base is `http-clusterip`, and the entry's namespace is `nginx`.
- No hosted organization and no cluster were used. Nothing was released or delivered.

## What the run found

| Check | Result |
| --- | --- |
| `cub package install` into a new Space | Worked in about a second. It created the Space, 7 Units and 9 Links, and a Component named for the package. |
| `cub package list` and `cub package show` | Both read the install back: package, version, namespace, source with its digest, base, and the facts collected. |
| The two-step form into a second Space | Worked. It created the same 7 Units and 9 Links. |
| The Units of the two Spaces | The data of all 7 Units was the same in both Spaces. |
| The Component | `cub package install` named it `bitnami-nginx`, after the package. `cub installer upload --component walk-nginx` named it `walk-nginx`. |

## One command

```text
$ cub package install oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67 --base http-clusterip --space walk-nginx-package --namespace nginx --non-interactive
Installing oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67 into Space walk-nginx-package...
Wizard wrote <temp>/out/record/selection.yaml and inputs.yaml
Collector produced 2 fact(s) in <temp>/out/record/facts.yaml
Base: http-clusterip; components: []
Namespace: nginx
Rendered 6 manifest(s) to <temp>/out/manifests
== bitnami-nginx@24.0.2 → Space walk-nginx-package ==
Space walk-nginx-package (Create)
  Create    nginx
  Create    namespace
  Create    nginx-networkpolicy
  Create    nginx-pdb
  Create    nginx-service
  Create    nginx-serviceaccount
  Create    installer
  Create    link nginx -> namespace (reference:v1/Namespace)
  Create    link nginx -> nginx-serviceaccount (reference:v1/ServiceAccount)
  Create    link nginx-networkpolicy -> namespace (reference:v1/Namespace)
  Create    link nginx-networkpolicy -> nginx (selector)
  Create    link nginx-pdb -> namespace (reference:v1/Namespace)
  Create    link nginx-pdb -> nginx (selector)
  Create    link nginx-service -> namespace (reference:v1/Namespace)
  Create    link nginx-service -> nginx (selector)
  Create    link nginx-serviceaccount -> namespace (reference:v1/Namespace)
```

The command was given no `--work-dir`, so it worked in a temporary directory.
After it finished, that directory no longer existed.

```text
$ cub package list --space walk-nginx-package
SPACE                 PACKAGE          VERSION    NAMESPACE    SOURCE
walk-nginx-package    bitnami-nginx    24.0.2     nginx        oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67
```

```text
$ cub package show --space walk-nginx-package
Package:    bitnami-nginx
Version:    24.0.2
Space:      walk-nginx-package
Source:     oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67
Digest:     sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67
Namespace:  nginx
Base:       http-clusterip

Facts:
  FACT              VALUE
  targetFactChecks  {"base":"http-clusterip","mode":"not-required","result":"pass"}
  targetFacts       {"requiredCRDs":[],"requiredObjectStores":[],"requiredSecrets":[],"requiredTopology":null,"requiredValues":[]}
```

```text
$ cub unit list --space walk-nginx-package
NAME                    SPACE                 CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
nginx-service           walk-nginx-package                                                                                        installer upload of bitnami-nginx@24.0.2
namespace               walk-nginx-package                                                                                        installer upload of bitnami-nginx@24.0.2
nginx-networkpolicy     walk-nginx-package                                                                                        installer upload of bitnami-nginx@24.0.2
nginx                   walk-nginx-package                                                                                        installer upload of bitnami-nginx@24.0.2
nginx-pdb               walk-nginx-package                                                                                        installer upload of bitnami-nginx@24.0.2
nginx-serviceaccount    walk-nginx-package                                                                                        installer upload of bitnami-nginx@24.0.2
```

The list shows 6 Units. The seventh, `installer`, holds the installer record and
is hidden.

```text
$ cub unit get installer --space walk-nginx-package -o jq='.Unit | {HiddenReason}'
{
  "HiddenReason": "InstallerRecord"
}

$ cub unit list --space walk-nginx-package --include-hidden --no-headers | wc -l
       7

$ cub space get walk-nginx-package -o jq='.Space | {Slug, Labels, ComponentID}'
{
  "ComponentID": "<id>",
  "Labels": {
    "Component": "bitnami-nginx",
    "Namespace": "nginx",
    "Variant": "base"
  },
  "Slug": "walk-nginx-package"
}
```

## Two steps, for comparison

```text
$ cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67 --base http-clusterip --work-dir ./bitnami-nginx-24-0-2-http-clusterip --non-interactive --namespace nginx
Loaded prior install state from confighub.
Wizard wrote $HOME/<work>/bitnami-nginx-24-0-2-http-clusterip/out/record/selection.yaml and inputs.yaml
Collector produced 2 fact(s) in $HOME/<work>/bitnami-nginx-24-0-2-http-clusterip/out/record/facts.yaml
Base: http-clusterip; components: []
Namespace: nginx
Rendered 6 manifest(s) to $HOME/<work>/bitnami-nginx-24-0-2-http-clusterip/out/manifests
Next: cub installer upload --work-dir $HOME/<work>/bitnami-nginx-24-0-2-http-clusterip
```

```text
$ cub installer upload --work-dir ./bitnami-nginx-24-0-2-http-clusterip --space walk-nginx-two-step --component walk-nginx
== bitnami-nginx@24.0.2 → Space walk-nginx-two-step ==
Space walk-nginx-two-step (Create)
  Create    nginx
  Create    namespace
  Create    nginx-networkpolicy
  Create    nginx-pdb
  Create    nginx-service
  Create    nginx-serviceaccount
  Create    installer
  ... (9 "Create    link" lines, the same as above, trimmed)

Revert this upload of walk-nginx-two-step with:
  cub unit update --patch --space walk-nginx-two-step --restore Before:ChangeSet:upload-20261126-215856 --where "Labels.UploadSource = 'bitnami-nginx'" --include-hidden=InstallerRecord

Applied: 7 created, 0 updated, 0 emptied, 0 revived, 0 adopted.
```

## Comparison

| | `cub package install` | `cub installer setup` then `upload` |
| --- | --- | --- |
| Units shown by `cub unit list` | 6 | 6 |
| Units with `--include-hidden` | 7 | 7 |
| Links | 9 | 9 |
| Space labels | `Component: bitnami-nginx`, `Namespace: nginx`, `Variant: base` | `Component: walk-nginx`, `Namespace: nginx`, `Variant: base` |
| Component | `bitnami-nginx`, created | `walk-nginx`, created |
| Listed by `cub package list` | Yes | Yes |

`cub unit data` printed the same text for each of the 7 Units in both Spaces.

```text
$ cub component list
NAME             REQUIRE-WORKFLOW    REQUIRE-TRACKING    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
walk-nginx       false               false               0                              base
bitnami-nginx    false               false               0                              base

$ cub package list
SPACE                  PACKAGE          VERSION    NAMESPACE    SOURCE
walk-nginx-package     bitnami-nginx    24.0.2     nginx        oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67
walk-nginx-two-step    bitnami-nginx    24.0.2     nginx        oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67
```

## Notes

1. **`cub package install` has no `--component` flag.** It names the Component after the package. To choose the Component's name, the two-step form with `cub installer upload --component` is the one that does it.
2. **The installer record is now a hidden Unit named `installer`.** In the [walk of 2026-10-08](./live-walk-entry-steps-2026-10-08.md) it was a visible Unit named `installer-record`. The deploy and promote steps on the entry pages still delete `installer-record`. This run did not deploy or promote, so it did not test those steps. The [run of 2026-11-27](./live-walk-entry-deploy-promote-2026-11-27.md) tested them and found the delete no longer needed.
3. **Both forms now create a Component.** In the walk of 2026-10-08, with installer plugin 0.1.0, the upload wrote a `Component` label and created no Component.
4. **`cub installer setup` printed `Loaded prior install state from confighub.`** So it contacted the hub, which held one install of the same package by then. This run did not check what it read.
5. **`cub package install` printed no summary line and no revert command.** `cub installer upload` printed both.

## Not run

The run did not use a hosted organization, `cub auth login`, a context other
than the current one, or a cluster. It did not install again to upgrade, did not
run `cub package install` without `--base`, and did not deploy or promote
either Space.

## Cleanup

The hub was removed with its data, and the scratch directory's keys and tokens
were deleted.

```text
$ cub mini uninstall --name t --delete-data
Removed the hub "t": its data, its cub context, and the server and database it ran, which no other hub used.
```
