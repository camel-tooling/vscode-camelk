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
import { EditorView, SideBarView, VSBrowser, WebDriver } from 'vscode-extension-tester';
import { devModeIntegration } from '../../IntegrationConstants';
import {
	cleanOutputView,
	outputViewHasText,
	viewHasItem,
	updateFileText,
	contextMenuItemClick
} from '../utils/waitConditions';
import {
	textDoesNotContainAsci,
	inputBoxQuickPickOrSet,
	findSectionItem,
	DoNextTest
} from '../utils/utils';
import { assert } from 'chai';

export function devModeTest(extension: string, language: string, doNextTest: DoNextTest) {

	describe(`Dev Mode test with the integration file update`, function () {

		let driver: WebDriver;
		let uiTestFirstRun = true;

		const [initialCodeMessage, updatedCodeMessage, initialLogMessage, updatedLogMessage] = consts.prepareCodeLogMessages(extension, language);

		before(async function () {
			driver = VSBrowser.instance.driver;
		});

		after(async function () {
			this.timeout(60000);
			await new EditorView().closeAllEditors();
			await cleanOutputView();
			const item = await findSectionItem(consts.extensionName, consts.integrationFileName.toLowerCase());
			if (item !== undefined) {
				await driver.wait(() => { return contextMenuItemClick(item, consts.integrationRemove); });
				const content = new SideBarView().getContent();
				await driver.wait(async () => {
					return viewHasItem(content, consts.extensionName, consts.integrationFileName.toLowerCase())
						.then(val => {
							return !val
						});
				});
			}
		});

		beforeEach(function () {
			if (!doNextTest.doNextTest) {
				this.skip();
			}
		});

		afterEach(function () {
			if (this.currentTest?.state === 'failed' && this.id !== 'independent') {
				doNextTest.stopTest();
			}
		});

		it(`Select ${consts.startIntegration} in the popup menu`, async function () {
			this.timeout(30000);
			const item = await findSectionItem(consts.testFolder, `${consts.integrationFileName}.${extension}`);
			await driver.wait(() => { return contextMenuItemClick(item, consts.startIntegration); });
		});

		it(`Start integration with '${devModeIntegration}' command`, async function () {
			this.timeout(5000);
			assert.isTrue(await inputBoxQuickPickOrSet('pick', devModeIntegration));
		});

		it(`Initial integration pod started`, async function () {
			if (uiTestFirstRun) {
				this.timeout(600000);
				uiTestFirstRun = false;
			} else {
				this.timeout(300000);
			}
			await driver.wait(() => { return outputViewHasText(consts.initialPodReadyMessage); });
		});

		it(`Initial integration output contains - ${initialLogMessage}`, async function () {
			this.timeout(30000);
			await driver.wait(() => { return outputViewHasText(initialLogMessage); });
		});

		it(`Integration output does not contain ASCI`, async function () {
			this.timeout(30000);
			this.id = 'independent'
			assert.isTrue(await textDoesNotContainAsci('OutputView'));
		});

		it(`Integration exists in ${consts.extensionName} sidebar`, async function () {
			this.timeout(30000);
			const content = new SideBarView().getContent();
			await driver.wait(() => { return viewHasItem(content, consts.extensionName, consts.integrationFileName.toLowerCase()); });
		});

		it(`Update Simple.${extension} with new message`, async function () {
			this.timeout(30000);
			await findSectionItem(consts.testFolder, `${consts.integrationFileName}.${extension}`);
			await driver.wait(() => { return updateFileText(initialCodeMessage, updatedCodeMessage); });
		});

		it(`Updated integration pod started`, async function () {
			this.timeout(300000);
			await driver.wait(() => { return outputViewHasText(consts.updatedPodReadyMessage); });
		});

		it(`Updated integration output contains - ${updatedLogMessage}`, async function () {
			this.timeout(30000);
			await driver.wait(() => { return outputViewHasText(updatedLogMessage); });
		});

	});
}
