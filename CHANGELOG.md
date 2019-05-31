# Change Log

All notable changes to the "vscode-camelk" extension will be documented in this file.

## 0.0.4

- Added Camel-K Integration Settings where users can specify the proxy url and namespace to use the Kubernetes Rest APIs instead of the local 'kubectl' utility.
- Added a 'Use Proxy' setting that currently enables the Camel-K Integrations view to use the Rest API instead of 'kubectl.' See the list of issues for current limitations with this code.
- Added work-in-progress 'CamelKJSONUtils' to start building a library of functions that will enable us to package, start, and stop integrations via the Kubernetes Rest APIs. Also added a few tests to start testing those functions, though currently only the createCamelKRestURL is used.
- Added ability to 'remove' an integration when Use Proxy is specified (using a DELETE rest API call through Kubernetes)
- Added ability to 'refresh' the integrations view when Use Proxy is specified (using a GET rest API call through Kubernetes)
- Removed "Stop Camel-K Integration" menu, since it duplicates the "Remove Integration" menu on the integrations view
- Removed the streaming data from all integrations started in the VS Code workspace in favor of adding a "View log snapshot" menu for running integrations that opens a new Output channel and shows the Camel log up to that moment. This works for both proxied and local executable methods

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
