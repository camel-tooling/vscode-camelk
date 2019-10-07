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

suite("ensure install methods are functioning as expected", function() {

	test("install Camel K CLI on activation", function(done) {
		const extensionId = 'redhat.vscode-camelk';
		let extension = vscode.extensions.getExtension(extensionId);
		if (extension !== null && extension !== undefined) {
			extension.activate().then(() => {
				if (extension !== null && extension !== undefined) {
					let kamelPath = config.getActiveKamelconfig();
					assert.equal(fs.existsSync(kamelPath), true);
					done();
				}
			});
		} else {
			assert.fail("Camel K extension is undefined");
			done();
		}
	});
});
