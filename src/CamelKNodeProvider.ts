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
	public setUseProxy(flag: boolean): void {
		this.useProxy = flag;
	}

	// clear the tree
	public resetList(): void {
		this.treeNodes = [];
	}

	// set up so we don't pollute test runs with camel k integrations
	public setRetrieveIntegrations(flag:boolean): void {
		this.retrieveIntegrations = flag;
	}

	// get the list of children for the node provider
	public getChildren(element?: TreeNode): Promise<TreeNode[]> {
		return Promise.resolve(this.treeNodes);
	}

	// add a child to the list of nodes
	public addChild(oldNodes: TreeNode[] = this.treeNodes, newNode: TreeNode, disableRefresh : boolean = false ): Promise<TreeNode[]> {
		return new Promise<TreeNode[]>( async (resolve, reject) => {
			if (oldNodes) {
				oldNodes.push(newNode);
				if (!disableRefresh) {
					await this.refresh().catch(err => reject(err));
				}
				resolve(oldNodes);
			}
			reject(new Error("Internal problem. TreeView is not initialized correctly."));
		});
	}

	// This method isn't used by the view currently, but is here to facilitate testing
	public removeChild(oldNodes: TreeNode[] = this.treeNodes, oldNode: TreeNode, disableRefresh : boolean = false ): Promise<TreeNode[]> {
		return new Promise<TreeNode[]>( async (resolve, reject) => {
			if (oldNodes) {
				const index = oldNodes.indexOf(oldNode);
				if (index !== -1) {
					oldNodes.splice(index, 1);
					if (!disableRefresh) {
						await this.refresh().catch(err => reject(err));
					}
				}
				resolve(oldNodes);
			}
			reject(new Error("Internal problem. TreeView is not initialized correctly."));
		});
	}

	// trigger a refresh event in VSCode
	public refresh(): Promise<void> {
		return new Promise<void>( async (resolve, reject) => {
			extension.setStatusLineMessageAndShow(`Refreshing Apache Camel K Integrations view...`);
			this.resetList();
			let inaccessible = false;
			if (this.retrieveIntegrations) {
				if (this.useProxy) {
					await utils.pingKubernetes()
						.then( async () => {
							await this.getIntegrationsFromCamelKRest()
								.then( (output) => {
									this.processIntegrationListFromJSON(output);
								});
						})
						.catch( (error) =>  {
							utils.shareMessage(extension.mainOutputChannel, `Refreshing Apache Camel K Integrations view using kubernetes Rest APIs failed. ${error}`);
							inaccessible = true;
							reject(error);
							return;
						});
				} else {
					await utils.pingKamel()
						.then( async () => {
							await Promise.resolve(this.getIntegrationsFromCamelK())
								.then((output) => {
									this.processIntegrationList(output);
								});
						})
						.catch( (error) =>  {
							utils.shareMessage(extension.mainOutputChannel, `Refreshing Apache Camel K Integrations view using kubectl failed. ${error}`);
							inaccessible = true;
							reject(error);
							return;
						});
				}
			}
			extension.hideStatusLine();
			this._onDidChangeTreeData.fire();
			let newCount = this.treeNodes.length;
			if (newCount === 0 && !inaccessible) {
				utils.shareMessage(extension.mainOutputChannel, "Refreshing Apache Camel K Integrations view succeeded, no published integrations available.");
			}
			resolve();
		});
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
	processIntegrationList(output: string): void {
		if (output) {
			let lines = output.split('\n');
			for (let entry of lines) {
				let line = entry.split('  ');
				let cleanLine = [];
				for (var i=0; i < line.length; i++) {
					if (line[i].trim().length === 0) {
						continue;
					}
					cleanLine.push(line[i].trim());
				}
				let firstString : string = cleanLine[0];
				if (firstString === undefined || firstString.toUpperCase().startsWith('NAME') || firstString.trim().length === 0) {
					continue;
				}
				let integrationName = cleanLine[0];
				let status = cleanLine[1];
				let newNode = new TreeNode("string", integrationName, status, vscode.TreeItemCollapsibleState.None);
				if (!this.doesNodeExist(this.treeNodes, newNode)) {
					this.addChild(this.treeNodes, newNode, true);
				}
			}
		}
	}

	// process the JSON we get back from the kube rest API
	processIntegrationListFromJSON(json : Object): void {
		if (json) {
			try {
				let jsonStringify = JSON.stringify(json);
				let jsonObject = JSON.parse(jsonStringify);
				for (var i=0; i<jsonObject.items.length;i++) {
					var integration = jsonObject.items[i];
					var integrationName = integration.metadata.name;
					var integrationPhase = integration.status.phase;
					let newNode = new TreeNode("string", integrationName, integrationPhase, vscode.TreeItemCollapsibleState.None);
					if (!this.doesNodeExist(this.treeNodes, newNode)) {
						this.addChild(this.treeNodes, newNode, true);
					}
				}
			} catch( error ) {
				console.log(error);
			}
		}
	}

	// retrieve the list of integrations running in camel k using the kube proxy and rest API
	getIntegrationsFromCamelKRest(): Promise<Object> {
		return new Promise( (resolve, reject) => {
			let proxyURL = utils.createCamelKRestURL();
			let options = {
				uri: proxyURL,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				json: true // Automatically parses the JSON string in the response
			};
			utils.pingKubernetes()
				.then( () => {
					return utils.delay(750);
				})
				.then( () => {
					return rp(options);
				})
				.then( (json) => {
					resolve(json);
				})
				.catch( (error) =>  {
					reject(error);
				});
		});
	}

	// actually retrieve the list of integrations running in camel k using kubectl
	getIntegrationsFromCamelK(): Promise<string> {
		return new Promise( (resolve, reject) => {
			let commandString = 'kubectl get integration';
			console.log('Command string: ' + commandString);
			let runKubectl = child_process.exec(commandString);
			var shellOutput = '';
			if (runKubectl.stdout) {
				runKubectl.stdout.on('data', function (data) {
					console.log("[OUT] " + data);
					shellOutput += data;
				});
			}
			if (runKubectl.stderr) {
				runKubectl.stderr.on('data', function (data) {
					console.log("[ERROR] " + data);
					reject(data.toString());
				});
			}
			runKubectl.on("close", () => {
				console.log("[CLOSING] " + shellOutput);
				resolve(shellOutput);
			});
		});
	}

}

// simple tree node for our integration view
export class TreeNode extends vscode.TreeItem {
	type: string;
	status: string;

	constructor(
		type: string,
		label: string,
		status: string,
		collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.type = type;
		this.status = status;
		this.iconPath = this.getIconForPodStatus(this.status);
		this.tooltip = `Status: ${this.status}`;
	}

	getIconForPodStatus(status: string):  object {
		let newIcon : object;
		if (status.toLowerCase().startsWith("running")) {
			newIcon = vscode.Uri.file(path.join(__dirname, "../resources/round-k-transparent-16-running.svg"));
		} else {
			newIcon = vscode.Uri.file(path.join(__dirname, "../resources/round-k-transparent-16-error.svg"));
		}
		return newIcon;
	}
}
