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
		return this.provideCompletionItemsForText(document.getText(), document.offsetAt(position), position);
	}

	public async provideCompletionItemsForText(text: string, offset: number, position: vscode.Position): Promise<vscode.CompletionItem[]> {
		const globalNode = jsonparser.parseTree(text);
		const node = jsonparser.findNodeAtOffset(globalNode, offset, false);
		let completions: vscode.CompletionItem[] = [];
		if (node) {
			if (this.isInTasksArray(node)) {
				const completionBasic: vscode.CompletionItem = {
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
			} else if (this.isInTraitsArray(node)) {
				const traitCompletions: vscode.CompletionItem[] = await TraitManager.provideAvailableTraits();
				completions = completions.concat(traitCompletions);
			} else if (this.isInTraitsArrayMember(node)) {
				const value = node.value as string;
				const traitpropertyCompletions: vscode.CompletionItem[] = await TraitManager.provideTraitProperties(value.substr(0, value.length - 1), position);
				completions = completions.concat(traitpropertyCompletions);
			}
		}
		return Promise.resolve(completions);
	}

	private isInTraitsArray(node: jsonparser.Node) {
		return this.isInArray(node)
			&& this.isSiblingTraitTasks(node);
	}
	
	private isInTraitsArrayMember(node: jsonparser.Node) {
		const parent = node.parent;
		if (parent && this.isInTraitsArray(parent) && node.type === "string") {
			const value = node.value as string;
			if (value && value.endsWith('.')) {
				return true;
			}
		}
		return false;
	}

	private isParentHasStringPropertyOfType(node: jsonparser.Node, type: string) {
		const parent = node.parent;
		if (parent !== undefined && parent.type === "property") {
			const nodeTasks = parent.children?.find(child => {
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
