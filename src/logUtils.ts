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
	const currentNs: string | undefined = config.getNamespaceconfig();
	if (currentNs) {
		ns = currentNs;
	}
	return ns;
}

export async function handleLogViaKamelCli(integrationName: string) : Promise<void> {
	const kamelExecutor: kamel.Kamel = kamel.create();
	const ns: string = getCurrentNamespace();
	const resource = {
		kindName: `custom/${integrationName}`,
		namespace: ns,
		containers: undefined,
		containersQueryPath: `.spec`
	};
	const cresource = `${resource.namespace}/${resource.kindName}`;
	const args : string[] = ['log', `${integrationName}`];
	try { 
		const proc: ChildProcess = await kamelExecutor.invokeArgs(args);
		const panel = LogsPanel.createOrShow(`Waiting for integration ${integrationName} to start...\n`, cresource);
		if (proc && proc.stdout) {
			proc.stdout.on('data', async (data: string) => {
				if (data.length > 0) {
					const buf = Buffer.from(data);
					const stripAnsi = require('strip-ansi');
					const text = stripAnsi(buf.toString());
					if (text.indexOf(`Received hang up - stopping the main instance`) !== -1 && !closeLogViewWhenIntegrationRemoved) {
						const title: string = panel.getTitle();
						updateLogViewTitleToStopped(panel, title);
					}
					panel.addContent(text);
				}
			});
		}
	} catch(error) {
		utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
	}
}

export async function handleLogViaKubectlCli(podName: string) : Promise<string | void> {
	const kubectlExe: kubectl.Kubectl = kubectl.create();
	const ns: string = getCurrentNamespace();
	const resource = {
		kindName: `custom/${podName}`,
		namespace: ns,
		containers: undefined,
		containersQueryPath: `.spec`
	};
	const cresource = `${resource.namespace}/${resource.kindName}`;
	const args : string[] = ['logs', `-f`, `${podName}`];
	try {
		const proc: ChildProcess = await kubectlExe.invokeArgs(args);
		let panel : LogsPanel | undefined = undefined;
		if (proc && proc.stderr) {
			proc.stderr.on('data', async (data: string) => {
				if (data.length > 0) {
					const text: string = data.toString();
					window.showErrorMessage(`Error encountered while opening log for ${podName}. See Apache Camel K output channel for details and wait a moment before trying again. It's likely the pod simply hasn't started yet.`);
					return text;
				}
			});
		}
		if (proc && proc.stdout) {
			proc.stdout.on('data', async (data: string) => {
				if (data.length > 0) {
					if (!panel) {
						panel = LogsPanel.createOrShow(`Waiting for ${podName} to start...\n`, cresource);
					}
					const text: string = data.toString();
					panel.addContent(text);
				}
			});
		}
	} catch( error ) {
		utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
	}
}

export async function handleOperatorLog() : Promise<void> {
	const operatorName = `camel-k-operator`;
	const podNames: string[] = await kubectlutils.getNamedPodsFromKubectl(operatorName);
	await handleLogViaKubectlCli(podNames[0]);
}

export function removeIntegrationLogView(integrationName: string) : void {
	if (closeLogViewWhenIntegrationRemoved) {
		LogsPanel.currentPanels.forEach((value : LogsPanel) => {
			const title: string = value.getTitle();
			if (title.indexOf(integrationName) >= 0) {
				value.disposeView();
			}
		});
	} else {
		LogsPanel.currentPanels.forEach((value : LogsPanel) => {
			const title: string = value.getTitle();
			if (title.indexOf(integrationName) >= 0) {
				updateLogViewTitleToStopped(value, title);
			}
		});
	}
}

export function updateLogViewTitleToStopped(panel: LogsPanel, title: string) {
	if (panel && title) {
		// make sure we only show the log as stopped once 
		const stoppedString = `[Integration stopped]`;
		const boolHasIntegrationStopped = title.indexOf(stoppedString) !== -1;
		if (!boolHasIntegrationStopped) {
			panel.updateTitle(title + ` ` + stoppedString);
		} else {
			panel.updateTitle(title);
		}
	}
}

export async function getIntegrationsListFromKamel(integrationName? : string) : Promise<string> {
	const kamelExecutor: kamel.Kamel = kamel.create();
	let cmdLine = `get`;
	if (integrationName) {
		cmdLine += integrationName;
	}
	let result: string;
	try {
		result = await kamelExecutor.invoke(cmdLine);
	} catch (error) {
		utils.shareMessage(mainOutputChannel, `exec error: ${error}`);
		result = `exec error: ${error}`;
	}
	return result;
}
