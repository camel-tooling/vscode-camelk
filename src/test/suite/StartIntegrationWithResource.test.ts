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
import * as IntegrationConstants from '../../IntegrationConstants';
import { skipOnJenkins, openCamelKTreeView, skipIfNoCamelKInstance } from "./Utils";
import { assert, expect } from 'chai';
import * as shelljs from 'shelljs';
import * as kamel from '../../kamel';
import { getTelemetryServiceInstance } from '../../Telemetry';
import { cleanDeployedIntegration, checkIntegrationDeployed, checkIntegrationRunning, openCamelFile } from './Utils/DeployTestUtil';
import * as tmp from 'tmp';

export const RUNNING_TIMEOUT = 720000;
export const DEPLOYED_TIMEOUT = 10000;
export const UNDEPLOY_TIMEOUT = 20000;
export const PROVIDER_POPULATED_TIMEOUT = 20000;
export const EDITOR_OPENED_TIMEOUT = 5000;
const TOTAL_TIMEOUT: number = RUNNING_TIMEOUT + DEPLOYED_TIMEOUT + EDITOR_OPENED_TIMEOUT + UNDEPLOY_TIMEOUT + PROVIDER_POPULATED_TIMEOUT;

suite('Check can deploy with resource', () => {
	
	let showQuickpickStub: sinon.SinonStub;
	let showOpenDialogStub: sinon.SinonStub;
	let telemetrySpy: sinon.SinonSpy;

	setup(async() => {
		showQuickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog');
		// Workaround due to bug in shelljs: https://github.com/shelljs/shelljs/issues/704
		const nodePath = shelljs.which('node');
		shelljs.config.execPath = nodePath ? nodePath.toString() : '';
		telemetrySpy = sinon.spy(await getTelemetryServiceInstance(), 'send');
	});

	teardown(async () => {
		showQuickpickStub.restore();
		showOpenDialogStub.restore();
		await cleanDeployedIntegration(telemetrySpy);
		await config.addNamespaceToConfig(undefined);
		await config.addOperatorIdToConfig(undefined);
		telemetrySpy.restore();
		tmp.setGracefulCleanup();
	});
	
	const testDeploymentWithResource = test('Check can deploy with a single resource', async() => {
		skipOnJenkins(testDeploymentWithResource);
		skipIfNoCamelKInstance(testDeploymentWithResource);
		const resource = tmp.fileSync({ prefix: "simple" });
		await testDeployWithResources([resource], showQuickpickStub, showOpenDialogStub);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithResourceInPathWithSpace = test('Check can deploy with a single resource with space in path', async() => {
		skipOnJenkins(testDeploymentWithResourceInPathWithSpace);
		skipIfNoCamelKInstance(testDeploymentWithResourceInPathWithSpace);
		const dir = tmp.dirSync({prefix: "with a space"}).name;
		const resource = tmp.fileSync({ dir: dir, prefix: "simpleWithParentFolderHavingSpace" });
		expect(resource.name).includes(' ');
		await testDeployWithResources([resource], showQuickpickStub, showOpenDialogStub);
	}).timeout(TOTAL_TIMEOUT);
	
	const testDeploymentWithSeveralResources = test('Check can deploy with several resources', async() => {
		skipOnJenkins(testDeploymentWithSeveralResources);
		skipIfNoCamelKInstance(testDeploymentWithSeveralResources);
		const resource1 = tmp.fileSync({ prefix: "simple1" });
		const resource2 = tmp.fileSync({ prefix: "simple2" });
		await testDeployWithResources([resource1, resource2], showQuickpickStub, showOpenDialogStub);
	}).timeout(TOTAL_TIMEOUT);
	
});

async function testDeployWithResources(resources: tmp.FileResult[], showQuickpickStub: sinon.SinonStub<any[], any>, showOpenDialogStub: sinon.SinonStub<any[], any>) {
	const uriOfResources = resources.map(resource => {return vscode.Uri.file(resource.name);});
	const createdFile: vscode.Uri | undefined = await openCamelFile('TestJavaDeployWithResources.java');

	await openCamelKTreeView();
	assert.isEmpty(extension.camelKIntegrationsProvider.getTreeNodes());
	showQuickpickStub.reset();
	showQuickpickStub.onFirstCall().returns(IntegrationConstants.resourceIntegration);
	showOpenDialogStub.onFirstCall().returns(uriOfResources);

	await vscode.commands.executeCommand('camelk.startintegration');

	await checkIntegrationDeployed(1);
	await checkIntegrationRunning(0);

	const filenames = uriOfResources.map(uriOfResource => uriOfResource.fsPath.substring(uriOfResource.fsPath.lastIndexOf('/') + 1));
	await checkResourcesAvailableForDeployedIntegration(filenames);
	return createdFile;
}

async function checkResourcesAvailableForDeployedIntegration(fileNames: string[]) {
	const describeShell = shelljs.exec(`"${await kamel.create().getPath()}" describe integration test-java-deploy-with-resources`);
	const description: string = describeShell.stdout;
	console.log('Description for deployment with resources: ' + description);
	const lineReturnAndSpaces = /\r?\n|\r|\s/g;
	const descWithoutLineReturnAndSpaces = description.replace(lineReturnAndSpaces, '');
	const configuration = descWithoutLineReturnAndSpaces.substring(descWithoutLineReturnAndSpaces.indexOf('Traits:Mount:Configuration:') + 'Traits:Mount:Configuration:'.length);
	console.log(`configuration to check: ${configuration}`);
	for (const fileName of fileNames) {
		expect(configuration).contains(fileName);
	}
}
