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
import mvndownload from 'mvn-artifact-download';
import * as path from 'path';
import * as vscode from 'vscode';

const PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES = "java.project.referencedLibraries";

export function downloadJavaDependencies(extensionStorage:string): string {
    let camelVersion = "3.0.0-RC3";
    let destination = path.join(extensionStorage, `java-dependencies-${camelVersion}`);
    /* These are camel-core-engine dependencies, to improve:
    * - use a dependency manager so we just need to specify camel-core-engine
    * - rely on kamel inspect to know all extra potential libraries that can be provided
    */
    mvndownload(`org.apache.camel:camel-api:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:camel-base:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:camel-core-engine:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:camel-jaxp:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:spi-annotations:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:camel-management-api:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:camel-support:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:camel-util:${camelVersion}`, destination);
    mvndownload(`org.apache.camel:camel-util-json:${camelVersion}`, destination);
    mvndownload(`org.slf4j:slf4j-api:1.7.28`, destination);
    return destination;
}

export function updateReferenceLibraries(editor: vscode.TextEditor | undefined, destination:string) {
    const camelKReferencedLibrariesPattern = destination + '/*.jar';
    let documentEdited = editor?.document;
    if (documentEdited?.fileName.endsWith(".java")) {
        let text = documentEdited.getText();
        const configuration = vscode.workspace.getConfiguration();
        let refLibrariesConfig = configuration.get(PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES) as Array<string>;
        if (text.includes("camel")) {
            ensureReferencedLibrariesContainsCamelK(refLibrariesConfig, camelKReferencedLibrariesPattern, configuration);
        } else if (refLibrariesConfig.includes(camelKReferencedLibrariesPattern)) {
            removeCamelKFromReferencedlibraries(refLibrariesConfig, camelKReferencedLibrariesPattern, configuration);
        }
    }
}

function removeCamelKFromReferencedlibraries(refLibrariesConfig: string[], camelKReferencedLibrariesPattern: string, configuration: vscode.WorkspaceConfiguration) {
    for (var i = 0; i < refLibrariesConfig.length; i++) {
        if (refLibrariesConfig[i] === camelKReferencedLibrariesPattern) {
            refLibrariesConfig.splice(i, 1);
        }
    }
    configuration.update(PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES, refLibrariesConfig);
}

function ensureReferencedLibrariesContainsCamelK(refLibrariesConfig: string[], camelKReferencedLibrariesPattern: string, configuration: vscode.WorkspaceConfiguration) {
    if (!refLibrariesConfig.includes(camelKReferencedLibrariesPattern)) {
        refLibrariesConfig.push(camelKReferencedLibrariesPattern);
        configuration.update(PREFERENCE_KEY_JAVA_REFERENCED_LIBRARIES, refLibrariesConfig);
    }
}

