# Data collection

vscode-camelk has opt-in telemetry collection, provided by [vscode-redhat-telemetry](https://github.com/redhat-developer/vscode-redhat-telemetry).

### What's included in the vsocde-camelk telemetry data

* when extension is activated
* when a command from this extension is used, the command id is provided
* when `Create a new Apache Camel K Integration file` command contributed by extension is executed
    * with the chosen language
* when `Start Apache Camel K integration` command contributed by extension is executed
    * with the language of the file deployed
    * with the kind (basic, dev, ...)

## What's included in the general telemetry data

Please see the [vscode-redhat-telemetry data collection information](https://github.com/redhat-developer/vscode-redhat-telemetry/blob/HEAD/USAGE_DATA.md) for information on what data it collects.

## How to opt in or out

Use the `redhat.telemetry.enabled` setting in order to enable or disable telemetry collection.
