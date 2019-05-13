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
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

export class CamelKNodeProvider implements vscode.TreeDataProvider<TreeNode> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

	constructor() {}

	public getChildren(task?: TreeNode): Thenable<TreeNode[]> {
		return Promise.resolve(getIntegrations());
	}

	public refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(task: TreeNode): vscode.TreeItem {
		return task;
	}	
}

function getIntegrations(): Promise<TreeNode[]> {
	return new Promise( async (resolve, reject) => {
		let treeTasks: TreeNode[] = [];
		let output = await callGetIntegrations();
		if (output) {
			let lines = output.split('\n');
			for (let entry of lines) {
				let line = entry.split(' ');
				if (line[0].toUpperCase().startsWith('NAME') || line[0].trim().length === 0) {
					continue;
				}
				let integrationName = line[0];
				let newNode = new TreeNode("string", integrationName, vscode.TreeItemCollapsibleState.None);
				treeTasks.push(newNode);
			}
			resolve(treeTasks);
		}
		reject();
	});
}	

function callGetIntegrations(): Promise<string> {
	return new Promise( (resolve, reject) => {
			let commandString = 'kubectl get integration';
			console.log('Command string: ' + commandString);
			let runKamel = child_process.exec(commandString);
			var shellOutput = '';
			runKamel.stdout.on('data', function (data) {
				console.log("[OUT] " + data);
				shellOutput += data;
			});
			runKamel.stderr.on('data', function (data) {
				console.log("[ERROR] " + data);
			});
			runKamel.on("close", () => {
				console.log("[CLOSING] " + shellOutput);
				resolve(shellOutput);
			});
		});			
}

export class TreeNode extends vscode.TreeItem {
	type: string;

	constructor(
		type: string,
		label: string,
		collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.type = type;
		this.iconPath = {
			light: path.join(__filename, '..', '..', 'resources', 'light', 'folder.svg'),
			dark: path.join(__filename, '..', '..', 'resources', 'dark', 'folder.svg')
		};
	}
}