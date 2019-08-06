[![GitHub tag](https://img.shields.io/github/tag/camel-tooling/vscode-camelk.svg?style=plastic)]()
[![Build Status](https://travis-ci.org/camel-tooling/vscode-camelk.svg?branch=master)](https://travis-ci.org/camel-tooling/vscode-camelk)
[![License](https://img.shields.io/badge/license-Apache%202-blue.svg)]()
[![Gitter](https://img.shields.io/gitter/room/camel-tooling/Lobby.js.svg)](https://gitter.im/camel-tooling/Lobby)

# Visual Studio extension to support Apache Camel K

This extension offers basic integration with Apache Camel K (https://github.com/apache/camel-K) on two fronts.

First, Apache Camel K runs with a combination of the "kamel" runtime and either Minishift, Minikube, or GKE running locally on the development system. We utilize the "kamel" and "kubectl" executables to manage a few basic tasks listed further down.

Second, we also have the capability of using Restful calls to a Proxy when provided the correct URL and port combination (defaulting to http://localhost:8000). The proxy offers the same functionality as if we were using the command-line executables.

To install Minikube and Apache Camel K, see [Installing MiniKube and Camel K](configure-minikube-camelk.md).

## Kubernetes tools in VS Code

The [Kubernetes Tools extension from Microsoft](https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools) offers a number of tools we can use with Minikube and Apache Camel K. With a local Minikube instance running, you can see your local clusters appear in the Kubernetes Activity view.

![Kubernetes Activity with Camel K](images/kubernetes-view-camelk.jpg)

With any node appearing in a Minikube cluster, you can easily follow the logs by right-clicking and selecting "Follow Logs" in the context menu.

![Kubernetes View pop-up menu](images/kubernetes-view-camelk-popup.jpg)

This opens a log for the selected pod in a new Terminal window.

![Kubernetes View operator log](images/kubernetes-view-camelk-operator-log.jpg)

## Starting new Apache Camel K integrations

Once your Apache Camel K/Minikube environment is running and the vscode-camelk extension is installed, you can easily start a new Apache Camel K integration from a Java (*.java), Camel XML (Spring DSL) (*.xml), JavaScript (*.js), Groovy (*.groovy), or Kotlin (*.kts) file. To do this, right-click on the integration file, and select "Start Apache Camel K Integration".

With [Language Support for Apache Camel](https://marketplace.visualstudio.com/items?itemName=camel-tooling.vscode-apache-camel) installed, you also get LSP support for URIs and more in Camel XML, Java, Groovy, and other routes:

![Hello XML](images/kubernetes-view-camelk-hello-xml.jpg)

## 'Start Apache Camel K Integration' menu results

If the Apache Camel K executable (kamel.exe) is in the system path, we can simply call the utility with appropriate options to run a particular file when the user wishes. For example, if I have a simple workspace with a Groovy file...

![Run Menu](images/kubernetes-view-camelk-run-xml-menu.jpg)

Once you click the Start Apache Camel-K Integration menu, a drop-down appears in the command palette with three choices:

![Start types](images/camelk-start-integration-dropdown.jpg)

You have three choices:

* Basic - Apache Camel K Integration (no ConfigMap or Secret)
* ConfigMap - Apache Camel-K Integration with Kubernetes ConfigMap
* Secret - Apache Camel-K Integration with Kubernetes Secret

We'll cover the Basic case here. When you select the "Basic" option, it runs my Apache Camel-K Groovy file as a new integration in the directory of the file (i.e. `kamel run "filename"` or the equivalent Kubernetes rest call) or uses the Kubernetes Rest API to deploy the integration to the running Kubernetes system.

Once the integration is in a "running" state, it's ready to go!

Note that the first time a new integration is published, it may take a few seconds to propagate through the system to a running state. Use the "Refresh" button when you hover over the Apache Camel K Integrations view to update the state of your currently deployed integrations.

## Publishing new Kubernetes ConfigMaps or Secrets

We have added two new menus when you right-click on a *.properties file in the Explorer view:

* Create Kubernetes Config Map from File
* Create Kubernetes Secret from File

In both cases, you are asked for the name of your new ConfigMap or Secret. The name must start with a letter and contain no spaces, but can use numbers or hyphens (i.e. "my-confg-map" is valid but "my config map" is not). Once given a valid name, the action will create your new ConfigMap or Secret that you can reference in your Apache Camel-K route. 

![Kubernetes ConfigMap List](images/kubernetes-secret-name-command.jpg)

See [Configuration via ConfigMap or Secret](https://camel.apache.org/staging/camel-k/latest/configuration/configmap-secret.html) in the Apache Camel-K documentation for more details.

## Running with Kubernetes ConfigMaps or Secrets

If you select the "ConfigMap - Apache Camel-K Integration with Kubernetes ConfigMap" or "Secret - Apache Camel-K Integration with Kubernetes Secret" you will be presented with a list of the published ConfigMaps or Secrets in your current Kubernetes system. Select the one you want to use with your integration and it will run accordingly.

![Kubernetes ConfigMap List](images/kubernetes-configmap-list.jpg)

## Output Channels

There are two types of "output channels" providing details for the extension.

* The "Apache Camel K" output channel (View->Output, select "Apache Camel K" from the drop-down in the view) offers details about events such as when the Apache Camel K Integrations view is refreshed, when new integrations are started, when running integrations are stopped, and when the log of a particular running integration is viewed.
* In that last case, the "Follow log for Apache Camel K Integration" menu, when invoked on a running integration in the Apache Camel K Integrations view, opens a new Output channel named for the running "pod" associated with that particular integration. This gives you access to the running Camel log for the selected integration.

## Stopping running Apache Camel K integrations

Once an integration is running, it may be stopped in the "Apache Camel K Integrations" view by right-clicking on the integration and selecting "Remove Apache Camel K Integration." Stopping an integration removes its associated output channel.

"Remove Apache Camel K Integration" essentially calls `kamel delete '${filename}'` (or the equivalent call in the Kubernetes Rest API) to stop the running integration in the system.

## Apache Camel K Integrations view

The Apache Camel K Integrations view offers a list of the "integrations" registered with the current Apache Camel K context. If you right-click on a running integration, you can "Remove" an integration to stop them in the system or "Follow" the log to show the running log for your integration in a new Output channel.

![Apache Camel K integrations view Remove](images/camelk-integrations-view-remove-menu.jpg)

Following a log opens a new Output channel named for the running Kubernetes pod where the integration is running. It updates as new data is added:

![Apache Camel K integrations view Log](images/camelk-integrations-view-integrations-log.jpg)

In addition, the view has a "Refresh" button that can be used to manually trigger a refresh of the list, but when you add/remove file-based integrations in the Explorer view, it should refresh automatically.

Note: Refreshing the view sometimes is delayed as we wait for pods to start. You may need to give it a few seconds. If nothing happens, the Refresh button is a good option.

![Apache Camel K integrations view Refresh](images/camelk-integrations-view-refresh-action.jpg)

Integrations in the list are decorated with a little dot indicating the status of the deployment. If green, the integration is in a "Running" state. If red, it is in other states such as "Building Kit" or "Error." And if you hover over the integration, the tooltip will show the status.

![Apache Camel K integrations view Status tooltip](images/camelk-integrations-view-status-tooltip.jpg)

### Apache Camel K Status Bar Messages

While events are occurring such as the Apache Camel K Integrations view is being refreshed or a new Integration is being deployed, a status bar message will appear to offer an indication. This can be disabled in the extension settings.

The extension shows status messages when:

* Starting a new integration
* Removing an integration
* Refreshing the integrations view
* Starting to follow an integration log
* Starting a local Kubernetes proxy instance

![Apache Camel K integrations Status Bar](images/camelk-integrations-status-bar.jpg)

## Apache Camel K Extension Settings

To access the new extension settings, go to File->Preferences->Settings, then select "Extensions" and finally "Apache Camel K Tooling Extension Settings."

![Apache Camel K Extension Settings](images/camelk-integrations-view-settings.jpg)

* Proxy Namespace - Currently this drop-down has two values: default and syndesis.
* Proxy Port - Corresponds to the port of the Proxy URL to be used for accessing Kubernetes via Rest APIs. Defaults to 8000.
* Proxy URL - This setting corresponds to the server proxy url for your Kubernetes service. It defaults to http://localhost, but can be altered to any appropriate service URL. It is combined with the port to construct URLs at runtime when starting the proxy and using proxy calls. (See [Use an HTTP Proxy to Access the Kubernetes API)[https://kubernetes.io/docs/tasks/access-kubernetes-api/http-proxy-access-api/] for details on how to create the local proxy (i.e. 'kubectl proxy –port=8000') and "Starting a local Kubernetes proxy" below.)
* Show Status Bar Messages - Indicates whether to show messages in the status bar to indicate when the system is updating, such as when the Camel K Integrations view is being refreshed or a new Integration is being deployed.
* Use Proxy - This setting determines whether the Camel K Integrations view retrieves the list of running integrations via the local 'kubectl' application or via the Kubernetes Rest API and calls through the Proxy URL/Namespace combination above. The ultimate URL becomes [proxyurl]/apis/camel.apache.org/v1alpha1/namespaces/[namespace]/integrations.

## Starting a local Kubernetes proxy

(Only available with the Minikube executable installed, but useful for local development.)

We have created a new command available in the command palette (Ctrl+Shift+P or F1) called "Apache Camel K: Start the Kubernetes proxy server." This will start a new Kubernetes proxy using the Minikube executable ('kubectl proxy --port=8000) and refreshes the Apache Camel K Integrations view immediately. This command creates a local proxy at the URL composed of the Proxy URL and Proxy Port set in the settings. For example, with the defaults the proxy URL becomes http://localhost:8000.

## Known Issues

Here's the current list of issues we're working to resolve. If you find a new issue, please [create a new issue report in GitHub](https://github.com/camel-tooling/vscode-camelk/issues)!
