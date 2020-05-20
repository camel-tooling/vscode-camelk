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

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as kamel from '../kamel';

const validFilename = require('valid-filename');

const LANGUAGES_WITH_FILENAME_EXTENSIONS = new Map([
	['Java', 'java'],
	['XML', 'xml'],
	['Yaml', 'yaml'],
	['Groovy', 'groovy'],
	['JavaScript', 'js'],
	['Kotlin', 'kts']]);
const LANGUAGES = Array.from(LANGUAGES_WITH_FILENAME_EXTENSIONS.keys());

export async function create(...args: any[]) : Promise<void> {

	let language : string | undefined;
	let workspaceFolder : vscode.WorkspaceFolder | undefined = undefined;
	if (vscode.workspace.workspaceFolders) {
		// default to root workspace folder
		workspaceFolder = vscode.workspace.workspaceFolders[0];
	}
	let filename : string | undefined;

	// for didact use, we expect two arguments
	if (args && args.length === 2) {
		let innerArgs1 : any[] = args[0];
		if (innerArgs1 && innerArgs1[0] && innerArgs1[1]) {
			language = innerArgs1[0];
			filename = innerArgs1[1];
		}
	}

	if (!language && !filename) {
		const selectedLanguage = await vscode.window.showQuickPick(LANGUAGES, {placeHolder:'Please select the language in which the new file will be generated.'});
		if (selectedLanguage) {
			const selectedWorkspaceFolder = await vscode.window.showWorkspaceFolderPick(
				{placeHolder: 'Please select the workspace folder in which the new file will be created.'});
			if (selectedWorkspaceFolder) {
				filename = await vscode.window.showInputBox({
					prompt: 'Please provide a name for the new file (without extension)',
					validateInput: (name: string) => {
						return validateFileName(name, selectedLanguage, selectedWorkspaceFolder);
					}
				});
				language = selectedLanguage;
				workspaceFolder = selectedWorkspaceFolder;
			}
		}
	}

	if (filename && language && workspaceFolder) {
		const kamelExe = kamel.create();
		const newFileFullPath: string = computeFullpath(language, workspaceFolder, filename);
		await kamelExe.invoke(`init "${newFileFullPath}"`);
		const textDocument = await vscode.workspace.openTextDocument(newFileFullPath);
		await vscode.window.showTextDocument(textDocument);
	}
}

function computeFullpath(language: string, workspaceFolder: vscode.WorkspaceFolder, filename: string): string {
	const extension = getFileExtensionForLanguage(language);
	return path.join(workspaceFolder.uri.fsPath, `${filename}.${extension}`);
}

export function validateFileName(name: string, language: string, workspaceFolder: vscode.WorkspaceFolder): string | undefined {
	if (!name) {
		return 'Please provide a name for the new file (without extension)';
	}
	let newFilePotentialFullPath: string = computeFullpath(language, workspaceFolder, name);
	if (fs.existsSync(newFilePotentialFullPath)) {
		return 'There is already a file with the same name. Please choose a different name.';
	}
	if (!validFilename(name)) {
		return 'The filename is invalid.';
	}
	const patternJavaNamingConvention = '[A-Z][a-zA-Z_$0-9]*';
	if ((language === 'Java' || language === 'Groovy') && !name.match(patternJavaNamingConvention)) {
		return `The filename needs to follow the ${language} naming convention. I.e. ${patternJavaNamingConvention}`;
	}
	return undefined;
}

function getFileExtensionForLanguage(language: string): string {
	const extension = LANGUAGES_WITH_FILENAME_EXTENSIONS.get(language);
	if (extension) {
		return extension;
	} else {
		return 'unknown';
	}
}
