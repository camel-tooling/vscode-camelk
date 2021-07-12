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
import * as extension from '../../extension';
import * as Utils from './Utils';

const homedir = require('os').homedir();

suite("Kubectl integration watcher", function() {
	let messageStub: sinon.SinonStub<[string], void>;
	let refreshStub: sinon.SinonStub<[], Promise<void>>;
	let sandbox: sinon.SinonSandbox;
	let kubeconfigFilePath : string = homedir + '/.kube/config';
	
	this.beforeAll(async () => {
		this.timeout(60000);
		await Utils.ensureExtensionActivated();
		await sleep(extension.DELAY_RETRY_KUBECTL_CONNECTION);
	});

	this.beforeEach(() => {
		sandbox = sinon.createSandbox();
		refreshStub = sandbox.stub(extension.camelKIntegrationsProvider, 'refresh');
		messageStub = sandbox.stub(extension.mainOutputChannel, 'append');
	});
	
	this.afterEach(() => {
		if(fs.existsSync(kubeconfigFilePath+ '.bak')){
			fs.renameSync(kubeconfigFilePath + '.bak', kubeconfigFilePath);
		}
		refreshStub.restore();
		messageStub.restore();
		sandbox.reset();
	});
	
	test('Check there is no loop for closing kubectl process', async function() {
		await sleep(extension.DELAY_RETRY_KUBECTL_CONNECTION);
		sinon.assert.notCalled(messageStub);
	});
	
	test('Check there is one set of message logged in case of connection error', async function() {
		invalidateKubeConfigFileByRenamingIt(kubeconfigFilePath);
		await extension.getIntegrationsFromKubectlCliWithWatch();
		checkErrorMessageLogged(messageStub);
	});
	
	test('Check there is no loop for closing kubectl process with View visible', async function() {
		await Utils.openCamelKTreeView();
		await sleep(extension.DELAY_RETRY_KUBECTL_CONNECTION);
		messageStub.resetHistory();
		await sleep(extension.DELAY_RETRY_KUBECTL_CONNECTION);
		sinon.assert.notCalled(messageStub);
	});
	
	test('Check there is only one set of message logged in case of connection error with View visible', async function() {
		invalidateKubeConfigFileByRenamingIt(kubeconfigFilePath);
		await Utils.openCamelKTreeView();
		messageStub.resetHistory();
		await extension.getIntegrationsFromKubectlCliWithWatch();
		checkErrorMessageLogged(messageStub);
	});
	
});

function invalidateKubeConfigFileByRenamingIt(kubeconfigFilePath: string) {
	if (fs.existsSync(kubeconfigFilePath)) {
		fs.renameSync(kubeconfigFilePath, kubeconfigFilePath + '.bak');
	}
}

function checkErrorMessageLogged(messageStub: sinon.SinonStub<[string], void>) {
	expect(messageStub.callCount,
		`Depending on latency, versions used and environment configuration, one or two messages can be logged. Number of messages logged ${messageStub.callCount}`)
		.above(0).below(3);
}

function sleep(ms = 0) {
	return new Promise(r => setTimeout(r, ms));
}
