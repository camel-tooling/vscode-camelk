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

const waitUntil = require('async-wait-until');

const getDocPath = (p: string) => {
	return path.resolve(__dirname, '../../../../testFixture', p);
};
export const getDocUri = (p: string) => {
	return vscode.Uri.file(getDocPath(p));
};

export async function checkExpectedCompletion(docUri: vscode.Uri, position: vscode.Position, expectedCompletion: vscode.CompletionItem) {
    let hasExpectedCompletion = false;
    await waitUntil(() => {
        // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
        (vscode.commands.executeCommand('vscode.executeCompletionItemProvider', docUri, position)).then(value => {
            let actualCompletionList = value as vscode.CompletionList;
            const actualCompletionLabelList = actualCompletionList.items.map(c => { return c.label; });
            hasExpectedCompletion = actualCompletionLabelList.includes(expectedCompletion.label);
        });
        return hasExpectedCompletion;
    }, 10000, 500);
}
