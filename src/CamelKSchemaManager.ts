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

import * as vscode from 'vscode';
import fetch from 'cross-fetch';
import { Response } from 'cross-fetch/lib.fetch';

const CAMELK_MODELINE_PREFIX = '# camel-k:';
const CAMELK_SCHEMA_ID = 'camelk';
export const CAMELK_SCHEMA_URI_PREFIX = CAMELK_SCHEMA_ID + '://schema/';

let camelkSchemaCache: string | undefined;
let configUpdaterRegistered: boolean = false;

export async function registerCamelKSchemaProvider(mainOutputChannel: vscode.OutputChannel): Promise<void> {
	const yamlExtension: vscode.Extension<any> | undefined = vscode.extensions.getExtension('redhat.vscode-yaml');
	await retrieveSchemaAsCache(mainOutputChannel);
	if(yamlExtension?.isActive) {
		const yamlExtensionAPI: any = yamlExtension?.exports;
		yamlExtensionAPI.registerContributor(CAMELK_SCHEMA_ID, requestYamlSchemaUriCallback, requestYamlSchemaContentCallback);
	} else {
		mainOutputChannel.appendLine('Yaml extension is not active. There won\'t be automatic completion/validation for Camel K files.');
	}
	
	listenToConfigUpdate(mainOutputChannel);
}

function listenToConfigUpdate(mainOutputChannel: vscode.OutputChannel) {
	if (!configUpdaterRegistered) {
		configUpdaterRegistered = true;
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('camelk.yaml.schema')) {
				retrieveSchemaAsCache(mainOutputChannel);
			}
		});
	}
}

async function retrieveSchemaAsCache(mainOutputChannel: vscode.OutputChannel): Promise<string | undefined> {
	camelkSchemaCache = undefined;
	try {
		const schemaUrl: string | undefined = getCamelKSchemaUrl();
		if (schemaUrl !== undefined) {
			const res: Response = await fetch(schemaUrl);
			if (res.status >= 400) {
				const errorMessage = `Cannot retrieve Camel K schema from url ${schemaUrl} with status text ${res.statusText} and error code ${res.status}`;
				console.log(errorMessage);
				mainOutputChannel.appendLine(errorMessage);
				return undefined;
			} else if (camelkSchemaCache === undefined) {
				camelkSchemaCache = await res.text();
				return camelkSchemaCache;
			}
		} else {
			mainOutputChannel.appendLine('Camel K schema settings is not configured.');
		}
	} catch (err) {
		mainOutputChannel.appendLine('Cannot retrieve Camel K schema. ' + err);
	}
}

function requestYamlSchemaUriCallback(resource: string): string | undefined {
	const textDocument: vscode.TextDocument | undefined = vscode.workspace.textDocuments.find(document => {
		return document.uri.toString() === resource;
	});
	if (textDocument
		&& resource.endsWith('.yaml')
		&& textDocument.getText().startsWith(CAMELK_MODELINE_PREFIX)) {
			return CAMELK_SCHEMA_URI_PREFIX + resource;
		}
	return undefined;
}

export function requestYamlSchemaContentCallback(uri: string): string | undefined {
	const parsedUri: vscode.Uri = vscode.Uri.parse(uri);
	if (parsedUri.scheme !== CAMELK_SCHEMA_ID) {
		return undefined;
	}
	if (!parsedUri.path || !parsedUri.path.startsWith('/')) {
		return undefined;
	}
	return camelkSchemaCache;
}

function getCamelKSchemaUrl(): string | undefined {
	return vscode.workspace.getConfiguration().get('camelk.yaml.schema');
}
