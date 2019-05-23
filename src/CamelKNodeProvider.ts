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

	protected treeNodes: TreeNode[] = [];
	protected retrieveIntegrations : boolean = true;

	constructor() {}

	public resetList() {
		this.treeNodes = [];
	}

	// set up so we don't pollute test runs with camel-k integrations
	public setRetrieveIntegrations(flag:boolean) {
		this.retrieveIntegrations = flag;
	}

	// get the list of children for the node provider
	public getChildren(element?: TreeNode): Thenable<TreeNode[]> {
		if (this.retrieveIntegrations) {
			return Promise.resolve(this.processIntegrationList());
		}
		return Promise.resolve(this.treeNodes);
	}

	// add a child to the list of nodes
	public addChild(oldtasks: TreeNode[] = this.treeNodes, newtask: TreeNode, disableRefresh : boolean = false ): Thenable<TreeNode[]> {
		if (oldtasks !== null && oldtasks !== undefined) {
			oldtasks.push(newtask);
			if (disableRefresh !== true) {
				this.refresh();
			}
			return Promise.resolve(oldtasks);
		}
		return Promise.reject();
	}

	// This method isn't used by the view currently, but is here to facilitate testing
	public removeChild(oldtasks: TreeNode[] = this.treeNodes, oldtask: TreeNode, disableRefresh : boolean = false ): Thenable<TreeNode[]> {
		if (oldtasks !== null && oldtasks !== undefined) {
			const index = oldtasks.indexOf(oldtask, 0);
			if (index > -1) {
				oldtasks.splice(index, 1);
				if (disableRefresh !== true) {
					this.refresh();
				}
			}
			return Promise.resolve(oldtasks);
		}
		return Promise.reject();
	}

	// trigger a refresh event in VSCode
	public refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(node: TreeNode): vscode.TreeItem {
		return node;
	}	

	// process the text-based list we get back from the kubectl command
	private processIntegrationList(): Promise<TreeNode[]> {
		return new Promise( async (resolve, reject) => {
			this.resetList();
			let output = await this.getIntegrationsFromCamelK();
			if (output) {
				let lines = output.split('\n');
				for (let entry of lines) {
					let line = entry.split(' ');
					if (line[0].toUpperCase().startsWith('NAME') || line[0].trim().length === 0) {
						continue;
					}
					let integrationName = line[0];
					let newNode = new TreeNode("string", integrationName, vscode.TreeItemCollapsibleState.None);
					this.addChild(this.treeNodes, newNode, true);
				}
				resolve(this.treeNodes);
			}
			reject();
		});
	}	
	
	// actually retrieve the list of integrations running in camel-k using kubectl
	// TODO: research using a rest call to get the same information
	getIntegrationsFromCamelK(): Promise<string> {
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
	
}

// simple tree node for our integration view
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
			light: path.join(__filename, '..', '..', 'resources', 'round-k-transparent-16.svg'),
			dark: path.join(__filename, '..', '..', 'resources', 'round-k-transparent-16.svg')
		};
	}
}
