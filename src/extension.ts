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
import { installKamel, installKubectl} from './installer';
import { Errorable, failed } from './errorable';
import * as kubectl from './kubectl';
import * as kamel from './kamel';
import * as kubectlutils from './kubectlutils';
import * as config from './config';
import * as StartJavaDebuggerCommand from './commands/StartJavaDebuggerCommand'
import { downloadSpecificCamelKJavaDependencies, initializeJavaDependenciesManager } from './JavaDependenciesManager';
import { CamelKTaskCompletionItemProvider } from './task/CamelKTaskCompletionItemProvider';
import { CamelKDebugTaskProvider } from './task/CamelKDebugTaskDefinition';
import { CamelKRunTaskProvider } from './task/CamelKRunTaskDefinition';
import { ChildProcess } from 'child_process';
import { LogsPanel } from './logsWebview';
import * as logUtils from './logUtils';
import {checkKamelNeedsUpdate, version, handleChangeRuntimeConfiguration} from './versionUtils';
import * as NewIntegrationFileCommand from './commands/NewIntegrationFileCommand';
import { registerCamelKSchemaProvider } from './CamelKSchemaManager';
import * as telemetry from './Telemetry';
export const DELAY_RETRY_KUBECTL_CONNECTION: number = 1000;

export let mainOutputChannel: vscode.OutputChannel;
export let myStatusBarItem: vscode.StatusBarItem;
export let camelKIntegrationsProvider: CamelKNodeProvider;
export let camelKIntegrationsTreeView: vscode.TreeView<TreeNode | undefined>;
export let closeLogViewWhenIntegrationRemoved: boolean;
export var runtimeVersionSetting: string | undefined;

const eventEmitter: events.EventEmitter = new events.EventEmitter();
const restartKubectlWatchEvent: string = 'restartKubectlWatch';

let showStatusBar: boolean;
let runningKubectl: ChildProcess | undefined;
let timestampLastkubectlIntegrationStart: number = 0;
let stashedContext: vscode.ExtensionContext;

const COMMAND_ID_START_LOG = 'camelk.integrations.log';
const COMMAND_ID_REFRESH = 'camelk.integrations.refresh';

