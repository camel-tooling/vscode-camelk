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

import * as extension from '../../extension';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as config from '../../config';
import * as IntegrationConstants from './../../IntegrationConstants';
import { skipOnJenkins, openCamelKTreeView } from "./Utils";
import { assert, expect } from 'chai';
import { waitUntil } from 'async-wait-until';
import { getNamedListFromKubernetesThenParseList } from '../../kubectlutils';
import * as shelljs from 'shelljs';
import * as kamel from './../../kamel';
import * as kubectl from './../../kubectl';
import { LANGUAGES, LANGUAGES_WITH_FILENAME_EXTENSIONS } from '../../IntegrationConstants';
import * as CamelKRunTaskDefinition from '../../task/CamelKRunTaskDefinition';
import { getTelemetryServiceInstance } from '../../Telemetry';
import { cleanDeployedIntegration, createFile, startIntegrationWithBasicCheck, checkTelemetry, checkIntegrationDeployed, checkIntegrationRunning } from './Utils/DeployTestUtil';

export const RUNNING_TIMEOUT = 720000;
export const DEPLOYED_TIMEOUT = 10000;
export const UNDEPLOY_TIMEOUT = 20000;
export const PROVIDER_POPULATED_TIMEOUT = 20000;
export const EDITOR_OPENED_TIMEOUT = 5000;
const TOTAL_TIMEOUT: number = RUNNING_TIMEOUT + DEPLOYED_TIMEOUT + EDITOR_OPENED_TIMEOUT + UNDEPLOY_TIMEOUT + PROVIDER_POPULATED_TIMEOUT;

const lineReturnAndSpaces = /\r?\n|\r|\s/g;

