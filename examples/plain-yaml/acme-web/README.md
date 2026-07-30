# Plain YAML application

This example starts with four ordinary Kubernetes YAML files. There is no Helm
chart and no render step.

The files describe:

- one Namespace;
- one ConfigMap with a welcome message;
- one Deployment with a digest-pinned image and health probes; and
- one Service.

The repository proof uploads these files to ConfigHub with one Unit per
Kubernetes object. It then reads the Units back and compares them with these
files. A separate README Unit explains the example inside Hub.

This example proves the import boundary. It does not claim that the application
was deployed or observed on a cluster.
