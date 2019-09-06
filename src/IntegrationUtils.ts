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

const choiceList = [ basicIntegration, 
	configMapIntegration, 
	secretIntegration ];

export async function startIntegration(context: vscode.Uri): Promise<any> {
	return new Promise <any> ( async (resolve, reject) => {
		const choice : string | undefined = await vscode.window.showQuickPick(choiceList, {
			placeHolder: 'Select the type of Apache Camel K Integration'
		});

		if (choice) {
			let selectedConfigMap : any = undefined;
			let selectedSecret : any = undefined;

			switch (choice) {
				case configMapIntegration:
					await getSelectedConfigMap().then( (selection) => {
						selectedConfigMap = selection;
						if (selectedConfigMap === undefined) {
							reject (new Error('No ConfigMap selected.'));
							return;
						}
					}).catch ( (error) => {
						reject(error);
						return;
					});
					break;
				case secretIntegration:
					await getSelectedSecret().then( (selection) => {
						selectedSecret = selection;
						if (selectedSecret === undefined) {
							reject (new Error('No Secret selected.'));
							return;
						}
					}).catch ( (error) => {
						reject(error);
						return;
					});
					break;
				case basicIntegration:
					// do nothing with config-map or secret
					break;
			}
				
			if (selectedConfigMap !== null || selectedSecret !== null) {
				await createNewIntegration(context, selectedConfigMap, selectedSecret)
					.then( success => {
						if (!success) {
							reject(false);
							return;
						}
						resolve(true);
					})
					.catch(err => {
						reject(err);
					});
			}
		} else {
			reject(new Error('No integration selection made.'));
			return;
		}
	});
}

function getSelectedConfigMap() {
	return new Promise <any> ( async (resolve, reject) => {
		await getConfigMaps()
			.then( (configMaps) => {
				vscode.window.showQuickPick(configMaps, {
					placeHolder: 'Select an available Kubernetes ConfigMap or ESC to cancel'
				}).then ( (selectedConfigMap) => {
					resolve(selectedConfigMap);
				});
			}).catch ( (error) => {
				reject(new Error(`No ConfigMaps available: ${error}`));
			});
		});
}

function getSelectedSecret() {
	return new Promise <any> ( async (resolve, reject) => {
		await getSecrets()
			.then( (secrets) => {
				vscode.window.showQuickPick(secrets, {
					placeHolder: 'Select an available Kubernetes Secret or ESC to cancel'
				}).then ( (selectedSecret) => {
					resolve(selectedSecret);
				});
			}).catch ( (error) => {
				reject(new Error(`No Secrets available: ${error}`));
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
