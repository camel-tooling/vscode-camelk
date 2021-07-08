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
import * as IntegrationUtils from '../IntegrationUtils';

export const NAME_OF_PROVIDED_TASK_TO_DEPLOY_IN_DEV_MODE_FROM_ACTIVE_EDITOR = "Start in dev mode Camel K integration opened in active editor";

export interface CamelKRunTaskDefinition extends vscode.TaskDefinition {
    
	configmap?: string;
	compression?: boolean;
	dependencies?: Array<string>;
	dev?: boolean;
	environmentVariables?: Array<string>;
	file: string;
	profile?: string;
	properties?: Array<string>;
	resources?: Array<string>;
	secret?: string;
	traits?: Array<string>;
	volumes?: Array<string>;
}

export class CamelKRunTaskProvider implements vscode.TaskProvider {
	
	private tasks: vscode.Task[] | undefined;
	static START_CAMELK_TYPE: string = 'camel-k';
	constructor() { }

	public async provideTasks(): Promise<vscode.Task[]> {
		return this.getTasks();
	}

	public async resolveTask(_task: vscode.Task): Promise<vscode.Task | undefined> {
		const definition: CamelKRunTaskDefinition = <any>_task.definition;
		return this.getRunTask(definition);
	}

	private async getTasks(): Promise<vscode.Task[]> {
		if (this.tasks !== undefined) {
			return this.tasks;
		}
		this.tasks = [];
		let startTaskDefinition = {
			"type": CamelKRunTaskProvider.START_CAMELK_TYPE,
			"label": NAME_OF_PROVIDED_TASK_TO_DEPLOY_IN_DEV_MODE_FROM_ACTIVE_EDITOR,
			"file": "\"${file}\"",
			"dev": true
		};
		this.tasks.push(await this.getRunTask(startTaskDefinition));		
		return this.tasks;
	}
	
	public async getRunTask(definition: CamelKRunTaskDefinition): Promise<vscode.Task> {
		let args = IntegrationUtils.computeKamelArgs(definition.file,
			definition.dev,
			definition.configmap,
			definition.secret,
			definition.resources,
			definition.dependencies,
			definition.properties,
			definition.traits,
			definition.environmentVariables,
			definition.volumes,
			definition.compression,
			definition.profile);
		let argsInlined = args.join(' ');
		let processExecution = new vscode.ShellExecution(`${await kamel.create().getPath()} ${argsInlined}`);
		let displayName :string;
		if(definition.label) {
			displayName = definition.label;
		} else {
			displayName = `Start Integration for file ${definition.file}`;
		}
		return new vscode.Task(definition,
			vscode.TaskScope.Workspace,
			displayName,
			CamelKRunTaskProvider.START_CAMELK_TYPE,
			processExecution);
	}
}
