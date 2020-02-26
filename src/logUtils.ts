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

import * as kamel from './kamel';
import { ChildProcess } from 'child_process';
import { LogsPanel } from './logsWebview';
import * as utils from './CamelKJSONUtils';
import { mainOutputChannel, closeLogViewWhenIntegrationRemoved } from './extension';
import * as kubectl from './kubectl';
import * as config from './config';
import * as kubectlutils from './kubectlutils';
import { window } from 'vscode';

function getCurrentNamespace() : string {
	let ns = `default`;
	const currentNs = config.getNamespaceconfig();
	if (currentNs) {
		ns = currentNs;
	}
	return ns;
}

export function handleLogViaKamelCli(integrationName: string) : Promise<string> {
	return new Promise<string>( async () => {
		let kamelExe = kamel.create();
		let ns = getCurrentNamespace();
		let resource = {
			kindName: `custom/${integrationName}`,
			namespace: ns,
			containers: undefined,
			containersQueryPath: `.spec`
		};
		const cresource = `${resource.namespace}/${resource.kindName}`;
		let args : string[] = ['log', `${integrationName}`];
		await kamelExe.invokeArgs(args)
			.then( async (proc : ChildProcess) => {
				const panel = LogsPanel.createOrShow(`Waiting for integration ${integrationName} to start...\n`, cresource);
				if (proc && proc.stdout) {
					proc.stdout.on('data', async (data: string) => {
						if (data.length > 0) {
							var buf = Buffer.from(data);
							var text = buf.toString();
							if (text.indexOf(`Received hang up - stopping the main instance`) > 0 && !closeLogViewWhenIntegrationRemoved) {
								var title = panel.getTitle();
								updateLogViewTitleToStopped(panel, title);
							}
							panel.addContent(buf.toString());
						}
					});
				}
				}).catch( (error) => {
					utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
				});
	});
}

export function handleLogViaKubectlCli(podName: string) : Promise<string> {
	return new Promise<string>( async (reject) => {
		let kubectlExe = kubectl.create();
		let ns = getCurrentNamespace();
		let resource = {
			kindName: `custom/${podName}`,
			namespace: ns,
			containers: undefined,
			containersQueryPath: `.spec`
		};
		const cresource = `${resource.namespace}/${resource.kindName}`;
		let args : string[] = ['logs', `-f`, `${podName}`];
		await kubectlExe.invokeArgs(args)
			.then( async (proc : ChildProcess) => {
				var panel : LogsPanel | undefined = undefined;
				if (proc && proc.stderr) {
					proc.stderr.on('data', async (data: string) => {
						if (data.length > 0) {
							var text = data.toString();
							window.showErrorMessage(`Error encountered while opening log for ${podName}. See Apache Camel K output channel for details and wait a moment before trying again. It's likely the pod simply hasn't started yet.`);
							reject(text);
							return;
						}
					});
				}
				if (proc && proc.stdout) {
					proc.stdout.on('data', async (data: string) => {
						if (data.length > 0) {
							if (!panel) {
								panel = LogsPanel.createOrShow(`Waiting for ${podName} to start...\n`, cresource);
							}
							var text = data.toString();
							panel.addContent(text);
						}
					});
				}}).catch( (error) => {
					utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
				});
	});
}

export function parseKamelGetResponseForKitName(incoming : string) : string | undefined {
	if (incoming) {
		let lines : string[] = incoming.split("\n");
		if (lines.length > 1) {
			let secondLine = lines[1];
			let columns : string[] = secondLine.split("\t");
			if (columns.length > 2) {
				let kitname = columns[2];
				return kitname;
			}
		}
	}
	return undefined;
}

export function handleKitLog(integrationName: string) : Promise<string> {
	return new Promise<string>( async () => {
		await getIntegrationsListFromKamel(integrationName).then( async (result : string ) => {
			if (result && result.length > 0) {
				let kitname = parseKamelGetResponseForKitName(result);
				if (kitname) {
					let fullkitname = `camel-k-${kitname}-builder`;
					await handleLogViaKubectlCli(fullkitname)
					.then( () => {
						Promise.resolve();
					}).catch((error) => {
						throw new Error(error);
					});
				} else {
					throw new Error(`Kit name for integration ${integrationName} not found`);
				}
			}
		}).catch( (err) => {
			throw new Error(err);
		});
	});
}

export function handleOperatorLog() : Promise<string> {
	return new Promise<string>( async () => {
		const operatorName = `camel-k-operator`;
		await kubectlutils.getNamedPodsFromKubectl(operatorName).then( async (podNames) => {
			await handleLogViaKubectlCli(podNames[0])
			.then( () => {
				Promise.resolve();
			}).catch((error) => {
				throw new Error(error);
			});
		}).catch( (err) => {
			throw new Error(err);
		});
	});
}

export function removeIntegrationLogView(integrationName: string) : Promise<string> {
	return new Promise<string>( async () => {
		if (closeLogViewWhenIntegrationRemoved) {
			LogsPanel.currentPanels.forEach((value : LogsPanel) => {
				var title = value.getTitle();
				if (title.indexOf(integrationName) >= 0) {
					value.disposeView();
				}
			});
		} else {
			LogsPanel.currentPanels.forEach((value : LogsPanel) => {
				var title = value.getTitle();
				if (title.indexOf(integrationName) >= 0) {
					updateLogViewTitleToStopped(value, title);
				}
			});
		}
	});
}

export function updateLogViewTitleToStopped(panel: LogsPanel, title: string) {
	if (panel && title) {
		// make sure we only show the log as stopped once 
		const stoppedString = `[Integration stopped]`;
		let boolHasIntegrationStopped = title.indexOf(stoppedString) > 0;
		if (!boolHasIntegrationStopped) {
			panel.updateTitle(title + ` ` + stoppedString);
		} else {
			panel.updateTitle(title);
		}
	}
}

export function getIntegrationsListFromKamel(integrationName? : string) : Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		let kamelExe = kamel.create();
		let cmdLine = `get`;
		if (integrationName) {
			cmdLine = `get ${integrationName}`;
		}
		await kamelExe.invoke(cmdLine)
			.then( async (result : string) => {
					resolve(result);
				}).catch( (error) => {
					reject(`exec error: ${error}`);
					utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
				});
	});
}
