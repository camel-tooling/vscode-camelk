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
import * as CamelKRunTaskDefinition from '../../task/CamelKRunTaskDefinition';
import { getTelemetryServiceInstance } from '../../Telemetry';
import { cleanDeployedIntegration, startIntegrationWithBasicCheck, checkTelemetry, checkIntegrationDeployed, checkIntegrationRunning, openCamelFile } from './Utils/DeployTestUtil';
import { LANGUAGES } from './../../IntegrationConstants';

export const RUNNING_TIMEOUT = 720000;
export const DEPLOYED_TIMEOUT = 10000;
export const UNDEPLOY_TIMEOUT = 20000;
export const PROVIDER_POPULATED_TIMEOUT = 20000;
export const EDITOR_OPENED_TIMEOUT = 5000;
const TOTAL_TIMEOUT: number = RUNNING_TIMEOUT + DEPLOYED_TIMEOUT + EDITOR_OPENED_TIMEOUT + UNDEPLOY_TIMEOUT + PROVIDER_POPULATED_TIMEOUT;

const lineReturnAndSpaces = /\r?\n|\r|\s/g;

suite('Check can deploy default examples', () => {
	
	const EXTRA_NAMESPACE_FOR_TEST = 'namespace-for-deployment-test';
	const EXTRA_OPERATOR_ID_FOR_TEST = 'operator-id-for-deployment-test';
	let showQuickpickStub: sinon.SinonStub;
	let showInputBoxStub: sinon.SinonStub;
	let telemetrySpy: sinon.SinonSpy;

	setup(async() => {
		showQuickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
		// Workaround due to bug in shelljs: https://github.com/shelljs/shelljs/issues/704
		const nodePath = shelljs.which('node');
		shelljs.config.execPath = nodePath ? nodePath.toString() : '';
		telemetrySpy = sinon.spy(await getTelemetryServiceInstance(), 'send');
	});

	teardown(async () => {
		showQuickpickStub.restore();
		showInputBoxStub.restore();
		await cleanDeployedIntegration(telemetrySpy);
		await config.addNamespaceToConfig(undefined);
		await config.addOperatorIdToConfig(undefined);
		telemetrySpy.restore();
	});
	
	suite('Check basic deployments for each languages', function() {
		LANGUAGES.forEach(function(language) {
			const testInProgress = test(`Check can deploy ${language} example`, async() => {
				skipOnJenkins(testInProgress);
				const fileName = language === 'Java' ? `TestBasic${language}Deploy.java` : `TestBasic${language}Deploy.camel.${language.toLowerCase()}`
				await openCamelFile(fileName);
				
				await startIntegrationWithBasicCheck(showQuickpickStub, telemetrySpy, 0);
				const extensionFile = IntegrationConstants.LANGUAGES_WITH_FILENAME_EXTENSIONS.get(language);
				checkTelemetry(telemetrySpy, extensionFile ? extensionFile : "");
			}).timeout(TOTAL_TIMEOUT);
		});
	});
	
	const testDeploymentUsingDefaultTask = test('Check can deploy from a task', async() => {
		skipOnJenkins(testDeploymentUsingDefaultTask);
		await openCamelFile('TestJavaDeployFromTask.java');
		await openCamelKTreeView();
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onFirstCall().returns(IntegrationConstants.vscodeTasksIntegration);
		showQuickpickStub.onSecondCall().returns(CamelKRunTaskDefinition.NAME_OF_PROVIDED_TASK_TO_DEPLOY_IN_DEV_MODE_FROM_ACTIVE_EDITOR);
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithConfigMap = test('Check can deploy with a configmap', async() => {
		skipOnJenkins(testDeploymentWithConfigMap);
		await openCamelFile('TestJavaDeployWithConfigMap.java');
		const kubectlPath = await kubectl.create().getPath();
		const confimapName = 'my-configmap';
		createConfigMap(kubectlPath, confimapName);
		
		await openCamelKTreeView();
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onFirstCall().returns(IntegrationConstants.configMapIntegration);
		showQuickpickStub.onSecondCall().returns(confimapName);
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
		
		await checkConfigMapAvailableForDeployedIntegration();
		
		shelljs.exec(`"${kubectlPath}" delete configmap ${confimapName}`);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithSecret = test('Check can deploy with a secret', async() => {
		skipOnJenkins(testDeploymentWithSecret);
		await openCamelFile('TestJavaDeployWithSecret.java');
		const kubectlPath = await kubectl.create().getPath();
		const secretName = 'my-secret';
		createSecret(kubectlPath, secretName);
		
		await openCamelKTreeView();
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onFirstCall().returns(IntegrationConstants.secretIntegration);
		showQuickpickStub.onSecondCall().returns(secretName);
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
		
		shelljs.exec(`"${kubectlPath}" delete secret ${secretName}`);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithproperty = test('Check can deploy with a property', async() => {
		skipOnJenkins(testDeploymentWithproperty);
		await openCamelFile('TestJavaDeployWithProperty.java');
		
		await openCamelKTreeView();
		assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
		showQuickpickStub.onFirstCall().returns(IntegrationConstants.propertyIntegration);
		showInputBoxStub.onFirstCall().returns('propertyKey');
		showInputBoxStub.onSecondCall().returns('my Value');
		showQuickpickStub.onSecondCall().returns("No");
		
		await vscode.commands.executeCommand('camelk.startintegration');

		await checkIntegrationDeployed(1);
		await checkIntegrationRunning(0);
		
		await checkPropertyAvailableAvailableForDeployedIntegration();
		
	}).timeout(TOTAL_TIMEOUT);
	
	const testSpecificNamespace = test('Check can deploy on specific namespace', async () => {
		skipOnJenkins(testSpecificNamespace);
		await prepareNewNamespaceWithCamelK(EXTRA_NAMESPACE_FOR_TEST, EXTRA_OPERATOR_ID_FOR_TEST);
		await openCamelFile('TestDeployInSpecificNamespace.java');
		await config.addNamespaceToConfig(EXTRA_NAMESPACE_FOR_TEST);
		await config.addOperatorIdToConfig(EXTRA_OPERATOR_ID_FOR_TEST);

		await startIntegrationWithBasicCheck(showQuickpickStub, telemetrySpy, 0);
		await checkIntegrationsInDifferentNamespaces(EXTRA_NAMESPACE_FOR_TEST);
		
		shelljs.exec(`"${await kubectl.create().getPath()}" delete namespace ${EXTRA_NAMESPACE_FOR_TEST}`);
	}).timeout(TOTAL_TIMEOUT);

});

async function checkConfigMapAvailableForDeployedIntegration() {
	const describeShell = shelljs.exec(`"${await kamel.create().getPath()}" describe integration test-java-deploy-with-config-map`);
	const description: string = describeShell.stdout;
	console.log('Check describe have config map: ' + description);
	expect(description.replace(lineReturnAndSpaces, '')).includes('Configs:[configmap:my-configmap]');
}

async function checkPropertyAvailableAvailableForDeployedIntegration() {
	const describeShell = shelljs.exec(`"${await kamel.create().getPath()}" describe integration test-java-deploy-with-property`);
	const description: string = describeShell.stdout;
	expect(description).includes('propertyKey = my Value');
	expect(description.replace(lineReturnAndSpaces, '')).includes('Properties:[propertyKey=myValue]');
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

async function prepareNewNamespaceWithCamelK(namespace: string, operatorId: string) {
	const kubectlPath = await kubectl.create().getPath();
	const createNamespaceExec = shelljs.exec(`"${kubectlPath}" create namespace ${namespace}`);
	assert.equal(createNamespaceExec.stderr, '');
	await waitUntil(() => {
		return createNamespaceExec.stdout.includes(`namespace/${namespace} created`);
	});
	const installKamelExec = shelljs.exec(`"${await kamel.create().getPath()}" install --global --olm=false --namespace=${namespace} --operator-id=${operatorId}`);
	try {
		await waitUntil(() => {
			return installKamelExec.stdout.includes(`Camel K installed in namespace ${namespace}`);
		});
	} catch (error) {
		assert.fail(`Camel K not succesfully installed in namespace ${namespace}.\nstdout:\n${installKamelExec.stdout}\nstderr:\n${installKamelExec.stderr}`);
	} 
}
