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
import * as child_process from 'child_process';
import * as path from 'path';
import { CamelKNodeProvider, TreeNode } from './CamelKNodeProvider';
import * as utils from './CamelKJSONUtils';
import * as rp from 'request-promise';
import {platform} from 'os';
import * as configmapsandsecrets from './ConfigMapAndSecrets';
import * as integrationutils from './IntegrationUtils';
import * as events from 'events';

export let mainOutputChannel: vscode.OutputChannel;
export let myStatusBarItem: vscode.StatusBarItem;

let camelKIntegrationsProvider = new CamelKNodeProvider();
let useProxy : boolean;
let outputChannelMap : Map<string, vscode.OutputChannel>;
let curlCommand : string = '/bin/sh';
let curlOption : string = '-c';
let proxyPort : number;
let showStatusBar : boolean;
let camelKIntegrationsTreeView : vscode.TreeView<TreeNode>;
let eventEmitter = new events.EventEmitter();
const restartKubectlWatchEvent = 'restartKubectlWatch';

// This extension offers basic integration with Camel K (https://github.com/apache/camel-k) on two fronts.
export function activate(context: vscode.ExtensionContext) {

	outputChannelMap = new Map();

	determineCurlCommand();
	applyUserSettings();

	mainOutputChannel = vscode.window.createOutputChannel("Apache Camel K");
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	context.subscriptions.push(myStatusBarItem);

	createIntegrationsView();

	// start the watch listener for auto-updates
	startListeningForServerChanges();

	// Listener to handle auto-refresh of view - kubectl times out, so we simply restart the watch when it does
	var watchListener = function restartKubectlListenerOnEvent() {
		startListeningForServerChanges();
	};
	eventEmitter.on(restartKubectlWatchEvent, watchListener);

	// create the integration view action -- refresh
	vscode.commands.registerCommand('camelk.integrations.refresh', () => camelKIntegrationsProvider.refresh());

	// create the integration view action -- remove
	vscode.commands.registerCommand('camelk.integrations.remove', async (node: TreeNode) => {
		if (node && node.label) {
			setStatusLineMessage(`Removing Apache Camel K Integration...`);
			let integrationName : string = node.label;
			if (useProxy) {
				utils.shareMessage(mainOutputChannel, 'Removing ' + integrationName + ' via Kubernetes Rest Delete');
				await stopIntegrationViaRest(integrationName).catch( (error) => {
					utils.shareMessage(mainOutputChannel, `rest error: ${error}`);
				});
			} else {
				utils.shareMessage(mainOutputChannel, 'Removing ' + integrationName + ' via Kamel executable Delete');
				let commandString = 'kamel delete "' + integrationName + '"';
				child_process.exec(commandString, (error, stdout, stderr) => {
					if (error) {
						utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
						return;
					}
					if (stdout) {
						// empty for now, but here in case we need it
					}
					if (stderr) {
						console.log(`stderr: ${stderr}`);
					}
				});
				await removeOutputChannelForIntegrationViaKubectl(integrationName);
			}
			hideStatusLine();
			camelKIntegrationsProvider.refresh();
		}
	});

	// create the integration view action -- start log
	vscode.commands.registerCommand('camelk.integrations.log', async (node: TreeNode) => {
		if (node && node.label) {
			setStatusLineMessage(`Retrieving log for running Apache Camel K Integration...`);
			let integrationName : string = node.label;
			if (useProxy) {
				utils.shareMessage(mainOutputChannel, 'Connecting to the log for ' + integrationName + ' via Kubernetes Rest');
				await getPodsViaRest()
					.then((output) => {
						findThePODNameForIntegrationFromJSON(output, integrationName)
							.then( async (podName) => {
								await (getPodLogViaCurl(podName))
								.catch( (error) => {
									utils.shareMessage(mainOutputChannel, `No log found for pod: ${error}`);
								});
							})
							.catch( (error) => {
								utils.shareMessage(mainOutputChannel, `No pod found for integration: ${integrationName}`);
							});
						})
					.catch( (error) => {
						utils.shareMessage(mainOutputChannel, `rest error: ${error}`);
				});
			} else {
				utils.shareMessage(mainOutputChannel, 'Connecting to the log for ' + integrationName + ' via kubectl');
				await getIntegrationsFromKubectl(integrationName)
					.then( (output) => {
						let podName = processIntegrationList(output);
						if (podName) {
							let commandString = 'kubectl logs -f ' + podName;
							let podOutputChannel = getOutputChannel(podName);
							podOutputChannel.show();
							let kubectl = child_process.exec(commandString);
							if (kubectl.stdout) {
								kubectl.stdout.on('data', function (data) {
									try {
										if (podOutputChannel) {
											podOutputChannel.append(`${data}`);
										}
									} catch (error) {
										console.log(error);
									}
								});
							}
							if (kubectl.stderr) {
								kubectl.stderr.on('data', function (data) {
									mainOutputChannel.append("[ERROR] " + `${data} \n`);
								});
							}
							kubectl.on("close", (code, signal) => {
								console.log("[CLOSING] " + `${code} / ${signal} \n`);
							});
						} else {
							utils.shareMessage(mainOutputChannel, `No deployed integration found for: ${integrationName} \n`);
						}
					}).catch( (error) => {
						utils.shareMessage(mainOutputChannel, `rest error: ${error} \n`);
					});
			}
			hideStatusLine();
		}
	});

	// create the integration view action -- start proxy
	vscode.commands.registerCommand('camelk.integrations.startproxy', async (node: TreeNode) => {
		setStatusLineMessage(`Starting kubectl proxy...`);
		await startKubeProxy()
			.then ( () => {
				let proxy = utils.createBaseProxyURL();
				utils.shareMessage(mainOutputChannel, (`Started kubectl proxy at URL ${proxy}`));
				hideStatusLine();
				if (useProxy) {
					// populate the initial tree
					camelKIntegrationsProvider.refresh();
				}
			})
			.catch( (error) => {
				utils.shareMessage(mainOutputChannel, ("kubectl execution return code: " + error));
		});
		hideStatusLine();
	});

	// create the integration view action -- start new integration
	let startIntegration = vscode.commands.registerCommand('camelk.startintegration', async (uri:vscode.Uri) => { await runTheFile(uri);});
	context.subscriptions.push(startIntegration);

	// add commands to create config-map and secret objects from .properties files
	configmapsandsecrets.registerCommands();
}

