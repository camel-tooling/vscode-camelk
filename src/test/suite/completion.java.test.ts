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

import * as path from 'path';
import * as vscode from 'vscode';

const waitUntil = require('async-wait-until');

const getDocPath = (p: string) => {
	return path.resolve(__dirname, '../../../../testFixture', p);
};
const getDocUri = (p: string) => {
	return vscode.Uri.file(getDocPath(p));
};

suite('Should do completion in Camel K standalone files', () => {

	const docUriJava = getDocUri('MyRouteBuilder.java');

	const expectedCompletion = { label: 'from(String uri) : RouteDefinition'};

	test('Completes from method for Java', async () => {
		await testCompletion(docUriJava, new vscode.Position(5, 11), expectedCompletion);
	}).timeout(60000);

});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletion: vscode.CompletionItem
) {
	let doc = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(doc);
	await waitUntil(() => {
		let javaExtension = vscode.extensions.getExtension('redhat.java');
		return javaExtension?.isActive && javaExtension?.exports.status === "Started";
	}, 20000);

	let hasExpectedCompletion = false;
	await waitUntil(() => {
		// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
		(vscode.commands.executeCommand(
			'vscode.executeCompletionItemProvider',
			docUri,
			position
		)).then(value => {
			let actualCompletionList = value as vscode.CompletionList;
			const actualCompletionLabelList = actualCompletionList.items.map(c => { return c.label; });
			hasExpectedCompletion = actualCompletionLabelList.includes(expectedCompletion.label);
		});
		return hasExpectedCompletion;
	}, 10000, 500);

}
