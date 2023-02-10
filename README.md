<h1 align="center">
  <img width="125" height="125" src="https://raw.githubusercontent.com/camel-tooling/vscode-camelk/main/icons/icon128.png">
  <br>
  Tooling for Apache Camel K
</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=redhat.vscode-camelk"><img src="https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-camelk?style=for-the-badge" alt="Marketplace Version"/></a>
  <a href="https://circleci.com/gh/camel-tooling/vscode-camelk"><img src="https://img.shields.io/circleci/build/github/camel-tooling/vscode-camelk/main?style=for-the-badge" alt="CircleCI"></a>
  <a href="https://github.com/camel-tooling/vscode-camelk/blob/main/LICENSE"><img src="https://img.shields.io/github/license/camel-tooling/vscode-camelk?color=blue&style=for-the-badge" alt="License"/></a>
  <a href="https://gitter.im/camel-tooling/Lobby"><img src="https://img.shields.io/gitter/room/camel-tooling/Lobby?color=yellow&style=for-the-badge" alt="Gitter"/></a>
</p><br/>

<h2 align="center">VS Code support for Apache Camel K functionality</h2>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#requirements">Requirements</a> •
  <a href="https://camel-tooling.github.io/vscode-camelk/">Documentation</a> •
  <a href="#issues">Issues</a>  •
  <a href="#data-and-telemetry">Telemetry</a>
</p>

<p align="center">
<b>First, what is Apache Camel K?</b> According to its Github Readme, <i>“Apache Camel K is a lightweight integration platform, born on Kubernetes, with serverless superpowers.”</i> Essentially Camel K enables developers to run integrations on Kubernetes or OpenShift clusters which enables them to get Camel-based integration solutions up and running very quickly!</p>

<p align="center">
Our goal for the <b>Tooling for Apache Camel K</b> extension for <a href="https://code.visualstudio.com/">Microsoft Visual Studio Code</a> is to make that process even more seamless.</p>

<p align="center">
For more information about Camel K, be sure to check out its <a href="https://camel.apache.org/camel-k/latest/index.html">documentation</a> and <a href="https://github.com/apache/camel-K">github</a> pages.
</p><br/>

<p align="center"><img src="./docs/images/quickstart-console.jpg" alt="Running Camel K integration" width="100%"/></p>

### Features

- Create/Start/Stop an Apache Camel K Integration
- Create a new Camel K Integration task configuration with multiple parameters
- Publish new Kubernetes ConfigMaps or Secrets
- View the status of published integrations
- View the log for an Apache Camel K Operator
- View the running log for a published Apache Camel K Integration
- Java Language Support
- Customize Apache Camel K Extension Settings
- Change the Namespace

### Requirements

- An **instance of Apache Camel K** running on a Kubernetes or an OpenShift cluster
- **Minikube** or the **Kubernetes CLI** installed. (more details at [Apache Camel K Installation](https://camel.apache.org/camel-k/latest/installation/installation.html) page)

### Documentation

Our full documentation is located in [GitHub pages](https://camel-tooling.github.io/vscode-camelk/). Included are details about all of Tooling for Apache Camel K extension capabilities with examples and detailed information.

### Issues

Something is not working properly? In that case, feel free to [open issues, add feature requests, report bugs, etc.](https://github.com/camel-tooling/vscode-camelk/issues)

### Get Involved

If you'd like to help us get better, we appriciate it!
Check out our [Contribution Guide](Contributing.md) on how to do that.

### Data and Telemetry

The Tooling for Apache Camel K extension collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.elemetry.enabled` setting which you can learn more about at [How to disable Telemetry reporting](https://github.com/redhat-developer/vscode-redhat-telemetry#how-to-disable-telemetry-reporting).