export function setStatusLineMessage( message : string) {
	if (myStatusBarItem && message && showStatusBar) {
		myStatusBarItem.text = message;
		myStatusBarItem.show();
	}
}

export function hideStatusLine() {
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
				} catch (error) {
					console.log(error);
					reject(error);
					return;
				}
				mainOutputChannel.show();
				utils.shareMessage(mainOutputChannel, `Removed Output channel for integration: ${channelName}`);
				resolve();
				return;
			}
		}
	});
}

// retrieve the actual output channel for the name we stashed in the map
function getOutputChannel( channelName: string) : vscode.OutputChannel {
	let podOutputChannel;
	if (outputChannelMap.has(channelName)) {
		podOutputChannel = outputChannelMap.get(channelName);
		if (podOutputChannel !== undefined) {
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
		.catch ( (error) => {
			console.log(error);
		});
}

// locate the POD name that corresponds to the Integration name
function findThePODNameForIntegrationFromJSON(json : Object, integrationName : string) : Promise<string> {
	return new Promise( async (resolve, reject) => {
		if (json) {
			let temp = JSON.stringify(json);
			let o = JSON.parse(temp);
			for (var i=0; i<o.items.length;i++) {
				var metadataName : string = o.items[i].metadata.name;
				if (metadataName.startsWith(integrationName + '-')) {
					resolve(metadataName);
				}
			}
			reject(new Error());
		} else {
			reject("JSON not returned from Kubernetes Rest call");
		}
	});
}

// use curl to do a rest call to follow the logs and process output to the output channel
function getPodLogViaCurl(podName : string): Promise<boolean> {
	return new Promise( async (resolve, reject) => {
			let podsURL = utils.createCamelKPodLogURL(podName);
			await utils.pingTheURL(podsURL).catch( (error) =>  {
				reject(error);
				return false;
			});
			let podOutputChannel = getOutputChannel(podName);
			podOutputChannel.show();
			let commandString = `curl -v -H "Accept: application/json, */*" ${podsURL}?follow=true --insecure -N`;
			await utils.delay(1000);
			let runKamel = child_process.spawn(curlCommand, [curlOption, commandString]);
			if (runKamel.stdout) {
				runKamel.stdout.on('data', function (data) {
					if (podOutputChannel) {
						podOutputChannel.append(`${data}`);
					}
					resolve(true);
				});
			}
			runKamel.on("close", (code, signal) => {
				console.log("[CLOSING] " + `${code} / ${signal} \n`);
				resolve(true);
			});
		});
	}

// retrieve the list of running pods via a rest command
async function getPodsViaRest() : Promise<Object>{
	return new Promise( async (resolve, reject) => {
		let podsURL = utils.createCamelKGetPodsURL();
		await utils.pingTheURL(podsURL).catch( (error) =>  {
			reject(error);
		});
		var options = {
			uri: podsURL,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			json: true // Automatically parses the JSON string in the response
		};

		await utils.delay(1000);
		rp(options)
			.then(function (json:Object) {
				resolve(json);
			})
			.catch(function () {
				reject();
		});
	});
}

// stop a running integration via a kubernetes rest call
async function stopIntegrationViaRest(integrationName: string) : Promise<any>{
	return new Promise( async (resolve, reject) => {
		let proxyURL = utils.createCamelKDeleteRestURL(integrationName);
		await utils.pingKubernetes().catch( (error) =>  {
			utils.shareMessage(mainOutputChannel, error + ".\n\n");
			reject(error);
		});
		await getPodsViaRest()
			.then((output) => {
				findThePODNameForIntegrationFromJSON(output, integrationName)
					.then( async (podName) => {
						removeOutputChannel(podName);
					})
					.catch( (error) => {
							utils.shareMessage(mainOutputChannel, `No output channel found for pod: ${error}`);
					});
		});

		var options = {
			uri: proxyURL,
			method: 'DELETE'
		};

		await utils.delay(1000);
		rp(options)
			.then(function () {
				resolve();
			})
			.catch(function (error) {
				reject(error);
			});
		});
}

// start an integration from a file
function startIntegration(context: vscode.Uri): Promise<string> {
	return new Promise <string> ( async (resolve, reject) => {
		setStatusLineMessage(`Starting new Apache Camel K Integration...`);
		if (useProxy) {
			utils.shareMessage(mainOutputChannel, "Starting new integration via Kubernetes rest API");
			createNewIntegrationViaRest(context)
				.then( success => {
					if (!success) {
						vscode.window.showErrorMessage("Unable to call Kubernetes rest API.");
						reject(new Error("Unable to call Kubernetes rest API."));
						return;
					}
					resolve();
					hideStatusLine();
					return success;
				})
				.catch(err => {
					utils.shareMessage(mainOutputChannel, "Kamel execution return code: " + err);
					reject();
					hideStatusLine();
					return err;
				});
		} else {
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
					return success;
				})
				.catch(err => {
					utils.shareMessage(mainOutputChannel, ("Kamel execution return code: " + err));
					reject();
					hideStatusLine();
					return err;
				});
			}
		});
}