suite('Check can deploy default examples', () => {
	
	const EXTRA_NAMESPACE_FOR_TEST = 'namespace-for-deployment-test';
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

	teardown(async () => {
		showQuickpickStub.restore();
		showInputBoxStub.restore();
		showWorkspaceFolderPickStub.restore();
		if (createdFile && fs.existsSync(createdFile.fsPath)) {
			fs.unlinkSync(createdFile.fsPath);
		}
		await cleanDeployedIntegration(telemetrySpy);
		await config.addNamespaceToConfig(undefined);
		telemetrySpy.restore();
	});
	
	suite('Check basic deployments for each languages', function() {
		LANGUAGES.forEach(function(language) {
			const testInProgress = test(`Check can deploy ${language} example`, async() => {
				skipOnJenkins(testInProgress);
				createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, `TestBasic${language}Deploy`, language);
				
				await startIntegrationWithBasicCheck(showQuickpickStub, telemetrySpy, 0);
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
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onSecondCall().returns(IntegrationConstants.vscodeTasksIntegration);
		showQuickpickStub.onThirdCall().returns(CamelKRunTaskDefinition.NAME_OF_PROVIDED_TASK_TO_DEPLOY_IN_DEV_MODE_FROM_ACTIVE_EDITOR);
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithConfigMap = test('Check can deploy with a configmap', async() => {
		skipOnJenkins(testDeploymentWithConfigMap);
		const language = 'Java';
		createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, `Test${language}DeployWithConfigMap`, language);
		const kubectlPath = await kubectl.create().getPath();
		const confimapName = 'my-configmap';
		createConfigMap(kubectlPath, confimapName);
		
		await openCamelKTreeView();
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onSecondCall().returns(IntegrationConstants.configMapIntegration);
		showQuickpickStub.onThirdCall().returns(confimapName);
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
		
		await checkConfigMapAvailableForDeployedIntegration();
		
		shelljs.exec(`"${kubectlPath}" delete configmap ${confimapName}`);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithSecret = test('Check can deploy with a secret', async() => {
		skipOnJenkins(testDeploymentWithSecret);
		const language = 'Java';
		createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, `Test${language}DeployWithSecret`, language);
		const kubectlPath = await kubectl.create().getPath();
		const secretName = 'my-secret';
		createSecret(kubectlPath, secretName);
		
		await openCamelKTreeView();
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onSecondCall().returns(IntegrationConstants.secretIntegration);
		showQuickpickStub.onThirdCall().returns(secretName);
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
		
		shelljs.exec(`"${kubectlPath}" delete secret ${secretName}`);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithproperty = test('Check can deploy with a property', async() => {
		skipOnJenkins(testDeploymentWithproperty);
		const language = 'Java';
		createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, `Test${language}DeployWithProperty`, language);
		
		await openCamelKTreeView();
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onSecondCall().returns(IntegrationConstants.propertyIntegration);
		showInputBoxStub.onSecondCall().returns('propertyKey');
		showInputBoxStub.onThirdCall().returns('my Value');
		showQuickpickStub.onThirdCall().returns("No");
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
		
		await checkPropertyAvailableAvailableForDeployedIntegration();
		
	}).timeout(TOTAL_TIMEOUT);
	
	const testSpecificNamespace = test('Check can deploy on specific namespace', async () => {
		skipOnJenkins(testSpecificNamespace);
		await prepareNewNamespaceWithCamelK(EXTRA_NAMESPACE_FOR_TEST);
		createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, 'TestDeployInSpecificNamespace', 'Java');
		await config.addNamespaceToConfig(EXTRA_NAMESPACE_FOR_TEST);

		await startIntegrationWithBasicCheck(showQuickpickStub, telemetrySpy, 0);
		await checkIntegrationsInDifferentNamespaces(EXTRA_NAMESPACE_FOR_TEST);
		
		shelljs.exec(`"${await kubectl.create().getPath()}" delete namespace ${EXTRA_NAMESPACE_FOR_TEST}`);
	}).timeout(TOTAL_TIMEOUT);

});

async function checkConfigMapAvailableForDeployedIntegration() {
	const describeShell = shelljs.exec(`"${await kamel.create().getPath()}" describe integration test-java-deploy-with-config-map`);
	const description: string = describeShell.stdout;
	console.log('Check describe have config map: ' + description);
	expect(description.replace(lineReturnAndSpaces, '')).includes('Configuration:map[configs:[configmap:my-configmap]]');
}

async function checkPropertyAvailableAvailableForDeployedIntegration() {
	const describeShell = shelljs.exec(`"${await kamel.create().getPath()}" describe integration test-java-deploy-with-property`);
	const description: string = describeShell.stdout;
	expect(description).includes('propertyKey = my Value');
	expect(description.replace(lineReturnAndSpaces, '')).includes('Configuration:map[properties:[propertyKey=myValue]]');
}

function createConfigMap(kubectlPath: string, confimapName: string) {
	const createNamespaceExec = shelljs.exec(`"${kubectlPath}" create configmap ${confimapName} --from-literal=dummykey=dummyvalue`);
	assert.equal(createNamespaceExec.stderr, '');
	waitUntil(() => {
		return createNamespaceExec.stdout.includes(`configmap/${confimapName} created`);
	});
}

function createSecret(kubectlPath: string, confimapName: string) {
	const createNamespaceExec = shelljs.exec(`"${kubectlPath}" create secret generic ${confimapName} --from-literal=dummykey=dummyvalue`);
	assert.equal(createNamespaceExec.stderr, '');
	waitUntil(() => {
		return createNamespaceExec.stdout.includes(`secret/${confimapName} created`);
	});
}

async function checkIntegrationsInDifferentNamespaces(EXTRA_NAMESPACE_FOR_TEST: string) {
	const integrations = await getNamedListFromKubernetesThenParseList('integration', `--namespace=${EXTRA_NAMESPACE_FOR_TEST}`);
	expect(integrations).to.include('test-deploy-in-specific-namespace');
	const integrationsOnDefault = await getNamedListFromKubernetesThenParseList('integration', '--namespace=default');
	assert.isEmpty(integrationsOnDefault);
}

async function prepareNewNamespaceWithCamelK(EXTRA_NAMESPACE_FOR_TEST: string) {
	const kubectlPath = await kubectl.create().getPath();
	const createNamespaceExec = shelljs.exec(`"${kubectlPath}" create namespace ${EXTRA_NAMESPACE_FOR_TEST}`);
	assert.equal(createNamespaceExec.stderr, '');
	waitUntil(() => {
		return createNamespaceExec.stdout.includes(`namespace/${EXTRA_NAMESPACE_FOR_TEST} created`);
	});
	assert.include(shelljs.exec(`"${await kamel.create().getPath()}" install --namespace=${EXTRA_NAMESPACE_FOR_TEST}`).stdout, `Camel K installed in namespace ${EXTRA_NAMESPACE_FOR_TEST} \n`);
}
