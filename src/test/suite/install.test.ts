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
import * as config from '../../config';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as installer from '../../installer';
import * as Utils from './Utils';
import * as versionUtils from '../../versionUtils';
import { failed } from '../../errorable';

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

	var testVar = test("ensure cli version checking works correctly", async function() {
		if(process.env.VSCODE_CAMELK_GITHUB_TOKEN === undefined) {
			testVar.skip();
		}

		await versionUtils.checkKamelNeedsUpdate('bogusversion').then( () => {
			assert.fail('cli version checking, negative case worked');
		}).catch( (error) => {
			assert.ok(error, 'cli version checking, negative case worked');
		});
	
		const retrievedVersion = await versionUtils.getLatestCamelKVersion();
		if (failed(retrievedVersion)) {
			assert.fail(retrievedVersion.error[0]);
		}
		let latestversion = retrievedVersion.result.trim();
		assert.ok(typeof latestversion === "string" && latestversion, 'unable to retrieve latest version');
		await versionUtils.checkKamelNeedsUpdate(latestversion).then( (boolVal) => {
			// should return a false since the versions should match
			assert.ok(typeof boolVal === "boolean" && !boolVal, 'cli version checking, positive case worked');
		});
	});

	test("ensure we have access to the kamel cli", function(done) {
		let kamelPath = config.getActiveKamelconfig();
		console.log(`kamelPath= ${kamelPath}`);
		assert.equal(fs.existsSync(kamelPath), true);
		done();
	});

	test("ensure we have access to the kubectl cli", function(done) {
		let kubectlPath = config.getActiveKubectlconfig();
		console.log(`kubectlPath= ${kubectlPath}`);
		assert.equal(fs.existsSync(kubectlPath), true);
		done();
	});
});
