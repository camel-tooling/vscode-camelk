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

import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as extension from '../../extension';
import * as utils from '../../CamelKJSONUtils';
import * as CamelKNodeProvider from '../../CamelKNodeProvider';
import * as Utils from './Utils';

const homedir = require('os').homedir();

suite("Kubectl integration watcher", function() {
	
	let messageSpy = sinon.spy(utils, "shareMessage");
	let refreshStub: sinon.SinonStub<[], Promise<void>>;
	let sandbox: sinon.SinonSandbox;
	let kubeconfigFilePath : string = homedir + '/.kube/config';
	
	this.beforeAll(async () => {
		this.timeout(40000);
		await Utils.ensureExtensionActivated();
	});

	this.beforeEach(() => {
		sandbox = sinon.createSandbox();
		refreshStub = sandbox.stub(extension.camelKIntegrationsProvider, 'refresh');
		messageSpy.resetHistory();
	});
	
	this.afterEach(() => {
		if(fs.existsSync(kubeconfigFilePath+ '.bak')){
			fs.renameSync(kubeconfigFilePath + '.bak', kubeconfigFilePath);
		}
		refreshStub.restore();
		sandbox.reset();
	});
	
	test('Check there is no loop for closing kubectl process', async function() {
		await sleep(extension.DELAY_RETRY_KUBECTL_CONNECTION);
		sinon.assert.notCalled(messageSpy);
	});
	
	test('Check there is one message logged in case of connection error', async function() {
		if(fs.existsSync(kubeconfigFilePath)) {
			fs.renameSync(kubeconfigFilePath, kubeconfigFilePath + '.bak');
		}
		await extension.getIntegrationsFromKubectlCliWithWatch();
		sinon.assert.calledOnce(messageSpy);
	});
	
	test('Check there is no loop for closing kubectl process with View visible', async function() {
		await openCamelKTreeView(sandbox);
		await sleep(extension.DELAY_RETRY_KUBECTL_CONNECTION);
		messageSpy.resetHistory();
		await sleep(extension.DELAY_RETRY_KUBECTL_CONNECTION);
		sinon.assert.notCalled(messageSpy);
	});
	
	test('Check there is only one message logged in case of connection error with View visible', async function() {
		if(fs.existsSync(kubeconfigFilePath)) {
			fs.renameSync(kubeconfigFilePath, kubeconfigFilePath + '.bak');
		}
		await openCamelKTreeView(sandbox);
		messageSpy.resetHistory();
		await extension.getIntegrationsFromKubectlCliWithWatch();
		sinon.assert.calledOnce(messageSpy);
	});
	
});

async function openCamelKTreeView(sandbox: sinon.SinonSandbox) {
	/* To open Tree View, reveal must be used.
	Consequently, it requires to have at least an element in the tree and that getParent of the TreeNodeProvider is implemented.
	Given that, we are testing in case there is no connection and so there is no TreeNodes, we are forced to create a fake one.*/
	const fakeNode = new CamelKNodeProvider.TreeNode("string", "mockIntegration", "running", vscode.TreeItemCollapsibleState.None);
	let children = await extension.camelKIntegrationsProvider.getChildren();
	await extension.camelKIntegrationsProvider.addChild(children, fakeNode, true);
	await extension.camelKIntegrationsTreeView.reveal(fakeNode);
	expect(extension.camelKIntegrationsTreeView.visible, 'The Tree View of Camel K integration is not visible').to.be.true;
}

function sleep(ms = 0) {
	return new Promise(r => setTimeout(r, ms));
}
