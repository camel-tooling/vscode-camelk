# Change Log

All notable changes to the "vscode-camelk" extension will be documented in this file.

## 0.0.4

- TBD

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
