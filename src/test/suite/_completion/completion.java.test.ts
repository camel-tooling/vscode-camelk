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

import * as extension from '../../../extension';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as JavaDependenciesManager from '../../../JavaDependenciesManager';
import { getDocUri, checkExpectedCompletion } from '../completion.util';
import { fail } from 'assert';
import * as Utils from '../Utils';
import { waitUntil } from 'async-wait-until';

const DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT = 600000;
const JAVA_EXTENSION_READINESS_TIMEOUT = 40000;
const TOTAL_TIMEOUT = DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT + JAVA_EXTENSION_READINESS_TIMEOUT + 5000;

// TODO: skipped on jenkins due to FUSETOOLS2-578
suite('Should do completion in Camel K standalone files', () => {
	
	const testVar = test('Completes from method for Java', async () => {
		const docUriJava = getDocUri('MyRouteBuilder.java');
		const expectedCompletion = { label: {
			description: 'RouteDefinition',
			detail: '(String uri) : RouteDefinition',
			label: 'from'
		}};
		Utils.skipOnJenkins(testVar);
		await testCompletion(docUriJava, new vscode.Position(5, 11), expectedCompletion, false);
	}).timeout(TOTAL_TIMEOUT);
	
	const testAdditionalDependencies = test('Completes additional dependencies', async () => {
		const docUriJava = getDocUri('MyRouteBuilderWithAdditionalDependencies.java');
		const expectedCompletion = { label: {
			description: 'org.apache.commons.math3.util',
			label: 'ArithmeticUtils'
		}};
		Utils.skipOnJenkins(testAdditionalDependencies);
		await testCompletion(docUriJava, new vscode.Position(6, 19), expectedCompletion, true);
	}).timeout(TOTAL_TIMEOUT);
});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletion: vscode.CompletionItem,
	refreshClasspath: boolean
) {
	let initialNumberOfDependencies = 0;
	await waitUntil(()=> {
		const destination = retrieveDestination();
		if(fs.existsSync(destination)) {
			initialNumberOfDependencies = fs.readdirSync(destination).length;
			return initialNumberOfDependencies >= 7;
		}
		return false;
	}, DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT, 5000).catch(() => {
		const destination = retrieveDestination();
		let messageForDownloaded: string;
		if(fs.existsSync(destination)) {
			messageForDownloaded = `The one that were downloaded in ${destination} are: ${fs.readdirSync(destination).join(';')}`;
		} else {
			messageForDownloaded = `The destination folder has not been created ${destination}`;
		}
		fail(`Camel Java dependencies not downloaded in reasonable time (${DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT}). ${messageForDownloaded}`);
	});

	const doc = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(doc);
	if(refreshClasspath) {
		await vscode.commands.executeCommand('camelk.classpath.refresh', docUri);
		await vscode.commands.executeCommand('camelk.classpath.refresh', docUri);
		await waitUntil(()=> {
			const destination = retrieveDestination();
			if(fs.existsSync(destination)) {
				console.log(`The one that were downloaded in ${destination} are: ${fs.readdirSync(destination).join(';')}`);
				return fs.readdirSync(destination).length > initialNumberOfDependencies;
			}
			return false;
		}, DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT, 5000).catch(() => {
			const destination = retrieveDestination();
			let messageForDownloaded: string;
			if(fs.existsSync(destination)) {
				messageForDownloaded = `The one that were downloaded in ${destination} are: ${fs.readdirSync(destination).join(';')}`;
			} else {
				messageForDownloaded = `The destination folder has not been created ${destination}`;
			}
			fail(`Additional Camel Java dependencies not downloaded in reasonable time (${DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT}). ${messageForDownloaded}`);
		});
	}
	let javaExtension: vscode.Extension<any> | undefined;
	await waitUntil(() => {
		javaExtension = vscode.extensions.getExtension('redhat.java');
		const isJavaExtensionActive = javaExtension?.isActive;
		if(isJavaExtensionActive) {
			try {
				return javaExtension?.exports?.status === "Started";
			} catch (error) {
				console.log(`Error when checking that java extension is started:\n${error}`);
				return false;
			}
		} else {
			return false;
		}
	}, JAVA_EXTENSION_READINESS_TIMEOUT).catch(() => {
		const iStartedMessage = javaExtension?.isActive ? (' is started? '+ (javaExtension?.exports?.status === "Started")) : '';
		fail(`VS Code Java extension problem not ready in ${JAVA_EXTENSION_READINESS_TIMEOUT}: is defined?`+ javaExtension
			+ ' is Active?' + javaExtension?.isActive
			+ iStartedMessage );
	});

	await checkExpectedCompletion(docUri, position, expectedCompletion);

	function retrieveDestination() {
		const context = extension.getStashedContext();
		return context !== undefined ? JavaDependenciesManager.destinationFolderForDependencies(context) : '';
	}
}
