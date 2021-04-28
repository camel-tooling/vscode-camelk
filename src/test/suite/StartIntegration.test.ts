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

import * as fs from 'fs';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as config from '../../config';
import * as IntegrationUtils from '../../IntegrationUtils';
import { skipOnJenkins, getCamelKIntegrationsProvider, openCamelKTreeView } from "./Utils";
import { assert, expect } from 'chai';
import { waitUntil } from 'async-wait-until';
import { getNamedListFromKubernetesThenParseList } from '../../kubectlutils';
import * as shelljs from 'shelljs';
import * as extension from '../../extension';
import * as kamel from './../../kamel';
import * as kubectl from './../../kubectl';
import { LANGUAGES, LANGUAGES_WITH_FILENAME_EXTENSIONS } from '../../commands/NewIntegrationFileCommand';
import * as CamelKTaskDefinition from '../../task/CamelKTaskDefinition';
import { getTelemetryServiceInstance } from '../../Telemetry';
import { TelemetryEvent } from '@redhat-developer/vscode-redhat-telemetry/lib';

const RUNNING_TIMEOUT: number = 720000;
const DEPLOYED_TIMEOUT: number = 10000;
const UNDEPLOY_TIMEOUT: number = 10000;
const EDITOR_OPENED_TIMEOUT: number = 5000;
const TOTAL_TIMEOUT: number = RUNNING_TIMEOUT + DEPLOYED_TIMEOUT + EDITOR_OPENED_TIMEOUT + UNDEPLOY_TIMEOUT;

suite('Check can deploy default examples', () => {
	
	const EXTRA_NAMESPACE_FOR_TEST: string = 'namespace-for-deployment-test';
	let showQuickpickStub: sinon.SinonStub;
	let showInputBoxStub: sinon.SinonStub;
	let showWorkspaceFolderPickStub: sinon.SinonStub;
	let createdFile: vscode.Uri | undefined;
	let telemetrySpy: sinon.SinonSpy;

	setup(async() => {
		showQuickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
		showWorkspaceFolderPickStub = sinon.stub(vscode.window, 'showWorkspaceFolderPick');
		// Workaround due to bug in shelljs: https://github.com/shelljs/shelljs/issues/704
		shelljs.config.execPath = shelljs.which('node').toString();
		telemetrySpy = sinon.spy(await getTelemetryServiceInstance(), 'send');
	});

	teardown(() => {
		showQuickpickStub.restore();
		showInputBoxStub.restore();
		showWorkspaceFolderPickStub.restore();
		if (createdFile && fs.existsSync(createdFile.fsPath)) {
			fs.unlinkSync(createdFile.fsPath);
		}
		const deployedTreeNode = getCamelKIntegrationsProvider().getTreeNodes()[0];
		if(deployedTreeNode) {
			vscode.commands.executeCommand('camelk.integrations.remove', deployedTreeNode);
			waitUntil(() => {
				return getCamelKIntegrationsProvider().getTreeNodes().length === 0;
			}, UNDEPLOY_TIMEOUT);
		}
		config.addNamespaceToConfig(undefined);
		telemetrySpy.restore();
	});
	
	suite('Check basic deployments for each languages', function() {
		LANGUAGES.forEach(function(language) {
			const testInProgress = test(`Check can deploy ${language} example`, async() => {
				skipOnJenkins(testInProgress);
				createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, `TestBasic${language}Deploy`, language);
				
				await startIntegrationWithBasicCheck(showQuickpickStub, telemetrySpy);
				const extensionFile = LANGUAGES_WITH_FILENAME_EXTENSIONS.get(language);
				checkTelemetry(telemetrySpy, extensionFile ? extensionFile : "");
			}).timeout(TOTAL_TIMEOUT);
		});
	});
	
	const testDeploymentUsingDefaultTask = test('Check can deploy from a task', async() => {
		skipOnJenkins(testDeploymentUsingDefaultTask);
		const language = 'Java';
		createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, `Test${language}DeployFromTask`, language);
		await openCamelKTreeView();
		assert.isEmpty(getCamelKIntegrationsProvider().getTreeNodes());
		showQuickpickStub.onSecondCall().returns(IntegrationUtils.vscodeTasksIntegration);
		showQuickpickStub.onThirdCall().returns(CamelKTaskDefinition.NAME_OF_PROVIDED_TASK_TO_DEPLOY_IN_DEV_MODE_FROM_ACTIVE_EDITOR);
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed();
		await checkIntegrationRunning();
	}).timeout(TOTAL_TIMEOUT);
	
	const testSpecificNamespace = test('Check can deploy on specific namespace', async () => {
		skipOnJenkins(testSpecificNamespace);
		await prepareNewNamespaceWithCamelK(EXTRA_NAMESPACE_FOR_TEST);
		createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, 'TestDeployInSpecificNamespace', 'Java');
		await config.addNamespaceToConfig(EXTRA_NAMESPACE_FOR_TEST);

		await startIntegrationWithBasicCheck(showQuickpickStub, telemetrySpy);
		await checkIntegrationsInDifferentNamespaces(EXTRA_NAMESPACE_FOR_TEST);
		
		shelljs.exec(`${await kubectl.create().getPath()} delete namespace ${EXTRA_NAMESPACE_FOR_TEST}`);
	}).timeout(TOTAL_TIMEOUT);

});

