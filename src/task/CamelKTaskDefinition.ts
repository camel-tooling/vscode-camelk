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

import * as vscode from 'vscode';
import * as IntegrationUtils from '../IntegrationUtils';

export interface CamelKTaskDefinition extends vscode.TaskDefinition {
    
	configmap?: string;
	compression?: boolean;
	dependencies?: Array<string>;
	dev?: boolean;
	environmentVariables?: Array<string>;
	file: string;
	profile?: string;
	properties?: Array<string>;
	resource?: string;
	secret?: string;
	traits?: Array<string>;
	volumes?: Array<string>;
}

export class CamelKTaskProvider implements vscode.TaskProvider {

	private tasks: vscode.Task[] | undefined;
	static START_CAMELK_TYPE: string = 'camel-k';
	constructor() { }

	public async provideTasks(): Promise<vscode.Task[]> {
		return this.getTasks();
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const definition: CamelKTaskDefinition = <any>_task.definition;
		return this.getTask(definition);
	}

	private getTasks(): vscode.Task[] {
		if (this.tasks !== undefined) {
			return this.tasks;
		}
		this.tasks = [];
		let taskDefinition = {
			"type": CamelKTaskProvider.START_CAMELK_TYPE,
			"label": "Start in dev mode Camel K integration opened in active editor",
			"file": "\"${file}\"",
			"dev": true
		};
		this.tasks.push(this.getTask(taskDefinition));
		return this.tasks;
	}

	public getTask(definition: CamelKTaskDefinition): vscode.Task {
		let args = IntegrationUtils.computeKamelArgs(definition.file,
			definition.dev,
			definition.configmap,
			definition.secret,
			definition.resource,
			definition.dependencies,
			definition.properties,
			definition.traits,
			definition.environmentVariables,
			definition.volumes,
			definition.compression,
			definition.profile);
		let argsInlined = args.join(' ');
		let processExecution = new vscode.ShellExecution(`kamel ${argsInlined}`);
		let displayName :string;
		if(definition.label) {
			displayName = definition.label;
		} else {
			displayName = `Start Integration for file ${definition.file}`;
		}
		return new vscode.Task(definition,
			vscode.TaskScope.Workspace,
			displayName,
			CamelKTaskProvider.START_CAMELK_TYPE,
			processExecution);
	}
}
