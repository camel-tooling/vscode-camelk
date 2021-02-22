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
import { getDocUri, checkExpectedCompletion } from '../completion.util';
import { skipOnJenkins } from '../Utils';
import { waitUntil } from 'async-wait-until';

suite('Should do completion in yaml Camel K files without file name pattern', () => {
	
	const testSecondLevel = test('Completes for second level', async () => {
		const docURiTasksJson = getDocUri('camelkwithoutsuffix-withfirstlevel.yaml');
		skipOnJenkins(testSecondLevel);
		const expectedCompletion = { label: 'steps' };
		await testCompletion(docURiTasksJson, new vscode.Position(2, 4), expectedCompletion);
	});
	
	const testFirstLevel = test('Completes for first level', async () => {
		const docURiTasksJson = getDocUri('camelkwithoutsuffix.yaml');
		skipOnJenkins(testFirstLevel);
		const expectedCompletion = { label: 'from' };
		await testCompletion(docURiTasksJson, new vscode.Position(1, 2), expectedCompletion);
	});

});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletion: vscode.CompletionItem
) {
	await vscode.window.showTextDocument(docUri, {preview: false});
	waitUntil(() => {
		return vscode.workspace.textDocuments.length > 0;
	});
	
	await checkExpectedCompletion(docUri, position, expectedCompletion);
}
