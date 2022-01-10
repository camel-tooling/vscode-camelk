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
import { ShellResult } from './shell';
import * as telemetry from './Telemetry';

export const validNameRegex = /^[A-Za-z][A-Za-z0-9-]*(?:[A-Za-z0-9]$){1}/;
const COMMAND_ID_CREATE_CONFIG_MAP_FROM_FILE = 'camelk.integrations.createconfigmapfromfile';
const COMMAND_ID_CREATE_CONFIGMAP_FROM_FOLDER = 'camelk.integrations.createconfigmapfromfolder';
const COMMAND_ID_CREATE_SECRET_FROM_FILE = 'camelk.intevargrations.createsecretfromfile';
const COMMAND_ID_CREATE_SECRET_FROM_FOLDER = 'camelk.integrations.createsecretfromfolder';

export function registerCommands(): void {
	// create the integration view action -- create new configmap from file or folder
	vscode.commands.registerCommand(COMMAND_ID_CREATE_CONFIG_MAP_FROM_FILE, (uri:vscode.Uri) => {
		createConfigMapFromUri(uri);
		telemetry.sendCommandTracking(COMMAND_ID_CREATE_CONFIG_MAP_FROM_FILE);
	});
	vscode.commands.registerCommand(COMMAND_ID_CREATE_CONFIGMAP_FROM_FOLDER, (uri:vscode.Uri) => {
		createConfigMapFromUri(uri);
		telemetry.sendCommandTracking(COMMAND_ID_CREATE_CONFIGMAP_FROM_FOLDER);
	});

	// create the integration view action -- create new secret from file or folder
	vscode.commands.registerCommand(COMMAND_ID_CREATE_SECRET_FROM_FILE, (uri:vscode.Uri) => {
		createSecretFromUri(uri);
		telemetry.sendCommandTracking(COMMAND_ID_CREATE_SECRET_FROM_FILE);
	});
	vscode.commands.registerCommand(COMMAND_ID_CREATE_SECRET_FROM_FOLDER, (uri:vscode.Uri) => {
		createSecretFromUri(uri);
		telemetry.sendCommandTracking(COMMAND_ID_CREATE_SECRET_FROM_FOLDER);
	});
}

async function createConfigMapFromUri(uri:vscode.Uri): Promise<void> {
	try {
		const output: string = await createConfigMapFromFilenameOrFolder(uri);
		extension.setStatusLineMessageAndShow(`Received... ${output}`);
	} catch(error) {
		utils.shareMessage(extension.mainOutputChannel, ("Error encountered while creating Kubernetes ConfigMap: " + error));
	} finally {
		extension.hideStatusLine();
	}	
}

async function createSecretFromUri(uri:vscode.Uri): Promise<void> {
	try {
		const output: string = await createSecretFromFilenameOrFolder(uri);
		extension.setStatusLineMessageAndShow(`Received... ${output}`);
	} catch(error) {
		utils.shareMessage(extension.mainOutputChannel, ("Error encountered while creating Kubernetes Secret: " + error));
	} finally {
		extension.hideStatusLine();
	}		
}

// call back function used to validate entries in the input box and return a human readable error message
function validateName(text : string): string | null {
	return !validNameRegex.test(text) ? 'Name must be at least two characters long, start with a letter, and only include a-z, A-Z, and hyphens' : null;
}

async function createConfigMapFromFilenameOrFolder(uri:vscode.Uri) : Promise<string> {
	try {
		const kubeIsReady: boolean = await isKubernetesAvailable();
		if (kubeIsReady) {
			const configMapName: string | undefined = await vscode.window.showInputBox({
				prompt: 'Kubernetes ConfigMap Name',
				placeHolder: 'Provide the unique identifier for this Kubernetes ConfigMap.',
				value: 'new-configmap',
				ignoreFocusOut: true,
				validateInput: validateName
			});
			if (configMapName) {
				try { 
					const output: string = await createConfigMap(configMapName, uri);
					vscode.window.showInformationMessage(`Successfully created new Kubernetes ConfigMap named "${configMapName}"`);
					return output;
				} catch(err) {
					vscode.window.showErrorMessage(`Problem encountered creating new Kubernetes ConfigMap named "${configMapName}": ${err}`);
					return Promise.reject(err);
				}
			} else {
				return Promise.reject("No name given for Kubernetes ConfigMap.");
			}
		} else {
			vscode.window.showInformationMessage(`Kubernetes extensions still coming up, please wait a moment and try again.`);
			return Promise.reject("Kubernetes not available.");
		}
	} catch (err) {
		return Promise.reject(err);
	}
}

async function createSecretFromFilenameOrFolder(uri:vscode.Uri) : Promise<string> {
	try {
		const kubeIsReady: boolean = await isKubernetesAvailable();
		if (kubeIsReady) {
			const secretName: string | undefined = await vscode.window.showInputBox({
				prompt: 'Kubernetes Secret Name',
				placeHolder: 'Provide the unique identifier for this Kubernetes secret.',
				value: 'new-secret',
				validateInput: validateName
			});
			if (secretName) {
				try {
					const output: string = await createSecret(secretName, uri);
					vscode.window.showInformationMessage(`Successfully created new Kubernetes Secret named "${secretName}"`);
					return output;
				} catch(err) {
					vscode.window.showErrorMessage(`Problem encountered creating new Kubernetes Secret named "${secretName}": ${err}`);
					return Promise.reject(err);
				}
			} else {
				return Promise.reject("No name given for secret.");
			}			
		} else {
			vscode.window.showInformationMessage(`Kubernetes extensions still coming up, please wait a moment and try again.`);
			return Promise.reject("Kubernetes not available.");
		}
	} catch (err) {
		return Promise.reject(err);
	}
}

async function createConfigMap(name:string, filename: vscode.Uri) : Promise<string> {
	return invokeKubeCtlCommand(`create configmap ${name} --from-file="${filename.fsPath}"`);
}

async function createSecret(name:string, filename: vscode.Uri) : Promise<string> {
	return invokeKubeCtlCommand(`create secret generic ${name} --from-file="${filename.fsPath}"`);
}

// TODO: move this function into kubectl or kubectlutils and adapt to use namespaces (see https://github.com/camel-tooling/vscode-camelk/issues/489)
async function invokeKubeCtlCommand(cmd: string) : Promise<string> {
	try {
		const kubectl: k8s.API<k8s.KubectlV1> = await k8s.extension.kubectl.v1;
		if (kubectl && kubectl.available) {
			const result: ShellResult | undefined = await kubectl.api.invokeCommand(`${cmd}`);
			if (result && result.code === 0) {
				return result.stdout;
			} else {
				const error = result ? result.stderr : `Unable to invoke kubectl with command ${cmd}`;
				return Promise.reject(new Error(error));
			}
		} else {
			return Promise.reject('Kubernetes not available');
		}
	} catch (err) {
		return Promise.reject(err);
	}
}
