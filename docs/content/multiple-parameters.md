## Creating a new Camel K Integration task configuration with multiple parameters

Though the simple "Deploy Integration with Apache Camel K" menu works well for simple cases, you can use a Task for more complex integrations. When the Camel K integration requires more configuration, you can set that up using a Task.

To create a new Task, you have a few options.

1. From the command palette, call the `Tasks: Configure Task` command. This will open the tasks.json file where you can enter new task info by hand (with some auto-completion support in the editor). If you already have a tasks.json but no Camel K tasks, you can create a new task with the type `camel-k` in the tasks.json which is automatically opened.
2. If you don't have any Tasks configured yet, you can use the `camel-k: Start in dev mode Camel K integration opened in active editor` command, which will template an initial Camel K task for you.

You will end up with something like the following with a new, empty Camel K task specified:

```json
{
    // See https://go.microsoft.com/fwlink/?LinkId=733558 
    // for the documentation about the tasks.json format
    "version": "2.0.0",
    "tasks": [
        {
            "type": "camel-k",
            "dev": true,
            "file": "${file}",
            "problemMatcher": []
        }
    ]
}
```

Note: We recommend adding a `label` attribute to more easily find your task in the task list when you try to run it.

Once you've created your Camel K task, you can use auto-complete to explore the various parameters available. The following example launches the integration in `--dev` mode and provides a couple of dependencies:

```json
{
    "type": "camel-k",
    "label": "Run RestWithUndertow and Dependencies",
    "dev": true,
    "file": "./examples/RestWithUndertow.java",
    "problemMatcher": [],
    "dependencies": [ "camel-rest", "camel-undertow" ]
}
```

When you've defined your Task, you can use one of two options to execute it:

- call command from palette `Tasks: Run Task`. You will see the command listed with the label that you provided previously.
- with the `Deploy Integration with Apache Camel K` command, pick the option `Use a predefined Task - useful for multi-attributes deployment`

After running the camel-k `Task`, a terminal will open where you can see the command used and any execution result.
