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
import { skipOnJenkins } from "./Utils";
import * as shelljs from 'shelljs';
import { LANGUAGES_WITH_FILENAME_EXTENSIONS } from '../../commands/NewIntegrationFileCommand';
import { getTelemetryServiceInstance } from '../../Telemetry';
import { cleanDeployedIntegration, createFile, startIntegrationWithBasicCheck, checkTelemetry} from './Utils/DeployTestUtil';
import { CamelKDebugTaskProvider } from '../../task/CamelKDebugTaskDefinition';
import { waitUntil } from 'async-wait-until';
import { fail } from 'assert';
import { assert } from 'chai';

export const RUNNING_TIMEOUT: number = 720000;
export const DEPLOYED_TIMEOUT: number = 10000;
export const UNDEPLOY_TIMEOUT: number = 20000;
export const PROVIDER_POPULATED_TIMEOUT: number = 20000;
export const EDITOR_OPENED_TIMEOUT: number = 5000;
const TOTAL_TIMEOUT: number = RUNNING_TIMEOUT + DEPLOYED_TIMEOUT + EDITOR_OPENED_TIMEOUT + UNDEPLOY_TIMEOUT + PROVIDER_POPULATED_TIMEOUT;

suite('Check can debug default Java example', () => {
	
	let showQuickpickStub: sinon.SinonStub;
	let showInputBoxStub: sinon.SinonStub;
	let showWorkspaceFolderPickStub: sinon.SinonStub;
	let createdFile: vscode.Uri | undefined;
	let telemetrySpy: sinon.SinonSpy;
	let debugConfigurationTaskExecution: vscode.TaskExecution | undefined;

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
		await cleanDeployedIntegration();
		await config.addNamespaceToConfig(undefined);
		telemetrySpy.restore();
		if(debugConfigurationTaskExecution) {
			debugConfigurationTaskExecution.terminate();
		}
		await vscode.debug.stopDebugging();
	});
	
	const testInProgress = test(`Check can debug Java example`, async() => {
		skipOnJenkins(testInProgress);
		createdFile = await createAndDeployIntegration(createdFile, showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, telemetrySpy);
		const debugActivationTask = await createCamelKDebugTask();
		
		debugConfigurationTaskExecution = await vscode.tasks.executeTask(debugActivationTask);
		
		await checkDebugPortReportedAsReady();
		await checkJavaDebugConnection();
	}).timeout(TOTAL_TIMEOUT);
	
});

async function createAndDeployIntegration(createdFile: vscode.Uri | undefined, showQuickpickStub: sinon.SinonStub<any[], any>, showWorkspaceFolderPickStub: sinon.SinonStub<any[], any>, showInputBoxStub: sinon.SinonStub<any[], any>, telemetrySpy: sinon.SinonSpy<any[], any>) {
	const language = 'Java';
	createdFile = await createFile(showQuickpickStub, showWorkspaceFolderPickStub, showInputBoxStub, `Test${language}Debug`, language);
	await startIntegrationWithBasicCheck(showQuickpickStub, telemetrySpy);
	const extensionFile = LANGUAGES_WITH_FILENAME_EXTENSIONS.get(language);
	checkTelemetry(telemetrySpy, extensionFile ? extensionFile : "");
	return createdFile;
}

async function createCamelKDebugTask() {
	const debugTaskDefinition = {
		"type": CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE,
		"integrationName": "test-java-debug"
	};
	return await new CamelKDebugTaskProvider().getDebugTask(debugTaskDefinition);
}

async function checkJavaDebugConnection() {
	console.log('Start checking Java debug connection is working');
	const workspaceFolderList = vscode.workspace.workspaceFolders;
	if (workspaceFolderList) {
		console.log(`Start debugging in this folder: ${workspaceFolderList[0].uri.fsPath}`);
		assert.isTrue(await vscode.debug.startDebugging(workspaceFolderList[0], "Attach Java Process to port 5005"));
	} else {
		fail('Missing a workspace folder');
	}
	console.log('Checked that Java debug connection is working');
}

async function checkDebugPortReportedAsReady() {
	let currentTerminalContent = '';
	try {
		await waitUntil(() => {
			getActiveTerminalOutput().then(content => {
				currentTerminalContent = content;
			});
			return currentTerminalContent.includes('Listening for transport dt_socket at address: 5005');
		}, 30000, 1000);
	} catch (error) {
		console.log('Latest content retrieved in terminal:\n' + currentTerminalContent);
		throw error;
	}
}

async function getActiveTerminalOutput() : Promise<string> {
	const term = vscode.window.activeTerminal;
	console.log(`-current terminal = ${term?.name}`);
	await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
	await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
	await vscode.commands.executeCommand('workbench.action.terminal.clearSelection');	
	const clipboard_content = await vscode.env.clipboard.readText();
	return clipboard_content.trim();
}
