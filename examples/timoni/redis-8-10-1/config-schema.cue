#Config: {
	// The Kubernetes metadata common to all resources.
	// The `metadata.name` and `metadata.namespace` fields are
	// set from the user-supplied instance name and namespace.
	metadata: timoniv1.#Metadata & {
		// The annotations allows adding `metadata.annotations` to all resources.
		annotations?: timoniv1.#Annotations
		// The labels allows adding `metadata.labels` to all resources.
		// The `app.kubernetes.io/name` and `app.kubernetes.io/version` labels
		// are automatically generated and can't be overwritten.
		labels: timoniv1.#Labels
	}
	// Redis config
	maxmemory: *512 | int & >=64
	readonly: replicas: *1 | int & >=0
	persistence: {
		enabled:      *true | bool
		storageClass: *"standard" | string
		size:         *"8Gi" | string
	}
	password?: string & =~"^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$"
	// The image allows setting the container image repository,
	// tag, digest and pull policy.
	// The default image repository, tag and digest are set in `images.cue`.
	image: timoniv1.#Image & {
		repository: *"docker.io/redis" | string
		tag:        *"8.10.1-alpine" | string
		digest:     *"sha256:becdda6c7f4b3fb42e42fd7f120bbf5c54c4caaaf16f26da24e4563d2c1f0576" | string
		pullPolicy: *"IfNotPresent" | string
	}
	imagePullSecrets?: [...corev1.LocalObjectReference]
	// Resource requirements
	// The resources allows setting the container resource requirements.
	// By default, each Redis container requests 100m CPU and 64Mi memory.
	resources: corev1.#ResourceRequirements & timoniv1.#ResourceRequirements & {
		limits: memory: *"544Mi" | string & timoniv1.#MemoryQuantity
		requests: {
			cpu:    *"100m" | timoniv1.#CPUQuantity
			memory: *"64Mi" | string & timoniv1.#MemoryQuantity
		}
	}
	// Security (common to all deployments)
	securityContextPreset: *"hardened" | timoniv1.#SecurityContextPreset
	// The pods run as non-root with the RuntimeDefault seccomp profile.
	// Under the `hardened` preset, the identity defaults are pinned to
	// the Redis image's non-root UID.
	podSecurityContext: corev1.#PodSecurityContext & timoniv1.#PodSecurityContext & {
		runAsUser:    *1001 | int
		runAsGroup:   *1001 | int
		runAsNonRoot: *true | bool
		fsGroup:      *1001 | int
	}
	// The securityContext allows setting the container security context.
	// By default, the containers are denied privilege escalation, their root
	// filesystem is read-only and all their capabilities are dropped.
	securityContext: corev1.#SecurityContext & timoniv1.#ContainerSecurityContext & {
		allowPrivilegeEscalation: *false | bool
		readOnlyRootFilesystem:   *true | bool
	}
	// Pod scheduling settings (common to all deployments);
	// pods are scheduled on Linux nodes by default.
	nodeSelector: *{"kubernetes.io/os": "linux"} | {[string]: string}
	// The affinity rules: `podAntiAffinity` accepts the `soft` (default),
	// `hard` and `none` presets for spreading each deployment's replicas
	// across nodes, or raw pod anti-affinity rules.
	affinity: timoniv1.#AffinityValues & {
		podAntiAffinity: *"soft" | timoniv1.#AffinityPreset | corev1.#PodAntiAffinity
		nodeAffinity?:   corev1.#NodeAffinity
		podAffinity?:    corev1.#PodAffinity
	}
	// Pod optional settings (common to all deployments)
	podAnnotations?: {[string]: string}
	tolerations?: [...corev1.#Toleration]
	topologySpreadConstraints?: [...corev1.#TopologySpreadConstraint]
	service: {
		// Service
		port: *6379 | int & >0 & <=65535
	}
	clusterDomain: "cluster.local"
	// Test Job disabled by default.
	test: {
		enabled: *false | bool
	}
}
