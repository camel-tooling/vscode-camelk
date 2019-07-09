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

export let mainOutputChannel: vscode.OutputChannel;
let camelKIntegrationsProvider = new CamelKNodeProvider();
let useProxy : boolean = false;
let outputChannelMap : Map<string, vscode.OutputChannel>;
let curlCommand : string = '/bin/sh';
let curlOption : string = '-c';

// This extension offers basic integration with Camel-K (https://github.com/apache/camel-k) on two fronts.

export function activate(context: vscode.ExtensionContext) {

	outputChannelMap = new Map();

	const osType = platform();
	if (osType === 'win32') {
		curlCommand = 'cmd';
		curlOption = '/c';
	}

	// process the workspace setting indicating whether we should use the proxy or CLI
	let proxySetting = vscode.workspace.getConfiguration().get('camelk.integrations.useProxy');
	if (proxySetting) {
		useProxy = true;
	}
	camelKIntegrationsProvider.setUseProxy(useProxy);

	vscode.workspace.onDidChangeConfiguration(() => {
		let proxySetting = vscode.workspace.getConfiguration().get('camelk.integrations.useProxy');
		if (proxySetting) {
			useProxy = true;
		} else {
			useProxy = false;
		}
		camelKIntegrationsProvider.setUseProxy(useProxy);
		camelKIntegrationsProvider.refresh();
	});	
	
	mainOutputChannel = vscode.window.createOutputChannel("Camel-K");
	mainOutputChannel.show();

	// create the integrations view
	vscode.window.registerTreeDataProvider('camelk.integrations', camelKIntegrationsProvider);

	// create the integration view action -- refresh
	vscode.commands.registerCommand('camelk.integrations.refresh', () => camelKIntegrationsProvider.refresh());

	// create the integration view action -- remove
	vscode.commands.registerCommand('camelk.integrations.remove', async (node: TreeNode) => {
		if (node && node.label) {
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
				await getIntegrationsFromKubectl(integrationName)
					.then( (output) => {
						let podName = processIntegrationList(output);
						if (podName) {
							removeOutputChannel(podName);
						}
					});
			}
			camelKIntegrationsProvider.refresh();
		}
	});

	// create the integration view action -- start log
	vscode.commands.registerCommand('camelk.integrations.log', async (node: TreeNode) => {
		if (node && node.label) {
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
								utils.shareMessage(mainOutputChannel, `No pod found for integration: ${error}`);
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
							kubectl.stdout.on('data', function (data) {
								podOutputChannel.append(`${data}`);
							});
							kubectl.stderr.on('data', function (data) {
								mainOutputChannel.append("[ERROR] " + `${data} \n`);
							});
							kubectl.on("close", (code, signal) => {
								console.log("[CLOSING] " + `${code} / ${signal} \n`);
							});
						}
					}).catch( (error) => {
						utils.shareMessage(mainOutputChannel, `rest error: ${error} \n`);
					});
			}
		}
	});

	// create the integration view action -- start proxy
	vscode.commands.registerCommand('camelk.integrations.startproxy', async (node: TreeNode) => {
		await startKubeProxy()
			.then ( () => {
				utils.shareMessage(mainOutputChannel, ("Started kubectl proxy on port 8000"));
				if (useProxy) {
					// populate the initial tree
					camelKIntegrationsProvider.refresh();
				}
			})
			.catch( (error) => {
				utils.shareMessage(mainOutputChannel, ("kubectl execution return code: " + error));
		});
	});

	// create the integration view action -- start new integration
	let startIntegration = vscode.commands.registerCommand('camelk.startintegration', async () => { await runTheFile(context);});
	context.subscriptions.push(startIntegration);

	// populate the initial tree
	camelKIntegrationsProvider.refresh();
}

// find an output channel by name in the map and remove it
function removeOutputChannel( channelName: string) {
	let podOutputChannel;
	if (outputChannelMap.has(channelName)) {
		podOutputChannel = outputChannelMap.get(channelName);
		if (podOutputChannel !== undefined) {
			podOutputChannel.dispose();
			outputChannelMap.delete(channelName);
			utils.shareMessage(mainOutputChannel, `Removed Output channel for integration: ${channelName}`);
			mainOutputChannel.show();
		}
	}
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
async function runTheFile(context: vscode.ExtensionContext) {
	startIntegration(context);
	await camelKIntegrationsProvider.refresh();
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
		}
	});
}

