## Java Language Support

From version 0.0.32 we provide [Language Support for Java(TM) by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) and [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) as dependencies.

With Language Support for Java, you will benefit from Java Language completion on standalone files. An invisible project is created with a default classpath.

The command `Refresh local Java classpath for Camel K standalone file based on the current editor` refreshes specific dependencies for the classpath of the opened Integration, such as dependencies declared as part of the modeline of the file. When using a modeline to configure such dependencies, you gain a [CodeLens](https://code.visualstudio.com/blogs/2017/02/12/code-lens-roundup) link (`Refresh classpath dependencies`) at the top of the editor to trigger the refresh more easily.

Be aware of the following **limitations**:

- It requires `jbang` to be available on system command-line.
- It supports modeline dependencies notation from the local build. See [apache/camel-k#2213](https://github.com/apache/camel-k/issues/2213)
- A single classpath is provided. It means that the refresh command needs to be called when switching between Integration file written in Java that does not have the same dependencies.
- There is no progress indicator. Please be patient. The first time may take several minutes on a slow network.
  
Debugger for Java is provided to benefit from Java debug on standalone files. To leverage it, you need to start an integration, then there are 2 solutions:

- Right-click on integration in the Integrations view, then choose `Start Java debugger on Camel K integration`.
- Launch a `camel-k-debug` VS Code tasks and then to launch a `java` attach in debug VS Code tasks.
