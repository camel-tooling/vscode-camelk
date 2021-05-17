/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as kamel from '../kamel';
import * as vscode from 'vscode';

export interface CamelKDebugTaskDefinition extends vscode.TaskDefinition {
	integrationName: string;
	port?: number,
	remotePort?: number,
	suspend?: boolean
}

export class CamelKDebugTaskProvider implements vscode.TaskProvider {

	private tasks: vscode.Task[] | undefined;
	static DEBUG_CAMELK_TYPE: string = 'camel-k-debug';
	constructor() { }

	public async provideTasks(): Promise<vscode.Task[]> {
		return this.getTasks();
	}

	public async resolveTask(_task: vscode.Task): Promise<vscode.Task | undefined> {
		const definition: CamelKDebugTaskDefinition = <any>_task.definition;
		return this.getDebugTask(definition);
	}

	private async getTasks(): Promise<vscode.Task[]> {
		if (this.tasks !== undefined) {
			return this.tasks;
		}
		this.tasks = [];
		const debugTaskDefinition = {
			"type": CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE,
			"integrationName": ""
		};
		this.tasks.push(await this.getDebugTask(debugTaskDefinition));

		return this.tasks;
	}

	public async getDebugTask(definition: CamelKDebugTaskDefinition): Promise<vscode.Task> {
		const commandLine = await computeKamelDebugCommandLine(definition);
		const processExecution = new vscode.ShellExecution(commandLine, {});
		let displayName: string;
		if (definition.label) {
			displayName = definition.label;
		} else {
			displayName = `Prepare debug capabilities on Integration ${definition.integrationName}`;
		}
		return new vscode.Task(definition,
			vscode.TaskScope.Workspace,
			displayName,
			CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE,
			processExecution);
	}
}

async function computeKamelDebugCommandLine(definition: CamelKDebugTaskDefinition) {
	//TODO: put some logic to determine the integration name based on a provided file? it will allow something more dynamic.
	let commandLine = `${await kamel.create().getPath()} debug ${definition.integrationName}`;
	if (definition.port) {
		commandLine += ` --port ${definition.port}`;
	}
	if (definition.remotePort) {
		commandLine += ` --remote-port ${definition.remotePort}`;
	}
	if (definition.suspend !== undefined) {
		commandLine += ` --suspend ${definition.suspend}`;
	}
	return commandLine;
}