const COMMAND_ID_REMOVE = 'camelk.integrations.remove';
export const COMMAND_ID_START_INTEGRATION = 'camelk.startintegration';
const COMMAND_ID_OPEN_OPERATOR_LOG = 'camelk.integrations.openOperatorLog';
export const COMMAND_ID_START_JAVA_DEBUG = 'camelk.integrations.debug.java';
export async function activate(context: vscode.ExtensionContext) {
	stashedContext = context;
	await telemetry.initializeTelemetry(context);
	camelKIntegrationsProvider = new CamelKNodeProvider(context);

	applyUserSettings();

	mainOutputChannel = vscode.window.createOutputChannel("Apache Camel K");
	await installAllTutorials(context);
	registerCamelKSchemaProvider(mainOutputChannel);
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	context.subscriptions.push(myStatusBarItem);
	
	vscode.tasks.registerTaskProvider(CamelKRunTaskProvider.START_CAMELK_TYPE, new CamelKRunTaskProvider());
	vscode.tasks.registerTaskProvider(CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE, new CamelKDebugTaskProvider());
	const tasksJson:vscode.DocumentSelector = { scheme: 'file', language: 'jsonc', pattern: '**/tasks.json' };
	vscode.languages.registerCompletionItemProvider(tasksJson, new CamelKTaskCompletionItemProvider());

	await installDependencies(context).then ( (): void => {
		
		createIntegrationsView();

		// start the watch listener for auto-updates
		startListeningForServerChanges();
	
		// Listener to handle auto-refresh of view - kubectl times out, so we simply restart the watch when it does
		var watchListener = function restartKubectlListenerOnEvent() {
			startListeningForServerChanges();
		};
		eventEmitter.on(restartKubectlWatchEvent, watchListener);
	
		// create the integration view action -- refresh
		vscode.commands.registerCommand(COMMAND_ID_REFRESH, () => {
			camelKIntegrationsProvider.refresh()
			.catch( (err) => {
				console.log(err);
			});
			telemetry.sendCommandTracking(COMMAND_ID_REFRESH);
		});
	
		// create the integration view action -- remove
		vscode.commands.registerCommand(COMMAND_ID_REMOVE, async (node: TreeNode) => {
			let selection : TreeNode = node;
			if (!selection) {
				if (camelKIntegrationsTreeView.selection) {
					selection = camelKIntegrationsTreeView.selection[0] as TreeNode;
				}
			}
			if (selection && selection.label) {
				setStatusLineMessageAndShow(`Removing Apache Camel K Integration...`);
				let integrationName: string = retrieveIntegratioName(selection);
				let kamelExecutor = kamel.create();
				utils.shareMessage(mainOutputChannel, 'Removing ' + integrationName + ' via Kamel executable Delete');
				try {
					await kamelExecutor.invoke(`delete ${integrationName}`);
				} catch(error) {
					utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
				}
				try {
					const isKilled = await integrationutils.killChildProcessForIntegration(integrationName);
					console.log(`Removed the child process running in the background for ${integrationName}: ${isKilled}`);
				} catch(err) {
					console.log(err);
				}
				await removeIntegrationLogView(integrationName);
				// TODO: we need to look into closing the log view when the integration is stopped
				hideStatusLine();
				try {
					await camelKIntegrationsProvider.refresh();
				} catch (err) {
					console.log(err);
				}
				telemetry.sendCommandTracking(COMMAND_ID_REMOVE);
			}
		});
	
		// create the integration view action -- start log
		vscode.commands.registerCommand(COMMAND_ID_START_LOG, async (node: TreeNode) => {
			let selection : TreeNode = node;
			if (!selection) {
				if (camelKIntegrationsTreeView.selection) {
					selection = camelKIntegrationsTreeView.selection[0] as TreeNode;
				}
			}
			if (selection && selection.label) {
				utils.shareMessage(mainOutputChannel, `Retrieving log for running Apache Camel K Integration...`);
				let integrationName : string = retrieveIntegratioName(selection);
				await logUtils.handleLogViaKamelCli(integrationName).catch((error) => {
					utils.shareMessage(mainOutputChannel, `error: ${error} \n`);
				});
				telemetry.sendCommandTracking(COMMAND_ID_START_LOG);
			}
		});
	
		// create the integration view action -- start new integration
		context.subscriptions.push(vscode.commands.registerCommand(COMMAND_ID_START_INTEGRATION,
			async (...args:any[]) => {
				await runTheFile(args);
			}));
	
		// add commands to create config-map and secret objects from .properties files
		configmapsandsecrets.registerCommands();
		
		// create the integration view action -- open operator log
		vscode.commands.registerCommand(COMMAND_ID_OPEN_OPERATOR_LOG, async () => {
			utils.shareMessage(mainOutputChannel, `Retrieving log for Apache Camel K Operator...`);
			try {
				await logUtils.handleOperatorLog();
			} catch (err) {
				utils.shareMessage(mainOutputChannel, `No Apache Camel K Operator available: ${err} \n`);
			}
			telemetry.sendCommandTracking(COMMAND_ID_OPEN_OPERATOR_LOG);
		});

		vscode.commands.registerCommand('camelk.integrations.createNewIntegrationFile', async (...args:any[]) => { await NewIntegrationFileCommand.create(args);});
		vscode.commands.registerCommand('camelk.integrations.selectFirstNode', () => { selectFirstItemInTree();});
		vscode.commands.registerCommand('camelk.classpath.refresh', async (uri:vscode.Uri) => { await downloadSpecificCamelKJavaDependencies(context, uri, mainOutputChannel)});
		vscode.commands.registerCommand(COMMAND_ID_START_JAVA_DEBUG, async (integrationItem: TreeNode) => {
			await StartJavaDebuggerCommand.start(integrationItem);
			telemetry.sendCommandTracking(COMMAND_ID_START_JAVA_DEBUG);
		});
	});

	initializeJavaDependenciesManager(context);
	
	vscode.workspace.onDidChangeConfiguration(async (event) => {
		await handleChangeRuntimeConfiguration();
		closeLogViewWhenIntegrationRemoved = vscode.workspace.getConfiguration().get(config.REMOVE_LOGVIEW_ON_SHUTDOWN_KEY) as boolean;
		showStatusBar = vscode.workspace.getConfiguration().get(config.SHOW_STATUS_BAR_KEY) as boolean;
		if (!showStatusBar) {
			hideStatusLine();
		}
		if (event.affectsConfiguration(config.NAMESPACE_KEY)) {
			runningKubectl?.kill();
			eventEmitter.emit(restartKubectlWatchEvent);
		}
		if (camelKIntegrationsTreeView && camelKIntegrationsTreeView.visible === true) {
			try {
				await camelKIntegrationsProvider.refresh();
			} catch (err) {
				console.log(err);
			}
		}
	});
	
	(await telemetry.getTelemetryServiceInstance()).sendStartupEvent();
	
	return {
		getStashedContext() : vscode.ExtensionContext {
			return stashedContext;
		},
		getCamelKIntegrationsProvider(): CamelKNodeProvider {
			return camelKIntegrationsProvider;
		},
		getCamelKIntegrationsTreeView(): vscode.TreeView<TreeNode | undefined>{
			return camelKIntegrationsTreeView;
		},
		getIntegrationsFromKubectlCliWithWatchTestApi(): Promise<void> {
			return getIntegrationsFromKubectlCliWithWatch();
		},
		getMainOutputChannel(): vscode.OutputChannel {
			return mainOutputChannel;
		}
	};
}

