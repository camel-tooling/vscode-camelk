/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as consts from '../utils/uiTestConstants';
import { assert } from 'chai';
import { EditorView, ExtensionsViewItem, VSBrowser, WebDriver } from 'vscode-extension-tester';
import { Marketplace } from 'vscode-uitests-tooling';
import { extensionIsActivated } from './../utils/waitConditions';
import { DoNextTest } from '../utils/utils';

export function camelkExtensionTest(extensionActivated: DoNextTest) {

	describe('Extensions view', function () {

		let marketplace: Marketplace;
		let item: ExtensionsViewItem;
		let driver: WebDriver;

		before(async function () {
			driver = VSBrowser.instance.driver;
			VSBrowser.instance.waitForWorkbench;
		});

		after(async function () {
			this.timeout(consts.TIMEOUT_5_SECONDS);
			await marketplace.close();
			await new EditorView().closeAllEditors();
		});

		afterEach(function () {
			if (this.currentTest?.state === 'failed' && this.id === 'required') {
				extensionActivated.stopTest();
			}
		});

		it('Open Marketplace', async function () {
			this.timeout(consts.TIMEOUT_15_SECONDS);
			this.retries(3);
			marketplace = await Marketplace.open(this.timeout());
		});

		it('Find extension', async function () {
			this.timeout(consts.TIMEOUT_15_SECONDS);
			this.retries(3);
			item = await marketplace.findExtension(`@installed ${consts.displayName}`);
		});

		it('Extension was properly activated', async function () {
			this.id = 'required';
			this.timeout(consts.TIMEOUT_60_SECONDS);
			await driver.wait(async () => {
				// on macOS the extension is sometimes activated immediately and it causes UI test flakiness
				if (process.platform == 'darwin') {
					item = await marketplace.findExtension(`@installed ${consts.displayName}`);
				}
				return extensionIsActivated(item, extensionActivated);
			}, consts.TIMEOUT_60_SECONDS);
		});

		it('Extension is installed', async function () {
			this.timeout(consts.TIMEOUT_5_SECONDS);
			const installed = await item.isInstalled();
			assert.isTrue(installed);
		});

		it('Verify author', async function () {
			this.timeout(consts.TIMEOUT_5_SECONDS);
			const author = await item.getAuthor();
			assert.equal(author, 'Red Hat');
		});

		it('Verify display name', async function () {
			this.timeout(consts.TIMEOUT_5_SECONDS);
			const title = await item.getTitle();
			assert.equal(title, `${consts.displayName}`);
		});

		it('Verify description', async function () {
			this.timeout(consts.TIMEOUT_5_SECONDS);
			const desc = await item.getDescription();
			assert.equal(desc, `${consts.description}`);
		});

		it('Verify version', async function () {
			this.timeout(consts.TIMEOUT_5_SECONDS);
			const version = await item.getVersion();
			assert.equal(version, `${consts.version}`);
		});

	});
}
