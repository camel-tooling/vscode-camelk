![Apache Camel](post-logo-apache-camel-d.png)

# Apache Camel K

Apache Camel K is a lightweight integration framework built from Apache Camel that runs natively on Kubernetes and is specifically designed for serverless and microservice architectures.

Users of Camel K can instantly run integration code written in Camel DSL on their preferred cloud (Kubernetes or OpenShift).

[Check out the Apache Camel K project documentation for more details about the framework.](https://camel.apache.org/camel-k/latest/index.html)

## Apache Camel K in VS Code - Your First Integration

What follows is a simple step-by-step process that helps you create and deploy a Camel K integration on a Minikube instance running locally.

We will:

* Create a folder with a sample Apache Camel integration written in Java
* Deploy the file to our OpenShift instance
* Update the Java file and watch the change ripple through to the running integration in seconds! 

## Prerequisites 

You must have a few things set up prior to walking through the steps in this tutorial. 

<a href='didact://?commandId=vscode.didact.validateAllRequirements' title='Validate all requirements!'><button>Validate all Requirements at Once!</button></a>

| Requirement (Click to Verify)  | Availability | Additional Information/Solution |
| :--- | :--- | :--- |
| [At least one folder exists in the workspace](didact://?commandId=vscode.didact.workspaceFolderExistsCheck&text=workspace-folder-status "Ensure that at least one folder exists in the user workspace"){.didact} | *Status: unknown*{#workspace-folder-status} | Create a workspace folder (or [click here to create a temporary folder](didact://?commandId=vscode.didact.createWorkspaceFolder "Create a temporary folder and add it to the workspace."){.didact}), close, and reopen the Didact window
| [Apache Camel K's CLI (kamel) is accessible and running at the command line](didact://?commandId=vscode.didact.cliCommandSuccessful&text=kamel-requirements-status$$kamel%20version "Tests to see if `kamel version` returns a result"){.didact} 	| *Status: unknown*{#kamel-requirements-status} 	| See [Installing Camel K](https://camel.apache.org/camel-k/latest/installation "Documentation on how to Install Apache Camel K")
| [OpenShift (oc) is accessible and running at the command line](didact://?commandId=vscode.didact.cliCommandSuccessful&text=openshift-requirements-status$$oc%20version "Tests to see if `oc version` returns a result"){.didact} 	| *Status: unknown*{#openshift-requirements-status} 	| Need docs link
| [OpenShift Do (odo) is accessible and running at the command line](didact://?commandId=vscode.didact.cliCommandSuccessful&text=odo-requirements-status$$odo%20version "Tests to see if `odo version` returns a result"){.didact} 	| *Status: unknown*{#odo-requirements-status} 	| Need docs link
| [VS Code Extension Pack for Apache Camel by Red Hat is installed](didact://?commandId=vscode.didact.extensionRequirementCheck&text=extension-requirement-status$$redhat.apache-camel-extension-pack "Checks the VS Code workspace to make sure the extension pack is installed"){.didact} | *Status: unknown*{#extension-requirement-status} 	| [Click here to install](vscode:extension/redhat.apache-camel-extension-pack "Opens the extension page and provides an install link") |
| [VS Code Tooling for Apache Camel K by Red Hat is installed](didact://?commandId=vscode.didact.extensionRequirementCheck&text=camelk-extension-requirement-status$$redhat.vscode-camelk "Checks the VS Code workspace to make sure the extension pack is installed"){.didact} | *Status: unknown*{#camelk-extension-requirement-status} 	| [Click here to install](vscode:extension/redhat.vscode-camelk "Opens the extension page and provides an install link") |

## Your First Camel K Integration

You can write an integration in one of several languages supported ([Groovy, Kotlin, JavaScript, Java, XML, etc.](https://camel.apache.org/camel-k/latest/languages/languages.html)), but today we're going to focus on Java which is one of the most popular.

### Step 0: Connect your Local OC/ODO instance to the OpenShift system

(Massage this)

- Get oc login string from the OpenShift console
- copy it directly if you have oc installed
- or massage slightly to work with odo - odo login [path] --token=[token]

### Step 1: Creating a Folder and Your Integration

First, we need to create a simple Java Camel K example. You can do this using the `Create a new Apache Camel K Integration file` command. [(Execute^)](didact://?commandId=camelk.integrations.createNewIntegrationFile&text=Java$$Greeter)

Inside VS Code, press `F1` or `Ctrl+Shift+P` to bring up the Command Palette, and type `Create a new Apache Camel K Integration file`. When the command is selected, click Enter.

1. Choose the language to use (choose `Java`).
2. Choose the workspace folder (press Enter to select the current workspace root folder)
3. Provide a name for the new file (be sure not to include the file extension or it will be repeated) (type `Greeter`)

When you complete step 3, you should see the file `Greeter.java` appear in your workspace folder.

<details><summary>Advanced Users!</summary>

If you simply want to get started writing some Groovy code, you can create a folder in your workspace, create a file called `Greeter.java`, and copy in the following code:

```java
// camel-k: language=java

import org.apache.camel.builder.RouteBuilder;

public class Greeter extends RouteBuilder {
	@Override
	public void configure() throws Exception {

		// Write your routes here, for example:
		from("timer:java?period=1s")
			.routeId("java")
			.setBody()
				.simple("Hello Camel K from ${routeId}")
			.to("log:info");
	}
}

```

</details>

## Step 2: Exploring the Java integration file

Now that you have an integration file, let's take a quick look at it. If you created the file yourself, go ahead and open it now. Go to the Explorer activity (Ctrl+Shift+E) and look at the workspace folders listed.

- [ ] If you created the file earlier, you can [open the Greeter.java file in the editor.](didact://?commandId=vscode.openFolder&projectFilePath=Greeter.java "Opens the Greeter.java file"){.didact}

For this file, we're simply telling Camel to put the message `Hello Camel K from ${routeId}` in the console once every second.

## Step 3: Deploying the Integration

(TODO: Update image)

![Camel K Start Integration menu](https://raw.githubusercontent.com/camel-tooling/vscode-camelk/master/images/camelk-start-integration-popup-menu.jpg){.imageRight}

The `Tooling for Camel K` extension offers several tools to get your new integration started. 

First, you can right-click the `Greeter.java` file and select `Start Apache Camel K Integration`. That will provide a drop-down in the Command palette area with a number of deployment options. In this case, select the `Basic Mode - Apache Camel K Integration (no ConfigMap or Secret)` option. 

- [ ] [Start the Greeter.java integration in Basic Mode](didact://?commandId=camelk.startintegration&projectFilePath=Greeter.java "Deploys the Greeter.java file in 'Basic mode'"){.didact}

Since this is likely the first time you've started a new integration in Camel K, it might take a bit to spin up the necessary resources on the target system. While that starts up, we can look at the `Apache Camel K` Output channel and watch as the Camel K operator starts up the necessary resources to run our integration.

## Step 4: Managing our Integration

We can see what integrations we currently have running in our OpenShift system in the `Apache Camel K Integrations` view in the Explorer activity (Ctrl+Shift+E).

- [ ] Open the `Apache Camel K Integrations` view [(Execute^)](didact://?commandId=camelk.integrations.focus)

![Integrations view with context menu](https://raw.githubusercontent.com/camel-tooling/vscode-camelk/master/images/camelk-integrations-view-remove-menu.jpg){.imageRight}

From here, we can:

- Hover over the integration name to see its current state in the tooltip. 
- Right-click on the running integration to `Remove Apache Camel K Integration` and undeploy it.
- Right-click on the running integration to `Follow log for running Apache Camel K Integration` which opens a new Log window showing all messages from the route.

# Finding more information

For more about **Apache Camel K**, [check out the project documentation](https://camel.apache.org/camel-k/latest/index.html).

For more about what the **Tooling for Apache Camel K** extension has to offer in VS Code, [check out the readme](https://github.com/camel-tooling/vscode-camelk/blob/master/README.md)
