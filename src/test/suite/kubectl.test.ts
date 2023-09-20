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
import * as kubectl from '../../kubectl';
import * as kubectlutils from '../../kubectlutils';
import * as os from 'os';
import { expect } from 'chai';
import path = require('path');

suite("ensure kubectl are available", function() {

	let kubectlConfigBeforeTest :string;
	
	this.beforeEach(function() {
		kubectlConfigBeforeTest = config.getActiveKubectlconfig();
	});
	
	this.afterEach(async() => {
		await config.addKubectlPathToConfig(kubectlConfigBeforeTest);
	});
	
    test("ensure can access the kubectl cli", function(done) {
		// instead of relying on us activating the kubernetes extension to install kubectl
		// just rely on the CLI already being installed and active in the target environment
		kubectlutils.isKubernetesAvailable().then( (flag) => {
			if (flag) {
				console.log(`Kubectl is available: ${flag}`);
				done();
			}
		}).catch( (error) => {
			assert.fail(`Kubectl is not available: ${error}`);
			done();
		});
	});
	
	test('check kubectl can be on path with space', async function() {
		const kubectlWithSpacePath = path.resolve(__dirname, `../../../../test Fixture with speci@l chars/binaries for test with space/${os.platform()}/kubectl${os.platform()=== 'win32' ? '.exe' : ''}`);
		await config.addKubectlPathToConfig(kubectlWithSpacePath);
		const kubectlExe = kubectl.create();
		const kubectlExePath = await kubectlExe.getPath();
		expect(kubectlExePath).to.be.equal(kubectlWithSpacePath);
		
		await kubectlExe.invokeArgs(['version']);
	});

});
