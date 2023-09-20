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
import * as installer from '../../installer';
import * as kamel from '../../kamel';
import * as os from 'os';
import { expect } from 'chai';
import path = require('path');

suite("ensure kamel and kubectl are available", function() {
	
	let kamelConfigBeforeTest :string;
	
	this.beforeEach(function() {
		kamelConfigBeforeTest = config.getActiveKamelconfig();
	});
	
	this.afterEach(async() => {
		await config.addKamelPathToConfig(kamelConfigBeforeTest);
	});

    test("ensure can activate kamel cli", function(done) {
		installer.isKamelAvailable().then( (flag) => {
			if (flag) {
				assert.ok('kamel is available.');
				done();
			} else {
				assert.fail(`kamel is not available - nothing returned`);	
				done();
			}
		}).catch ( (error) => {
			assert.fail(`kamel is not available: ${error}`);
			done();
		});
	});
	
	test('check kamel can be on path with space', async function() {
		const kamelWithSpacePath = path.resolve(__dirname, `../../../../test Fixture with speci@l chars/binaries for test with space/${os.platform()}/kamel${os.platform()=== 'win32' ? '.exe' : ''}`);
		await config.addKamelPathToConfig(kamelWithSpacePath);
		const kamelExe = kamel.create();
		const kamelExePath = await kamelExe.getPath();
		expect(kamelExePath).to.be.equal(kamelWithSpacePath);
		
		await kamelExe.invoke('version');
	});

});
