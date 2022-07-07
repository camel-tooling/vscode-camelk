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

import { ActivityBar, DefaultWait } from 'vscode-uitests-tooling';
import { EditorView, SideBarView, VSBrowser, Workbench, WebDriver, BottomBarPanel, DefaultTreeItem } from 'vscode-extension-tester';
import { outputViewHasText, viewHasItem, inputBoxQuickPickOrSet, findSectionItem, updateFileText } from './utils/waitConditions';
import { activationError } from './utils/waitConditions';
import { prepareEmptyTestFolder } from './utils/resourcesUtils';
import { LANGUAGES_WITH_FILENAME_EXTENSIONS, devModeIntegration } from '../IntegrationConstants';
import * as uiTestConstants from './utils/uiTestConstants';

// Workaround due the issue -> https://github.com/redhat-developer/vscode-extension-tester/issues/444
async function workaroundMacIssue444(item: DefaultTreeItem, command: string): Promise<boolean> {
	await item.click();
	const workbench = new Workbench();
	await workbench.openCommandPrompt();
	return await inputBoxQuickPickOrSet('set', `>${command}`);
}

describe('Your first Apache Camel K integration', function () {

	let uiTestFirstRun = true;

	LANGUAGES_WITH_FILENAME_EXTENSIONS.forEach(function (extension: string, language: string) {

		describe(`${language} language tests`, function () {

			let driver: WebDriver;
			let doNextTest = true;

			const [initialCodeMessage, updatedCodeMessage, initialLogMessage, updatedLogMessage] = uiTestConstants.prepareCodeLogMessages(extension, language);

			before(async function () {
				this.timeout(30000);
				if (activationError) {
					this.skip();
				}
				doNextTest = true;
				await prepareEmptyTestFolder(uiTestConstants.testDir);
				driver = VSBrowser.instance.driver;
				(await new ActivityBar().getViewControl('Explorer'))?.openView();
				await VSBrowser.instance.openResources(uiTestConstants.testDir);
				VSBrowser.instance.waitForWorkbench;
				// Workaround due the issue ->  https://issues.redhat.com/browse/FUSETOOLS2-1654
				if (process.platform == 'win32' && uiTestFirstRun) {
					this.timeout(80000);
					await DefaultWait.sleep(60000);
				}
			});

			after(async function () {
				this.timeout(60000);
				if (!activationError) {
					const item = await findSectionItem(uiTestConstants.extensionName, uiTestConstants.integrationFileName.toLowerCase());
					// Workaround due the issue -> https://github.com/redhat-developer/vscode-extension-tester/issues/444
					if (process.platform === 'darwin') {
						await workaroundMacIssue444(item, uiTestConstants.integrationRemove);
					} else { // Regular test 
						const menu = await item.openContextMenu();
						const option = await menu.getItem(uiTestConstants.integrationRemove);
						if (option) {
							await option.click();
						}
					}
					const content = new SideBarView().getContent();
					await driver.wait(async () => {
						return viewHasItem(content, uiTestConstants.extensionName, uiTestConstants.integrationFileName.toLowerCase(), 1000)
							.then(val => {
								return !val
							})
					}, 60000);
					await new EditorView().closeAllEditors();
					const outputView = await new BottomBarPanel().openOutputView();
					await driver.wait(async () => {
						try {
							await outputView.clearText();
							const outputTextLength = (await outputView.getText()).length;
							if ((outputTextLength === 1 && process.platform !== 'win32') ||
								(outputTextLength === 2 && process.platform === 'win32')) {
								return true;
							}
							await content.getDriver().sleep(1000);
							return false;
						} catch (err) {
							await content.getDriver().sleep(1000);
							return false;
						}
					}, 60000);
					await prepareEmptyTestFolder(uiTestConstants.testDir);
				}
			});

			beforeEach(function () {
				if (!doNextTest) {
					this.skip();
				}
			});

			afterEach(function () {
				if (this.currentTest?.state === 'failed') {
					doNextTest = false;
				}
			});

			it(`Use command '${uiTestConstants.createNewIntegrationFile}'`, async function () {
				this.timeout(30000);
				const workbench = new Workbench();
				await workbench.openCommandPrompt();
				await inputBoxQuickPickOrSet('pick', uiTestConstants.createNewIntegrationFile);
			});

			it(`Choose a language from the suggested - ${language}`, async function () {
				this.timeout(5000);
				await inputBoxQuickPickOrSet('pick', language);
			});

			it(`Choose a directory from the suggested - ${uiTestConstants.testFolder}`, async function () {
				this.timeout(5000);
				await inputBoxQuickPickOrSet('pick', uiTestConstants.testFolder);
			});

			it(`Enter integrationFileName without extension - Simple`, async function () {
				this.timeout(5000);
				await inputBoxQuickPickOrSet('set', uiTestConstants.integrationFileName);
			});

			it(`Verify the created file Simple.${extension} existence`, async function () {
				this.timeout(15000);
				const content = new SideBarView().getContent();
				await driver.wait(() => { return viewHasItem(content, uiTestConstants.testFolder, `${uiTestConstants.integrationFileName}.${extension}`); });
			});

			it(`Select ${uiTestConstants.startIntegration} in the popup menu`, async function () {
				this.timeout(30000);
				const item = await findSectionItem(uiTestConstants.testFolder, `${uiTestConstants.integrationFileName}.${extension}`);
				// Workaround due the issue -> https://github.com/redhat-developer/vscode-extension-tester/issues/444
				if (process.platform === 'darwin') {
					await workaroundMacIssue444(item, uiTestConstants.startIntegration);
				} else { // Regular test 
					const menu = await item.openContextMenu();
					const option = await menu.getItem(uiTestConstants.startIntegration);
					if (option) {
						await option.click();
					}
				}
			});

			it(`Start integration with '${devModeIntegration}' command`, async function () {
				this.timeout(5000);
				await inputBoxQuickPickOrSet('pick', devModeIntegration);
			});

			it(`Verify initial integration pod started`, async function () {
				if (uiTestFirstRun) {
					this.timeout(600000);
					uiTestFirstRun = false;
				} else {
					this.timeout(300000);
				}
				await driver.wait(() => { return outputViewHasText(uiTestConstants.initialPodReadyMessage, 1000); });
			});

			it(`Verify initial integration output - ${initialLogMessage}`, async function () {
				this.timeout(30000);
				await driver.wait(() => { return outputViewHasText(initialLogMessage), 1000; });
			});

			it(`Verify integration in ${uiTestConstants.extensionName} sidebar`, async function () {
				this.timeout(30000);
				const content = new SideBarView().getContent();
				await driver.wait(() => { return viewHasItem(content, uiTestConstants.extensionName, uiTestConstants.integrationFileName.toLowerCase(), 1000); });
			});

			it(`Update Simple.${extension} with new message`, async function () {
				this.timeout(30000);
				await findSectionItem(uiTestConstants.testFolder, `${uiTestConstants.integrationFileName}.${extension}`);
				await driver.wait(() => { return updateFileText(initialCodeMessage, updatedCodeMessage); });
			});

			it(`Verify updated integration pod started`, async function () {
				this.timeout(300000);
				await driver.wait(() => { return outputViewHasText(uiTestConstants.updatedPodReadyMessage, 1000); });
			});

			it(`Verify updated integration output - ${updatedLogMessage}`, async function () {
				this.timeout(30000);
				await driver.wait(() => { return outputViewHasText(updatedLogMessage), 1000; });
			});
		});
	});
});
