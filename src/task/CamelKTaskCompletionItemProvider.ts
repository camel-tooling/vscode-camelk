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

import * as jsonparser from 'jsonc-parser';
import * as vscode from 'vscode';
import { TraitManager } from './TraitManager';

export class CamelKTaskCompletionItemProvider implements vscode.CompletionItemProvider {

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        return this.provideCompletionItemsForText(document.getText(), document.offsetAt(position));
    }

    public async provideCompletionItemsForText(text: string, offset: number): Promise<vscode.CompletionItem[]> {
        let node = jsonparser.findNodeAtOffset(jsonparser.parseTree(text), offset, false);
        let completions: vscode.CompletionItem[] = [];
        if (node !== undefined) {
            if (this.isInTasksArray(node)) {
                let completionBasic: vscode.CompletionItem = {
                    label: 'Camel K basic development mode',
                    insertText:
`{
    "label": "Start in dev mode Camel K integration opened in active editor",
    "type": "camel-k",
    "dev": true,
    "file": "\${file}",
    "problemMatcher": []
}`
                };
                completions.push(completionBasic);
            } else if(this.isInTraitsArray(node)) {
                let traitCompletions: vscode.CompletionItem[] = await TraitManager.provideAvailableTraits();
                completions = completions.concat(traitCompletions);
            }
        }
        return Promise.resolve(completions);
    }

    private isInTraitsArray(node: jsonparser.Node) {
        return this.isInArray(node)
            && this.isSiblingTraitTasks(node);
    }

    private isParentHasStringPropertyOfType(node: jsonparser.Node, type: string) {
        let parent = node.parent;
        if (parent !== undefined && parent.type === "property") {
            let nodeTasks = parent.children?.find(child => {
                return child.type === "string" && child.value === type;
            });
            return nodeTasks !== undefined;
        }
        return false;
    }

    private isSiblingTraitTasks(node: jsonparser.Node) {
        return this.isParentHasStringPropertyOfType(node, 'traits');
    }

    private isInTasksArray(node: jsonparser.Node) {
        return this.isInArray(node)
            && this.isParentTasks(node);
    }

    private isInArray(node: jsonparser.Node) {
        return node?.type === "array";
    }

    private isParentTasks(node: jsonparser.Node) {
        return this.isParentHasStringPropertyOfType(node, 'tasks');
    }
}
