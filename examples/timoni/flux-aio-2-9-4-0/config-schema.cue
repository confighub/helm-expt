#Config: {
	// Flux distribution version
	version: "v2.9.4"
	// Metadata (common to all resources)
	metadata: timoniv1.#Metadata & {
		annotations: "app.kubernetes.io/role": "cluster-admin"
		labels: "app.kubernetes.io/part-of": "flux"
	}
	selector: timoniv1.#Selector
	controllers: {
		source: {
			image: timoniv1.#Image & {
				repository: "ghcr.io/fluxcd/source-controller"
				tag:        "v1.9.4"
				digest:     ""
				pullPolicy: *"IfNotPresent" | string
			}
			resources?:   corev1.#ResourceRequirements
			featureGates: *"" | string
		}
		kustomize: {
			enabled: *true | bool
			image: timoniv1.#Image & {
				repository: "ghcr.io/fluxcd/kustomize-controller"
				tag:        "v1.9.4"
				digest:     ""
				pullPolicy: *"IfNotPresent" | string
			}
			resources?:   timoniv1.#ResourceRequirements
			featureGates: *"ExternalArtifact=true" | string
		}
		helm: {
			enabled: *true | bool
			image: timoniv1.#Image & {
				repository: "ghcr.io/fluxcd/helm-controller"
				tag:        "v1.6.3"
				digest:     ""
				pullPolicy: *"IfNotPresent" | string
			}
			resources?:   timoniv1.#ResourceRequirements
			featureGates: *"ExternalArtifact=true" | string
		}
		notification: {
			enabled: *true | bool
			image: timoniv1.#Image & {
				repository: "ghcr.io/fluxcd/notification-controller"
				tag:        "v1.9.3"
				digest:     ""
				pullPolicy: *"IfNotPresent" | string
			}
			resources?:   timoniv1.#ResourceRequirements
			featureGates: *"" | string
		}
		watcher: {
			enabled: *true | bool
			image: timoniv1.#Image & {
				repository: "ghcr.io/fluxcd/source-watcher"
				tag:        "v2.2.3"
				digest:     ""
				pullPolicy: *"IfNotPresent" | string
			}
			resources?:   timoniv1.#ResourceRequirements
			featureGates: *"" | string
		}
	}
	expose: {
		webhookReceiver:    *false | bool
		notificationServer: *false | bool
		sourceServer:       *false | bool
	}
	proxy: {
		https?: string
		http?:  string
		no:     *".cluster.local.,.cluster.local,.svc" | string
	}
	env?: [string]: string
	securityProfile:    "privileged"
	podSecurityProfile: *"" | "restricted" | "privileged"
	logLevel:           *"info" | string
	hostNetwork:        *true | bool
	compatibility:      *"kubernetes" | "openshift"
	workload: {
		provider: *"" | "aws" | "azure" | "gcp"
		identity: *"" | string
	}
	reconcile: {
		concurrent: *5 | int
		requeue:    *30 | int
	}
	persistence: {
		enabled:      *false | bool
		storageClass: *"standard" | string
		size:         *"8Gi" | string & =~"^([0-9]*)?(Gi)?$"
	}
	tmpfs: {
		enabled:    *false | bool
		sizeLimit?: string & =~"^([0-9]*)?(Mi|Gi)?$"
	}
	resources: timoniv1.#ResourceRequirements & {
		limits: memory: *"1Gi" | timoniv1.#MemoryQuantity
		requests: {
			cpu:    *"100m" | timoniv1.#CPUQuantity
			memory: *"64Mi" | timoniv1.#MemoryQuantity
		}
	}
	imagePullSecrets?: [...timoniv1.#ObjectReference]
	imagePullSecret?: {
		registry!: string
		username!: string
		password!: string
	}
	securityContext: *{allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, runAsNonRoot: true, capabilities: drop: ["ALL"], seccompProfile: type: "RuntimeDefault"} | corev1.#PodSecurityContext
	affinity: corev1.#Affinity & {
		nodeAffinity: requiredDuringSchedulingIgnoredDuringExecution: nodeSelectorTerms: [{matchExpressions: [{key: "kubernetes.io/os", operator: "In", values: ["linux"]}]}]
		podAntiAffinity: requiredDuringSchedulingIgnoredDuringExecution: [{topologyKey: "kubernetes.io/hostname", labelSelector: matchExpressions: [{key: "app.kubernetes.io/name", operator: "In", values: [metadata.name]}]}]
	}
	tolerations: *[{operator: "Exists", key: "node.kubernetes.io/not-ready"}, {operator: "Exists", key: "node.kubernetes.io/unreachable", effect: "NoExecute", tolerationSeconds: 300}] | [...corev1.#Toleration]
}
