/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as IntegrationUtils from '../../../IntegrationUtils';
import { openCamelKTreeView } from "../Utils";
import { assert, expect } from 'chai';
import { waitUntil } from 'async-wait-until';
import * as extension from '../../../extension';
import * as kamel from '../../../kamel';
import { LANGUAGES_WITH_FILENAME_EXTENSIONS } from '../../../commands/NewIntegrationFileCommand';
import { TelemetryEvent } from '@redhat-developer/vscode-redhat-telemetry/lib';
import { TreeNode } from '../../../CamelKNodeProvider';
import { UNDEPLOY_TIMEOUT, PROVIDER_POPULATED_TIMEOUT, RUNNING_TIMEOUT, DEPLOYED_TIMEOUT, EDITOR_OPENED_TIMEOUT } from '../StartIntegration.test';
import { checkCodelensForOpenedDocument } from '../codelenses/StartIntegrationCodeLens.test';

export async function cleanDeployedIntegration(telemetrySpy: sinon.SinonSpy) {
	const deployedTreeNodes: TreeNode[] | undefined = await retrieveDeployedTreeNodes();
	if (deployedTreeNodes) {
		telemetrySpy.resetHistory();
		deployedTreeNodes.forEach(deployedTreeNode => {
			vscode.commands.executeCommand('camelk.integrations.remove', deployedTreeNode);
		});
		try {
			await waitUntil(() => {
				return extension.camelKIntegrationsProvider.getTreeNodes().length === 0 && telemetrySpy.callCount === deployedTreeNodes?.length;
			}, UNDEPLOY_TIMEOUT);
		} catch (error) {
			console.log('Error while trying to remove deployed integrations, it remains:');
			console.log(`${await kamel.create().invoke('get integration')}`);
			throw new Error(`Undeployment has still not been finished or the Tree view has not been refreshed.\n${error}`);
		}
	} else {
		console.log('No deployed integration detected in Camel K Integration view.');
	}
}

export async function retrieveDeployedTreeNodes(minimalExpectedTreeNode =1): Promise<TreeNode[]> {
	let deployedTreeNodes: TreeNode[] = [];
	try {
		await waitUntil(() => {
			deployedTreeNodes = extension.camelKIntegrationsProvider.getTreeNodes();
			return deployedTreeNodes.length >= minimalExpectedTreeNode;
		}, PROVIDER_POPULATED_TIMEOUT);
	} catch (err) {
		console.log(`Less than ${minimalExpectedTreeNode} Integration found in Camel K Integration provider of the view.`);
	}
	return deployedTreeNodes;
}

export async function startIntegrationWithBasicCheck(showQuickpickStub: sinon.SinonStub<any[], any>, telemetrySpy: sinon.SinonSpy, alreadyDeployedIntegration: number) {
	await openCamelKTreeView();
	try {
		await waitUntil(() => {
			return extension.camelKIntegrationsProvider.getTreeNodes().length === alreadyDeployedIntegration;
		});
	} catch(error) {
		const currentIntegrations = extension.camelKIntegrationsProvider.getTreeNodes();
		assert.equal(
			currentIntegrations.length,
			alreadyDeployedIntegration,
			`It is expected that there is ${alreadyDeployedIntegration} Integration already deployed but the following are detected ${currentIntegrations.map(treeNode => treeNode.label).join(';')}`);
	}
	showQuickpickStub.onSecondCall().returns(IntegrationUtils.basicIntegration);
	telemetrySpy.resetHistory();
	await vscode.commands.executeCommand('camelk.startintegration');

	await checkIntegrationDeployed(alreadyDeployedIntegration + 1);
	await checkIntegrationRunning(alreadyDeployedIntegration);
}

export async function checkIntegrationRunning(indexOfNewDeployedIntegration :number) {
	try {
		let counter = 0;
		await waitUntil(() => {
			const treeNode = extension.camelKIntegrationsProvider.getTreeNodes()[indexOfNewDeployedIntegration];
			if (counter % 60000 === 0) {
				console.log(`Awaiting that the integration ${treeNode?.label} is running. Current waiting time is ${counter} ms and current status is ${treeNode?.status}`);
			}
			counter += 1000;
			return treeNode?.status === "Running";
		}, RUNNING_TIMEOUT, 1000);
	} catch (error) {
		console.log(error);
		assert.fail(`The integration has not been marked as Running in Camel K Integration provided view. Current status ${extension.camelKIntegrationsProvider.getTreeNodes()[0].status} \n${error}`);
	}
}

export async function checkIntegrationDeployed(expectedDeployedIntegration :number) {
	try {
		await waitUntil(() => {
			console.log(`Await that there are ${expectedDeployedIntegration} integrations listed in Tree`);	
			return extension.camelKIntegrationsProvider.getTreeNodes()?.length === expectedDeployedIntegration;
		}, DEPLOYED_TIMEOUT, 1000);
	} catch (error) {
		assert.fail('No integration has shown up in Camel K Integration provider view. (Nota: it requires that Camel K instance is reachable.)\n' + error);
	}
}

export async function createFile(showQuickpickStub: sinon.SinonStub<any[], any>,
	showWorkspaceFolderPickStub: sinon.SinonStub<any[], any>,
	showInputBoxStub: sinon.SinonStub<any[], any>,
	integrationName: string,
	language: string): Promise<vscode.Uri | undefined> {
	showQuickpickStub.onFirstCall().returns(language);
	const workspaceFolder = (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0];
	showWorkspaceFolderPickStub.returns(workspaceFolder);
	showInputBoxStub.onFirstCall().returns(integrationName);

	await vscode.commands.executeCommand('camelk.integrations.createNewIntegrationFile');
	const fileExtension = LANGUAGES_WITH_FILENAME_EXTENSIONS.get(language);

	try {
		await waitUntil(() => {
			return vscode.window.activeTextEditor?.document.fileName.endsWith(`${integrationName}.${fileExtension}`);
		}, EDITOR_OPENED_TIMEOUT, 1000);
	} catch (error) {
		assert.fail(`${integrationName}.${fileExtension} has not been opened in editor. Filename of currently opened editor: ${vscode.window.activeTextEditor?.document.fileName}`);
	}
	const uri = vscode.window.activeTextEditor?.document.uri;
	
	await checkCodelensForOpenedDocument(uri as vscode.Uri);
	
	return uri;
}

export function checkTelemetry(telemetrySpy: sinon.SinonSpy<any[], any>, languageExtension: string) {
	expect(telemetrySpy.calledOnce, `telemetry expected to be called once but was called ${telemetrySpy.callCount} time(s).\n${getTelemetryCallsContent(telemetrySpy)}`).true;
	const actualEvent: TelemetryEvent = telemetrySpy.getCall(0).args[0];
	expect(actualEvent.name).to.be.equal('command');
	expect(actualEvent.properties.identifier).to.be.equal(extension.COMMAND_ID_START_INTEGRATION);
	expect(actualEvent.properties.language).to.be.equal(languageExtension);
}

function getTelemetryCallsContent(telemetrySpy: sinon.SinonSpy<any[], any>): string {
	let res = '';
	telemetrySpy.getCalls().forEach(call => {
		call.args.forEach(telemetryEvent => {
			res += telemetryEvent.name + ';'
				+ 'identifier: ' + telemetryEvent.properties.identifier + ';'
				+ 'language: ' + telemetryEvent.properties.language + ';'
				+ 'kind: ' + telemetryEvent.properties.kind + '\n';
		});
	});
	return res;
}
