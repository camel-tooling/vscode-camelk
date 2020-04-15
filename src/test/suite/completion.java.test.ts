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

import * as vscode from 'vscode';
import { areJavaDependenciesDownloaded } from '../../JavaDependenciesManager';
import { getDocUri, checkExpectedCompletion } from './completion.util';
import { fail } from 'assert';

const os = require('os');
const waitUntil = require('async-wait-until');

const DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT = 120000;
const JAVA_EXTENSION_READINESS_TIMEOUT = 20000;
const TOTAL_TIMEOUT = DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT + JAVA_EXTENSION_READINESS_TIMEOUT + 5000;

suite('Should do completion in Camel K standalone files', () => {

	const docUriJava = getDocUri('MyRouteBuilder.java');

	const expectedCompletion = { label: 'from(String uri) : RouteDefinition'};

	var testVar = test('Completes from method for Java', async () => {
		if(os.homedir().includes('hudson')) {
			testVar.skip();
		}
		await testCompletion(docUriJava, new vscode.Position(5, 11), expectedCompletion);
	}).timeout(TOTAL_TIMEOUT);

});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletion: vscode.CompletionItem
) {
	await waitUntil(()=> {
		return areJavaDependenciesDownloaded;
	}, DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT).catch(() => {
		fail(`Camel Java dependencies not downloaded in reasonable time (${DOWNLOAD_JAVA_DEPENDENCIES_TIMEOUT})`);
	});

	let doc = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(doc);
	let javaExtension: vscode.Extension<any> | undefined;
	await waitUntil(() => {
		javaExtension = vscode.extensions.getExtension('redhat.java');
		return javaExtension?.isActive && javaExtension?.exports.status === "Started";
	}, JAVA_EXTENSION_READINESS_TIMEOUT).catch(() => {
		fail(`VS Code Java extension problem not ready in ${JAVA_EXTENSION_READINESS_TIMEOUT}: is defined?`+ javaExtension
			+ ' is Active?' + javaExtension?.isActive
			+ ' is started? '+ (javaExtension?.exports.status === "Started"));
	});

	await checkExpectedCompletion(docUri, position, expectedCompletion);
}
