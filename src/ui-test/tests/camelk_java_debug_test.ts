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

'use strict'

import {
	EditorView,
	VSBrowser,
} from 'vscode-extension-tester';
import { createIntegration, getIntegration, modifyCurrentFileToBeInvalid, prepareEmptyTestFolder, startIntegration } from '../utils/utils';
import { cleanOutputView, sidebarIntegrationRemove } from '../utils/waitConditions';
import * as uiTestConstants from '../utils/uiTestConstants';
import { assertPromiseSucceed, assertPromiseFail } from '../utils/promiseUtils';

const START_DEBUG_LABEL = uiTestConstants.startDebug;

export function camelKJavaDebugTest() {

	describe('Test Debug on Camel K Integrations from Side Bar', function () {

		describe('Java Debug', function () {

			const INTEGRATION_LABEL = 'java-debug-test';
			const INTEGRATION_FILE = 'JavaDebugTest';

			before(async function () {
				this.timeout(uiTestConstants.TIMEOUT_60_SECONDS);
				await createIntegration(INTEGRATION_FILE, 'Java', 'java');
				await startIntegration(INTEGRATION_LABEL, 'Basic');
			})

			it('Check Java Debug available', async function () {
				this.timeout(uiTestConstants.TIMEOUT_30_SECONDS);
				const item = await getIntegration(INTEGRATION_LABEL);
				await assertPromiseSucceed(
					VSBrowser.instance.driver.wait(
						async () => {
							const menu = await item.openContextMenu();
							const hasItem = menu.hasItem(START_DEBUG_LABEL);
							menu.close();

							return hasItem;
						}, uiTestConstants.TIMEOUT_5_SECONDS),
					'Java debug was not available on a run of a valid file'
				);
			});

			after(async function () {
				this.timeout(uiTestConstants.TIMEOUT_60_SECONDS);
				await sidebarIntegrationRemove(VSBrowser.instance.driver, uiTestConstants.extensionName, INTEGRATION_LABEL);
				await new EditorView().closeAllEditors();
				await VSBrowser.instance.driver.wait(() => { return cleanOutputView(); });
				await prepareEmptyTestFolder(uiTestConstants.testDir);
			});

		});

		describe('No Java Debug on Invalid Files', function () {

			const INTEGRATION_LABEL = 'java-debug-test-invalid';
			const INTEGRATION_FILE = 'JavaDebugTestInvalid';

			before(async function () {
				this.timeout(uiTestConstants.TIMEOUT_60_SECONDS);
				await createIntegration(INTEGRATION_FILE, 'Java', 'java');
				await modifyCurrentFileToBeInvalid();
				await startIntegration(INTEGRATION_LABEL, 'Basic');
			});

			it('Test Java Debugger Not Available On Invalid File', async function () {
				this.timeout(uiTestConstants.TIMEOUT_30_SECONDS);
				const item = await getIntegration(INTEGRATION_LABEL);
				await assertPromiseFail(
					VSBrowser.instance.driver.wait(
						async () => {
							const menu = await item.openContextMenu();
							const hasItem = await menu.hasItem(START_DEBUG_LABEL);
							menu.close();

							return hasItem;
						}, uiTestConstants.TIMEOUT_5_SECONDS),
					'Java debugger was available for a run on an invalid file'
				);
			});

			after(async function () {
				this.timeout(uiTestConstants.TIMEOUT_60_SECONDS);
				await sidebarIntegrationRemove(VSBrowser.instance.driver, uiTestConstants.extensionName, INTEGRATION_LABEL);
				await new EditorView().closeAllEditors();
				await VSBrowser.instance.driver.wait(() => { return cleanOutputView(); });
				await prepareEmptyTestFolder(uiTestConstants.testDir);
			});
		})

	});
}
