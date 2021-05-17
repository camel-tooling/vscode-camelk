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
import * as path from 'path';
import * as utils from './CamelKJSONUtils';
import * as extension from './extension';
import * as kubectlutils from './kubectlutils';
import * as installer from './installer';
import * as config from './config';

export class CamelKNodeProvider implements vscode.TreeDataProvider<TreeNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

	protected treeNodes: TreeNode[] = [];
	protected retrieveIntegrations : boolean = true;

	static context : vscode.ExtensionContext | undefined;

	constructor(context? : vscode.ExtensionContext) {
		CamelKNodeProvider.context = context;
	}

	// clear the tree
	public resetList(): void {
		this.treeNodes = [];
	}

	public getTreeNodes() : TreeNode[] {
		return this.treeNodes;
	}

	// set up so we don't pollute test runs with camel k integrations
	public setRetrieveIntegrations(flag:boolean): void {
		this.retrieveIntegrations = flag;
	}

	// get the list of children for the node provider
	public getChildren(element?: TreeNode): Promise<TreeNode[]> {
		return Promise.resolve(this.treeNodes);
	}

	public getParent(element?: TreeNode) {
		/* there is only root element currently.
		   Method is required to be provided for reveal method to work, which is used in tests*/
		return Promise.resolve(undefined);
	}

	// add a child to the list of nodes
	public addChild(oldNodes: TreeNode[] = this.treeNodes, newNode: TreeNode, disableRefresh : boolean = false ): Promise<TreeNode[]> {
		return new Promise<TreeNode[]>( async (resolve, reject) => {
			if (oldNodes) {
				oldNodes.push(newNode);
				if (!disableRefresh) {
					try {
						await this.refresh();
					} catch( err ) {
						reject(err);
					}
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
						try {
							await this.refresh();
						} catch (err) {
							reject(err);
						}
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
			if (this.retrieveIntegrations) {
				try {
					await installer.isKamelAvailable();
					const output: string = await kubectlutils.getIntegrations();
					this.processIntegrationList(output);
				} catch(error) {
					utils.shareMessage(extension.mainOutputChannel, `Refreshing Apache Camel K Integrations view using kubectl failed. ${error}`);
					reject(error);
					return;
				}
			}
			extension.hideStatusLine();
			this._onDidChangeTreeData.fire(undefined);
			const newCount: number = this.treeNodes.length;
			if (newCount === 0) {
				let namespace : string | undefined = config.getNamespaceconfig();
				if (namespace) {
					utils.shareMessage(extension.mainOutputChannel, `Refreshing Apache Camel K Integrations view succeeded, no published integrations available for namespace ${namespace}.`);
				} else {
					utils.shareMessage(extension.mainOutputChannel, `Refreshing Apache Camel K Integrations view succeeded, no published integrations available.`);
				}
			}
			resolve();
			return;
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
			const lines: Array<string> = output.split('\n');
			for (let entry of lines) {
				const spaceSplittedLine: Array<string> = entry.split('  ');
				const cleanLine: Array<string> = new Array<string>();
				for (let integration of spaceSplittedLine) {
					if (integration.trim().length === 0) {
						continue;
					}
					cleanLine.push(integration.trim());
				}
				const firstString: string = cleanLine[0];
				if (firstString === undefined || firstString.toUpperCase().startsWith('NAME') || firstString.trim().length === 0) {
					continue;
				}
				const integrationName: string = cleanLine[0];
				const status: string = cleanLine[1];
				const newNode: TreeNode = new TreeNode("string", integrationName, status, vscode.TreeItemCollapsibleState.None);
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
				const jsonObject: any = JSON.parse(JSON.stringify(json));
				for (let integration of jsonObject.items) {
					const newNode: TreeNode = new TreeNode("string", integration.metadata.name, integration.status.phase, vscode.TreeItemCollapsibleState.None);
					if (!this.doesNodeExist(this.treeNodes, newNode)) {
						this.addChild(this.treeNodes, newNode, true);
					}
				}
			} catch( error ) {
				console.log(error);
			}
		}
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

		if (CamelKNodeProvider.context) {
			this.iconPath = TreeNode.getIconForPodStatus(this.status, CamelKNodeProvider.context);
		}

		const namespace: string | undefined = config.getNamespaceconfig();
		if (namespace) {
			this.tooltip = `Status: ${this.status} \nNamespace: ${namespace}`;
		} else {
			this.tooltip = `Status: ${this.status}`;
		}
	}

	static getIconForPodStatus(status: string, extContext: vscode.ExtensionContext): vscode.Uri | undefined {
		if (extContext) {
			if (status && status.toLowerCase().startsWith("running")) {
				const iconPath: string = path.join(extContext.extensionPath, '/resources/round-k-transparent-16-running.svg');
				return vscode.Uri.file(iconPath);
			} else {
				const iconPath: string = path.join(extContext.extensionPath, '/resources/round-k-transparent-16-error.svg');
				return vscode.Uri.file(iconPath);
			}
		}
		return undefined;
	}
}