// use kubernetes rest to post new integration
function createNewIntegrationViaRest(context: vscode.Uri): Promise<boolean> {
	return new Promise<boolean> ( async (resolve, reject) => {
		let filename = context.fsPath;
		let absoluteRoot = path.parse(filename).base;
		let rootName = absoluteRoot.split('.', 1)[0];
		let integrationName = utils.toKebabCase(rootName);
		utils.shareMessage(mainOutputChannel, `Deploying file ${absoluteRoot} as integration ${integrationName}`);
		await removeOutputChannelForIntegrationViaRest(integrationName);

		utils.stringifyFileContents(filename).then( async (fileContent) => {
			utils.createCamelKDeployJSON(integrationName, fileContent, filename).then (async (json) => {
				let proxyURL = utils.createCamelKRestURL();
				await utils.pingKubernetes().catch( (error) =>  {
					mainOutputChannel.append(error + ".\n\n");
					reject(error);
				});
				var options = {
					uri: proxyURL,
					method: 'POST',
					body: json
				};
				await utils.delay(1000);
				rp(options).then(() => {
					resolve(true);
					return;
				}).catch((error) => {
					reject(error);
				});
			});
		});
	});
}

// remove the output channel for a running integration via kubernetes rest call
async function removeOutputChannelForIntegrationViaRest(integrationName:string) {
	await getPodsViaRest().then((output) => {
		findThePODNameForIntegrationFromJSON(output, integrationName)
			.then( async (podName) => {
				removeOutputChannel(podName);
			});
	});
}

