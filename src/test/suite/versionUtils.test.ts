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
import * as config from '../../config';
import { Platform } from '../../shell';
import * as versionUtils from '../../versionUtils';
import path = require('path');

chai.use(sinonChai);
const should = chai.should();

suite("VersionUtils check", () => {

	suite("ensure version url methods are functioning as expected", () => {

		test("validate url for existing 1.0.0 version", async () => {
			await validateVersion('1.0.0', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/1.0.0/camel-k-client-1.0.0-linux-64bit.tar.gz');
		});

		test("validate url for existing 1.0.1 version", async () => {
			await validateVersion('1.0.1', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/1.0.1/camel-k-client-1.0.1-linux-64bit.tar.gz');
		});

		test("validate url for existing 1.1.0 version", async () => {
			await validateVersion('1.1.0', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.1.0/camel-k-client-1.1.0-linux-64bit.tar.gz');
		});

		test("validate url for existing 1.1.1 version", async () => {
			await validateVersion('1.1.1', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.1.1/camel-k-client-1.1.1-linux-64bit.tar.gz');
		});

		test("validate url for existing 1.2.1 version", async () => {
			await validateVersion('1.2.1', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.2.1/camel-k-client-1.2.1-linux-64bit.tar.gz');
		});

		test("validate url for existing 1.3.2 version", async () => {
			await validateVersion('1.3.2', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.3.2/camel-k-client-1.3.2-linux-64bit.tar.gz');
		});

		test("validate url for existing 1.4.0 version", async () => {
			await validateVersion('1.4.0', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.4.0/camel-k-client-1.4.0-linux-64bit.tar.gz');
		});

		test("validate url for existing 1.4.1 version", async () => {
			await validateVersion('1.4.1', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.4.1/camel-k-client-1.4.1-linux-64bit.tar.gz');
		});
		
		test("validate url for existing 1.5.0 version", async () => {
			await validateVersion('1.5.0', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.5.0/camel-k-client-1.5.0-linux-64bit.tar.gz');
		});
		
		test("validate url for existing 1.6.0 version", async () => {
			await validateVersion('1.6.0', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.6.0/camel-k-client-1.6.0-linux-64bit.tar.gz');
		});
		
		test("validate url for existing 1.7.0 version", async () => {
			await validateVersion('1.7.0', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.7.0/camel-k-client-1.7.0-linux-64bit.tar.gz');
		});
			
		test("validate url for existing 1.8.2 version", async () => {
			await validateVersion('1.8.2', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.8.2/camel-k-client-1.8.2-linux-64bit.tar.gz');
		});
		
		test("validate url for existing 1.9.0 version", async () => {
			await validateVersion('1.9.0', Platform.LINUX, 'https://github.com/apache/camel-k/releases/download/v1.9.0/camel-k-client-1.9.0-linux-64bit.tar.gz');
		});
		
		test("validate url for existing 1.9.0 windows version", async () => {
			await validateVersion('1.9.0', Platform.WINDOWS, 'https://github.com/apache/camel-k/releases/download/v1.9.0/camel-k-client-1.9.0-windows-64bit.tar.gz');
		});

		test("validate url for existing 1.9.0 MacOS version", async () => {
			await validateVersion('1.9.0', Platform.MACOS, 'https://github.com/apache/camel-k/releases/download/v1.9.0/camel-k-client-1.9.0-mac-64bit.tar.gz');
		});
		
		

		test("validate invalid url for xyz1 version", async () => {
			await invalidateVersion('xyz1', Platform.LINUX);
		});

		async function validateVersion(tagName: string, platform: Platform, urlToTest: string): Promise<void> {
			try {
				const testUrl = await versionUtils.getDownloadURLForCamelKTag(tagName, platform);
				should.equal(testUrl, urlToTest);
			} catch (error) {
				should.fail((error as Error).message);
			}
		}

		async function invalidateVersion(tagName: string, platform: Platform): Promise<void> {
			try {
				await versionUtils.getDownloadURLForCamelKTag(tagName, platform);
				should.fail(`Downloading invalid Camel-K version (${tagName}) did not fail!`);
			} catch (error) {
				should.exist(error);
			}
		}
	});

	suite("Check needs update", function () {

		let kamelConfigBeforeTest: string;
		let kamelAutoupgradeConfigTest: boolean;
		this.beforeEach(function () {
			kamelConfigBeforeTest = config.getActiveKamelconfig();
			kamelAutoupgradeConfigTest = config.getKamelAutoupgradeConfig();
		});

		this.afterEach(async () => {
			await config.addKamelPathToConfig(kamelConfigBeforeTest);
			await config.setKamelAutoupgradeConfig(kamelAutoupgradeConfigTest);
		});

		test("When Auto-upgrade off and cli path setting provided then no need to update kamel binary", async () => {
			const pathToSnapshotKamel = path.resolve(__dirname, '../../../../test Fixture with speci@l chars/binaries for test with space/kamel');

			await config.setKamelAutoupgradeConfig(false);
			await config.addKamelPathToConfig(pathToSnapshotKamel);

			chai.expect(await versionUtils.checkKamelNeedsUpdate()).to.be.false;
		});
		
		test("When Auto-upgrade off and no cli path setting provided then need to update kamel binary", async () => {

			await config.setKamelAutoupgradeConfig(false);
			await config.addKamelPathToConfig(undefined);

			chai.expect(await versionUtils.checkKamelNeedsUpdate()).to.be.true;
		});

	});

});
