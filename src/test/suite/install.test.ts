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
import * as config from '../../config';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as installer from '../../installer';

const extensionId = 'redhat.vscode-camelk';

suite("ensure install methods are functioning as expected", function() {

	let installKubectlSpy  = sinon.spy(installer, 'installKubectl');

	test("install Camel K and Kubernetes CLIs on activation", async function() {
		// reset the call count
		installKubectlSpy.resetHistory();	

		let extension = vscode.extensions.getExtension(extensionId);
		if (extension !== null && extension !== undefined) {
			await extension.activate().then( () => {
				assert.ok("Camel K extension is ready to go");
			});
		} else {
			assert.fail("Camel K extension is undefined and cannot be activated");
		}

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
