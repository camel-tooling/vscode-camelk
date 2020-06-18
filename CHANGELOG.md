# Change Log

All notable changes to the "vscode-camelk" extension will be documented in this file.

## 0.0.14

- Update default runtime version to 1.0.0
- Listing VS Code task to deploy Camel K integration in "Start Apache Camel Integration" command
- Completion for trait names and trait properties in tasks.json
- Command to create new Apache Camel K Integration files
- A tutorial to create and deploy your first Camel K Integration is available (requires [VS Code Didact](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-didact) to be installed)
- Access to Kit builder log has been removed. Since Camel K 1.0.0, the corresponding log is by default in the [Apache Camel K Operator log](./README.md#Viewing-the-log-for-a-apache-camel-k-operator)

## 0.0.13

- Provide tasks to support multi-arguments launch of Camel K integrations
- Change log functionality from Output channels to separate log windows that can be moved and placed in the display
- Add the ability to auto-scroll with a log window or turn it off so it remains at a particular location
- Add an extension preference to close an open log window if the integration is removed
- Add a new button to the Integrations view that opens the Apache Camel K Operator log
- Add a new context menu to published integrations in the Integrations view to open the Kit Builder log
- Update default runtime version to 1.0.0-RC2
- Add a setting to override the default version to use for the Camel K cli to avoid auto-upgrades 
- Add a validation when new Camel K CLI is downloaded to verify that it is available. If not, provide error to help with diagnosis

## 0.0.12

- avoid infinite loop when connection to kamel instance is not configured

## 0.0.11

- Pure Java language support with standalone Camel K Java files (requires vscode-java 0.55.0 and that the file contains the word `camel`)
- Upgrade default Kamel client to 1.0.0-RC1

## 0.0.10

- Remove Rest Proxy functionality
- Automatically download the kubectl and kamel CLI tools 
- Clean up underlying code to consistently call kubectl and kamel for all actions
- Add optional namespace support
- Update several NPM versions and fix any security vulnerabilities

## 0.0.9

- Add ability to deploy integrations associated with Resource files
- Added the Microsoft Kubernetes Tools extension as an extension dependency
- Update to add Dev Mode option for quick deployment and instant feedback in the Apache Camel K Output Channel
- Add support for --property
- Add ability to define custom dependencies for an integration
- Added support for starting integrations with the YAML file extension
- Adding auto-refresh to update view when any integration changes are noted by kubectl

## 0.0.8
- Fix regression preventing to use Commands to deploy integration

## 0.0.7

- Update to naming approved by Red Hat legal
- Adjusted Apache Camel K Integrations view to only refresh when visible
- Adjusted Apache Camel K output channel to only become shown when updates are made

## 0.0.6

- Added ability to deploy integrations with associated Kubernetes ConfigMaps or Secrets
- Added ability to create Kubernetes ConfigMaps or Secrets
- Began migrating away from direct Kubectl calls in favor of using the Kubernetes API component
- Changed 'Camel-K' to 'Apache Camel K' across the board for consistency
- Added tests for ConfigMap and Secret utilities
- Added Kotlin
- Moved menus to separate group to avoid cluttering up the Explorer context menu as much

## 0.0.5

- Added status bar indicators when Camel-K integrations view is refreshing and during other events
- Added test for kebab case based on Camel-K go test
- Added check to see if the kamel executable is available when not using proxy
- Fixed issue with right-click menu not correctly finding selected file
- Added decorators to indicate state of published integration (Running is green, anything else is red)
- Added new setting to turn off status bar messages

## 0.0.4

- Added Camel-K Integration Settings where users can specify the proxy url and namespace to use the Kubernetes Rest APIs instead of the local 'kubectl' utility.
- Added a 'Use Proxy' setting that currently enables the Camel-K Integrations view to use the Rest API instead of 'kubectl.' See the list of issues for current limitations with this code.
- Added work-in-progress 'CamelKJSONUtils' to start building a library of functions that will enable us to package, start, and stop integrations via the Kubernetes Rest APIs. Also added a few tests to start testing those functions, though currently only the createCamelKRestURL is used.
- Added ability to 'remove' an integration when Use Proxy is specified (using a DELETE rest API call through Kubernetes)
- Added ability to 'refresh' the integrations view when Use Proxy is specified (using a GET rest API call through Kubernetes)
- Removed "Stop Camel-K Integration" menu, since it duplicates the "Remove Integration" menu on the integrations view
- Removed the streaming data from all integrations started in the VS Code workspace in favor of adding a "View log snapshot" menu for running integrations that opens a new Output channel and shows the Camel log up to that moment. This works for both proxied and local executable methods
- reduce size of extension by moving test dependencies to devDependencies

## 0.0.3

- Streamlined menus to two -- Start Camel-K Integration and Stop Camel-K Integration - to avoid duplication
- Updated readme to include details about showing the Camel-K output channel
- Fixed refresh so that it attempts a few times before failing, which should give deploying integrations time to come up

## 0.0.2

- Fix issue with readme image and add list of current issues with github links

## 0.0.1

- Initial commit of extension that provides simple menu to call `kamel run --dev "selectedfile"`
- Added PR from Zoran adding a 'Stop Camel-K integration' menu
- Added new "Camel-K Integrations" view with refresh (view action) and remove (context action)
- Improved other actions so view is refreshed when integrations are started and stopped
- Added support for XML files as well as Groovy and cleaned up some code
- Cleaned up the readme and added Minikube/Camel-K install directions
- Added Java support, though we are unable to add Java integrations at this time - details in Readme issues section
- Fixed issue with Java integrations and now call 'kamel' from the parent directory of the integration file
- Starting and stopping integrations now works for .java, .groovy, and .xml files
- Updated icon used for tree elements
- Added first test mocking adding an integration to the view
- Added tests for the Integration view and did some code cleanup on CamelKNodeProvider
