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
import { isKubernetesAvailable } from './kubectlutils';

export const validNameRegex = /^[A-Za-z][A-Za-z0-9\-]*(?:[A-Za-z0-9]$){1}/;

export function registerCommands() {

	// create the integration view action -- create new configmap from file or folder
	vscode.commands.registerCommand('camelk.integrations.createconfigmapfromfile', (uri:vscode.Uri) => {
		createConfigMapFromUri(uri);
	});
	vscode.commands.registerCommand('camelk.integrations.createconfigmapfromfolder', (uri:vscode.Uri) => {
		createConfigMapFromUri(uri);
	});

	// create the integration view action -- create new secret from file or folder
	vscode.commands.registerCommand('camelk.integrations.createsecretfromfile', (uri:vscode.Uri) => {
		createSecretFromUri(uri);
	});
	vscode.commands.registerCommand('camelk.integrations.createsecretfromfolder', (uri:vscode.Uri) => {
		createSecretFromUri(uri);
	});
}

function createConfigMapFromUri(uri:vscode.Uri): void {
	createConfigMapFromFilenameOrFolder(uri)
		.then ( (output) => {
			extension.setStatusLineMessageAndShow(`Received... ${output}`);
		})
		.catch( (error) => {
			utils.shareMessage(extension.mainOutputChannel, ("Error encountered while creating Kubernetes ConfigMap: " + error));
		});
		extension.hideStatusLine();
}

function createSecretFromUri(uri:vscode.Uri): void {
	createSecretFromFilenameOrFolder(uri)
		.then ( (output) => {
			extension.setStatusLineMessageAndShow(`Received... ${output}`);
		})
		.catch( (error) => {
			utils.shareMessage(extension.mainOutputChannel, ("Error encountered while creating Kubernetes Secret: " + error));
		});
		extension.hideStatusLine();
}

// call back function used to validate entries in the input box and return a human readable error message
function validateName(text : string): string | null {
	return !validNameRegex.test(text) ? 'Name must be at least two characters long, start with a letter, and only include a-z, A-Z, and hyphens' : null;
}

function createConfigMapFromFilenameOrFolder(uri:vscode.Uri) : Promise<string> {
	return new Promise<string>( (resolve, reject) => {
		isKubernetesAvailable()
			.then( (kubeIsReady) => {
				if (kubeIsReady) {
					return vscode.window.showInputBox({
						prompt: 'Kubernetes ConfigMap Name',
						placeHolder: 'Provide the unique identifier for this Kubernetes ConfigMap.',
						value: 'new-configmap',
						ignoreFocusOut: true,
						validateInput: validateName
					});
				} else {
					vscode.window.showInformationMessage(`Kubernetes extensions still coming up, please wait a moment and try again.`);
					reject("Kubernetes not available.");
				}
			})
			.then( (configMapName) => {
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
			})
			.catch( err => {
				reject(err);
			});
	});
}

function createSecretFromFilenameOrFolder(uri:vscode.Uri) : Promise<string> {
	return new Promise( (resolve, reject) => {
		isKubernetesAvailable()
			.then( (kubeIsReady) => {
				if (kubeIsReady) {
					return vscode.window.showInputBox({
						prompt: 'Kubernetes Secret Name',
						placeHolder: 'Provide the unique identifier for this Kubernetes secret.',
						value: 'new-secret',
						validateInput: validateName
					});
				} else {
					vscode.window.showInformationMessage(`Kubernetes extensions still coming up, please wait a moment and try again.`);
					reject("Kubernetes not available.");
				}
			})
			.then( (secretName) => {
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
			})
			.catch( err => {
				reject(err);
			});
	});
}

function createConfigMap(name:string, filename: vscode.Uri) : Promise<string> {
	return new Promise<string>( (resolve, reject) => {
		k8s.extension.kubectl.v1
			.then( (kubectl) => {
				if (kubectl && kubectl.available) {
					let nameStr = ` --from-file="${filename.fsPath}"`;
					return kubectl.api.invokeCommand(`create configmap ${name} ${nameStr}`);
				} else {
					reject('Kubernetes not available');
				}
			})
			.then( (result) => {
				if (!result || result.code !== 0) {
					const error = result ? result.stderr : 'Unable to invoke kubectl';
					reject(new Error(error));
					return;
				}
				if (result && result.code === 0) {
					resolve (result.stdout);
					return;
				}
			})
			.catch( err => {
				reject(err);
			});
	});
}

function createSecret(name:string, foldername: vscode.Uri) : Promise<string> {
	return new Promise<string>( (resolve, reject) => {
		k8s.extension.kubectl.v1
			.then( (kubectl) => {
				if (kubectl && kubectl.available) {
					let nameStr = ` --from-file="${foldername.fsPath}"`;
					return kubectl.api.invokeCommand(`create secret generic ${name} ${nameStr}`);
				} else {
					reject('Kubernetes not available');
				}
			})
			.then( (result) => {
				if (!result || result.code !== 0) {
					const error = result ? result.stderr : 'Unable to invoke kubectl';
					reject(new Error(error));
					return;
				}
				if (result && result.code === 0) {
					resolve (result.stdout);
					return;
				}
			})
			.catch (err => {
				reject(err);
			});
	});
}
