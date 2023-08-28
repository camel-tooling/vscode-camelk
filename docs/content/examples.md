## Your First Apache Camel K Integration

After your Apache Camel K/Minikube environment is running and you have installed the **Tooling for Apache Camel K** (vscode-camelk) extension, you can quickly start your first integration.

1. Create a directory on your development system called **integrations**. For example, `/home/(User_Name)/Documents/integrations` on Linux or `C:\Users\(User_Name)\Documents\integrations` on Windows.
2. Start a new workspace in your VS Code Integrated Development Environment (IDE).
3. Add the folder from step 1 to your new workspace with **File > Add Folder to Workspace...**
4. Call command `Camel: Create Camel route in Yaml DSL`
5. Right-click on created file in your directory and select **Deploy Integration with Apache Camel K**.
6. Select `Dev Mode - Apache Camel K Integration in Dev Mode`.
7. Watch as messages appear in the **Apache Camel K Output channel** as your integration begins to run.
8. Open created file and update the message to say `This is my first Camel K Integration!`. Save the file with **File > Save** or **Ctrl+S**.
9. Watch as your integration is updated and your new message begins to appear in the output channel.

<p align="center"><img src="../images/quickstart-console.jpg" alt="Running Quickstart after Message Update" class="zoom" width="100%"/></p>
