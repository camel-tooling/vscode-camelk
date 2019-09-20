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

const validNameRegex = /^[A-Za-z][A-Za-z0-9\-\.]*(?:[A-Za-z0-9]$){1}/;

const devModeIntegration: string = 'Dev Mode - Apache Camel K Integration in Dev Mode';
const basicIntegration: string = 'Basic - Apache Camel K Integration (no ConfigMap or Secret)';
const configMapIntegration: string = 'ConfigMap - Apache Camel K Integration with Kubernetes ConfigMap';
const secretIntegration: string = 'Secret - Apache Camel K Integration with Kubernetes Secret';
const resourceIntegration: string = 'Resource - Apache Camel K Integration with Resource file';
const propertyIntegration: string = 'Property - Apache Camel K Integration with Property';
const dependencyIntegration: string = 'Dependencies - Apache Camel K Integration with Explicit Dependencies';

const ResourceOptions: vscode.OpenDialogOptions = {
	canSelectMany: true,
	openLabel: 'Open Resource File(s)',
	filters: {
		'Text files': ['txt'],
		'All files': ['*']
	}
};

const choiceList = [
	devModeIntegration,
	basicIntegration,
	configMapIntegration,
	secretIntegration,
	resourceIntegration,
	propertyIntegration,
	dependencyIntegration
 ];

 export function startIntegration(context: vscode.Uri): Promise<boolean> {
	return new Promise <boolean> ( async (resolve, reject) => {
		const choice : string | undefined = await vscode.window.showQuickPick(choiceList, {
			placeHolder: 'Select the type of Apache Camel K Integration'
		});

		if (choice) {
			let selectedConfigMap : any = undefined;
			let selectedSecret : any = undefined;
			let devMode : boolean = false;
			let selectedResource : any = undefined;
			let errorEncountered : boolean = false;
			let selectedProperty : any = undefined;
			let selectedDependency : any = undefined;

			switch (choice) {
				case devModeIntegration:
					devMode = true;
					break;
				case configMapIntegration:
					await getSelectedConfigMap().then( (selection) => {
						selectedConfigMap = selection;
						if (selectedConfigMap === undefined) {
							reject (new Error('No ConfigMap selected.'));
							errorEncountered = true;
						}
					}).catch ( (error) => {
						reject(error);
						errorEncountered = true;
					});
					break;
				case secretIntegration:
					await getSelectedSecret().then( (selection) => {
						selectedSecret = selection;
						if (selectedSecret === undefined) {
							reject (new Error('No Secret selected.'));
							errorEncountered = true;
						}
					}).catch ( (error) => {
						reject(error);
						errorEncountered = true;
					});
					break;
				case resourceIntegration:
					await getSelectedResource().then( (selection) => {
						selectedResource = selection;
						if (selectedResource === undefined) {
							reject (new Error('No Resource selected.'));
							errorEncountered = true;
						}
					}).catch ( (error) => {
						reject(error);
						errorEncountered = true;
					});
					break;
				case propertyIntegration:
					await getSelectedProperties().then ( (selection) => {
						selectedProperty = selection;
						if (selectedProperty === undefined) {
							reject (new Error('No Property defined.'));
							errorEncountered = true;
						}
					}).catch ( (error) => {
						reject(error);
						errorEncountered = true;
					});
					break;
				case dependencyIntegration:
					await getSelectedDependencies().then ( (selection) => {
						selectedDependency = selection;
						if (selectedDependency === undefined) {
							reject (new Error('No Dependencies defined.'));
							errorEncountered = true;
						}
					}).catch ( (error) => {
						reject(error);
						errorEncountered = true;
					});
					break;
				case basicIntegration:
					// do nothing with config-map or secret
					break;
			}

			if (!errorEncountered) {
				await createNewIntegration(context, devMode, selectedConfigMap, selectedSecret, selectedResource, selectedProperty, selectedDependency)
					.then( success => {
						resolve(success);
					})
					.catch(err => {
						reject(err);
					});
			}
		} else {
			reject(new Error('No integration selection made.'));
		}
	});
}

