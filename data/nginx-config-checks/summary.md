# NGINX Config Extension Checks

This generated report checks the two supported NGINX base variants for the
specific extension-slot risk described in the user docs: custom NGINX config
text, raw manifests, git-cloned content, metrics add-ons, and sidecars should
not appear silently in the supported bases.

This is not an `nginx -t` semantic config validation. The current supported
bases use the chart's default NGINX config from the image, so there is no custom
`nginx.conf` or `conf.d` content to validate. If a future base fills
`serverBlock`, `streamServerBlock`, `extraDeploy`, metrics, sidecars, or
git-clone values, it should add an NGINX-specific config validation receipt.

## Result

~~~text
variants checked: 2
checks:           14
pass:             14
fail:             0
~~~

| Variant | Check | Result | Evidence |
| --- | --- | --- | --- |
| http-clusterip | no ConfigMap-backed nginx.conf or conf.d content | pass | rendered objects contain no ConfigMap and no configMap volume |
| http-clusterip | no raw extraDeploy object kinds | pass | rendered kinds: Deployment, NetworkPolicy, PodDisruptionBudget, Service, ServiceAccount |
| http-clusterip | no sidecars | pass | containers: nginx |
| http-clusterip | no git-clone init container | pass | initContainers: preserve-logs-symlinks |
| http-clusterip | no metrics add-on service or ServiceMonitor | pass | services: nginx |
| http-clusterip | only expected volumes are mounted | pass | volumes: empty-dir |
| http-clusterip | ingress shape matches variant | pass | Ingress not expected and not rendered |
| existing-tls-ingress | no ConfigMap-backed nginx.conf or conf.d content | pass | rendered objects contain no ConfigMap and no configMap volume |
| existing-tls-ingress | no raw extraDeploy object kinds | pass | rendered kinds: Deployment, Ingress, NetworkPolicy, PodDisruptionBudget, Service, ServiceAccount |
| existing-tls-ingress | no sidecars | pass | containers: nginx |
| existing-tls-ingress | no git-clone init container | pass | initContainers: preserve-logs-symlinks |
| existing-tls-ingress | no metrics add-on service or ServiceMonitor | pass | services: nginx |
| existing-tls-ingress | only expected volumes are mounted | pass | volumes: empty-dir, certificate |
| existing-tls-ingress | ingress shape matches variant | pass | Ingress expected and rendered |

## Routing Rule

| Change | Route |
| --- | --- |
| Leave NGINX extension slots empty. | Use the supported catalog base. |
| Fill NGINX config text, raw manifests, sidecars, metrics, or git-clone values. | Create a new reviewed `cub installer` base variant and add NGINX config validation. |
| Change target, region, labels, gates, or observation policy after render. | Use a derived ConfigHub variant. |

Regenerate:

~~~sh
npm run nginx:config-checks
npm run nginx:config-checks:verify
~~~
