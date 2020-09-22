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

import {assert} from 'chai';
import * as config from '../../config';
import * as fs from 'fs';
import * as kubectl from '../../kubectl';
import * as sinon from 'sinon';
import * as installer from '../../installer';
import * as Utils from './Utils';
import * as versionUtils from '../../versionUtils';
import { failed } from '../../errorable';
import { findBinary } from '../../shell';

const os = require('os');

suite("ensure install methods are functioning as expected", function() {

	let installKubectlSpy  = sinon.spy(installer, 'installKubectl');

	test("install Camel K and Kubernetes CLIs on activation", async function() {
		let extension = await Utils.ensureExtensionActivated();

		installKubectlSpy.resetHistory();	

		// now try to activate again to ensure that we don't install a second time
		if (extension !== null && extension !== undefined) {
			await extension.activate().then( () => {
				console.log(`kubectl installer call count= ${installKubectlSpy.callCount}`);
				if (installKubectlSpy.callCount === 0) {
					assert.ok("Kubectl installer was called once during the activation test, was not called again when we re-activated");
				} else {
					assert.fail("Kubectl installer was called more than once when we activated the extension a second time");
				}
			});
		}

		// reset the call count to clean up after the test
		installKubectlSpy.resetHistory();	
	});

	const testInvalidVersionVar = test("ensure cli version checking works correctly: detect no update needed with unavailable version specified", async function() {
		skipIfNoGithubTokenAvailable(testInvalidVersionVar);

		const needsUpdate: boolean = await versionUtils.checkKamelNeedsUpdate('unavailable-version');
		assert.isFalse(needsUpdate, 'It is mentioned that there is need of update with an unavailable kamel version.');
	});
	
	const testLatestVersionVar = test("ensure cli version checking works correctly: check latest Camel K version can be retrieved and doesn't need an update", async function() {
		skipIfNoGithubTokenAvailable(testLatestVersionVar);

		const retrievedVersion = await versionUtils.getLatestCamelKVersion();
		if (failed(retrievedVersion)) {
			assert.fail(retrievedVersion.error[0]);
		}
		let latestversion = retrievedVersion.result.trim();
		assert.ok(typeof latestversion === "string" && latestversion, 'unable to retrieve latest version');
		const needsUpdate: boolean = await versionUtils.checkKamelNeedsUpdate(latestversion);
		assert.isFalse(needsUpdate, `Latest retrieved version is ${latestversion}. It is reported that an update is needed. It can be that a new Camel K has been released and the default version has not been updated.`);
	});
	
	test("ensure we have access to the kamel cli", function(done) {
		let kamelPath = config.getActiveKamelconfig();
		console.log(`kamelPath= ${kamelPath}`);
		assert.equal(fs.existsSync(kamelPath), true);
		done();
	});

	const kubectlTest = test("ensure we have access to the kubectl cli when kubectl not available on command line", async() => {
		if(await isKubectlAvailableOnCommandLine() && !isTestRunningCI()) {
			kubectlTest.skip();
		}

		let kubectlPath = await kubectl.baseKubectlPath();
		console.log(`kubectlPath= ${kubectlPath}`);
		assert.equal(fs.existsSync(kubectlPath), true);
	});
});

function skipIfNoGithubTokenAvailable(testVar: Mocha.Test) {
	if (!process.env.VSCODE_CAMELK_GITHUB_TOKEN) {
		testVar.skip();
	}
}

function isTestRunningCI() {
	const homedir = os.homedir();
	return homedir.includes('hudson') || homedir.includes('travis');
}

async function isKubectlAvailableOnCommandLine() {
	const findKubectlBinary = await findBinary('kubectl');
	return findKubectlBinary && findKubectlBinary.output && findKubectlBinary.err === null;
}

