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
import { installKamel, checkKamelCLIVersion, checkKubectlCLIVersion, checkMinikubeCLIVersion } from './installer';
import { shell, Shell } from './shell';
import { Errorable, failed } from './errorable';
import * as kamel from './kamel';

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
export function activate(context: vscode.ExtensionContext): void {

	installDependencies();

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
			if (useProxy) {
				utils.shareMessage(mainOutputChannel, 'Removing ' + integrationName + ' via Kubernetes Rest Delete');
				await stopIntegrationViaRest(integrationName).catch( (error) => {
					utils.shareMessage(mainOutputChannel, `rest error: ${error}`);
				});
			} else {
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
			}
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
			if (useProxy) {
				utils.shareMessage(mainOutputChannel, 'Connecting to the log for ' + integrationName + ' via Kubernetes Rest');
				await getPodsViaRest()
					.then(async (output) => {
						await findThePODNameForIntegrationFromJSON(output, integrationName)
							.then( async (podName) => {
								await getPodLogViaCurl(podName)
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
		setStatusLineMessageAndShow(`Starting kubectl proxy...`);
		await startKubeProxy()
			.then ( async () => {
				let proxy = utils.createBaseProxyURL();
				utils.shareMessage(mainOutputChannel, (`Started kubectl proxy at URL ${proxy}`));
				hideStatusLine();
				if (useProxy) {
					// populate the initial tree
					await camelKIntegrationsProvider.refresh()
					.catch( (err) => {
						console.log(err);
					});
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

// locate the POD name that corresponds to the Integration name
function findThePODNameForIntegrationFromJSON(json: Object, integrationName: string) : Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		if (json) {
			try {
				let temp = JSON.stringify(json);
				let o = JSON.parse(temp);
				let found: boolean = false;
				for (var i=0; i<o.items.length;i++) {
					var metadataName : string = o.items[i].metadata.name;
					if (metadataName.startsWith(integrationName + '-')) {
						found = true;
						resolve(metadataName);
					}
				}
				if (!found) {
					reject(new Error(`Unable to find pod name for integration ${integrationName}`));
				}
			} catch ( err ) {
				reject(err);
			}
		} else {
			reject("JSON not returned from Kubernetes Rest call");
		}
	});
}

// use curl to do a rest call to follow the logs and process output to the output channel
function getPodLogViaCurl(podName : string): Promise<boolean> {
	return new Promise( async (resolve, reject) => {
			let podsURL = utils.createCamelKPodLogURL(podName);
			await utils.pingTheURL(podsURL)
			.then( async () => {
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
			})
			.catch( (error) =>  {
				reject(error);
			});
		});
	}

// retrieve the list of running pods via a rest command
function getPodsViaRest(): Promise<Object>{
	return new Promise( async (resolve, reject) => {
		let podsURL = utils.createCamelKGetPodsURL();
		var options = {
			uri: podsURL,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			json: true // Automatically parses the JSON string in the response
		};
		await utils.pingTheURL(podsURL)
		.then( async () => {
			await utils.delay(1000);
			await rp(options)
				.then( (json) => {
					resolve(json);
				});
		})
		.catch( (error) =>  {
			reject(error);
		});
	});
}

// stop a running integration via a kubernetes rest call
function stopIntegrationViaRest(integrationName: string) : Promise<any>{
	return new Promise( async (resolve, reject) => {
		let proxyURL = utils.createCamelKDeleteRestURL(integrationName);
		await utils.pingKubernetes()
		.then( async () => {
			await getPodsViaRest()
			.then((output) => {
				findThePODNameForIntegrationFromJSON(output, integrationName)
					.then( async (podName) => {
						await removeOutputChannel(podName);
					})
					.catch( (error) => {
						utils.shareMessage(mainOutputChannel, `No output channel found for pod: ${error}`);
					});
			})
			.catch( (err) => {
				console.log(err);
			});

			var options = {
				uri: proxyURL,
				method: 'DELETE'
			};

			await utils.delay(1000);
			await rp(options)
				.then(function () {
					resolve();
				})
				.catch(function (error) {
					reject(error);
				});
			})
		.catch( (error) =>  {
			utils.shareMessage(mainOutputChannel, error + ".\n\n");
			reject(error);
		});
	});
}

// start an integration from a file
function startIntegration(context: vscode.Uri): Promise<any> {
	return new Promise <any> ( async (resolve, reject) => {
		setStatusLineMessageAndShow(`Starting new Apache Camel K Integration...`);
		if (useProxy) {
			utils.shareMessage(mainOutputChannel, "Starting new integration via Kubernetes rest API");
			await createNewIntegrationViaRest(context)
				.then( success => {
					if (!success) {
						vscode.window.showErrorMessage("Unable to call Kubernetes rest API.");
						reject(new Error("Unable to call Kubernetes rest API."));
					} else {
						resolve();
					}
					hideStatusLine();
				})
				.catch(err => {
					utils.shareMessage(mainOutputChannel, "Kamel execution return code: " + err);
					reject(err);
					hideStatusLine();
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
				})
				.catch(err => {
					utils.shareMessage(mainOutputChannel, ("Kamel execution return code: " + err));
					reject(err);
					hideStatusLine();
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

		await utils.stringifyFileContents(filename)
			.then( async (fileContent) => {
				await utils.createCamelKDeployJSON(integrationName, fileContent, filename)
					.then (async (json) => {
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
						await rp(options).then(() => {
							resolve(true);
						}).catch((error) => {
							reject(error);
						});
				});
		})
		.catch((err) => {
			reject(err);
		});
	});
}

// remove the output channel for a running integration via kubernetes rest call
async function removeOutputChannelForIntegrationViaRest(integrationName:string): Promise<any> {
	await getPodsViaRest()
		.then( async (output) => {
			await findThePODNameForIntegrationFromJSON(output, integrationName)
				.then( async (podName) => {
					await removeOutputChannel(podName);
				})
				.catch( (err) => {
					console.log(err);
				});
		});
}

// remove the output channel for a running integration via kubectl executable
export async function removeOutputChannelForIntegrationViaKubectl(integrationName:string): Promise<any> {
	await getIntegrationsFromKubectl(integrationName)
		.then( async (output) => {
			let podName = processIntegrationList(output);
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
function processIntegrationList(output: string): string {
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
function startListeningForServerChanges(): void {
	let commandString = `kubectl get integrations -w`;
	let runKamel = child_process.spawn(curlCommand, [curlOption, commandString]);
	if (runKamel.stdout) {
		runKamel.stdout.on('data', async function (data) {
			if (camelKIntegrationsTreeView.visible === true) {
				await camelKIntegrationsProvider.refresh().catch(err => console.log(err));
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

	vscode.workspace.onDidChangeConfiguration( async () => {
		let proxySetting = vscode.workspace.getConfiguration().get('camelk.integrations.useProxy') as boolean;
		useProxy = proxySetting;
		camelKIntegrationsProvider.setUseProxy(useProxy);
		await camelKIntegrationsProvider.refresh().catch(err => console.log(err));
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
	camelKIntegrationsTreeView = vscode.window.createTreeView('camelk.integrations', {
		treeDataProvider: camelKIntegrationsProvider
	});
	camelKIntegrationsTreeView.onDidChangeVisibility(async () => {
		if (camelKIntegrationsTreeView.visible === true) {
			await camelKIntegrationsProvider.refresh().catch(err => console.log(err));
		}
	});
}

export async function installDependencies() {

	let gotKamel : boolean = false;
	await checkKamelCLIVersion().then ( (kamelCliVersion) => {
		if (kamelCliVersion) {
			shareMessageInMainOutputChannel(`Found Apache Camel K CLI (kamel) version ${kamelCliVersion}...`);
			gotKamel = true;
		}
	}).catch ( () => { 
		// ignore 
	});
	const kubectlCliVersion : string = await checkKubectlCLIVersion();
	if (kubectlCliVersion) {
		shareMessageInMainOutputChannel(`Found Kubernetes CLI (kubectl) version ${kubectlCliVersion}...`);
	}

	const minikubeCliVersion : string = await checkMinikubeCLIVersion();
	if (minikubeCliVersion) {
		shareMessageInMainOutputChannel(`Found Minikube CLI (minikube) version ${minikubeCliVersion}...`);
	}

	if (!gotKamel) {
		const installPromise = installDependency("kamel", gotKamel, installKamel);
		await installPromise;
	}
}

async function installDependency(name: string, alreadyGot: boolean, installFunc: (shell: Shell) => Promise<Errorable<null>>): Promise<void> {
    if (!alreadyGot) {
		shareMessageInMainOutputChannel(`Installing ${name}...`);
        const result = await installFunc(shell);
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
