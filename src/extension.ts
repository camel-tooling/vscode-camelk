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
import { CamelKNodeProvider, TreeNode } from './CamelKNodeProvider';
import * as utils from './CamelKJSONUtils';
import * as configmapsandsecrets from './ConfigMapAndSecrets';
import * as integrationutils from './IntegrationUtils';
import * as events from 'events';
import { installKamel, installKubectl, checkKamelNeedsUpdate } from './installer';
import { Errorable, failed } from './errorable';
import * as kubectl from './kubectl';
import * as kamel from './kamel';
import * as kubectlutils from './kubectlutils';
import * as config from './config';
import { downloadJavaDependencies, updateReferenceLibraries } from './JavaDependenciesManager';
import { CamelKTaskCompletionItemProvider } from './task/CamelKTaskCompletionItemProvider';
import { CamelKTaskProvider } from './task/CamelKTaskDefinition';
import { ChildProcess } from 'child_process';
import { LogsPanel } from './logsWebview';

export const DELAY_RETRY_KUBECTL_CONNECTION = 1000;

export let mainOutputChannel: vscode.OutputChannel;
export let myStatusBarItem: vscode.StatusBarItem;
export let camelKIntegrationsProvider : CamelKNodeProvider;
export let camelKIntegrationsTreeView : vscode.TreeView<TreeNode | undefined>;

let showStatusBar : boolean;
let eventEmitter = new events.EventEmitter();
const restartKubectlWatchEvent = 'restartKubectlWatch';
let runningKubectl : ChildProcess | undefined;
let timestampLastkubectlIntegrationStart = 0;
let closeLogViewWhenIntegrationRemoved : boolean;

let stashedContext : vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext): Promise<void> {

	stashedContext = context;

	camelKIntegrationsProvider = new CamelKNodeProvider(context);

	applyUserSettings();

	mainOutputChannel = vscode.window.createOutputChannel("Apache Camel K");
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	context.subscriptions.push(myStatusBarItem);
	
	vscode.tasks.registerTaskProvider(CamelKTaskProvider.START_CAMELK_TYPE, new CamelKTaskProvider());
	let tasksJson:vscode.DocumentSelector = { scheme: 'file', language: 'jsonc', pattern: '**/tasks.json' };
	vscode.languages.registerCompletionItemProvider(tasksJson, new CamelKTaskCompletionItemProvider());

	await installDependencies(context).then ( () => {
		
		createIntegrationsView();

		// start the watch listener for auto-updates
		startListeningForServerChanges();
	
		// Listener to handle auto-refresh of view - kubectl times out, so we simply restart the watch when it does
		var watchListener = function restartKubectlListenerOnEvent() {
			startListeningForServerChanges();
		};
		eventEmitter.on(restartKubectlWatchEvent, watchListener);
	
		// create the integration view action -- refresh
		vscode.commands.registerCommand('camelk.integrations.refresh', () => {
			camelKIntegrationsProvider.refresh()
			.catch( (err) => {
				console.log(err);
			});
		});
	
		// create the integration view action -- remove
		vscode.commands.registerCommand('camelk.integrations.remove', async (node: TreeNode) => {
			if (node && node.label) {
				setStatusLineMessageAndShow(`Removing Apache Camel K Integration...`);
				let integrationName : string = node.label;
				let kamelExe = kamel.create();
				utils.shareMessage(mainOutputChannel, 'Removing ' + integrationName + ' via Kamel executable Delete');
				let args : string[] = ['delete', `${integrationName}`];
				await kamelExe.invokeArgs(args)
					.then( /* empty for now but here in case we need it */ )
					.catch( (error) => {
						utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
				});
				await integrationutils.killChildProcessForIntegration(integrationName).then( (boolResult) => {
					console.log(`Removed the child process running in the background for ${integrationName}: ${boolResult}`);
				}).catch( (err) => {
					console.log(err);
				});
				await removeIntegrationLogView(integrationName);
				// TODO: we need to look into closing the log view when the integration is stopped
				hideStatusLine();
				await camelKIntegrationsProvider.refresh()
				.catch( (err) => {
					console.log(err);
				});
			}
		});
	
		// create the integration view action -- start log
		vscode.commands.registerCommand('camelk.integrations.log', async (node: TreeNode) => {
			if (node && node.label) {
				setStatusLineMessageAndShow(`Retrieving log for running Apache Camel K Integration...`);
				let integrationName : string = node.label;
				await handleLogViaKamelCli(integrationName).catch((error) => {
					utils.shareMessage(mainOutputChannel, `error: ${error} \n`);
				});
				hideStatusLine();
			}
		});
	
		// create the integration view action -- start new integration
		let startIntegration = vscode.commands.registerCommand('camelk.startintegration', async (uri:vscode.Uri) => { await runTheFile(uri);});
		context.subscriptions.push(startIntegration);
	
		// add commands to create config-map and secret objects from .properties files
		configmapsandsecrets.registerCommands();
		
	});

	let destination = downloadJavaDependencies(context);
	
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		updateReferenceLibraries(editor, destination);
	});
	
	if (vscode.window.activeTextEditor) {
		updateReferenceLibraries(vscode.window.activeTextEditor, destination);
	}
	
}


