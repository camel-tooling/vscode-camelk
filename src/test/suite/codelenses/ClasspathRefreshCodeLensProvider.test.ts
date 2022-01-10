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
import { ClasspathRefreshCodeLensProvider } from '../../../codelenses/ClasspathRefreshCodeLensProvider';
import * as extension from '../../../extension';
import * as vscode from 'vscode';
import { getDocUri } from "../completion.util";
 
 suite("Classpath refresh CodeLenses Test", function() {
 
	test("Codelens provider returns correct CodeLens", async() => {
		const documentWithModeline = await vscode.workspace.openTextDocument({
			language: 'java',
			content: '// camel-k:'
		});
		
		const codeLenses = await new ClasspathRefreshCodeLensProvider().provideCodeLenses(documentWithModeline);
		checkCodeLens(codeLenses as vscode.CodeLens[]);
	});
	
	test("No codelenses without camel-k modeline", async() => {
		const documentWithModeline = await vscode.workspace.openTextDocument({
			language: 'java',
			content: 'dummy, not camel-k modeline'
		});
		
		const codeLenses: vscode.CodeLens[] | null | undefined =
					await new ClasspathRefreshCodeLensProvider().provideCodeLenses(documentWithModeline);
		assert.isNotNull(codeLenses);
		expect(codeLenses as vscode.CodeLens[]).has.length(0);
	});
	
	test("Codelens available on a file with a modeline", async() => {
		const docUriJava = getDocUri('MyRouteBuilderWithAdditionalDependencies.java');
		await vscode.window.showTextDocument(docUriJava);
		
		const codeLenses: vscode.CodeLens[] | undefined = await vscode.commands.executeCommand('vscode.executeCodeLensProvider', docUriJava);
		
		checkCodeLens(codeLenses as vscode.CodeLens[]);
	});

 });

function checkCodeLens(codeLenses: vscode.CodeLens[]) {
	const classpathRefreshCodeLenses = codeLenses.filter(codelens => {
		return codelens.command?.command === extension.COMMAND_ID_CLASSPATH_REFRESH;
	});
	expect(classpathRefreshCodeLenses).has.length(1);
	const codeLens: vscode.CodeLens = classpathRefreshCodeLenses[0];
	expect(codeLens.isResolved).to.be.true;
}
