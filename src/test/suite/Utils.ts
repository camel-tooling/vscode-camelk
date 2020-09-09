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
import { CamelKNodeProvider, TreeNode } from '../../CamelKNodeProvider';
import { expect } from 'chai';

const waitUntil = require('async-wait-until');

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
	}, ACTIVATION_TIMEOUT, 'Extension is not active even after calling activate explicitily.');
}

async function waitInCaseExtensionIsActivating(extension: vscode.Extension<any>) {
	await waitUntil(() => {
		return extension.isActive;
	}, ACTIVATION_TIMEOUT).catch(() => {
		console.log('Extension has not started automatically, we will force call to activate it.');
	});
}
export function retrieveExtensionContext(): vscode.ExtensionContext {
	const extension = retrieveCamelKExtension();
	return extension?.exports.getStashedContext();
}

export function getCamelKIntegrationsProvider(): CamelKNodeProvider {
	const extension = retrieveCamelKExtension();
	return extension?.exports.getCamelKIntegrationsProvider();
}

export function getCamelKMainOutputChannel(): vscode.OutputChannel {
	const extension = retrieveCamelKExtension();
	return extension?.exports.getMainOutputChannel();
}

export function getCamelKIntegrationsTreeView(): vscode.TreeView<TreeNode | undefined> {
	const extension = retrieveCamelKExtension();
	return extension?.exports.getCamelKIntegrationsTreeView();
}

export async function getIntegrationsFromKubectlCliWithWatchTestApi(): Promise<void> {
	const extension = retrieveCamelKExtension();
	return extension?.exports.getIntegrationsFromKubectlCliWithWatchTestApi();
}

function retrieveCamelKExtension(): vscode.Extension<any> | undefined {
	return vscode.extensions.getExtension('redhat.vscode-camelk');
}

export async function openCamelKTreeView() {
	/* To open Tree View, reveal must be used.
	Consequently, it requires to have at least an element in the tree and that getParent of the TreeNodeProvider is implemented.
	Given that, we are testing in case there is no connection and so there is no TreeNodes, we are forced to create a fake one.*/
	const fakeNode = new TreeNode("string", "mockIntegration", "running", vscode.TreeItemCollapsibleState.None);
	let children = await getCamelKIntegrationsProvider().getChildren();
	await getCamelKIntegrationsProvider().addChild(children, fakeNode, true);
	await getCamelKIntegrationsTreeView().reveal(fakeNode);
	expect(getCamelKIntegrationsTreeView().visible, 'The Tree View of Camel K integration is not visible').to.be.true;
}

export function skipOnJenkins(testVar: Mocha.Test) {
	if (os.homedir().includes('hudson')) {
		testVar.skip();
	}
}
