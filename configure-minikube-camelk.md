# Installing MiniKube and Apache Camel K

Before using the Tooling for Apache Camel K VS Code extension, both [Minikube](https://kubernetes.io/docs/setup/minikube/) and [Apache Camel K](https://camel.apache.org/camel-k/latest/index.html) must be installed on the local machine.

* To install Minikube, follow the directions [here](https://camel.apache.org/camel-k/latest/installation/platform/minikube.html).
* To install Camel-K, grab the latest release (such as [1.0.1](https://github.com/apache/camel-k/releases), copy it into a folder on the machine, and make that folder accessible on the system path.

Once Minikube and Apache Camel K are installed, follow the steps [here](https://camel.apache.org/camel-k/latest/installation/installation.html#procedure).

To ensure that everything is running properly, you can use `kamel get` at the command line to ensure you can get a list of running integrations. It should be empty initially.
