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

import * as path from 'path';
import * as utils from '../CamelKJSONUtils';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as nock from 'nock';

suite('ensure camelk utilities work as expected', function() {

	test('should be able to stringify existing file', function(done) {
		let testFilePath = path.join(__dirname, '../../src/test/helloworld.groovy');
		utils.stringifyFileContents(testFilePath)
			.then((text) => {
				console.log('file results = ' + text);
				assert.ok(text.length > 0);
				done();
			}).catch((err) => {
				assert.fail();
				done(err);
			});
	});

	test('should be able to create deploy descriptor for incoming camel file', function(done) {
		let testFilePath = path.join(__dirname, '../../src/test/helloworld.groovy');
		let fileContents:string;
		utils.stringifyFileContents(testFilePath).then((text) => {
			fileContents = text;
			utils.createCamelKDeployJSON('helloworld', fileContents, 'helloworld.groovy')
				.then((output) => {
					console.log('deployment output = ' + output);
					assert.ok(output.length > 0);
					done();
				});
		})
		.catch((err) => {
			assert.fail();
			done(err);
		});;
	});

	test('should be able to construct usable rest URL', function(done) {
		// have to do some gymnastics to clear the settings for some reason
		let proxyUrl = vscode.workspace.getConfiguration().get('camelk.integrations.proxyURL');
		let proxyPort = vscode.workspace.getConfiguration().get('camelk.integrations.proxyPort') as number;
		let namespace = vscode.workspace.getConfiguration().get('camelk.integrations.proxyNamespace');

		vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', 'http://localhost', true)
		.then( () => // use non-default value
			vscode.workspace.getConfiguration().update('camelk.integrations.proxyPort', 9000, true)
			.then( () => vscode.workspace.getConfiguration().update('camelk.integrations.proxyNamespace', 'default', true)
				.then ( () => {
					let urlstring = utils.createCamelKRestURL();
					console.log('url output = ' + urlstring);
					assert.strictEqual(urlstring, 'http://localhost:9000/apis/camel.apache.org/v1alpha1/namespaces/default/integrations');
				})
			)
		)

		// and set them back at the end
		vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', proxyUrl, true);
		vscode.workspace.getConfiguration().update('camelk.integrations.proxyPort', proxyPort, true);
		vscode.workspace.getConfiguration().update('camelk.integrations.proxyNamespace', namespace, true);
		done();
	});

	test('should be able to construct usable proxy URL', function(done) {

		// have to do some gymnastics to clear the settings for some reason
		let proxyUrl = vscode.workspace.getConfiguration().get('camelk.integrations.proxyURL');
		let proxyPort = vscode.workspace.getConfiguration().get('camelk.integrations.proxyPort') as number;

		vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', 'http://localhost')
			.then( () => vscode.workspace.getConfiguration().update('camelk.integrations.proxyPort', 9000)
			.then( () => {
				let urlstring = utils.createBaseProxyURL();
				console.log('url output = ' + urlstring);
				assert.equal(urlstring, 'http://localhost:9000');
			})
		);

		// and set them back at the end
		vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', proxyUrl);
		vscode.workspace.getConfiguration().update('camelk.integrations.proxyPort', proxyPort);

		done();
	});

	test('should be able to ping accessible server', function(done) {
		utils.pingTheURL('http://www.google.com').then(
			(result) => {
				console.log('ping output = ' + result);
				assert.equal(result, true);
				done();
			}
		);
	});

	test('should be able to fail ping of inaccessible server', function(done) {
		utils.pingTheURL('http://www.googleinaccesible.invalidurl').then(
			(result) => {
				assert.fail('Should not have made it here');
				done(result);
			}
		).catch( (error) => {
			console.log('ping output = ' + error);
			assert.ok(error);
			done();
		});
	});

	test('should be able to ping kubernetes', function(done) {
		// have to do some gymnastics to clear the settings for some reason
		let proxyUrl = vscode.workspace.getConfiguration().get('camelk.integrations.proxyURL');
		let proxyPort = vscode.workspace.getConfiguration().get('camelk.integrations.proxyPort') as number;

		vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', 'http://localhost', true)
			.then( () => vscode.workspace.getConfiguration().update('camelk.integrations.proxyPort', 9000, true)
			.then( () => {
				let proxyURL = utils.createCamelKRestURL();

				// use nock to mock the http request
				nock(proxyURL).get('').reply(200, {});

				utils.pingKubernetes().then( (rtn) => {
					assert.equal(rtn, proxyURL);
				}).catch ( (err) => {done(err)});

				nock.cleanAll();
			})
		);

		// and set them back at the end
		vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', proxyUrl, true);
		vscode.workspace.getConfiguration().update('camelk.integrations.proxyPort', proxyPort, true);

		done();
	});

	test('should be able to mock when kubernetes is not available', function(done) {
		let proxyURL = utils.createCamelKRestURL();

		// use nock to mock the http request
		nock(proxyURL).get('').reply(404, {});

		utils.pingKubernetes().then( (rtn) => {
			assert.fail('should not have been accessible');
			done(rtn);
		}).catch( (error) =>  {
			assert.ok(error, 'valid failure here');
			done();
		});

		nock.cleanAll();
	});

	test('test kebab case utility', function(done) {

		// based loosely on https://github.com/apache/camel-k/blob/master/pkg/util/kubernetes/sanitize_test.go

		assert.equal(utils.toKebabCase('MyOtherGroovyRoute'), 'my-other-groovy-route');
		assert.equal(utils.toKebabCase('abc'), 'abc');
		assert.equal(utils.toKebabCase('fooToBar'), 'foo-to-bar');
		assert.equal(utils.toKebabCase('foo-to-bar'), 'foo-to-bar');
		assert.equal(utils.toKebabCase('-foo-bar-'), 'foo-bar');
		assert.equal(utils.toKebabCase('1foo-bar2'), '1foo-bar2');
		assert.equal(utils.toKebabCase('foo-bar-1'), 'foo-bar-1');

		done();
	});

});