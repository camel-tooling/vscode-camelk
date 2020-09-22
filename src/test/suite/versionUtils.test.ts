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

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as versionUtils from '../../versionUtils';

chai.use(sinonChai);
const should = chai.should();

suite("ensure version url methods are functioning as expected", () => {

	test("validate url for existing 1.0.0 version", async () => {
		await validateVersion('1.0.0', 'linux', 'https://github.com/apache/camel-k/releases/download/1.0.0/camel-k-client-1.0.0-linux-64bit.tar.gz');
	});

	test("validate url for existing 1.0.1 version", async () => {
		await validateVersion('1.0.1', 'linux', 'https://github.com/apache/camel-k/releases/download/1.0.1/camel-k-client-1.0.1-linux-64bit.tar.gz');
	});

	test("validate url for existing 1.1.0 version", async () => {
		await validateVersion('1.1.0', 'linux', 'https://github.com/apache/camel-k/releases/download/v1.1.0/camel-k-client-1.1.0-linux-64bit.tar.gz');
	});
	
	test("validate url for existing 1.1.1 version", async () => {
		await validateVersion('1.1.1', 'linux', 'https://github.com/apache/camel-k/releases/download/v1.1.1/camel-k-client-1.1.1-linux-64bit.tar.gz');
	});

	test("validate invalid url for xyz1 version", async () => {
		await invalidateVersion('xyz1', 'linux');
	});

	async function validateVersion(tagName : string, platformName : string, urlToTest : string): Promise<void> {
		try {
			const testUrl = await versionUtils.getDownloadURLForCamelKTag(tagName, platformName);
			should.equal(testUrl, urlToTest);
		} catch (error) {
			should.fail(error);
		}
	}

	async function invalidateVersion(tagName : string, platformName : string): Promise<void> {
		try {
			await versionUtils.getDownloadURLForCamelKTag(tagName, platformName);
			should.fail(`Downloading invalid Camel-K version (${tagName}) did not fail!`);
		} catch (error) {
			should.exist(error);
		}		
	}
});
