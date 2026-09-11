
Stack: kubara-gitops-shop  —  Kubara components plus the retained Argo CD controller and shop app. Static composition only; repository binding, target prerequisites and live delivery remain required.
Resolving 6 components: cert-manager, traefik, metrics-server, external-secrets, argo-cd, shop-web

Certify
  [PASS] no resource conflicts across components (184 objects)
  [PASS] CRD ordering: 59 CRDs are delivered before the 2 custom resources that need them
  [PASS] served API versions: 2 custom resource(s) match their bundled CRD; target availability is not checked
  [PASS] app needs met: shop-web needs an ingress controller, cert-manager, external-secrets, all carried by this stack
  [WARN] 4 admission webhook(s) need a caBundle — cert-manager is in the stack and can issue it
  [WARN] namespaces: 0 created, 6 must already exist (argocd, cert-manager, external-secrets, kube-system, shop, traefik)
  [WARN] target prerequisite unknown: ClusterIssuer/letsencrypt; Include ClusterIssuer/letsencrypt in the stack, or verify it exists on the selected target before delivery.
  [WARN] target prerequisite unknown: ClusterSecretStore/platform-store; Include ClusterSecretStore/platform-store in the stack, or verify it exists on the selected target before delivery.
  => CERTIFIED

Sandbox render  (free, no infrastructure)
  184 objects total
      cert-manager: 46  [mgmt]
      traefik: 31  [mgmt]
      metrics-server: 9  [mgmt]
      external-secrets: 44  [mgmt]
      argo-cd: 49  [mgmt]
      shop-web: 5  [workload]  [authored]

  Saved editable components, stack.yaml, rendered.yaml and baseline result.json in ./plugin/compose-ai/platform
  Resume: cub stack certify './plugin/compose-ai/platform/stack.yaml' --json
  Edit a component, then save a new result and render before sharing. Target availability is not checked.

