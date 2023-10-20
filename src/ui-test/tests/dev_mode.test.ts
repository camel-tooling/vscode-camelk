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

import * as path from 'path';
import * as consts from '../utils/uiTestConstants';
import {
	ActivityBar,
	DefaultTreeItem,
	EditorView,
	SideBarView,
	VSBrowser,
	WebDriver,
	resources,
	workspaces
} from 'vscode-uitests-tooling';
import { EXTENDED_LANGUAGES_WITH_FILENAME_EXTENSIONS, devModeIntegration } from '../../IntegrationConstants';
import {
	cleanOutputView,
	outputViewHasText,
	viewHasItem,
	updateFileText,
	contextMenuItemClick,
	sidebarIntegrationRemove
} from '../utils/waitConditions';
import {
	textDoesNotContainAsci,
	inputBoxQuickPickOrSet
} from '../utils/utils';
import { assert } from 'chai';

describe('Dev mode test with the logs', function () {
	this.timeout(300000);
	EXTENDED_LANGUAGES_WITH_FILENAME_EXTENSIONS.forEach(function (extension: string, language: string) {
		if (extension === 'xml') {
			console.log("Skip Dev XML test, due the issue: https://issues.redhat.com/browse/FUSETOOLS2-2238")
		} else {
			devModeTest(extension, language)
		}
	});
});

function devModeTest(extension: string, language: string) {

	describe(`Language: ${language}, Extension: ${extension}, Mode: Dev`, function () {

		let driver: WebDriver;
		let resourceManager: resources.IResourceManager;

		const [initialMessage, updatedMessage] = consts.prepareCodeLogMessages(extension, language);

		before(async function () {
			driver = VSBrowser.instance.driver;

			resourceManager = resources.createResourceManager(
				VSBrowser.instance,
				workspaces.createWorkspace(VSBrowser.instance, 'src/ui-test/resources'),
				'src/ui-test/resources'
			);
			await resourceManager.copy(`${consts.integrationFileName}.${extension}`, `${consts.integrationFileName}Copy.${extension}`);

			await VSBrowser.instance.openResources(path.resolve('src', 'ui-test', 'resources'));
			await (await new ActivityBar().getViewControl('Explorer')).openView();
			const section = await new SideBarView().getContent().getSection('resources');
			await section.openItem(`${consts.integrationFileName}Copy.${extension}`);

			const editorView = new EditorView();
			await driver.wait(async function () {
				return (await editorView.getOpenEditorTitles()).find(title => title === `${consts.integrationFileName}Copy.${extension}`);
			}, 5000);
			if (extension == 'java') {
				await driver.wait(() => { return updateFileText(consts.integrationFileName, `${consts.integrationFileName}Copy`); }, consts.TIMEOUT_60_SECONDS);
			}
		});

		after(async function () {
			this.timeout(consts.TIMEOUT_60_SECONDS);
			await new EditorView().closeAllEditors();
			await sidebarIntegrationRemove(driver, consts.extensionName, `${consts.integrationFileName}-copy`);
			await driver.wait(() => { return cleanOutputView(); }, this.timeout() - 1000);
			// Necessary try block to avoid "EBUSY" error on windows instances 
			// File can be hold by the Java process for a bit more time
			await driver.wait(async () => {
				try {
					return await resourceManager.delete(`${consts.integrationFileName}Copy.${extension}`) === undefined;
				} catch {
					return false;
				}
			}, 60000);
		});

		it(`Select ${consts.startIntegration} in the popup menu`, async function () {
			this.timeout(consts.TIMEOUT_15_SECONDS);
			const section = await new SideBarView().getContent().getSection('resources');
			const item = await section.findItem(`${consts.integrationFileName}Copy.${extension}`) as DefaultTreeItem;
			await driver.wait(() => { return contextMenuItemClick(item, consts.startIntegration); }, this.timeout() - 1000);
		});

		it(`Start integration with '${devModeIntegration}' command`, async function () {
			this.timeout(consts.TIMEOUT_60_SECONDS);
			assert.isTrue(await inputBoxQuickPickOrSet('pick', devModeIntegration));
		});

		it(`Initial integration pod started`, async function () {
			this.timeout(consts.TIMEOUT_30_SECONDS);
			await driver.wait(() => { return outputViewHasText(consts.initialPodReadyMessage); }, this.timeout() - 1000);
		});

		it(`Initial integration output contains - ${initialMessage}`, async function () {
			this.timeout(consts.TIMEOUT_30_SECONDS);
			await driver.wait(() => { return outputViewHasText(initialMessage); }, this.timeout() - 1000);
		});

		it(`Integration output does not contain ASCI`, async function () {
			this.timeout(consts.TIMEOUT_5_SECONDS);
			this.id = 'independent'
			assert.isTrue(await textDoesNotContainAsci('OutputView'));
		});

		it(`Integration exists in ${consts.extensionName} sidebar`, async function () {
			this.timeout(consts.TIMEOUT_15_SECONDS);
			const content = new SideBarView().getContent();
			await driver.wait(() => { return viewHasItem(content, consts.extensionName, `${consts.integrationFileName}-copy`.toLowerCase()); }, this.timeout() - 1000);
		});

		it(`Update ${consts.integrationFileName}Copy.${extension} with new message`, async function () {
			this.timeout(consts.TIMEOUT_30_SECONDS);
			await driver.wait(() => { return updateFileText(initialMessage, updatedMessage); }, this.timeout() - 1000);
		});

		it(`Updated integration pod started`, async function () {
			this.timeout(consts.TIMEOUT_30_SECONDS);
			await driver.wait(() => { return outputViewHasText(consts.updatedPodReadyMessage); }, this.timeout() - 1000);
		});

		it(`Updated integration output contains - ${updatedMessage}`, async function () {
			this.timeout(consts.TIMEOUT_30_SECONDS);
			await driver.wait(() => { return outputViewHasText(updatedMessage); }, this.timeout() - 1000);
		});

	});
}
