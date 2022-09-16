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
import { ActivityBar, DefaultWait } from 'vscode-uitests-tooling';
import { SideBarView, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { viewHasItem } from '../utils/waitConditions';
import { inputBoxQuickPickOrSet, DoNextTest } from '../utils/utils';
import { prepareEmptyTestFolder } from '../utils/utils';

export function createIntegrationFile(extension: string, language: string, doNextTest: DoNextTest) {

    describe(`Create default integration file: ${consts.integrationFileName}.${extension}`, function () {

        let driver: WebDriver;

        before(async function () {
            this.timeout(consts.TIMEOUT_30_SECONDS);
            doNextTest.continueTest();
            await prepareEmptyTestFolder(consts.testDir);
            driver = VSBrowser.instance.driver;
            (await new ActivityBar().getViewControl('Explorer'))?.openView();
            await VSBrowser.instance.openResources(consts.testDir);
            VSBrowser.instance.waitForWorkbench;
            // TODO previous: static wait for CamelK Windows settings through cmd.exe (process.platform == 'win32' && doNextTest.firstRun == true)
            // TODO actual: static wait for all systems due to the issue with new dependencies (doNextTest.firstRun == true)
            if (doNextTest.firstRun == true) {
                this.timeout(consts.TIMEOUT_60_SECONDS);
                doNextTest.firstRun = false;
                await DefaultWait.sleep(consts.TIMEOUT_30_SECONDS);
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

        it(`Use command '${consts.createNewIntegrationFile}'`, async function () {
            this.timeout(consts.TIMEOUT_30_SECONDS);
            const workbench = new Workbench();
            await workbench.openCommandPrompt();
            await inputBoxQuickPickOrSet('pick', consts.createNewIntegrationFile);
        });

        it(`Choose a language from the suggested - ${language}`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            await inputBoxQuickPickOrSet('pick', language);
        });

        it(`Choose a directory from the suggested - ${consts.testFolder}`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            await inputBoxQuickPickOrSet('pick', consts.testFolder);
        });

        it(`Enter integrationFileName without extension - Simple`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            await inputBoxQuickPickOrSet('set', consts.integrationFileName);
        });

        it(`Verify the created file Simple.${extension} existence`, async function () {
            this.timeout(consts.TIMEOUT_15_SECONDS);
            const content = new SideBarView().getContent();
            await driver.wait(() => { return viewHasItem(content, consts.testFolder, `${consts.integrationFileName}.${extension}`); });
        });

    });
}