$ env CUB_CONFIG=./cli/config.yaml cub stack sandbox kubara-gitops-shop --workspace ./plugin/compose-ai/platform
exit=0
{
  "apiVersion": "evidence.confighub.com/v1alpha1",
  "kind": "StackCertificationResult",
  "name": "kubara-gitops-shop",
  "certified": true,
  "objectCount": 184,
  "producer": {
    "name": "cub-workshop",
    "version": "0.6.21",
    "repository": "https://github.com/confighub/cub-workshop"
  },
  "scope": {
    "mode": "static-composition",
    "targetAvailability": "not-checked",
    "applicationHealth": "not-checked"
  },
  "prerequisites": {
    "scope": "explicit-namespaces-and-certificate-secret-store-ingress-class-references",
    "targetChecked": false,
    "requirements": [
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "argocd",
        "status": "unknown",
        "consumers": [
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Secret",
            "name": "argocd-notifications-secret",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Secret",
            "name": "argocd-secret",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-cmd-params-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-gpg-keys-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-notifications-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-rbac-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-ssh-known-hosts-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-tls-certs-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argo-cd-argocd-redis-health-configmap",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-redis",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-redis",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "StatefulSet",
            "name": "argo-cd-argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/argocd in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "cert-manager",
        "status": "unknown",
        "consumers": [
          {
            "component": "cert-manager",
            "kind": "ServiceAccount",
            "name": "cert-manager-cainjector",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "ServiceAccount",
            "name": "cert-manager",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "ServiceAccount",
            "name": "cert-manager-webhook",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Role",
            "name": "cert-manager-webhook:dynamic-serving",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "RoleBinding",
            "name": "cert-manager-webhook:dynamic-serving",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Service",
            "name": "cert-manager-cainjector",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Service",
            "name": "cert-manager",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Service",
            "name": "cert-manager-webhook",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Deployment",
            "name": "cert-manager-cainjector",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Deployment",
            "name": "cert-manager",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Deployment",
            "name": "cert-manager-webhook",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/cert-manager in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "external-secrets",
        "status": "unknown",
        "consumers": [
          {
            "component": "external-secrets",
            "kind": "ServiceAccount",
            "name": "external-secrets-cert-controller",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "ServiceAccount",
            "name": "external-secrets",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "ServiceAccount",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Secret",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Role",
            "name": "external-secrets-leaderelection",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "RoleBinding",
            "name": "external-secrets-leaderelection",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Service",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Deployment",
            "name": "external-secrets-cert-controller",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Deployment",
            "name": "external-secrets",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Deployment",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/external-secrets in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "kube-system",
        "status": "unknown",
        "consumers": [
          {
            "component": "cert-manager",
            "kind": "Role",
            "name": "cert-manager-cainjector:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Role",
            "name": "cert-manager:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "RoleBinding",
            "name": "cert-manager-cainjector:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "RoleBinding",
            "name": "cert-manager:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "ServiceAccount",
            "name": "metrics-server",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "RoleBinding",
            "name": "metrics-server-auth-reader",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "Service",
            "name": "metrics-server",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "Deployment",
            "name": "metrics-server",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/kube-system in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "shop",
        "status": "unknown",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "Deployment",
            "name": "shop-web",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "Service",
            "name": "shop-web",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "Ingress",
            "name": "shop-web",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "Certificate",
            "name": "shop-web-tls",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "ExternalSecret",
            "name": "shop-web-db",
            "namespace": "shop",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/shop in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "traefik",
        "status": "unknown",
        "consumers": [
          {
            "component": "traefik",
            "kind": "ServiceAccount",
            "name": "traefik",
            "namespace": "traefik",
            "field": "metadata.namespace"
          },
          {
            "component": "traefik",
            "kind": "Service",
            "name": "traefik",
            "namespace": "traefik",
            "field": "metadata.namespace"
          },
          {
            "component": "traefik",
            "kind": "Deployment",
            "name": "traefik",
            "namespace": "traefik",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/traefik in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "cert-manager.io",
        "kind": "ClusterIssuer",
        "namespace": null,
        "name": "letsencrypt",
        "status": "unknown",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "Certificate",
            "name": "shop-web-tls",
            "namespace": "shop",
            "field": "spec.issuerRef"
          }
        ],
        "remedy": "Include ClusterIssuer/letsencrypt in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "external-secrets.io",
        "kind": "ClusterSecretStore",
        "namespace": null,
        "name": "platform-store",
        "status": "unknown",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "ExternalSecret",
            "name": "shop-web-db",
            "namespace": "shop",
            "field": "spec.secretStoreRef"
          }
        ],
        "remedy": "Include ClusterSecretStore/platform-store in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "networking.k8s.io",
        "kind": "IngressClass",
        "namespace": null,
        "name": "traefik",
        "status": "bundled",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "Ingress",
            "name": "shop-web",
            "namespace": "shop",
            "field": "spec.ingressClassName"
          }
        ],
        "remedy": "Verify readiness on the selected target before delivery."
      }
    ]
  },
  "checks": [
    {
      "result": "PASS",
      "text": "no resource conflicts across components (184 objects)"
    },
    {
      "result": "PASS",
      "text": "CRD ordering: 59 CRDs are delivered before the 2 custom resources that need them"
    },
    {
      "result": "PASS",
      "text": "served API versions: 2 custom resource(s) match their bundled CRD; target availability is not checked"
    },
    {
      "result": "PASS",
      "text": "app needs met: shop-web needs an ingress controller, cert-manager, external-secrets, all carried by this stack"
    },
    {
      "result": "WARN",
      "text": "4 admission webhook(s) need a caBundle — cert-manager is in the stack and can issue it"
    },
    {
      "result": "WARN",
      "text": "namespaces: 0 created, 6 must already exist (argocd, cert-manager, external-secrets, kube-system, shop, traefik)"
    },
    {
      "result": "WARN",
      "text": "target prerequisite unknown: ClusterIssuer/letsencrypt; Include ClusterIssuer/letsencrypt in the stack, or verify it exists on the selected target before delivery."
    },
    {
      "result": "WARN",
      "text": "target prerequisite unknown: ClusterSecretStore/platform-store; Include ClusterSecretStore/platform-store in the stack, or verify it exists on the selected target before delivery."
    }
  ],
  "renderedFile": {
    "path": "kubara-gitops-shop.yaml",
    "sha256": "e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6",
    "bytes": 5592959
  },
  "components": [
    {
      "name": "cert-manager",
      "plane": "mgmt",
      "source": "components/01-cert-manager.yaml",
      "objects": 46
    },
    {
      "name": "traefik",
      "plane": "mgmt",
      "source": "components/02-traefik.yaml",
      "objects": 31
    },
    {
      "name": "metrics-server",
      "plane": "mgmt",
      "source": "components/03-metrics-server.yaml",
      "objects": 9
    },
    {
      "name": "external-secrets",
      "plane": "mgmt",
      "source": "components/04-external-secrets.yaml",
      "objects": 44
    },
    {
      "name": "argo-cd",
      "plane": "mgmt",
      "source": "components/05-argo-cd.yaml",
      "objects": 49
    },
    {
      "name": "shop-web",
      "plane": "workload",
      "source": "components/06-shop-web.yaml",
      "objects": 5
    }
  ]
}

$ env CUB_CONFIG=./cli/config.yaml cub stack certify ./plugin/compose-ai/platform/stack.yaml --json
exit=0

Stack: kubara-gitops-shop  —  Kubara components plus the retained Argo CD controller and shop app. Static composition only; repository binding, target prerequisites and live delivery remain required.
Resolving 6 components: cert-manager, traefik, metrics-server, external-secrets, argo-cd, shop-web

Certify
  [PASS] no resource conflicts across components (184 objects)
  [PASS] CRD ordering: 59 CRDs are delivered before the 2 custom resources that need them
  [PASS] served API versions: 2 custom resource(s) match their bundled CRD; target availability is not checked
  [PASS] app needs met: shop-web needs an ingress controller, cert-manager, external-secrets, all carried by this stack
  [WARN] 4 admission webhook(s) need a caBundle — cert-manager is in the stack and can issue it
  [WARN] namespaces: 0 created, 6 must already exist (argocd, cert-manager, external-secrets, kube-system, shop, traefik)
  [WARN] target prerequisite unknown: ClusterIssuer/letsencrypt; Include ClusterIssuer/letsencrypt in the stack, or verify it exists on the selected target before delivery.
  [WARN] target prerequisite unknown: ClusterSecretStore/platform-store; Include ClusterSecretStore/platform-store in the stack, or verify it exists on the selected target before delivery.
  => CERTIFIED

Sandbox render  (free, no infrastructure)
  184 objects total
      cert-manager: 46  [mgmt]
      traefik: 31  [mgmt]
      metrics-server: 9  [mgmt]
      external-secrets: 44  [mgmt]
      argo-cd: 49  [mgmt]
      shop-web: 5  [workload]  [authored]

  Wrote 184 objects in plane order to ./plugin/compose-ai/platform/rendered.yaml

  Ready. `cub stack upload kubara-gitops-shop --run` builds the base Spaces and links in ConfigHub.


$ env CUB_CONFIG=./cli/config.yaml cub stack sandbox ./plugin/compose-ai/platform/stack.yaml --out ./plugin/compose-ai/platform/rendered.yaml
exit=0
{
  "apiVersion": "evidence.confighub.com/v1alpha1",
  "kind": "StackCertificationResult",
  "name": "kubara-gitops-shop",
  "certified": true,
  "objectCount": 184,
  "producer": {
    "name": "cub-workshop",
    "version": "0.6.21",
    "repository": "https://github.com/confighub/cub-workshop"
  },
  "scope": {
    "mode": "static-composition",
    "targetAvailability": "not-checked",
    "applicationHealth": "not-checked"
  },
  "prerequisites": {
    "scope": "explicit-namespaces-and-certificate-secret-store-ingress-class-references",
    "targetChecked": false,
    "requirements": [
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "argocd",
        "status": "unknown",
        "consumers": [
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ServiceAccount",
            "name": "argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Secret",
            "name": "argocd-notifications-secret",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Secret",
            "name": "argocd-secret",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-cmd-params-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-gpg-keys-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-notifications-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-rbac-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-ssh-known-hosts-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argocd-tls-certs-cm",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "ConfigMap",
            "name": "argo-cd-argocd-redis-health-configmap",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Role",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "RoleBinding",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Service",
            "name": "argo-cd-argocd-redis",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-applicationset-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-notifications-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-repo-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-dex-server",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "Deployment",
            "name": "argo-cd-argocd-redis",
            "namespace": "argocd",
            "field": "metadata.namespace"
          },
          {
            "component": "argo-cd",
            "kind": "StatefulSet",
            "name": "argo-cd-argocd-application-controller",
            "namespace": "argocd",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/argocd in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "cert-manager",
        "status": "unknown",
        "consumers": [
          {
            "component": "cert-manager",
            "kind": "ServiceAccount",
            "name": "cert-manager-cainjector",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "ServiceAccount",
            "name": "cert-manager",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "ServiceAccount",
            "name": "cert-manager-webhook",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Role",
            "name": "cert-manager-webhook:dynamic-serving",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "RoleBinding",
            "name": "cert-manager-webhook:dynamic-serving",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Service",
            "name": "cert-manager-cainjector",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Service",
            "name": "cert-manager",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Service",
            "name": "cert-manager-webhook",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Deployment",
            "name": "cert-manager-cainjector",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Deployment",
            "name": "cert-manager",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Deployment",
            "name": "cert-manager-webhook",
            "namespace": "cert-manager",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/cert-manager in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "external-secrets",
        "status": "unknown",
        "consumers": [
          {
            "component": "external-secrets",
            "kind": "ServiceAccount",
            "name": "external-secrets-cert-controller",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "ServiceAccount",
            "name": "external-secrets",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "ServiceAccount",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Secret",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Role",
            "name": "external-secrets-leaderelection",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "RoleBinding",
            "name": "external-secrets-leaderelection",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Service",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Deployment",
            "name": "external-secrets-cert-controller",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Deployment",
            "name": "external-secrets",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          },
          {
            "component": "external-secrets",
            "kind": "Deployment",
            "name": "external-secrets-webhook",
            "namespace": "external-secrets",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/external-secrets in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "kube-system",
        "status": "unknown",
        "consumers": [
          {
            "component": "cert-manager",
            "kind": "Role",
            "name": "cert-manager-cainjector:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "Role",
            "name": "cert-manager:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "RoleBinding",
            "name": "cert-manager-cainjector:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "cert-manager",
            "kind": "RoleBinding",
            "name": "cert-manager:leaderelection",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "ServiceAccount",
            "name": "metrics-server",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "RoleBinding",
            "name": "metrics-server-auth-reader",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "Service",
            "name": "metrics-server",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          },
          {
            "component": "metrics-server",
            "kind": "Deployment",
            "name": "metrics-server",
            "namespace": "kube-system",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/kube-system in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "shop",
        "status": "unknown",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "Deployment",
            "name": "shop-web",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "Service",
            "name": "shop-web",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "Ingress",
            "name": "shop-web",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "Certificate",
            "name": "shop-web-tls",
            "namespace": "shop",
            "field": "metadata.namespace"
          },
          {
            "component": "shop-web",
            "kind": "ExternalSecret",
            "name": "shop-web-db",
            "namespace": "shop",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/shop in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "",
        "kind": "Namespace",
        "namespace": null,
        "name": "traefik",
        "status": "unknown",
        "consumers": [
          {
            "component": "traefik",
            "kind": "ServiceAccount",
            "name": "traefik",
            "namespace": "traefik",
            "field": "metadata.namespace"
          },
          {
            "component": "traefik",
            "kind": "Service",
            "name": "traefik",
            "namespace": "traefik",
            "field": "metadata.namespace"
          },
          {
            "component": "traefik",
            "kind": "Deployment",
            "name": "traefik",
            "namespace": "traefik",
            "field": "metadata.namespace"
          }
        ],
        "remedy": "Include Namespace/traefik in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "cert-manager.io",
        "kind": "ClusterIssuer",
        "namespace": null,
        "name": "letsencrypt",
        "status": "unknown",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "Certificate",
            "name": "shop-web-tls",
            "namespace": "shop",
            "field": "spec.issuerRef"
          }
        ],
        "remedy": "Include ClusterIssuer/letsencrypt in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "external-secrets.io",
        "kind": "ClusterSecretStore",
        "namespace": null,
        "name": "platform-store",
        "status": "unknown",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "ExternalSecret",
            "name": "shop-web-db",
            "namespace": "shop",
            "field": "spec.secretStoreRef"
          }
        ],
        "remedy": "Include ClusterSecretStore/platform-store in the stack, or verify it exists on the selected target before delivery."
      },
      {
        "group": "networking.k8s.io",
        "kind": "IngressClass",
        "namespace": null,
        "name": "traefik",
        "status": "bundled",
        "consumers": [
          {
            "component": "shop-web",
            "kind": "Ingress",
            "name": "shop-web",
            "namespace": "shop",
            "field": "spec.ingressClassName"
          }
        ],
        "remedy": "Verify readiness on the selected target before delivery."
      }
    ]
  },
  "checks": [
    {
      "result": "PASS",
      "text": "no resource conflicts across components (184 objects)"
    },
    {
      "result": "PASS",
      "text": "CRD ordering: 59 CRDs are delivered before the 2 custom resources that need them"
    },
    {
      "result": "PASS",
      "text": "served API versions: 2 custom resource(s) match their bundled CRD; target availability is not checked"
    },
    {
      "result": "PASS",
      "text": "app needs met: shop-web needs an ingress controller, cert-manager, external-secrets, all carried by this stack"
    },
    {
      "result": "WARN",
      "text": "4 admission webhook(s) need a caBundle — cert-manager is in the stack and can issue it"
    },
    {
      "result": "WARN",
      "text": "namespaces: 0 created, 6 must already exist (argocd, cert-manager, external-secrets, kube-system, shop, traefik)"
    },
    {
      "result": "WARN",
      "text": "target prerequisite unknown: ClusterIssuer/letsencrypt; Include ClusterIssuer/letsencrypt in the stack, or verify it exists on the selected target before delivery."
    },
    {
      "result": "WARN",
      "text": "target prerequisite unknown: ClusterSecretStore/platform-store; Include ClusterSecretStore/platform-store in the stack, or verify it exists on the selected target before delivery."
    }
  ],
  "renderedFile": {
    "path": "kubara-gitops-shop.yaml",
    "sha256": "e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6",
    "bytes": 5592959
  },
  "components": [
    {
      "name": "cert-manager",
      "plane": "mgmt",
      "source": "components/01-cert-manager.yaml",
      "objects": 46
    },
    {
      "name": "traefik",
      "plane": "mgmt",
      "source": "components/02-traefik.yaml",
      "objects": 31
    },
    {
      "name": "metrics-server",
      "plane": "mgmt",
      "source": "components/03-metrics-server.yaml",
      "objects": 9
    },
    {
      "name": "external-secrets",
      "plane": "mgmt",
      "source": "components/04-external-secrets.yaml",
      "objects": 44
    },
    {
      "name": "argo-cd",
      "plane": "mgmt",
      "source": "components/05-argo-cd.yaml",
      "objects": 49
    },
    {
      "name": "shop-web",
      "plane": "workload",
      "source": "components/06-shop-web.yaml",
      "objects": 5
    }
  ]
}

$ env CUB_CONFIG=./cli/config.yaml cub stack certify ./plugin/compose-ai/platform-moved/stack.yaml --json
exit=0

$ sh -c env CUB_CONFIG=./cli/config.yaml cub stack certify ./plugin/compose-ai/platform-moved/stack.yaml --json > ./plugin/compose-ai/platform-moved/changed-result.json
exit=0

Stack: kubara-gitops-shop  —  Kubara components plus the retained Argo CD controller and shop app. Static composition only; repository binding, target prerequisites and live delivery remain required.
Resolving 6 components: cert-manager, traefik, metrics-server, external-secrets, argo-cd, shop-web

Certify
  [PASS] no resource conflicts across components (184 objects)
  [PASS] CRD ordering: 59 CRDs are delivered before the 2 custom resources that need them
  [PASS] served API versions: 2 custom resource(s) match their bundled CRD; target availability is not checked
  [PASS] app needs met: shop-web needs an ingress controller, cert-manager, external-secrets, all carried by this stack
  [WARN] 4 admission webhook(s) need a caBundle — cert-manager is in the stack and can issue it
  [WARN] namespaces: 0 created, 6 must already exist (argocd, cert-manager, external-secrets, kube-system, shop, traefik)
  [WARN] target prerequisite unknown: ClusterIssuer/letsencrypt; Include ClusterIssuer/letsencrypt in the stack, or verify it exists on the selected target before delivery.
  [WARN] target prerequisite unknown: ClusterSecretStore/platform-store; Include ClusterSecretStore/platform-store in the stack, or verify it exists on the selected target before delivery.
  => CERTIFIED

Sandbox render  (free, no infrastructure)
  184 objects total
      cert-manager: 46  [mgmt]
      traefik: 31  [mgmt]
      metrics-server: 9  [mgmt]
      external-secrets: 44  [mgmt]
      argo-cd: 49  [mgmt]
      shop-web: 5  [workload]  [authored]

  Wrote 184 objects in plane order to ./plugin/compose-ai/platform-moved/changed.yaml

  Ready. `cub stack upload kubara-gitops-shop --run` builds the base Spaces and links in ConfigHub.


$ env CUB_CONFIG=./cli/config.yaml cub stack sandbox ./plugin/compose-ai/platform-moved/stack.yaml --out ./plugin/compose-ai/platform-moved/changed.yaml
exit=0
--- ./plugin/compose-ai/platform-moved/rendered.yaml	2026-09-11 18:13:51
+++ ./plugin/compose-ai/platform-moved/changed.yaml	2026-09-11 18:14:13
@@ -97785,7 +97785,7 @@
   name: shop-web
   namespace: shop
 spec:
-  replicas: 3
+  replicas: 2
   selector:
     matchLabels:
       app: shop-web

$ diff -u ./plugin/compose-ai/platform-moved/rendered.yaml ./plugin/compose-ai/platform-moved/changed.yaml
exit=1

$ sh -c env CUB_CONFIG=./cli/config.yaml cub stack certify ./plugin/compose-ai/incompatible/stack.yaml --json > ./plugin/compose-ai/incompatible/refusal.json
exit=1

$ sh -c env CUB_CONFIG=./cli/config.yaml cub stack certify ./plugin/compose-ai/recovered/stack.yaml --json > ./plugin/compose-ai/recovered/recovery.json
exit=0
2cc7c7ee6ab1b7e87ce01423145f48e984353744d7b237c758f71f73edd48b2a  ./plugin/compose-ai/platform-moved/result.json
c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774  ./plugin/compose-ai/platform-moved/changed-result.json
5ea63d1dcca49f44b73f839a220ae9ef30a911398fb84820766291563a119072  ./plugin/compose-ai/incompatible/refusal.json
c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774  ./plugin/compose-ai/recovered/recovery.json
e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6  ./plugin/compose-ai/platform-moved/rendered.yaml
d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3  ./plugin/compose-ai/platform-moved/changed.yaml
