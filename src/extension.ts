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
import { ChildProcess } from 'child_process';

export let mainOutputChannel: vscode.OutputChannel;
export let myStatusBarItem: vscode.StatusBarItem;

let camelKIntegrationsProvider : CamelKNodeProvider;
let outputChannelMap : Map<string, vscode.OutputChannel>;
let showStatusBar : boolean;
let camelKIntegrationsTreeView : vscode.TreeView<TreeNode>;
let eventEmitter = new events.EventEmitter();
const restartKubectlWatchEvent = 'restartKubectlWatch';
let runningKubectl : ChildProcess | undefined;
let timestampLastkubectlIntegrationStart = 0;

let stashedContext : vscode.ExtensionContext;

// This extension offers basic integration with Camel K (https://github.com/apache/camel-k) on two fronts.
export async function activate(context: vscode.ExtensionContext): Promise<void> {

	stashedContext = context;

	outputChannelMap = new Map();

	camelKIntegrationsProvider = new CamelKNodeProvider(context);

	applyUserSettings();

	mainOutputChannel = vscode.window.createOutputChannel("Apache Camel K");
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	context.subscriptions.push(myStatusBarItem);

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
				await removeOutputChannelForIntegrationViaKubectl(integrationName)
				.catch( (err) => {
					console.log(err);
				});
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
				await getIntegrationsFromKubectl(integrationName)
					.then( (podName) => {
						if (podName) {
							handleLogViaKubectlCli(podName);
						} else {
							utils.shareMessage(mainOutputChannel, `No deployed integration found for: ${integrationName} \n`);
						}
					}).catch( (error) => {
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

// find an output channel by name in the map and remove it
function removeOutputChannel( channelName: string) : Promise<any> {
	return new Promise <any> ( (resolve, reject) => {
		let podOutputChannel;
		if (outputChannelMap.has(channelName)) {
			podOutputChannel = outputChannelMap.get(channelName);
			if (podOutputChannel !== undefined) {
				outputChannelMap.delete(channelName);
				try {
					podOutputChannel.dispose();
					resolve();
				} catch (error) {
					console.log(error);
					reject(error);
				} finally {
					mainOutputChannel.show();
					utils.shareMessage(mainOutputChannel, `Removed Output channel for integration: ${channelName}`);
				}
			}
		}
	});
}

// retrieve the actual output channel for the name we stashed in the map
function getOutputChannel( channelName: string) : vscode.OutputChannel {
	let podOutputChannel;
	if (outputChannelMap.has(channelName)) {
		podOutputChannel = outputChannelMap.get(channelName);
		if (podOutputChannel) {
			return podOutputChannel;
		}
	}
	podOutputChannel = vscode.window.createOutputChannel(channelName);
	outputChannelMap.set(channelName, podOutputChannel);
	return podOutputChannel;
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

// remove the output channel for a running integration via kubectl executable
export async function removeOutputChannelForIntegrationViaKubectl(integrationName:string): Promise<any> {
	await getIntegrationsFromKubectl(integrationName)
		.then( async (podName) => {
			if (podName) {
				await removeOutputChannel(podName)
					.catch( (error) => console.log(error));
			}
		})
		.catch(err => {
			console.log(err);
		});
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	if (mainOutputChannel) {
		mainOutputChannel.dispose();
	}
	if (outputChannelMap && outputChannelMap.size > 0) {
		Array.from(outputChannelMap.values()).forEach(value => value.dispose());
	}
	outputChannelMap.clear();

	if (myStatusBarItem) {
		myStatusBarItem.dispose();
	}
}

// retrieve the first integration running in camel k starting with the integration name
async function getIntegrationsFromKubectl(integrationName : string): Promise<string> {
	return new Promise <string> ( async (resolve, reject) => {
		await kubectlutils.getPodsFromKubectlCli()
		.then( (allPods) => {
			let podArray = kubectlutils.parseShellResult(allPods);
			podArray.forEach(podName => {
				if (podName.startsWith(integrationName)) {
					resolve(podName);
					return;
				}
			});
			resolve(undefined);
			return;
		}).catch ( (error) => {
			reject(error);
			return;
		});
	});
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
					if (camelKIntegrationsTreeView.visible === true && Date.now() - timestampLastkubectlIntegrationStart > 1000) {
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

function handleLogViaKubectlCli(podName: string) : Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		let kubectlExe = kubectl.create();
		let kubectlArgs : string[] = [];
		kubectlArgs.push('logs');
		kubectlArgs.push(`-f`);
		kubectlArgs.push(`${podName}`);

		let podOutputChannel = getOutputChannel(podName);
		podOutputChannel.show();
	
		await kubectlExe.invokeArgs(kubectlArgs)
			.then( (runKubectl) => {
				if (runKubectl.stdout) {
					runKubectl.stdout.on('data', function (data) {
						try {
							if (podOutputChannel) {
								podOutputChannel.append(`${data}`);
							}
						} catch (error) {
							console.log(error);
						}
					});
				}
				if (runKubectl.stderr) {
					runKubectl.stderr.on('data', async function (data) {
						let tempData = data as string;
						if (tempData.indexOf(`waiting to start: ContainerCreating`) > 0) {
							podOutputChannel.append(`Waiting for container ${podName} to start...\n`);
							await utils.delay(5000).then( async () => await handleLogViaKubectlCli(podName));
						} else {
							podOutputChannel.append("[ERROR] " + `${data} \n`);
						}
					});
				}
				runKubectl.on("close", (code, signal) => {
					console.log("[CLOSING] " + `${code} / ${signal} \n`);
				});
						})
			.catch( (error) => {
				reject(new Error(`Kubernetes CLI unavailable: ${error}`));
				return;
			});
	});
}

// for testing purposes only
export function getStashedContext() : vscode.ExtensionContext {
	return stashedContext;
}
