![Apache Camel](./post-logo-apache-camel-d.png)

# Apache Camel K

Apache Camel K is a lightweight integration framework built from Apache Camel that runs natively on Kubernetes and is specifically designed for serverless and microservice architectures.

Users of Camel K can instantly run integration code written in Camel DSL on their preferred cloud (Kubernetes or OpenShift).

[Check out the Apache Camel K project documentation for more details about the framework.](https://camel.apache.org/camel-k/latest/index.html)

## Apache Camel K in VS Code - Your First Integration

What follows is a simple step-by-step process that helps you create and deploy a Camel K integration on a Minikube instance running locally.

We will:

* Create a new Camel K integration written in Java
* Deploy the file in an environment running Camel K (Minikube, OpenShift, etc)
* Update the Java file and watch the change ripple through to the running integration in seconds! 

## Prerequisites 

You must have a few things set up prior to walking through the steps in this tutorial. 

<a href='didact://?commandId=vscode.didact.validateAllRequirements' title='Validate all requirements!'><button>Validate all Requirements at Once!</button></a>

| Requirement (Click to Verify)  | Availability | Additional Information/Solution |
| :--- | :--- | :--- |
| [At least one folder exists in the workspace](didact://?commandId=vscode.didact.workspaceFolderExistsCheck&text=workspace-folder-status "Ensure that at least one folder exists in the user workspace"){.didact} | *Status: unknown*{#workspace-folder-status} | Create a workspace folder (or [click here to create a temporary folder](didact://?commandId=vscode.didact.createWorkspaceFolder "Create a temporary folder and add it to the workspace."){.didact}), close, and reopen the Didact window
| [Is kamel available on command-line?](didact://?commandId=vscode.didact.cliCommandSuccessful&text=kamel-status$$kamel "Tests to see if `kamel` returns a result"){.didact} 	| *Status: unknown*{#kamel-status} 	| Look into the [release page](https://github.com/apache/camel-k/releases) for latest version of the camel-k-client tool for your specific platform.Download and uncompress the archive. It contains a small binary file named kamel that you should put into your system path. For example, if you’re using Linux, you can put kamel in `/usr/bin`.)
| Ensure that Camel K is installed in an available Minikube or OpenShift environment | Status: Manual step | [Click here for installation details](https://camel.apache.org/camel-k/latest/installation/installation.html)
| [VS Code Extension Pack for Apache Camel by Red Hat is installed, which includes Camel K Tooling](didact://?commandId=vscode.didact.extensionRequirementCheck&text=extension-requirement-status$$redhat.apache-camel-extension-pack "Checks the VS Code workspace to make sure the extension pack is installed"){.didact} | *Status: unknown*{#extension-requirement-status} 	| [Click here to install](vscode:extension/redhat.apache-camel-extension-pack "Opens the extension page and provides an install link") |

## Your First Camel K Integration

You can write an integration in one of several languages supported ([Groovy, Kotlin, JavaScript, Java, XML, YAML](https://camel.apache.org/camel-k/latest/languages/languages.html)), but today we're going to focus one of the most common: Java.

### Step 1: Creating Your Integration

First, we need to create the new integration. Camel K has many examples available at their [GitHub project hosting the source](https://github.com/apache/camel-k/tree/master/examples), but we're just going to use a simple one: `Simple.java`. Thankfully, the Camel K command-line tool has given us a way to do that quickly and we can leverage that in the tooling. 

You can download the file yourself from the GitHub repo and then copy it into a folder in your workspace. Or you can create it with the tooling.

Inside VS Code, press `F1` or `Ctrl+Shift+P` to bring up the Command Palette, and type `Create a new Apache Camel K Integration file`. When the command is selected, click Enter.

1. Choose the language to use (choose `Java`).
2. Choose the workspace folder (press Enter to select the current workspace root folder)
3. Provide a name for the new file (be sure not to include the file extension or it will be repeated) (type `Simple`)

When you complete step 3, you should see the file `Simple.java` appear in your workspace folder. [(Execute^)](didact://?commandId=camelk.integrations.createNewIntegrationFile&text=Simple$$Java)

<details><summary>Advanced Users!</summary>

If you simply want to get started writing some Java, create a file called `Simple.java`, and copy in the following code:

```java
// camel-k: language=java

import org.apache.camel.builder.RouteBuilder;

public class Simple extends RouteBuilder {
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

Now that you have an integration file, let's take a quick look at it. If you created the file yourself, go ahead and open it now. Go to the Explorer activity (Ctrl+Shift+E) and look at the workspace files and folders listed to find `Simple.java`.

- [ ] If you created the file in your workspace earlier by hand, you can open the Simple.java file in the editor.[(Execute^)](didact://?commandId=vscode.openFolder&projectFilePath=Simple.java "Opens the Simple.java file"){.didact}

For this file, we're simply telling Camel to put the message `Hello Camel K from ${routeId}` in the console once a second.

## Step 3: Deploying the Integration

![Camel K Start Integration menu](https://raw.githubusercontent.com/camel-tooling/vscode-camelk/master/images/camelk-start-integration-popup-menu.jpg){.imageRight}

The `Tooling for Camel K` extension offers several tools to get your new integration started. 

First, you can right-click the `Simple.java` file and select `Start Apache Camel K Integration`. That will provide a drop-down in the Command palette area with a number of deployment options. In this case, select the `Dev Mode - Apache Camel K Integration in Dev Mode` option. 

- [ ] Start the Simple.java integration in Dev Mode[(Execute^)](didact://?commandId=camelk.startintegration&projectFilePath=Simple.java&text=Dev%20Mode "Deploys the Simple.java file in 'Dev mode'"){.didact}

Since this is likely the first time you've started a new integration in Camel K, it might take a bit to spin up the necessary resources on the target system. While that starts up, we can look at the `Apache Camel K` Output channel and watch as the Camel K operator starts up the necessary resources to run our integration.

## Step 4: Updating the Integration

While our integration is running in `Dev Mode`, we can modify it and see those changes reflected in the deployed integration. Let's try that now.

Change the message sent to the `.simple()` command of the Camel route in quotes to `We just changed our first Camel K integration while it was running!`. 

Save the file. Doing so automatically redeploys the file while it is deployed in Dev Mode. You should see the updated message displayed in the Output channel. 

## Step 5: Managing our Integration

We can see the integrations we currently have running in our environment in the `Apache Camel K Integrations` view in the Explorer activity (Ctrl+Shift+E).

- [ ] Open the `Apache Camel K Integrations` view[(Execute^)](didact://?commandId=camelk.integrations.focus)

![Integrations view with context menu](https://raw.githubusercontent.com/camel-tooling/vscode-camelk/master/images/camelk-integrations-view-remove-menu.jpg){.imageRight}

From here, we can:

- Hover over the `Apache Camel K Integrations` view and click the `Open Apache Camel K Operator Log` button to view it. [(Execute^)](didact://?commandId=camelk.integrations.openOperatorLog)
- Hover over the integration name to see its current state in the tooltip. [(Execute to select first integration in tree^)](didact://?commandId=camelk.integrations.selectFirstNode)
- Right-click on the running integration to `Follow log for running Apache Camel K Integration` [(Execute for selected integration^)](didact://?commandId=camelk.integrations.log)
- Right-click on the running integration to `Follow kit builder log for running Apache Camel K Integration` [(Execute for selected integration^)](didact://?commandId=camelk.integrations.kitlog)
- Right-click on the running integration to `Remove Apache Camel K Integration` and undeploy it.


While we are running in `Dev Mode`, all our logged output goes to the main `Apache Camel K` Output channel, but if the integration is running in another mode (such as `Basic`), we can explicitly open a new Output channel to follow the log for that running integration.

# Finding more information

For more about **Apache Camel K**, [check out the project documentation](https://camel.apache.org/camel-k/latest/index.html).

For more about what the **Tooling for Apache Camel K** extension has to offer in VS Code, [check out the readme](https://github.com/camel-tooling/vscode-camelk/blob/master/README.md)
