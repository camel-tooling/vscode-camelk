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
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES = "java.project.referencedLibraries";

export function downloadJavaDependencies(context:vscode.ExtensionContext): string {
    let pomTemplate = context.asAbsolutePath(path.join('resources', 'maven-project', 'pom-to-copy-java-dependencies.xml'));
    let extensionStorage = context.globalStoragePath;
    let camelVersion = "3.0.0";

    let destination = path.join(extensionStorage, `java-dependencies-${camelVersion}`);
    fs.mkdirSync(destination, { recursive: true });

    /* provides only camel-core-engine dependencies for now, to improve:
    * - rely on kamel inspect to know all extra potential libraries that can be provided
    */
    const mvn = require('maven').create({
        cwd: destination,
        file: pomTemplate,

    });
    mvn.execute(['dependency:copy-dependencies'], {'camelVersion': camelVersion, 'outputDirectory': destination});
    return destination;
}

export function updateReferenceLibraries(editor: vscode.TextEditor | undefined, destination:string) {
    const camelKReferencedLibrariesPattern = destination + '/*.jar';
    let documentEdited = editor?.document;
    if (documentEdited?.fileName.endsWith(".java")) {
        let text = documentEdited.getText();
        const configuration = vscode.workspace.getConfiguration();
        let refLibrariesTopLevelConfig = configuration.get(PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES);
        if(refLibrariesTopLevelConfig instanceof Array) {
            updateReferenceLibrariesForConfigKey(text, refLibrariesTopLevelConfig, camelKReferencedLibrariesPattern, configuration, PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES);
        } else {
            let includepropertyKeyConfig = PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES + '.include';
            let refLibrariesIncludeConfig = configuration.get(includepropertyKeyConfig) as Array<string>;
            updateReferenceLibrariesForConfigKey(text, refLibrariesIncludeConfig, camelKReferencedLibrariesPattern, configuration, includepropertyKeyConfig);
        }
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
    for (var i = 0; i < refLibrariesConfig.length; i++) {
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