function retrieveIntegratioName(selection: TreeNode) {
	let integrationNameTreeItem: string | vscode.TreeItemLabel | undefined = selection.label;
	if (integrationNameTreeItem === undefined) {
		return "";
	} else if(typeof integrationNameTreeItem === "string") {
		return integrationNameTreeItem;
	} else {
		return integrationNameTreeItem.label;
	}
}

function selectFirstItemInTree() {
	let nodes = camelKIntegrationsProvider.getTreeNodes();
	if (nodes && nodes.length > 0) {
		let firstNode = nodes[0];
		camelKIntegrationsTreeView.reveal(firstNode, {select:true});
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
async function runTheFile(...args: any[]) {
	try {
		await startIntegration(args);
		await camelKIntegrationsProvider.refresh();
	} catch (error) {
		console.log(error);
	}
}

// start an integration from a file
async function startIntegration(...args: any[]): Promise<any> {
	setStatusLineMessageAndShow(`Starting new Apache Camel K Integration...`);
	utils.shareMessage(mainOutputChannel, "Starting new integration via Kamel executable.");
	try {
		const success: boolean = await integrationutils.startIntegration(args);
		if (!success) {
			vscode.window.showErrorMessage("Unable to call Kamel.");
			return Promise.reject(new Error("Unable to call Kamel."));
		} 
	} catch (err) {
		utils.shareMessage(mainOutputChannel, ("Kamel execution return code: " + err));
		return Promise.reject(err);
	} finally {
		hideStatusLine();
	}
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


export function getIntegrationsFromKubectlCliWithWatch() : Promise<void> {
	return new Promise<void>(async (resolve, reject) => {
		const kubectlExe: kubectl.Kubectl = kubectl.create();
		const kubectlArgs : string[] = [];
		kubectlArgs.push('get');
		kubectlArgs.push(`integrations`);
		kubectlArgs.push(`-w`);
		timestampLastkubectlIntegrationStart = Date.now();
	
		try {
			const runKubectl: ChildProcess = await kubectlExe.invokeArgs(kubectlArgs);
			runningKubectl = runKubectl;
			if (runKubectl.stdout) {
				runKubectl.stdout.on('data', async function () {
					if (camelKIntegrationsTreeView.visible === true) {
						try {
							await camelKIntegrationsProvider.refresh();
						} catch(err) {
							console.log(err);
						}
					}
				});
			}
			runKubectl.on('close', () => {
				if (camelKIntegrationsTreeView.visible === true && Date.now() - timestampLastkubectlIntegrationStart > DELAY_RETRY_KUBECTL_CONNECTION) {
					// stopped listening to server - likely timed out
					eventEmitter.emit(restartKubectlWatchEvent);
				}
				runningKubectl = undefined;
				resolve();
			});				
		} catch (error) {
			reject(new Error(`Kubernetes CLI unavailable: ${error}`));
		}
	});
}

// use kubectl to keep an eye on the server for changes and update the view
export async function startListeningForServerChanges(): Promise<void> {
	await getIntegrationsFromKubectlCliWithWatch();
}

function applyStatusBarSettings(): void {
	showStatusBar = vscode.workspace.getConfiguration().get(config.SHOW_STATUS_BAR_KEY) as boolean;
}

function applyLogviewSettings(): void {
	closeLogViewWhenIntegrationRemoved = vscode.workspace.getConfiguration().get(config.REMOVE_LOGVIEW_ON_SHUTDOWN_KEY) as boolean;
}

async function applyDefaultVersionSettings() : Promise<void> {
	const runtimeSetting: string | undefined = config.getKamelRuntimeVersionConfig();
	const autoUpgradeSetting: boolean = config.getKamelAutoupgradeConfig();
	if (!runtimeSetting) {
		await config.setKamelRuntimeVersionConfig(version);
		runtimeVersionSetting = version;
		shareMessageInMainOutputChannel(`No version found. Using default version ${runtimeVersionSetting} of Apache Camel K CLI`);
	} else {
		if (autoUpgradeSetting && autoUpgradeSetting === true) {
			if (runtimeSetting && version.toLowerCase() !== runtimeSetting.toLowerCase()) {
				await config.setKamelRuntimeVersionConfig(version);
				runtimeVersionSetting = version;	
				shareMessageInMainOutputChannel(`Auto-upgrade setting enabled. Updating to default version ${version} of Apache Camel K CLI`);
			}
		} else {
			shareMessageInMainOutputChannel(`Using version ${runtimeSetting} of Apache Camel K CLI`);
			runtimeVersionSetting = runtimeSetting;
		}
	}
}

function applyUserSettings(): void {
	applyStatusBarSettings();
	applyLogviewSettings();
	applyDefaultVersionSettings();
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
			try { 
				await camelKIntegrationsProvider.refresh();
			} catch( err ) {
				console.log(err);
			}
		} else {
			runningKubectl?.kill();
		}
	});
}

