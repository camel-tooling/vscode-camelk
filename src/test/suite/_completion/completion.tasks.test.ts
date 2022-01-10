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

suite('Should do completion in tasks.json', () => {
	const docURiTasksJson = getDocUri('tasks.json');
	
	const testVar = test('Completes for Camel K template', async () => {
		skipOnJenkins(testVar);
		const expectedCompletion = { label: 'Camel K basic development mode' };
		await testCompletion(docURiTasksJson, new vscode.Position(3, 7), expectedCompletion);
	});

	const testTraits = test('Completes for traits', async () => {
		skipOnJenkins(testTraits);
		const expectedCompletion = { label: 'platform', documentation: `The platform trait is a base trait that is used to assign an integration platform to an integration. In case the platform is missing, the trait is allowed to create a default platform. This feature is especially useful in contexts where there's no need to provide a custom configuration for the platform (e.g. on OpenShift the default settings work, since there's an embedded container image registry).` };
		await testCompletion(docURiTasksJson, new vscode.Position(9, 23), expectedCompletion);
	});

	const testTraitProperties = test('Completes for trait properties', async () => {
		skipOnJenkins(testTraitProperties);
		const expectedCompletion = { label: 'enabled', insertText: 'enabled=false', documentation: 'Can be used to enable or disable a trait. All traits share this common property.' };
		await testCompletion(docURiTasksJson, new vscode.Position(17, 33), expectedCompletion);
	});

});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletion: vscode.CompletionItem
) {
	const doc = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(doc);
	await checkExpectedCompletion(docUri, position, expectedCompletion);
}
