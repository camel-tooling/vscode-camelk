/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import { assert, expect } from "chai";
import * as extension from '../../../extension';
import * as vscode from 'vscode';
import { getDocUri } from '../completion.util';

suite("Start Integration CodeLenses Test", function () {
	
	test("Codelens provider returns correct CodeLens for yaml file with modeline and without filename following pattern", async () => {
		console.log('starting test Start Integration CodeLenses Test: Codelens provider returns correct CodeLens for yaml file with modeline and without filename following pattern ')
		const doc = getDocUri('test-codelens-with-modeline.yaml');
		await vscode.workspace.openTextDocument(doc);
		console.log('Document opened');

		await checkCodelensForOpenedDocument(doc);
	});

	test("Codelens provider returns correct CodeLens for yaml file with camelk filename pattern and without modeline", async () => {
		const doc = getDocUri('test-codelens.camelk.yaml');
		await vscode.workspace.openTextDocument(doc);

		await checkCodelensForOpenedDocument(doc);
	});

	test("No codelenses without camel-k modeline on Java file", async () => {
		const docUriJava = getDocUri('MyRouteBuilder.java');
		await vscode.window.showTextDocument(docUriJava);

		const codeLenses = await retrieveCodeLensOnOpenedDocument(docUriJava);

		assert.isNotNull(codeLenses as vscode.CodeLens[]);
		expect(codeLenses as vscode.CodeLens[]).has.length(0);
	});

	test("Codelens available on a Java file with a modeline", async () => {
		const docUriJava = getDocUri('MyRouteBuilderWithAdditionalDependencies.java');
		await vscode.window.showTextDocument(docUriJava);

		await checkCodelensForOpenedDocument(docUriJava);
	});

});

export async function checkCodelensForOpenedDocument(uri: vscode.Uri) {
	const codeLenses: vscode.CodeLens[] | undefined = await retrieveCodeLensOnOpenedDocument(uri);
	checkCodeLens(codeLenses as vscode.CodeLens[]);
}

async function retrieveCodeLensOnOpenedDocument(uri: vscode.Uri): Promise<vscode.CodeLens[] | undefined> {
	return vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri);
}

function checkCodeLens(codeLenses: vscode.CodeLens[]) {
	const startIntegrationCodeLenses = codeLenses.filter(codelens => {
		return codelens.command?.command === extension.COMMAND_ID_START_INTEGRATION;
	});
	expect(startIntegrationCodeLenses).has.length(1);
	const codeLens: vscode.CodeLens = startIntegrationCodeLenses[0];
	expect(codeLens.isResolved).to.be.true;
}
