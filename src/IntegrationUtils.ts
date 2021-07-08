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
import { getConfigMaps, getSecrets } from './kubectlutils';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as kamel from './kamel';
import { CamelKRunTaskProvider, CamelKRunTaskDefinition } from './task/CamelKRunTaskDefinition';
import * as fs from 'fs';
import { getTelemetryServiceInstance } from './Telemetry';
import { TelemetryEvent } from '@redhat-developer/vscode-redhat-telemetry/lib';

const validNameRegex = /^[A-Za-z][A-Za-z0-9\-\.]*(?:[A-Za-z0-9]$){1}/;
const devModeIntegration: string = 'Dev Mode - Apache Camel K Integration in Dev Mode';
export const basicIntegration: string = 'Basic - Apache Camel K Integration without extra options';
export const configMapIntegration: string = 'ConfigMap - Apache Camel K Integration with Kubernetes ConfigMap as runtime configuration';
export const secretIntegration: string = 'Secret - Apache Camel K Integration with Kubernetes Secret as runtime configuration';
export const resourceIntegration: string = 'Resource - Apache Camel K Integration with Resource file';
export const propertyIntegration: string = 'Property - Apache Camel K Integration with Property';
const dependencyIntegration: string = 'Dependencies - Apache Camel K Integration with Explicit Dependencies';
export const vscodeTasksIntegration: string = 'Use a predefined Task - useful for multi-attributes deployment';

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
	dependencyIntegration,
	vscodeTasksIntegration
 ];

 let childProcessMap : Map<string, child_process.ChildProcess>;

 export function startIntegration(...args: any[]): Promise<boolean> {
	return new Promise <boolean> ( async (resolve, reject) => {
		let context : vscode.Uri | undefined;
		let inChoice : string | undefined;

		if (args && args.length > 0) {
			// if there are multiple arguments, assume didact input
			// at this time we only support the URI & basic/dev mode type of integration
			if (args[0] instanceof vscode.Uri) {
				context = args[0];
				inChoice = undefined;
			} else if (Array.isArray(args[0])) {
				let innerArgs1 : any[] = args[0];
				let innerArgs2 : any[] = innerArgs1[0];
				let innerArgs3 : any[] = innerArgs2[0];
				context = innerArgs3[0] as vscode.Uri;
				inChoice = undefined;

				if (innerArgs3.length > 1) {
					let value = innerArgs3[1];
					if (typeof value === 'string') {
						inChoice = value;
					}
				}
			}
		}
		if (!context) {
			// with no arguments, try working with the selected file
			try {
				let currentFile = await getCurrentFileSelectionPath();

				// validate that the file is in fact a file we might be interested in
				const regex = /\.(groovy|java|xml|js|kts|yaml)$/g;
				if (currentFile.fsPath.match(regex)) {
					context = currentFile;
				}
			 } catch (error) {
				reject('No arguments provided to start integration function call');
				return;	
			 }
		}

		let choice: string | undefined;
		if (!context) {
			reject('No valid file specified to start integration function call');
			return;	
		} else if (!inChoice && context) {
			choice = await vscode.window.showQuickPick(choiceList, {
				placeHolder: 'Select the type of Apache Camel K Integration'
			});
		} else {
			choice = findChoiceFromStartsWith(inChoice);
		}

		if (choice && context) {
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
					await getSelectedResources().then( (selection) => {
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
				case vscodeTasksIntegration:
					await handleDefinedTask(context).then(() => {
						resolve(true);
					}).catch(onrejected => {
						reject(onrejected);
						errorEncountered = true;
					});
					sendStartIntegrationTelemetryEvent(choice, context);
					return;
			}

			if (!errorEncountered) {
				try {
					const isSuccess = await createNewIntegration(context, devMode, selectedConfigMap, selectedSecret, selectedResource, selectedProperty, selectedDependency);
					sendStartIntegrationTelemetryEvent(choice, context);
					resolve(isSuccess);
				} catch(err) {
					reject(err);
				}
			}
		} else {
			reject(new Error('No integration selection made.'));
		}
	});
}

async function sendStartIntegrationTelemetryEvent(choice: string, context: vscode.Uri) {
	const telemetryService = await getTelemetryServiceInstance();
	const telemetryEvent: TelemetryEvent = {
		type: 'track',
		name: 'command',
		properties: {
			identifier: extension.COMMAND_ID_START_INTEGRATION,
			kind: choice,
			language: context.fsPath.substring(context.fsPath.lastIndexOf('.') + 1)
		}
	};
	telemetryService.send(telemetryEvent);
}

async function handleDefinedTask(context: vscode.Uri) {
	let allCamelKTasks = await vscode.tasks.fetchTasks({type: CamelKRunTaskProvider.START_CAMELK_TYPE});
	let filteredCamelKTasks = allCamelKTasks.filter(task => {
		let camelTaskDefinition = task.definition as CamelKRunTaskDefinition;
		let file = camelTaskDefinition.file;
		return file && (isAVariable(file) || isTheExactFile(file, context));
	});
	if (filteredCamelKTasks && filteredCamelKTasks.length > 0) {
		let camelKTaskNames = filteredCamelKTasks.map(task => task.name);
		let camelKTaskNameToLaunch = await vscode.window.showQuickPick(camelKTaskNames, {placeHolder: 'Choose a predefined task'});
		if(camelKTaskNameToLaunch) {
			let camelKTaskToLaunch = filteredCamelKTasks.find(task => task.name === camelKTaskNameToLaunch);
			if(camelKTaskToLaunch) {
				await vscode.tasks.executeTask(camelKTaskToLaunch);
			}
		} else {
			throw new Error('No Camel K Task chosen');
		}
	} else {
		await vscode.window.showInformationMessage('No Camel K Task applicable has been found. You can create one using "Tasks: Open User Tasks" or by creating a tasks.json file in .vscode folder.');
	}

	function isTheExactFile(file: string, uri: vscode.Uri): boolean {
		return file === vscode.workspace.asRelativePath(uri.path);
	}

	// this can be smarter in future by evaluating the variable for the task and then comparing with file used in the context
	function isAVariable(file: string): boolean {
		return file.includes("${");
	}
}

function getSelectedConfigMap(): Promise<string | undefined> {
	return new Promise <string | undefined>( async (resolve, reject) => {
		const configMaps: string[] = await getConfigMaps();
		if(configMaps.length === 0) {
			reject(`No ConfigMap available.`);
		}
		return resolve(await vscode.window.showQuickPick(configMaps, {
					placeHolder: 'Select an available Kubernetes ConfigMap or ESC to cancel'
				}));
	});
}

function getSelectedSecret(): Promise<string | undefined> {
	return new Promise<string | undefined>( async (resolve, reject) => {
		const secrets: string[] = await getSecrets();
		if(secrets.length === 0) {
			reject(new Error(`No Secrets available`));
		}
		return resolve(vscode.window.showQuickPick(secrets, {
					placeHolder: 'Select an available Kubernetes Secret or ESC to cancel'
				}));
	});
}

function getSelectedResources(): Promise<string[]> {
	return new Promise<string[]> ( async (resolve, reject) => {
		const fileUris = await vscode.window.showOpenDialog(ResourceOptions);
		if (fileUris === undefined || fileUris.length === 0) {
			reject(new Error('No Resource file(s) specified.'));
		} else {
			resolve(fileUris.map(fileUri => path.normalize(fileUri.path)));
		}
	});
}

function getSelectedProperties(): Promise<string[]> {
	return new Promise<string[]> ( async (resolve, reject) => {
		let hasMoreProperties: boolean = true;
		let returnedProperties : string[] = [];

		while (hasMoreProperties) {
			const propName: string | undefined = await vscode.window.showInputBox({
				placeHolder: 'Specify the property name',
				validateInput: validateName
			});
			if (propName) {
				let propValue: string | undefined = await vscode.window.showInputBox({
					placeHolder: 'Specify the property value'
				});
				if (propValue) {
					propValue = propValue.replace(/"/g, '\\"');
					console.log(propValue);
					let newProperty = `${propName}=${propValue}`;

					const moreProperties: string | undefined = await vscode.window.showQuickPick(['No', 'Yes'], {
						placeHolder: 'Are there more properties?',
						canPickMany: false
					});
					if (!moreProperties) {
						hasMoreProperties = false;
						reject(new Error(`No Property answer given`));
					} else {
						returnedProperties.push(newProperty);
						if (moreProperties && moreProperties.toLowerCase() === 'no') {
							hasMoreProperties = false;
							resolve(returnedProperties);
						}
					}
				} else {
					hasMoreProperties = false;
					reject(new Error(`No Property Value provided`));
				}
			} else {
				hasMoreProperties = false;
				reject(new Error(`No Property Name provided`));
			}
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
export function createNewIntegration(integrationFileUri: vscode.Uri, devMode? : boolean, configmap? : string, secret? : string, resourceArray? : string[], propertyArray? : string[], dependencyArray? : string[]): Promise<boolean> {
	return new Promise( async (resolve, reject) => {
		let filename = integrationFileUri.fsPath;
		let foldername = path.dirname(filename);
		let absoluteRoot = path.parse(filename).base;
		let rootName = absoluteRoot.split('.', 1)[0];
		let integrationName = utils.toKebabCase(rootName);
		utils.shareMessage(extension.mainOutputChannel, `Deploying file ${absoluteRoot} as integration ${integrationName}`);
				let kamelExecutor = kamel.create();
				let kamelArgs: string[] = computeKamelArgs(
					absoluteRoot,
					devMode,
					configmap,
					secret,
					resourceArray,
					dependencyArray,
					propertyArray);
				if (devMode && devMode === true) {
					if (extension.mainOutputChannel) {
						extension.mainOutputChannel.show();
					}
				}
				if (devMode && devMode === true) {
					kamelExecutor.setDevMode(devMode);
				}
				await kamelExecutor.invokeArgs(kamelArgs, foldername)
					.then( (runKubectl) => {
						if (runKubectl) {
							if (!childProcessMap) {
								childProcessMap = new Map();
							}
							childProcessMap.set(integrationName, runKubectl);
							resolve(true);
							return;
						} else {
							reject(false);
							return;
						}})
					.catch( (error) => {
						reject(error);
						return;
					});
				});
}

export function computeKamelArgs(absoluteRoot: string,
		devMode: boolean | undefined,
		configmap: string | undefined,
		secret: string | undefined,
		resourceArray: string[] | undefined,
		dependencyArray: string[] | undefined,
		propertyArray: string[] | undefined,
		traitsArray?: string[] | undefined,
		environmentVariablesArray?: string[] | undefined,
		integrationVolumesArray?: string[] | undefined,
		compression?: boolean | undefined,
		profile?: string) {
	let kamelArgs: string[] = [];
	kamelArgs.push('run');
	kamelArgs.push(`${absoluteRoot}`);
	if (devMode && devMode === true) {
		kamelArgs.push('--dev');
	}
	if (compression && compression === true) {
		kamelArgs.push('--compression');
	}
	if (configmap && configmap.trim().length > 0) {
		kamelArgs.push(`--config=configmap:${configmap}`);
	}
	if (secret && secret.trim().length > 0) {
		kamelArgs.push(`--config=secret:${secret}`);
	}
	if (profile && profile.trim().length > 0) {
		kamelArgs.push(`--profile=${profile}`);
	}
	if (resourceArray && resourceArray.length > 0) {
		resourceArray.forEach(resource => {
			kamelArgs.push(`--resource=file:${resource}`);
		});
	}
	if (dependencyArray && dependencyArray.length > 0) {
		dependencyArray.forEach(dependency => {
			kamelArgs.push(`--dependency=${dependency}`);
		});
	}
	if (propertyArray && propertyArray.length > 0) {
		propertyArray.forEach(prop => {
			kamelArgs.push(`-p ${prop}`);
		});
	}
	if (traitsArray && traitsArray.length > 0) {
		traitsArray.forEach(trait => {
			kamelArgs.push(`-t ${trait}`);
		});
	}
	if (environmentVariablesArray && environmentVariablesArray.length > 0) {
		environmentVariablesArray.forEach(environmentVariable => {
			kamelArgs.push(`-e ${environmentVariable}`);
		});
	}
	if (integrationVolumesArray && integrationVolumesArray.length > 0) {
		integrationVolumesArray.forEach(integrationVolume => {
			kamelArgs.push(`-v ${integrationVolume}`);
		});
	}
	
	return kamelArgs;
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

function getChildProcessForIntegration(integration:string) {
	if (childProcessMap) {
		if (childProcessMap.has(integration)) {
			return childProcessMap.get(integration);
		}
	}
	return null;
}

export function killChildProcessForIntegration(integration:string) : Promise<boolean> {
	return new Promise( (resolve, reject) => {
		let childProcess : any = getChildProcessForIntegration(integration);
		if (childProcess) {
			try {
				childProcess.kill();
			} catch (error) {
				reject(error);
			}
			childProcessMap.delete(integration);
		}
		resolve(childProcess ? childProcess.killed : true);
	});	
}

function findChoiceFromStartsWith(inChoice: string | undefined) : string | undefined {
	if (inChoice) {
		if (devModeIntegration.startsWith(inChoice)) {
			return devModeIntegration;
		}
		if (basicIntegration.startsWith(inChoice)) {
			return basicIntegration;
		}
	}
	// other choices not supported at present because they will require additional inputs
	return undefined;
 }

 export async function getCurrentFileSelectionPath(): Promise<vscode.Uri> {
	if (vscode.window.activeTextEditor) {
		return vscode.window.activeTextEditor.document.uri;
	} else {
		// set focus to the Explorer view
		await vscode.commands.executeCommand('workbench.view.explorer');
		// then get the resource with focus
		await vscode.commands.executeCommand('copyFilePath');
		const copyPath = await vscode.env.clipboard.readText();
		if (fs.existsSync(copyPath) && fs.lstatSync(copyPath).isFile() ) {
			return vscode.Uri.file(copyPath);
		}
	}
	throw new Error("Can not determine current file selection");
}
