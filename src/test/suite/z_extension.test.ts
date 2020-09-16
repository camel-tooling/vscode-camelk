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

import * as vscode from 'vscode';
import {assert} from 'chai';
import * as kamel from '../../kamel';
import * as config from '../../config';
import * as utils from './Utils';
import { ACTIVATION_TIMEOUT } from './Utils';

suite("ensure camelk extension exists and is accessible", function() {
	const extensionId = 'redhat.vscode-camelk';

	test('vscode-camelk extension should be present', function() {
		assert.ok(vscode.extensions.getExtension(extensionId));
	});

	test('vscode-camelk extension should activate', async() => {
		await utils.ensureExtensionActivated();
	}).timeout(ACTIVATION_TIMEOUT + 1000);	

	test('test that getBaseCmd returned value doesn\'t contain --namespace parameter when no namespace is passed', function() {
		let cmdStrNoNS : string = kamel.getBaseCmd(`fakepath`,`fakecommand`, undefined);
		assert.equal(cmdStrNoNS.indexOf('--namespace'), -1);
	});
	
	test('test that getBaseCmd returned value contains --namespace parameter when namespace is passed', function() {
		let cmdStrWithNS : string = kamel.getBaseCmd(`fakepath`,`fakecommand`, 'fakens');
		assert.ok(cmdStrWithNS.includes('--namespace'));
	});

	test('test setting namespace to undefined', async function() {
		const namespace : string | undefined = config.getNamespaceconfig();
		await config.addNamespaceToConfig(undefined);

		const namespaceConfigValueAfterReset : string | undefined = config.getNamespaceconfig();
		assert.equal(namespaceConfigValueAfterReset, undefined, 'By default, the namespace config should be undefined');
		
		await config.addNamespaceToConfig(namespace);
	});

	test('test setting namespace to other value', async function() {
		const namespace : string | undefined = config.getNamespaceconfig();
		const testNs = 'testing';
		await config.addNamespaceToConfig(testNs);

		const namespaceConfigValueAfterReset : string | undefined = config.getNamespaceconfig();
		assert.equal(namespaceConfigValueAfterReset, testNs, 'The value specified should be available.');

		await config.addNamespaceToConfig(namespace);
	});	

	test('test can set autoupgrade setting', async function() {
		await config.setKamelAutoupgradeConfig(true);

		const autoConfigValue = config.getKamelAutoupgradeConfig();
		assert.ok(autoConfigValue);

		await config.setKamelAutoupgradeConfig(false);
		const autoConfigValue2 = config.getKamelAutoupgradeConfig();
		assert.isFalse(autoConfigValue2);
	});

	test('test can set runtime version setting', async function() {	
		await config.setKamelAutoupgradeConfig(false);
		const autoConfigValue2 = config.getKamelAutoupgradeConfig();
		assert.isFalse(autoConfigValue2);

		const invalidVersion = 'invalidVersion';
		await config.setKamelRuntimeVersionConfig(invalidVersion).then( () => {
			const firstVersion = config.getKamelRuntimeVersionConfig();
			assert.equal(firstVersion, invalidVersion);	
		}).catch( (error) => {
			assert.fail(error);
		});

		const validVersion = '1.0.0-RC1';
		await config.setKamelRuntimeVersionConfig(validVersion).then( () => {
			const secondVersion = config.getKamelRuntimeVersionConfig();
			assert.equal(secondVersion, validVersion);	
		}).catch( (error) => {
			assert.fail(error);
		});

		await config.setKamelAutoupgradeConfig(true);
	});

});