async function checkIntegrationsInDifferentNamespaces(EXTRA_NAMESPACE_FOR_TEST: string) {
	const integrations = await getNamedListFromKubernetesThenParseList('integration', `--namespace=${EXTRA_NAMESPACE_FOR_TEST}`);
	expect(integrations).to.include('test-deploy-in-specific-namespace');
	const integrationsOnDefault = await getNamedListFromKubernetesThenParseList('integration', '--namespace=default');
	assert.isEmpty(integrationsOnDefault);
}

async function startIntegrationWithBasicCheck(showQuickpickStub: sinon.SinonStub<any[], any>, telemetrySpy: sinon.SinonSpy) {
	await openCamelKTreeView();
	const currentIntegrations = getCamelKIntegrationsProvider().getTreeNodes();
	assert.isEmpty(
		currentIntegrations,
		`It is expected that there is no Integration already deployed but the following are detected ${currentIntegrations.map(treeNode => treeNode.label).join(';')}`);

	showQuickpickStub.onSecondCall().returns(IntegrationUtils.basicIntegration);
	telemetrySpy.resetHistory();
	await vscode.commands.executeCommand('camelk.startintegration');

	await checkIntegrationDeployed();
	await checkIntegrationRunning();
}

async function prepareNewNamespaceWithCamelK(EXTRA_NAMESPACE_FOR_TEST: string) {
	const kubectlPath = await kubectl.create().getPath();
	const createNamespaceExec = shelljs.exec(`${kubectlPath} create namespace ${EXTRA_NAMESPACE_FOR_TEST}`);
	assert.equal(createNamespaceExec.stderr, '');
	waitUntil(() => {
		return createNamespaceExec.stdout.includes(`namespace/${EXTRA_NAMESPACE_FOR_TEST} created`);
	});
	assert.include(shelljs.exec(`${await kamel.create().getPath()} install --namespace=${EXTRA_NAMESPACE_FOR_TEST}`).stdout, `Camel K installed in namespace ${EXTRA_NAMESPACE_FOR_TEST} \n`);
}

async function checkIntegrationRunning() {
	try {
		await waitUntil(() => {
			return getCamelKIntegrationsProvider().getTreeNodes()[0]?.status === "Running";
		}, RUNNING_TIMEOUT, 1000);
	} catch (error) {
		assert.fail(`The integration has not been marked as Running in Camel K Integration provided view. Current status ${getCamelKIntegrationsProvider().getTreeNodes()[0].status} \n${error}`);
	}
}

async function checkIntegrationDeployed() {
	try {
		await waitUntil(() => {
			return getCamelKIntegrationsProvider().getTreeNodes()?.length === 1;
		}, DEPLOYED_TIMEOUT, 1000);
	} catch (error) {
		assert.fail('No integration has shown up in Camel K Integration provider view. (Nota: it requires that Camel K instance is reachable.)\n' + error);
	}
}

async function createFile(showQuickpickStub: sinon.SinonStub<any[], any>,
	showWorkspaceFolderPickStub: sinon.SinonStub<any[], any>,
	showInputBoxStub: sinon.SinonStub<any[], any>,
	integrationName: string,
	language: string): Promise<vscode.Uri | undefined>{
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
	return vscode.window.activeTextEditor?.document.uri;
}

function checkTelemetry(telemetrySpy: sinon.SinonSpy<any[], any>, languageExtension: string) {
	expect(telemetrySpy.calledOnce, `telemetry expected to be called once but was called ${telemetrySpy.callCount}`).true;
	const actualEvent: TelemetryEvent = telemetrySpy.getCall(0).args[0];
	expect(actualEvent.name).to.be.equal('command');
	expect(actualEvent.properties.identifier).to.be.equal(extension.COMMAND_ID_START_INTEGRATION);
	expect(actualEvent.properties.language).to.be.equal(languageExtension);
}
