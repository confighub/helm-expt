# ingress-nginx/ingress-nginx 4.15.1-r1 Installer Package

Package revision 1 of ingress-nginx 4.15.1, the last chart version upstream
published. It corrects the default base of the 4.15.1 package, which left out
the chart's admission certificate Jobs, so the controller waited for a Secret
nothing created. This default base keeps them as Argo CD Sync hooks. The
admission-disabled and internal-clusterip bases are unchanged.

Install it by naming the revision:

```sh
cub package install ingress-nginx:v4.15.1-r1 --space <space> --namespace ingress-nginx
```

It is generated from the ingress-nginx proof artifacts:

```sh
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --generate-proof
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --generate-package
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --verify-proof
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --verify-package
```