export function setStatusLineMessageAndShow( message: string): void {
	if (myStatusBarItem && message && showStatusBar) {
		myStatusBarItem.text = message;
		myStatusBarItem.show();
	}
}

export function hideStatusLine(): void {
	if (myStatusBarItem) {
		myStatusBarItem.hide();
	}
}

// start the integration file
async function runTheFile(context: vscode.Uri) {
	await startIntegration(context)
		.then( async () => await camelKIntegrationsProvider.refresh())
		.catch ( (error) => console.log(error) );
}

// start an integration from a file
function startIntegration(context: vscode.Uri): Promise<any> {
	return new Promise <any> ( async (resolve, reject) => {
		setStatusLineMessageAndShow(`Starting new Apache Camel K Integration...`);
		utils.shareMessage(mainOutputChannel, "Starting new integration via Kamel executable.");
		await integrationutils.startIntegration(context)
			.then( success => {
				if (!success) {
					vscode.window.showErrorMessage("Unable to call Kamel.");
					reject(new Error("Unable to call Kamel."));
				} else {
					resolve();
				}
				hideStatusLine();
			})
			.catch(err => {
				utils.shareMessage(mainOutputChannel, ("Kamel execution return code: " + err));
				reject(err);
				hideStatusLine();
			});
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	if (mainOutputChannel) {
		mainOutputChannel.dispose();
	}

	if (myStatusBarItem) {
		myStatusBarItem.dispose();
	}
}

export async function getIntegrationsFromKubectlCliWithWatch() : Promise<void> {
	return new Promise<void>( async (resolve, reject) => {
		let kubectlExe = kubectl.create();
		let kubectlArgs : string[] = [];
		kubectlArgs.push('get');
		kubectlArgs.push(`integrations`);
		kubectlArgs.push(`-w`);
		timestampLastkubectlIntegrationStart = Date.now();

		await kubectlExe.invokeArgs(kubectlArgs)
			.then( async (runKubectl) => {
				runningKubectl = runKubectl;
				if (runKubectl.stdout) {
					runKubectl.stdout.on('data', async function () {
						if (camelKIntegrationsTreeView.visible === true) {
							await camelKIntegrationsProvider.refresh().catch(err => console.log(err));
						}
					});
				}
				runKubectl.on("close", () => {
					if (camelKIntegrationsTreeView.visible === true && Date.now() - timestampLastkubectlIntegrationStart > DELAY_RETRY_KUBECTL_CONNECTION) {
						// stopped listening to server - likely timed out
						eventEmitter.emit(restartKubectlWatchEvent);
					}
					runningKubectl = undefined;
					resolve();
				});				
			})
			.catch( (error) => {
				reject(new Error(`Kubernetes CLI unavailable: ${error}`));
				return;
			});
	});
}

// use kubectl to keep an eye on the server for changes and update the view
export async function startListeningForServerChanges(): Promise<void> {
	await getIntegrationsFromKubectlCliWithWatch();
}

function applyStatusBarSettings(): void {
	let statusBarSetting = vscode.workspace.getConfiguration().get(config.SHOW_STATUS_BAR_KEY) as boolean;
	showStatusBar = statusBarSetting;

	vscode.workspace.onDidChangeConfiguration(() => {
		let statusBarSetting = vscode.workspace.getConfiguration().get(config.SHOW_STATUS_BAR_KEY) as boolean;
		showStatusBar = statusBarSetting;
		if (!showStatusBar) {
			hideStatusLine();
		}
	});
}

function applyLogviewSettings(): void {
	let logviewSetting = vscode.workspace.getConfiguration().get(config.REMOVE_LOGVIEW_ON_SHUTDOWN_KEY) as boolean;
	closeLogViewWhenIntegrationRemoved = logviewSetting;

	vscode.workspace.onDidChangeConfiguration(() => {
		let statusBarSetting = vscode.workspace.getConfiguration().get(config.REMOVE_LOGVIEW_ON_SHUTDOWN_KEY) as boolean;
		closeLogViewWhenIntegrationRemoved = statusBarSetting;
	});
}

function refreshIfNamespaceChanges(): void {
	vscode.workspace.onDidChangeConfiguration(async () => {
		if (camelKIntegrationsTreeView && camelKIntegrationsTreeView.visible === true) {
			await camelKIntegrationsProvider.refresh().catch(err => console.log(err));
		}
	});
}


function applyUserSettings(): void {
	applyStatusBarSettings();
	refreshIfNamespaceChanges();
	applyLogviewSettings();
}

function createIntegrationsView(): void {
	camelKIntegrationsTreeView = vscode.window.createTreeView('camelk.integrations', {
		treeDataProvider: camelKIntegrationsProvider
	});
	camelKIntegrationsTreeView.onDidChangeVisibility(async () => {
		if (camelKIntegrationsTreeView.visible === true) {
			if (runningKubectl === undefined || runningKubectl.killed) {
				eventEmitter.emit(restartKubectlWatchEvent);
			}
			await camelKIntegrationsProvider.refresh().catch(err => console.log(err));
		} else {
			runningKubectl?.kill();
		}
	});
}

export async function installDependencies(context: vscode.ExtensionContext) {

	let gotKamel : boolean = false;

	await checkKamelNeedsUpdate()
		.then ( (response) => { 
			gotKamel = !response; 
	}).catch ( (error) => {
		// ignore but log
		console.log(`Error when checking for kamel version: ${error}`);
	});

	let gotKubernetes : boolean = false;
	await kubectlutils.getKubernetesVersion().then ( async (kubectlCliVersion) => {
		if (kubectlCliVersion) {
			shareMessageInMainOutputChannel(`Found Kubernetes CLI (kubectl) version ${kubectlCliVersion}...`);
			gotKubernetes = true;
		}
	}).catch( (error) => {
		// ignore but log
		console.log(`Error when checking for Kubernetes version: ${error}`);
	});

	if (!gotKamel) {
		await installDependency("kamel", gotKamel, context, installKamel);
	}
	if (!gotKubernetes) {
		await installDependency("kubectl", false, context, installKubectl);
	}
}

async function installDependency(name: string, alreadyGot: boolean, context: vscode.ExtensionContext, installFunc: (context: vscode.ExtensionContext) => Promise<Errorable<null>>): Promise<void> {
	if (!alreadyGot) {
		shareMessageInMainOutputChannel(`Installing ${name}...`);
		const result = await installFunc(context);
		if (failed(result)) {
			utils.shareMessage(mainOutputChannel, `Unable to install ${name}: ${result.error[0]}`);
		} else {
			shareMessageInMainOutputChannel('done');
		}
	}
}

export function shareMessageInMainOutputChannel(msg: string) {
	utils.shareMessage(mainOutputChannel, msg);
}

function handleLogViaKamelCli(integrationName: string) : Promise<string> {
	return new Promise<string>( async () => {
		let kamelExe = kamel.create();
		let ns = `default`;
		const currentNs = config.getNamespaceconfig();
		if (currentNs) {
			ns = currentNs;
		}
		let resource = {
			kindName: `custom/${integrationName}`,
			namespace: ns,
			containers: undefined,
			containersQueryPath: `.spec`
		};
		const cresource = `${resource.namespace}/${resource.kindName}`;
		let args : string[] = ['log', `${integrationName}`];
		await kamelExe.invokeArgs(args)
			.then( async (proc : ChildProcess) => {
				const panel = LogsPanel.createOrShow(`Waiting for integration ${integrationName} to start...\n`, cresource);
				if (proc && proc.stdout) {
					proc.stdout.on('data', async (data: string) => {
						if (data.length > 0) {
							var buf = Buffer.from(data);
							var text = buf.toString();
							if (text.indexOf(`Received hang up - stopping the main instance`) > 0 && !closeLogViewWhenIntegrationRemoved) {
								var title = panel.getTitle();
								panel.updateTitle(title + ` [Integration stopped]`);
							}
							panel.addContent(buf.toString());
						}
					});
				}
				}).catch( (error) => {
					utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
				});
	});
}

// for testing purposes only
export function getStashedContext() : vscode.ExtensionContext {
	return stashedContext;
}

function removeIntegrationLogView(integrationName: string) : Promise<string> {
	return new Promise<string>( async () => {
		if (closeLogViewWhenIntegrationRemoved) {
			LogsPanel.currentPanels.forEach((value : LogsPanel) => {
				var title = value.getTitle();
				if (title.indexOf(integrationName) > 0) {
					value.disposeView();
				}
			});
		}
	});
}
