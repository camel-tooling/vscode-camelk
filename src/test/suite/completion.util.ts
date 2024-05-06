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
import * as path from 'path';
import * as vscode from 'vscode';
import { waitUntil } from 'async-wait-until';

const getDocPath = (p: string) => {
	return path.resolve(__dirname, '../../../../test Fixture with speci@l chars', p);
};
export const getDocUri = (p: string) => {
	return vscode.Uri.file(getDocPath(p));
};

export async function checkExpectedCompletion(docUri: vscode.Uri, position: vscode.Position, expectedCompletion: vscode.CompletionItem) {
	let hasExpectedCompletion = false;
	let lastCompletionList : vscode.CompletionList | undefined;
	try {
		await waitUntil(() => {
			// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
			(vscode.commands.executeCommand('vscode.executeCompletionItemProvider', docUri, position)).then(value => {
				const actualCompletionList = value as vscode.CompletionList;
				lastCompletionList = actualCompletionList;
				const completionItemFound = actualCompletionList.items.find(completion => {
					if(completion.label.toString() === expectedCompletion.label.toString()) {
						console.log('same label found');
						if(completion.documentation === expectedCompletion.documentation) {
							console.log('same documentation found');
						}
						if(expectedCompletion.insertText === undefined || completion.insertText === expectedCompletion.insertText) {
							console.log('same insertText found');
							return true;
						}
					}
					return false;

				});
				hasExpectedCompletion = completionItemFound !== undefined;
			});
			return hasExpectedCompletion;
		}, 15000, 500);
	} catch (err) {
		let errorMessage = '';
		if(lastCompletionList) {
			lastCompletionList.items.forEach(completion => {
				errorMessage += completion.label.toString() + '\n with documentation' + completion.documentation + ' and inserText ' + completion.insertText;
			});
		}
		throw new Error(`${err}\nCannot find expected completion "${expectedCompletion.label.toString()}" in the list of completions:\n${errorMessage}`);
	}
}