export async function installDependencies(context: vscode.ExtensionContext) {
	let gotKamel : boolean = false;
	try {
		const response: boolean = await checkKamelNeedsUpdate();
		gotKamel = !response; 
	} catch (error) {
		// ignore but log
		console.log(`Error when checking for kamel version: ${error}`);
	}

	let gotKubernetes : boolean = false;
	try {
		const kubectlCliVersion: string | undefined = await kubectlutils.getKubernetesVersion();
		if (kubectlCliVersion) {
			shareMessageInMainOutputChannel(`Found Kubernetes CLI (kubectl) version ${kubectlCliVersion}...`);
			gotKubernetes = true;
		}
	} catch (error) {
		// ignore but log
		console.log(`Error when checking for Kubernetes version: ${error}`);
	}

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
		const result: Errorable<null> = await installFunc(context);
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

// for testing purposes only
export function getStashedContext() : vscode.ExtensionContext {
	return stashedContext;
}

async function removeIntegrationLogView(integrationName: string) : Promise<void> {
	if (closeLogViewWhenIntegrationRemoved) {
		LogsPanel.currentPanels.forEach((value : LogsPanel) => {
			var title = value.getTitle();
			if (title.indexOf(integrationName) >= 0) {
				value.disposeView();
			}
		});
	} else {
		LogsPanel.currentPanels.forEach((value : LogsPanel) => {
			var title = value.getTitle();
			if (title.indexOf(integrationName) >= 0) {
				logUtils.updateLogViewTitleToStopped(value, title);
			}
		});
	}
}

export function setRuntimeVersionSetting(value: string) {
	runtimeVersionSetting = value;	
}

async function installAllTutorials(context : vscode.ExtensionContext) {
	const tutorialList = {
		"tutorials": [
			{
				"name": "Your First Integration", 
				"extpath" : "./didact/camelk/first-integration.md", "category": "Apache Camel K"
			}
		]
	};
	for (let tutorial of tutorialList.tutorials) {
		await registerTutorialWithDidact(context, tutorial.name, tutorial.extpath, tutorial.category);
	}
}

async function registerTutorialWithDidact(context: vscode.ExtensionContext, name : string, extpath : string, category : string) {
	try {
		// test to ensure didact is available 
		const extensionId: string = 'redhat.vscode-didact';
		const didactExt: any = vscode.extensions.getExtension(extensionId);
		if (didactExt) {
			const commandId: string = 'vscode.didact.register';
			const tutorialUri: vscode.Uri = vscode.Uri.file(context.asAbsolutePath(extpath));

			// then pass name, file system path, and category
			await vscode.commands.executeCommand(commandId,	name, tutorialUri.fsPath, category);
		}
	} catch (error) {
		console.log(error);
	}
}
