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

import * as uiTestConstants from '../utils/uiTestConstants';
import { ActivityBar, DefaultWait } from 'vscode-uitests-tooling';
import { SideBarView, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { viewHasItem } from '../utils/waitConditions';
import { inputBoxQuickPickOrSet, DoNextTest } from '../utils/utils';
import { prepareEmptyTestFolder } from '../utils/utils';

export function createIntegrationFile(extension: string, language: string, doNextTest: DoNextTest) {

    describe(`Create default integration file: ${uiTestConstants.integrationFileName}.${extension}`, function () {

        let driver: WebDriver;

        before(async function () {
            this.timeout(30000);
            doNextTest.continueTest();
            await prepareEmptyTestFolder(uiTestConstants.testDir);
            driver = VSBrowser.instance.driver;
            (await new ActivityBar().getViewControl('Explorer'))?.openView();
            await VSBrowser.instance.openResources(uiTestConstants.testDir);
            VSBrowser.instance.waitForWorkbench;
            if (process.platform == 'win32' && language == 'Java') {
                this.timeout(65000);
                await DefaultWait.sleep(60000);
            }
        });

        beforeEach(function () {
            if (!doNextTest.doNextTest) {
                this.skip();
            }
        });

        afterEach(function () {
            if (this.currentTest?.state === 'failed') {
                doNextTest.stopTest();
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

    });
}
