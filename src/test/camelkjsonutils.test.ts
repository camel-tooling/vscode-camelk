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

suite("ensure camelk utilities work as expected", async function() {
	
	test("should be able to stringify existing file", async function() {
		let testFilePath = path.join(__dirname, '../../src/test/helloworld.groovy');
		utils.stringifyFileContents(testFilePath)
			.then((text) => {
				console.log("file results = " + text);
				assert.ok(text.length > 0);
			}).catch(() => assert.fail());
	});

	test("should be able to create deploy descriptor for incoming camel file", async function() {
		let testFilePath = path.join(__dirname, '../../src/test/helloworld.groovy');
		let fileContents:string;
		utils.stringifyFileContents(testFilePath).then((text) => {
			fileContents = text;
			utils.createCamelKDeployJSON("helloworld", fileContents, "helloworld.groovy")
				.then((output) => {
					console.log("deployment output = " + output);
					assert.ok(output.length > 0);
				});
		});
	});

	test("should be able to construct usable rest URL", async function() {

		// have to do some gymnastics to clear the settings for some reason
		let proxyUrl = vscode.workspace.getConfiguration().get('camelk.integrations.proxyURL');
		let namespace = vscode.workspace.getConfiguration().get('camelk.integrations.proxyNamespace');

		await vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', 'http://localhost:8000', true);
		await vscode.workspace.getConfiguration().update('camelk.integrations.proxyNamespace', 'default', true);

		let urlstring = utils.createCamelKRestURL();
		console.log("url output = " + urlstring);
		assert.ok(urlstring === "http://localhost:8000/apis/camel.apache.org/v1alpha1/namespaces/default/integrations");

		// and set them back at the end
		await vscode.workspace.getConfiguration().update('camelk.integrations.proxyURL', proxyUrl, true);
		await vscode.workspace.getConfiguration().update('camelk.integrations.proxyNamespace', namespace, true);
	});

	test("should be able to ping accessible server", async function() {
		await utils.pingTheURL("http://www.google.com").then( 
			(result) => {
				console.log("ping output = " + result);
				assert.ok(result === true);
			}
		);
	});

	test("should be able to fail ping of inaccessible server", async function() {
		await utils.pingTheURL("http://www.googleinaccesible.invalidurl").then( 
			(result) => {
				assert.fail("Should not have made it here");
			}
		).catch( (error) => {
			console.log("ping output = " + error);
			assert.ok(error);
		});
	});

	test("should be able to ping kubernetes", async function() {
		let proxyURL = utils.createCamelKRestURL();

		// use nock to mock the http request
		nock(proxyURL).get('').reply(200, {});

		await utils.pingKubernetes().then( (rtn) => {
			assert.equal(rtn, proxyURL);
		});

		nock.cleanAll();
	});

	test("should be able to mock when kubernetes is not available", async function() {
		let proxyURL = utils.createCamelKRestURL();

		// use nock to mock the http request
		nock(proxyURL).get('').reply(404, {});

		await utils.pingKubernetes().then( (rtn) => {
			assert.fail("should not have been accessible");
		}).catch( (error) =>  {
			assert.ok(error, "valid failure here");
		});
		
		nock.cleanAll();
	});

});