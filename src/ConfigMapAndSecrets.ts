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
import * as k8s from 'vscode-kubernetes-tools-api';
import * as extension from './extension';
import * as utils from './CamelKJSONUtils';

export const validNameRegex = /^[A-Za-z][A-Za-z0-9\-]*(?:[A-Za-z0-9]$){1}/;

export function registerCommands() {

	// create the integration view action -- create new configmap from file or folder
	vscode.commands.registerCommand('camelk.integrations.createconfigmapfromfile', async (uri:vscode.Uri) => {
		await createConfigMapFromUri(uri);
	});
	vscode.commands.registerCommand('camelk.integrations.createconfigmapfromfolder', async (uri:vscode.Uri) => {
		await createConfigMapFromUri(uri);
	});

	// create the integration view action -- create new secret from file or folder
	vscode.commands.registerCommand('camelk.integrations.createsecretfromfile', async (uri:vscode.Uri) => {
		await createSecretFromUri(uri);
	});
	vscode.commands.registerCommand('camelk.integrations.createsecretfromfolder', async (uri:vscode.Uri) => {
		await createSecretFromUri(uri);
	});
}

async function createConfigMapFromUri(uri:vscode.Uri) {
	await createConfigMapFromFilenameOrFolder(uri)
		.then ( (output) => {
			extension.setStatusLineMessage(`Received... ${output}`);
		}).catch( (error) => {
			utils.shareMessage(extension.mainOutputChannel, ("Error encountered while creating Kubernetes ConfigMap: " + error));
	});
	extension.hideStatusLine();
}

async function createSecretFromUri(uri:vscode.Uri) {
	await createSecretFromFilenameOrFolder(uri)
		.then ( (output) => {
			extension.setStatusLineMessage(`Received... ${output}`);
		}).catch( (error) => {
			utils.shareMessage(extension.mainOutputChannel, ("Error encountered while creating Kubernetes Secret: " + error));
	});
	extension.hideStatusLine();
}

function validateName(text : string) {
	return !validNameRegex.test(text) ? 'Name must be at least two characters long, start with a letter, and only include a-z, A-Z, and hyphens' : null;
}

async function createConfigMapFromFilenameOrFolder(uri:vscode.Uri) : Promise<any> {
	return new Promise( async (resolve, reject) => {
		await isKubernetesAvailable()
			.then( async (kubeIsReady) => {
				if (kubeIsReady && kubeIsReady === true) {
					await vscode.window.showInputBox({
						prompt: 'Kubernetes ConfigMap Name',
						placeHolder: 'Provide the unique identifier for this Kubernetes ConfigMap.',
						value: 'new-configmap',
						ignoreFocusOut: true,
						validateInput: validateName
					}).then( (configMapName) => {
						if (configMapName) {
							createConfigMap(configMapName, uri)
								.then( (output) => {
									vscode.window.showInformationMessage(`Successfully created new Kubernetes ConfigMap named "${configMapName}"`);
									resolve(output);
								})
								.catch(err => {
									vscode.window.showErrorMessage(`Problem encountered creating new Kubernetes ConfigMap named "${configMapName}": ${err}`);
									reject(err);
								});
						} else {
							reject("No name given for Kubernetes ConfigMap.");
						}
					});
				} else {
					vscode.window.showInformationMessage(`Kubernetes extensions still coming up, please wait a moment and try again.`);
					reject("Kubernetes not available.");
				}
			})
			.catch( err => {
				reject(err);
			});
	});
}

async function createSecretFromFilenameOrFolder(uri:vscode.Uri) : Promise<any> {
	return new Promise( async (resolve, reject) => {
		await isKubernetesAvailable()
			.then( async (kubeIsReady) => {
				if (kubeIsReady && kubeIsReady === true) {
					let secretName = await vscode.window.showInputBox({
						prompt: 'Kubernetes Secret Name',
						placeHolder: 'Provide the unique identifier for this Kubernetes secret.',
						value: 'new-secret',
						validateInput: validateName
					});
					if (secretName) {
						createSecret(secretName, uri)
							.then( (output) => {
								vscode.window.showInformationMessage(`Successfully created new Kubernetes Secret named "${secretName}"`);
								resolve(output);
							})
							.catch(err => {
								vscode.window.showErrorMessage(`Problem encountered creating new Kubernetes Secret named "${secretName}": ${err}`);
								reject(err);
							});
					} else {
						reject("No name given for secret.");
					}
				} else {
					vscode.window.showInformationMessage(`Kubernetes extensions still coming up, please wait a moment and try again.`);
					reject("Kubernetes not available.");
				}
			})
			.catch( err => {
				reject(err);
			});
	});
}

async function isKubernetesAvailable(): Promise<boolean> {
	return new Promise<boolean>( async (resolve) => {
		await k8s.extension.kubectl.v1
			.then( (kubectl) => {
				if (kubectl && kubectl.available) {
					resolve(true);
				} else {
					resolve(false);
				}
			})
			.catch( err => {
				resolve(false);
			});
	});
}

async function createConfigMap(name:string, filename: vscode.Uri) : Promise<any> {
	return new Promise( async (resolve, reject) => {
		await k8s.extension.kubectl.v1
			.then( async (kubectl) => {
				if (kubectl.available) {
					let nameStr = ` --from-file="${filename.fsPath}"`;
					const result = await kubectl.api.invokeCommand(`create configmap ${name} ${nameStr}`);
					if (!result || result.code !== 0) {
						const error = result ? result.stderr : 'Unable to invoke kubectl';
						reject(new Error(error));
						return;
					}
					if (result && result.code === 0) {
						resolve (result.stdout);
						return;
					}
				} else {
					reject('Kubernetes not available');
				}
			})
			.catch( err => {
				reject(err);
			});
	});
}

async function createSecret(name:string, foldername: vscode.Uri) : Promise<any> {
	return new Promise( async (resolve, reject) => {
		await k8s.extension.kubectl.v1
			.then( async (kubectl) => {
				if (kubectl.available) {
					let nameStr = ` --from-file="${foldername.fsPath}"`;
					const result = await kubectl.api.invokeCommand(`create secret generic ${name} ${nameStr}`);
					if (!result || result.code !== 0) {
						const error = result ? result.stderr : 'Unable to invoke kubectl';
						reject(new Error(error));
						return;
					}
					if (result && result.code === 0) {
						resolve (result.stdout);
						return;
					}
				} else {
					reject('Kubernetes not available');
				}
			})
			.catch (err => {
				reject(err);
			})
	});
}

async function getNamedListFromKubernetes( itemType : string): Promise<any> {
	return new Promise( async (resolve, reject) => {
		await k8s.extension.kubectl.v1
			.then( async (kubectl) => {
				if (kubectl.available) {
					const result = await kubectl.api.invokeCommand(`get ${itemType}`);
					if (!result || result.code !== 0) {
						const error = result ? result.stderr : `Unable to invoke kubectl to retrieve ${itemType}`;
						reject(new Error(error));
					} else if (result) {
						const splitResults = result.stdout;
						const itemList : string[] = parseShellResult(splitResults);
						resolve(itemList);
					}
				} else {
					reject(new Error('Kubernetes not available'));
				}
			})
			.catch( err => {
				reject(err);
			});
	});
}

export async function getConfigMaps(): Promise<any> {
	return getNamedListFromKubernetes('configmap');
}

export async function getSecrets(): Promise<any> {
	return getNamedListFromKubernetes('secret');
}

export function parseShellResult(output: string) : string[] {
	let processedList : string[] = [''];
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

			let itemName = cleanLine[0];
			processedList.push(itemName);
		}
	}
	return processedList;
}