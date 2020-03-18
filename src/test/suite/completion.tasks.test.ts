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
import { getDocUri, checkExpectedCompletion } from './completion.util';
const os = require('os');

suite('Should do completion in tasks.json', () => {
	const docURiTasksJson = getDocUri('tasks.json');
	
	var testVar = test('Completes for Camel K template', async () => {
		assumeNotOnJenkins(testVar);
		const expectedCompletion = { label: 'Camel K basic development mode' };
		await testCompletion(docURiTasksJson, new vscode.Position(3, 7), expectedCompletion);
	});

	var testTraits = test('Completes for traits', async () => {
		assumeNotOnJenkins(testTraits);
		const expectedCompletion = { label: 'platform' };
		await testCompletion(docURiTasksJson, new vscode.Position(9, 23), expectedCompletion);
	});

});

function assumeNotOnJenkins(testVar: Mocha.Test) {
	if (os.homedir().includes('hudson')) {
		testVar.skip();
	}
}

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletion: vscode.CompletionItem
) {
	let doc = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(doc);
	await checkExpectedCompletion(docUri, position, expectedCompletion);
}
