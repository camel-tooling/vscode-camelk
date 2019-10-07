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
import * as installer from '../../installer';
import * as kubectlutils from '../../kubectlutils';

suite("ensure kamel and kubectl are available", function() {

    test("ensure can activate kamel cli", function(done) {
		installer.checkKamelCLIVersion().then( (version) => {
			assert.deepEqual(version, installer.version);
			done();
		});
	});

    test("ensure can access the kubectl cli", function(done) {
		// instead of relying on us activating the kubernetes extension to install kubectl
		// just rely on the CLI already being installed and active in the target environment
		kubectlutils.getKubernetesVersion().then( (version: any) => {
			if (version) {
				console.log(`Retrieved kubernetes version ${version}`);
			}
			assert.notStrictEqual(version, undefined);
			done();
		}).catch( () => {
			assert.fail('Kubectl unavailable');
			done();
		});
	});

});