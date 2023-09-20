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

import * as assert from 'assert';
import * as vscode from 'vscode';
import os = require('os');
import { waitUntil } from 'async-wait-until';

const extensionId = 'redhat.vscode-camelk';
export const ACTIVATION_TIMEOUT = 45000;

export async function ensureExtensionActivated() {
	const extension = vscode.extensions.getExtension(extensionId);
	if (extension) {
		await waitInCaseExtensionIsActivating(extension);
		if(!extension.isActive) {
			await forceActivation(extension);
		}
	} else {
		assert.fail("Camel K extension is undefined and cannot be activated");
	}
	return extension;
}

async function forceActivation(extension: vscode.Extension<any>) {
	await extension.activate();
	await waitUntil(() => {
		return extension.isActive;
	}, ACTIVATION_TIMEOUT);
}

async function waitInCaseExtensionIsActivating(extension: vscode.Extension<any>) {
	await waitUntil(() => {
		return extension.isActive;
	}, ACTIVATION_TIMEOUT).catch(() => {
		console.log('Extension has not started automatically, we will force call to activate it.');
	});
}

export async function openCamelKTreeView() {
	await vscode.commands.executeCommand('camelk.integrations.focus');
}

export function skipOnJenkins(testVar: Mocha.Test) {
	if (os.homedir().includes('hudson')) {
		testVar.skip();
	}
}

export function skipIfNoCamelKInstance(testVar: Mocha.Test) {
	if (os.platform() === 'win32'  || os.platform() === 'darwin') {
		testVar.skip();
	}
}
