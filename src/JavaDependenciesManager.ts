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
import { platform } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from './CamelKJSONUtils';
import { execSync } from 'child_process';

const PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES = "java.project.referencedLibraries";

export async function initializeJavaDependenciesManager(context: vscode.ExtensionContext, mainOutputChannel: vscode.OutputChannel): Promise<void> {
	const destination = destinationFolderForDependencies(context);
	const javaFileToWarmup = context.asAbsolutePath(path.join('resources', 'simple-java-file', 'UsedToWarmupDependenciesDownload.java'));
	await downloadSpecificCamelKJavaDependencies(context, vscode.Uri.file(javaFileToWarmup), mainOutputChannel);
	await initializeJavaSettingManagement(destination);
}

async function initializeJavaSettingManagement(destination: string) {
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		updateReferenceLibraries(editor, destination);
	});

	if (vscode.window.activeTextEditor) {
		updateReferenceLibraries(vscode.window.activeTextEditor, destination);
	}
}

export async function downloadSpecificCamelKJavaDependencies(
	context: vscode.ExtensionContext,
	uri: vscode.Uri | undefined,
	mainOutputChannel: vscode.OutputChannel): Promise<void>{
	if(uri === undefined) {
		uri = vscode.window.activeTextEditor?.document.uri;
	}
	if (uri) {
		const destination = destinationFolderForDependencies(context);
		await clearDestinationFolder(mainOutputChannel, destination);
		// replace of backslash by slash is a workaround to CAMEL-20033
		const command = `jbang camel@apache/camel dependency copy --output-directory="${destination}" "${uri.fsPath.replace(/\\/g,'/')}"`;
		try {
			if (platform() === 'darwin' && context.storageUri != undefined) {
				// In some not clearly defined cases on MacOS, a current working directory must be provided
				await vscode.workspace.fs.createDirectory(context.storageUri);
				execSync(command, {cwd: context.storageUri.fsPath});
			} else {
				execSync(command);
			}
			triggerRefreshOfJavaClasspath(context);
		} catch(error) {
			utils.shareMessage(mainOutputChannel, `Error while trying to refresh Java classpath based on file ${uri.fsPath}:\n${error}`);
		}
	} else {
		utils.shareMessage(mainOutputChannel, 'Cannot determine which file to use as base to refresh classpath');
	}
}

async function clearDestinationFolder(outputChannel: vscode.OutputChannel, parentDestination: string) {
	try {
		await vscode.workspace.fs.delete(vscode.Uri.file(parentDestination), { recursive: true });
	} catch(error) {
		utils.shareMessage(outputChannel, `Cannot clear folder ${parentDestination}\n: ${error}`);
	}
}

function triggerRefreshOfJavaClasspath(context: vscode.ExtensionContext) {
	const destination = path.join(destinationFolderForDependencies(context));
	/**
	 * This is currently a workaround as no API is available to trigger the refresh of the classpath.
	 * To trigger the refresh, we modify back and forth the settings. It is refreshing twice but the best that we can do for now.
	 * See https://github.com/redhat-developer/vscode-java/issues/1874
	**/
	updateReferencedLibraries("", destination);
	updateReferenceLibraries(vscode.window.activeTextEditor, destination);
}

export function updateReferenceLibraries(editor: vscode.TextEditor | undefined, destination:string) {
	const documentEdited = editor?.document;
	if (documentEdited?.fileName.endsWith(".java")) {
		const text = documentEdited.getText();
		updateReferencedLibraries(text, destination);
	}
}

function updateReferencedLibraries(text: string, destination: string) {
	const camelKReferencedLibrariesPattern = destination + '/*.jar';
	const configuration = vscode.workspace.getConfiguration();
	const refLibrariesTopLevelConfig = configuration.get(PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES);
	if (refLibrariesTopLevelConfig instanceof Array) {
		updateReferenceLibrariesForConfigKey(text, refLibrariesTopLevelConfig, camelKReferencedLibrariesPattern, configuration, PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES);
	} else {
		const includepropertyKeyConfig = PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES + '.include';
		const refLibrariesIncludeConfig = configuration.get(includepropertyKeyConfig) as Array<string>;
		updateReferenceLibrariesForConfigKey(text, refLibrariesIncludeConfig, camelKReferencedLibrariesPattern, configuration, includepropertyKeyConfig);
	}
}

function updateReferenceLibrariesForConfigKey(text: string, refLibrariesConfig: string[], camelKReferencedLibrariesPattern: string, configuration: vscode.WorkspaceConfiguration, configurationKey: string) {
    if (text.includes("camel")) {
        ensureReferencedLibrariesContainsCamelK(refLibrariesConfig, camelKReferencedLibrariesPattern, configuration, configurationKey);
    } else if (refLibrariesConfig.includes(camelKReferencedLibrariesPattern)) {
        removeCamelKFromReferencedlibraries(refLibrariesConfig, camelKReferencedLibrariesPattern, configuration, configurationKey);
    }
}

function removeCamelKFromReferencedlibraries(refLibrariesConfig: string[], camelKReferencedLibrariesPattern: string, configuration: vscode.WorkspaceConfiguration, configurationKey: string) {
    for (let i = 0; i < refLibrariesConfig.length; i++) {
        if (refLibrariesConfig[i] === camelKReferencedLibrariesPattern) {
            refLibrariesConfig.splice(i, 1);
        }
    }
    configuration.update(configurationKey, refLibrariesConfig);
}

function ensureReferencedLibrariesContainsCamelK(refLibrariesConfig: string[], camelKReferencedLibrariesPattern: string, configuration: vscode.WorkspaceConfiguration, configurationKey: string) {
    if (!refLibrariesConfig.includes(camelKReferencedLibrariesPattern)) {
        refLibrariesConfig.push(camelKReferencedLibrariesPattern);
        configuration.update(configurationKey, refLibrariesConfig);
    }
}
export function destinationFolderForDependencies(context: vscode.ExtensionContext) {
	const extensionStorage = context.globalStoragePath;
	return  path.join(extensionStorage, `java-dependencies`);
}
