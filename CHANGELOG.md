# Change Log

All notable changes to the "vscode-camelk" extension will be documented in this file.

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