// remove the output channel for a running integration via kubectl executable
export async function removeOutputChannelForIntegrationViaKubectl(integrationName:string) {
	await getIntegrationsFromKubectl(integrationName).then( (output) => {
		let podName = processIntegrationList(output);
		if (podName) {
			removeOutputChannel(podName).catch( (error) => console.log(error));
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() {
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

// retrieve the list of integrations running in camel k starting with the integration name
function getIntegrationsFromKubectl(integrationName : string): Promise<string> {
	return new Promise( (resolve, reject) => {
		let commandString = 'kubectl get pods | grep ' + integrationName;
		let runKubectl = child_process.exec(commandString);
		var shellOutput = '';
		if (runKubectl.stdout) {
			runKubectl.stdout.on('data', function (data) {
				shellOutput += data;
			});
		}
		if (runKubectl.stderr) {
			runKubectl.stderr.on('data', function (data) {
				console.log("[ERROR] " + data);
			});
		}
		runKubectl.on("close", () => {
			resolve(shellOutput);
		});
	});
}

// process the text-based list we get back from the kubectl command
function processIntegrationList(output: string) : string {
	if (output) {
		let lines = output.split('\n');
		for (let entry of lines) {
			let line = entry.split(' ');
			let podName = line[0];
			return podName;
		}
	}
	return '';
}

// start a new local Kubernetes proxy using kubectl
function startKubeProxy(): Promise<string> {
	return new Promise( (resolve, reject) => {

		let commandString = `kubectl proxy --port=${proxyPort}`;
		let runKubectl = child_process.exec(commandString);
		if (runKubectl.stdout) {
			runKubectl.stdout.on('data', function (data) {
				resolve(data.toString());
			});
		}
		if (runKubectl.stderr) {
			runKubectl.stderr.on('data', function (data) {
				reject(new Error(data.toString()));
			});
		}
	});
}

// use kubectl to keep an eye on the server for changes and update the view
function startListeningForServerChanges() {
	let commandString = `kubectl get integrations -w`;
	let runKamel = child_process.spawn(curlCommand, [curlOption, commandString]);
	if (runKamel.stdout) {
		runKamel.stdout.on('data', async function (data) {
			if (camelKIntegrationsTreeView.visible === true) {
				await camelKIntegrationsProvider.refresh();
			}
		});
	}
	runKamel.on("close", () => {
		// stopped listening to server - likely timed out
		eventEmitter.emit(restartKubectlWatchEvent);
	});
}

function determineCurlCommand(): void {
	const osType = platform();
	if (osType === 'win32') {
		curlCommand = 'cmd';
		curlOption = '/c';
	}
}

function applyStatusBarSettings(): void {
	// process the workspace setting indicating whether we should use the proxy or CLI
	let statusBarSetting = vscode.workspace.getConfiguration().get('camelk.integrations.showStatusBarMessages') as boolean;
	showStatusBar = statusBarSetting;

	vscode.workspace.onDidChangeConfiguration(() => {
		let statusBarSetting = vscode.workspace.getConfiguration().get('camelk.integrations.showStatusBarMessages') as boolean;
		showStatusBar = statusBarSetting;
		if (!showStatusBar) {
			hideStatusLine();
		}
	});
}

function applyProxySettings(): void {
	// process the workspace setting indicating whether we should use the proxy or CLI
	let proxySetting = vscode.workspace.getConfiguration().get('camelk.integrations.useProxy') as boolean;
	useProxy = proxySetting;
	camelKIntegrationsProvider.setUseProxy(useProxy);

	vscode.workspace.onDidChangeConfiguration(() => {
		let proxySetting = vscode.workspace.getConfiguration().get('camelk.integrations.useProxy') as boolean;
		useProxy = proxySetting;
		camelKIntegrationsProvider.setUseProxy(useProxy);
		camelKIntegrationsProvider.refresh();
	});
}

function applyProxyPortSettings(): void {
	// process the workspace setting indicating the proxy port we should use
	let proxyPortTemp = vscode.workspace.getConfiguration().get('camelk.integrations.proxyPort') as number;
	if (proxyPortTemp) {
		proxyPort = proxyPortTemp;
	}

	vscode.workspace.onDidChangeConfiguration(() => {
		let proxyPortTemp = vscode.workspace.getConfiguration().get('camelk.integrations.proxyPort') as number;
		proxyPort = proxyPortTemp;
	});
}

function applyUserSettings(): void {
	applyStatusBarSettings();
	applyProxySettings();
	applyProxyPortSettings();
}

function createIntegrationsView(): void {
	// create the integrations view
	camelKIntegrationsTreeView = vscode.window.createTreeView('camelk.integrations', {
		treeDataProvider: camelKIntegrationsProvider
	});
	camelKIntegrationsTreeView.onDidChangeVisibility(() => {
		if (camelKIntegrationsTreeView.visible === true) {
			camelKIntegrationsProvider.refresh();
		}
	});
}