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
import * as utils from './CamelKJSONUtils';
import * as rp from 'request-promise';
import * as extension from './extension';

export class CamelKNodeProvider implements vscode.TreeDataProvider<TreeNode> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

	protected treeNodes: TreeNode[] = [];
	protected retrieveIntegrations : boolean = true;

	private useProxy: boolean = false;

	constructor() {}

	// get our list of integrations from kubectl or the rest API
	public setUseProxy(flag: boolean) {
		this.useProxy = flag;
	}

	// clear the tree 
	public resetList() {
		this.treeNodes = [];
	}

	// set up so we don't pollute test runs with camel-k integrations
	public setRetrieveIntegrations(flag:boolean) {
		this.retrieveIntegrations = flag;
	}

	// get the list of children for the node provider
	public getChildren(element?: TreeNode): Thenable<TreeNode[]> {
		return Promise.resolve(this.treeNodes);
	}

	// add a child to the list of nodes
	public addChild(oldNodes: TreeNode[] = this.treeNodes, newNode: TreeNode, disableRefresh : boolean = false ): Thenable<TreeNode[]> {
		if (oldNodes !== null && oldNodes !== undefined) {
			oldNodes.push(newNode);
			if (disableRefresh !== true) {
				this.refresh();
			}
			return Promise.resolve(oldNodes);
		}
		return Promise.reject();
	}

	// This method isn't used by the view currently, but is here to facilitate testing
	public removeChild(oldNodes: TreeNode[] = this.treeNodes, oldNode: TreeNode, disableRefresh : boolean = false ): Thenable<TreeNode[]> {
		if (oldNodes !== null && oldNodes !== undefined) {
			const index = oldNodes.indexOf(oldNode, 0);
			if (index > -1) {
				oldNodes.splice(index, 1);
				if (disableRefresh !== true) {
					this.refresh();
				}
			}
			return Promise.resolve(oldNodes);
		}
		return Promise.reject();
	}

	// trigger a refresh event in VSCode
	public async refresh(): Promise<void> {
		let oldCount = this.treeNodes.length;
		this.resetList();
		let inaccessible = false;
		if (this.retrieveIntegrations) {
			let retryTries = 1;
			let numRetries = 10;
			while (retryTries < numRetries && !inaccessible) {
				this.resetList();

				if (!this.useProxy) {
					await this.getIntegrationsFromCamelK().then((output) => {
						this.processIntegrationList(output);
					}).catch(() => { 
						utils.shareMessage(extension.mainOutputChannel, "Refreshing Camel-K Integrations view using kubectl failed.");
						inaccessible = true;
						Promise.reject();
						return;
					});
				} else {
					await utils.pingKubernetes().catch( (error) =>  {
						utils.shareMessage(extension.mainOutputChannel, 'Refreshing Camel-K Integrations view using kubernetes Rest APIs failed. ' + error);
						inaccessible = true;
						Promise.reject();
						return;
					});
		
					await this.getIntegrationsFromCamelKRest().then((output) => {
						this.processIntegrationListFromJSON(output);
					}).catch(() => {
						utils.shareMessage(extension.mainOutputChannel, 'Refreshing Camel-K Integrations view using kubernetes Rest APIs failed.');
						inaccessible = true;
						Promise.reject();
						return;
					});
				}
				if (inaccessible) {
					break;
				}
				let newCount = this.treeNodes.length;
				if (newCount !== oldCount) {
					break;
				}
				retryTries++;
			}
		}
		this._onDidChangeTreeData.fire();
		Promise.resolve();
		let newCount = this.treeNodes.length;
		if (newCount === 0 && !inaccessible) {
			utils.shareMessage(extension.mainOutputChannel, "Refreshing Camel-K Integrations view succeeded, no published integrations available.");
		}
	}

	getTreeItem(node: TreeNode): vscode.TreeItem {
		return node;
	}

	doesNodeExist(oldNodes: TreeNode[], newNode: TreeNode): boolean {
		for (let node of oldNodes) {
			if (node.label === newNode.label) {
				return true;
			}
		}
		return false;
	}

	// process the text-based list we get back from the kubectl command
	processIntegrationList(output: string) {
		if (output) {
			let lines = output.split('\n');
			for (let entry of lines) {
				let line = entry.split(' ');
				if (line[0].toUpperCase().startsWith('NAME') || line[0].trim().length === 0) {
					continue;
				}
				let integrationName = line[0];
				let newNode = new TreeNode("string", integrationName, vscode.TreeItemCollapsibleState.None);
				if (this.doesNodeExist(this.treeNodes, newNode) === false) {
					this.addChild(this.treeNodes, newNode, true);
				}
			}
		}
	}
	
	// process the JSON we get back from the kube rest API
	processIntegrationListFromJSON(json : Object) {
		if (json) {
			let temp = JSON.stringify(json);
			let o = JSON.parse(temp);
			for (var i=0; i<o.items.length;i++) {
				var integrationName = o.items[i].metadata.name;
				let newNode = new TreeNode("string", integrationName, vscode.TreeItemCollapsibleState.None);
				if (this.doesNodeExist(this.treeNodes, newNode) === false) {
					this.addChild(this.treeNodes, newNode, true);
				}
			}
		}
	}

	// retrieve the list of integrations running in camel-k using the kube proxy and rest API
	getIntegrationsFromCamelKRest(): Promise<Object> {
		return new Promise( async (resolve, reject) => {
			let proxyURL = utils.createCamelKRestURL();
			await utils.pingKubernetes().catch( (error) =>  {
				reject(error);
			});
			var options = {
				uri: proxyURL,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				json: true // Automatically parses the JSON string in the response
			};
			await utils.delay(750);
			rp(options)
				.then(function (json:Object) {
					resolve(json);
				})
				.catch(function () {
					reject();
				});
			});
	}

	// actually retrieve the list of integrations running in camel-k using kubectl
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
