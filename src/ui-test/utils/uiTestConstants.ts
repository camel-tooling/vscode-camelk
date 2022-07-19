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
'use strict';

import { projectPath } from './../uitest_runner';
import * as path from 'path';
import * as pjson from '../../../package.json';

export const initialPodReadyMessage = '[1] Monitoring pod';
export const updatedPodReadyMessage = '[2] Monitoring pod';
export const testFolder = 'vscode-camelk-ui-test';
export const testDir = path.resolve(`${projectPath}`, '..', 'test-resources', 'vscode-camelk-ui-test');
export const integrationFileName = 'Simple';

export const extensionName = pjson.contributes.views.explorer[0].name;
export const startIntegration = pjson.contributes.commands[0].title;
export const integrationRemove = pjson.contributes.commands[2].title;
export const followIntegrationLogs = pjson.contributes.commands[3].title;
export const createNewIntegrationFile = pjson.contributes.commands[9].title;

export function prepareCodeLogMessages(extension: string, language: string): [string, string, string, string] {
    let initialCodeMessage = `Hello Camel K from`;
    let updatedCodeMessage = `Updated message with Camel K from`;
    let initialLogMessage = initialCodeMessage;
    let updatedLogMessage = updatedCodeMessage;
    if (extension === 'kts') {
        initialLogMessage = initialLogMessage.concat(` ${language.toLowerCase()}`);
        updatedLogMessage = updatedLogMessage.concat(` ${language.toLowerCase()}`);
        initialCodeMessage = initialCodeMessage.concat(' \\${routeId}');
        updatedCodeMessage = updatedCodeMessage.concat(' \\${routeId}');
    } else if (extension === 'yaml') {
        initialLogMessage = initialLogMessage.concat(` ${extension}`);
        updatedLogMessage = updatedLogMessage.concat(` ${extension}`);
        initialCodeMessage = initialLogMessage;
        updatedCodeMessage = updatedLogMessage;
    } else {
        initialLogMessage = initialLogMessage.concat(` ${extension}`);
        updatedLogMessage = updatedLogMessage.concat(` ${extension}`);
        initialCodeMessage = initialCodeMessage.concat(' ${routeId}');
        updatedCodeMessage = updatedCodeMessage.concat(' ${routeId}');
    }
    return [initialCodeMessage, updatedCodeMessage, initialLogMessage, updatedLogMessage]
}
