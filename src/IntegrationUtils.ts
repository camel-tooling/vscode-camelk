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
import * as extension from './extension';
import * as utils from './CamelKJSONUtils';
import * as path from 'path';
import * as child_process from 'child_process';
import { getConfigMaps, getSecrets } from './ConfigMapAndSecrets';
import * as k8s from 'vscode-kubernetes-tools-api';

const basicIntegration : string = 'Basic - Apache Camel K Integration (no ConfigMap or Secret)';
const configMapIntegration : string = 'ConfigMap - Apache Camel K Integration with Kubernetes ConfigMap';
const secretIntegration : string = 'Secret - Apache Camel K Integration with Kubernetes Secret';

export async function startIntegration(context: vscode.Uri): Promise<any> {
	return new Promise <any> ( async (resolve, reject) => {
		await vscode.window.showQuickPick([ basicIntegration, configMapIntegration, secretIntegration ],
		{
			placeHolder: 'Select the type of Apache Camel K Integration'
		}).then( async (choice) => {
			let selectedConfigMap = undefined;
			let selectedSecret = undefined;

			switch (choice) {
				case configMapIntegration:
					await getConfigMaps().then( async (configMaps) => {
						selectedConfigMap = await vscode.window.showQuickPick(configMaps, {
							placeHolder: 'Select an available Kubernetes ConfigMap or ESC to cancel'
						});
					});
					break;
				case secretIntegration:
					await getSecrets().then( async (secrets) => {
						selectedSecret = await vscode.window.showQuickPick(secrets, {
							placeHolder: 'Select an available Kubernetes Secret or ESC to cancel'
						});
					});
					break;
				case basicIntegration:
					// do nothing with config-map or secret
					break;
			}

			if (!choice) {
				reject(new Error('No integration selection made.'));
				return;
			}
	
			await createNewIntegration(context, selectedConfigMap, selectedSecret)
				.then( success => {
					if (!success) {
						reject(false);
					}
					resolve(true);
				})
				.catch(err => {
					reject(err);
				});
			});
		});
}
		
// use command-line "kamel" utility to start a new integration
function createNewIntegration(integrationFileUri: vscode.Uri, configmap? : string, secret? : string): Promise<boolean> {
	return new Promise( async (resolve, reject) => {
		let filename = integrationFileUri.fsPath;
		let foldername = path.dirname(filename);
		let absoluteRoot = path.parse(filename).base;
		let rootName = absoluteRoot.split('.', 1)[0];
		let integrationName = utils.toKebabCase(rootName);
		utils.shareMessage(extension.mainOutputChannel, `Deploying file ${absoluteRoot} as integration ${integrationName}`);
		await extension.removeOutputChannelForIntegrationViaKubectl(integrationName)
			.catch( (error) => { 
				// this is not a hard stop, it just means there was no output channel to close
				console.error(error); 
			});

		let commandString = 'kamel run';
		if (configmap && configmap.trim().length > 0) {
			commandString += ` --configmap=${configmap}`;
		}
		if (secret && secret.trim().length > 0) {
			commandString += ` --secret=${secret}`;
		}
		commandString += ' "' + absoluteRoot + '"';
		console.log(`commandString = ${commandString}`);
		let runKubectl = child_process.exec(commandString, { cwd : foldername});
		if (runKubectl.stdout) {
			runKubectl.stdout.on('data', function (data) {
				resolve(true);
				return;
			});
		}
		if (runKubectl.stderr) {
			runKubectl.stderr.on('data', function (data) {
				utils.shareMessage(extension.mainOutputChannel, `Error deploying ${integrationName}: ${data}`);
				reject(false);
				return;
			});
		}
	});
}		

export async function isCamelKAvailable(): Promise<boolean> {
	return new Promise<boolean>( async (resolve) => {
		const kubectl = await k8s.extension.kubectl.v1;
		if (kubectl.available) {
			const result = await kubectl.api.invokeCommand('api-versions');
			if (!result || result.code !== 0) {
				resolve(false);
			} else if (result) {
				let foundCamel : boolean = result.stdout.includes("camel.apache.org/v1alpha1");
				resolve(foundCamel);
			}
		}
		resolve(false);
	});
}