// use curl to do a rest call to follow the logs and process output to the output channel
function getPodLogViaCurl(podName : string): Promise<boolean> {
	return new Promise( async (resolve, reject) => {
			let podsURL = utils.createCamelKPodLogURL(podName);
			await utils.pingTheURL(podsURL).catch( (error) =>  {
				reject(error);
			});
			let podOutputChannel = getOutputChannel(podName);
			podOutputChannel.show();
			let commandString = `curl -v -H "Accept: application/json, */*" ${podsURL}?follow=true --insecure -N`;
			await utils.delay(1000);
			let runKamel = child_process.spawn(curlCommand, [curlOption, commandString]);
			runKamel.stdout.on('data', function (data) {
				podOutputChannel.append(`${data}`);
				resolve(true);
			});
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
function startIntegration(context: vscode.ExtensionContext): Promise<string> {
	return new Promise <string> ( async (resolve, reject) => {
		if (useProxy) {
			utils.shareMessage(mainOutputChannel, "Starting new integration via Kubernetes rest API");
			createNewIntegrationViaRest()
				.then( success => {
					if (!success) {
						vscode.window.showErrorMessage("Unable to call Kubernetes rest API.");
						reject();
					}
					resolve();
					return success;
				})
				.catch(err => {
					utils.shareMessage(mainOutputChannel, "Kamel execution return code: " + err);
					reject();
					return err;
				});
		} else {
			utils.shareMessage(mainOutputChannel, "Starting new integration via Kamel executable.");
			createNewIntegration(context)
				.then( success => {
					if (!success) {
						vscode.window.showErrorMessage("Unable to call Kamel.");
						reject();
					}
					resolve();
					return success;
				})
				.catch(err => {
					utils.shareMessage(mainOutputChannel, ("Kamel execution return code: " + err));
					reject();
					return err;
				});
			}
		});
}

// use kubernetes rest to post new integration
function createNewIntegrationViaRest(): Promise<boolean> {
	return new Promise<boolean> ( async (resolve, reject) => {
		try {
			const editor = vscode.window.activeTextEditor;
			if (typeof(editor) === 'undefined') {
				reject();
				console.error('No active editor present?');
				return;
			}
	
			let selection = editor.document.fileName;
			let filename = path.basename(selection);
			let rootName = filename.split('.', 1)[0];

			if (editor) {
				utils.stringifyFileContents(selection).then( async (fileContent) => {
					utils.createCamelKDeployJSON(rootName, fileContent, filename).then (async (json) => {
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
						rp(options)
							.then(() => {
								resolve(true);
								return;
							})
							.catch((error) => {
								reject(error);
							});
						});
					});
			}
		} catch (error) {
			console.error(error);
			reject(error);
		}
	});			
}

// use command-line "kamel" utility to start a new integration
function createNewIntegration(context: vscode.ExtensionContext): Promise<boolean> {
	return new Promise( (resolve, reject) => {
		try {

			const editor = vscode.window.activeTextEditor;
			if (typeof(editor) === 'undefined') {
				reject();
				console.error('No active editor present?');
				return;
			}
	
			let selection = editor.document.fileName;
			let filename = path.basename(selection);
			let root = path.dirname(selection);
			let absoluteRoot = path.resolve(root);

			if (editor) {
				let commandString = 'kamel run --dev "' + filename + '"';
				child_process.exec(commandString, { cwd : absoluteRoot});
				resolve(true);
			}
		} catch (error) {
			console.error(error);
			reject(error);
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
}

// retrieve the list of integrations running in camel-k starting with the integration name
function getIntegrationsFromKubectl(integrationName : string): Promise<string> {
	return new Promise( (resolve, reject) => {
		let commandString = 'kubectl get pods | grep ' + integrationName;
		let runKubectl = child_process.exec(commandString);
		var shellOutput = '';
		runKubectl.stdout.on('data', function (data) {
			shellOutput += data;
		});
		runKubectl.stderr.on('data', function (data) {
			console.log("[ERROR] " + data);
		});
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
		let commandString = 'kubectl proxy --port=8000';
		let runKubectl = child_process.exec(commandString);
		runKubectl.stdout.on('data', function (data) {
			resolve(data.toString());
		});
		runKubectl.stderr.on('data', function (data) {
			reject(new Error(data.toString()));
		});
	}); 
}