function getSelectedConfigMap(): Promise<string | undefined> {
	return new Promise <string | undefined>( async (resolve, reject) => {
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

function getSelectedSecret(): Promise<string | undefined> {
	return new Promise<string | undefined>( async (resolve, reject) => {
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

function getSelectedResource(): Promise<string> {
	return new Promise<string> ( async (resolve, reject) => {
		let returnedResources: string = '';
		const fileUri = await vscode.window.showOpenDialog(ResourceOptions);
		if (fileUri === undefined || fileUri.length === 0) {
			reject(new Error("No Resource file(s) specified."));
		} else {
			fileUri.forEach(selectedFile => {
				if (returnedResources.trim().length > 0) {
					// add a separator
					returnedResources += ` `;
				}
				const uriStr = path.normalize(selectedFile.path);
				returnedResources += `${uriStr}`;
			});
			resolve(returnedResources);
		}
	});
}

function getSelectedProperties(): Promise<string[]> {
	return new Promise<string[]> ( async (resolve, reject) => {
		let hasMoreProperties: boolean = true;
		let returnedProperties : string[] = [];

		while (hasMoreProperties) {
			let newProperty: string;
			await vscode.window.showInputBox({
				placeHolder: 'Specify the property name',
				validateInput: validateName
			}).then ( async (propName) => {
				if (propName) {
					await vscode.window.showInputBox({
						placeHolder: 'Specify the property value'
					}).then ( async (propValue) => {
						if (propValue) {
							propValue = propValue.replace(/"/g, '\\"');
							newProperty = `${propName}="${propValue}"`;

							await vscode.window.showQuickPick( ['No', 'Yes'], {
								placeHolder: 'Are there more properties?',
								canPickMany : false	}).then( (answer) => {
									if (!answer) {
										hasMoreProperties = false;
										reject(new Error(`No Property answer given`));
									} else {
										returnedProperties.push(newProperty);
										if (answer && answer.toLowerCase() === 'no') {
											hasMoreProperties = false;
											resolve(returnedProperties);
										}
									}
								});

						} else {
							hasMoreProperties = false;
							reject(new Error(`No Property Value provided`));
						}
					});
				} else {
					hasMoreProperties = false;
					reject(new Error(`No Property Name provided`));
				}
			});
		}
	});
}

function getSelectedDependencies(): Promise<string[]> {
	return new Promise <string[]> ( async (resolve, reject) => {
		let hasMoreDependencies: boolean = true;
		let returnedDependencies : string[] = [];
		while (hasMoreDependencies) {
			await vscode.window.showInputBox({
				placeHolder: 'Specify the dependency. Use Apache Camel component Artifact Id or Maven dependency format with group:artifact:version',
				validateInput: validateDependency,
			}).then ( async (dependency) => {
				if (dependency) {
					await vscode.window.showQuickPick( ['No', 'Yes'], {
						placeHolder: 'Are there more dependencies?',
						canPickMany : false	}).then ( (answer) => {
							if (!answer) {
								hasMoreDependencies = false;
								reject(new Error(`No Dependency answer given`));
							}
							returnedDependencies.push(dependency);
							if (answer && answer.toLowerCase() === 'no') {
								hasMoreDependencies = false;
								resolve(returnedDependencies);
							}
						});
				} else {
					hasMoreDependencies = false;
					reject(new Error(`No Dependency provided`));
				}
			});
		}
	});
}

// use command-line "kamel" utility to start a new integration
function createNewIntegration(integrationFileUri: vscode.Uri, devMode? : boolean, configmap? : string, secret? : string, resource? : string, propertyArray? : string[], dependencyArray? : string[]): Promise<boolean> {
	return new Promise( (resolve, reject) => {
		let filename = integrationFileUri.fsPath;
		let foldername = path.dirname(filename);
		let absoluteRoot = path.parse(filename).base;
		let rootName = absoluteRoot.split('.', 1)[0];
		let integrationName = utils.toKebabCase(rootName);
		utils.shareMessage(extension.mainOutputChannel, `Deploying file ${absoluteRoot} as integration ${integrationName}`);
		return extension.removeOutputChannelForIntegrationViaKubectl(integrationName)
			.then( () => {
				let commandString = `kamel run "${absoluteRoot}"`;
				if (devMode && devMode === true) {
					commandString += ` --dev`;
				}
				if (configmap && configmap.trim().length > 0) {
					commandString += ` --configmap=${configmap}`;
				}
				if (secret && secret.trim().length > 0) {
					commandString += ` --secret=${secret}`;
				}
				if (resource && resource.trim().length > 0) {
					let resourceArray = resource.split(' ');
					if (resourceArray && resourceArray.length > 0) {
						resourceArray.forEach(res => {
							commandString += ` --resource="${res}"`;
						});
					}
				}
				if (dependencyArray && dependencyArray.length > 0) {
					dependencyArray.forEach(dependency => {
						commandString += ` --dependency=${dependency}`;
					});
				}
				if (propertyArray && propertyArray.length > 0) {
					propertyArray.forEach(prop => {
						commandString += ` -p ${prop}`;
					});
				}
				console.log(`commandString = ${commandString}`);
				if (devMode && devMode === true) {
					if (extension.mainOutputChannel) {
						extension.mainOutputChannel.show();
					}
				}
				let runKubectl = child_process.exec(commandString, { cwd : foldername});
				if (runKubectl.stdout) {
					runKubectl.stdout.on('data', function (data) {
						if (devMode) {
							utils.shareMessage(extension.mainOutputChannel, `Dev Mode -- ${integrationName}: ${data}`);
						}
						resolve(true);
					});
				} else if (runKubectl.stderr) {
					runKubectl.stderr.on('data', function (data) {
						utils.shareMessage(extension.mainOutputChannel, `Error deploying ${integrationName}: ${data}`);
						reject(false);
					});
				}
			})
			.catch( (error) => {
				// this is not a hard stop, it just means there was no output channel to close
				console.error(error);
			});
	});
}

export function isCamelKAvailable(): Promise<boolean> {
	return new Promise<boolean>( (resolve) => {
		return k8s.extension.kubectl.v1
			.then( (kubectl) => {
				if (kubectl && kubectl.available) {
					return kubectl.api.invokeCommand('api-versions')
					.then( (result) => {
						if (result && result.code === 0) {
							let foundCamel : boolean = result.stdout.includes("camel.apache.org/v1alpha1");
							resolve(foundCamel);
						} else {
							resolve(false);
						}
					});
				} else {
					resolve(false);
				}
			})
			.catch(err => {
				console.log(err);
				resolve(false);
			});
	});
}

function validateName(text : string): string | null {
	return !validNameRegex.test(text) ? 'Name must be at least two characters long, start with a letter, and only include a-z, A-Z, periods and hyphens' : null;
}

function validateDependency(text : string): string | null {
	let inputEmpty : boolean = (text === undefined || text.trim().length === 0);
	if (inputEmpty) {
		return 'Dependency must be specified in the form of an Apache Camel component Artifact Id or a Maven dependency in the form of group:artifact:version';
	}
	if (!inputEmpty && text.indexOf(':') > -1) {
		let trifold : string[] = text.split(':');
		// make sure we have three colon-delimited strings
		return !(trifold && trifold.length === 3) ? 'Dependency must be specified in the form of a Maven dependency as group:artifact:version' : null;
	} else if (!(!inputEmpty && text.indexOf('-') > -1)) {
		// assume we're a camel component for now
		return 'Dependency must be specified in the form of an Apache Camel component Artifact Id or a Maven dependency in the form of group:artifact:version';
	}
	return null;
}
