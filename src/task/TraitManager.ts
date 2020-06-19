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

import * as kamel from '../kamel';
import * as vscode from 'vscode';
import { TraitDefinition } from './TraitDefinition';
import { TraitProperty } from './TraitProperty';

const SORT_PREFIX_TO_HAVE_COMPLETIONS_BEFORE_VARIABLES = '${1';

export class TraitManager {

	static async provideAvailableTraits(): Promise<vscode.CompletionItem[]> {
		const completions: vscode.CompletionItem[] = [];
		const traits = await TraitManager.retrieveTraitsDefinitions();
		for (const trait of traits) {
			const completionBasic: vscode.CompletionItem = {
				label: trait.name,
				insertText: TraitManager.computeSnippetForTrait(trait),
				kind: vscode.CompletionItemKind.Snippet,
			};
			completions.push(completionBasic);
		}
		return completions;
	}
	static async provideTraitProperties(traitName: string, position: vscode.Position): Promise<vscode.CompletionItem[]> {
		const completions: vscode.CompletionItem[] = [];
		const traitDefs = await TraitManager.retrieveTraitsDefinitions(traitName);
		traitDefs[0].properties.forEach((property: TraitProperty) => {
			const propertyCompletion: vscode.CompletionItem = {
				label: property.name,
				sortText: SORT_PREFIX_TO_HAVE_COMPLETIONS_BEFORE_VARIABLES + property.name,
				range: new vscode.Range(position, position),
				insertText: TraitManager.computeTraitPropertyInsertText(property)
			};
			completions.push(propertyCompletion);
		});
		return completions;
	}

	private static computeTraitPropertyInsertText(property: TraitProperty): string {
		if(property.defaultValue !== undefined) {
			return `${property.name}=${property.defaultValue}`;
		} else {
			return property.name;
		}
	}

	private static computeSnippetForTrait(trait: TraitDefinition): vscode.SnippetString {
		const propertyNames = trait.properties.map(property => property.name);
		const propertiesChoices = '${1|' + propertyNames.join(',') + '|}';
		return new vscode.SnippetString(`"${trait.name}.${propertiesChoices}="`);
	}

	private static async retrieveTraitsDefinitions(traitName?: string): Promise<TraitDefinition[]> {
		const kamelExecutor = kamel.create();
		const trait = await kamelExecutor.invoke(`help trait ${traitName ? traitName : '--all'} -o json`);
		const sanitizedTrait = sanitizeToWorkaroundBugInKamel1_0_0(trait);
		return JSON.parse(sanitizedTrait) as TraitDefinition[];
	}
}

function sanitizeToWorkaroundBugInKamel1_0_0(trait: string) {
	const indexOfJSonStart = trait.indexOf('[{"');
	if (indexOfJSonStart > 0) {
		trait = trait.substring(indexOfJSonStart, trait.length);
	}
	return trait;
}
