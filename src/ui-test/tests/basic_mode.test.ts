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
import { EXTENDED_LANGUAGES_WITH_FILENAME_EXTENSIONS, basicIntegration } from '../../IntegrationConstants';
import {
    cleanOutputView,
    viewHasItem,
    contextMenuItemClick,
    webViewHasTextInWebElement,
    sidebarIntegrationRemove,
    webViewOpen
} from '../utils/waitConditions';
import {
    textDoesNotContainAsci,
    inputBoxQuickPickOrSet,
    findSectionItem
} from '../utils/utils';
import { assert } from 'chai';
import {
    ActivityBar,
    DefaultTreeItem,
    EditorView,
    SideBarView,
    VSBrowser,
    WebDriver
} from 'vscode-uitests-tooling';

describe('Basic mode test with the logs', function () {
    this.timeout(300000);
    EXTENDED_LANGUAGES_WITH_FILENAME_EXTENSIONS.forEach(function (extension: string, language: string) {
        if (extension === 'xml') {
            console.log("Skip Basic XML test, due the issue: https://issues.redhat.com/browse/FUSETOOLS2-2238")
        } else {
            basicModeWithLogsTest(extension, language)
        }
    });
});

function basicModeWithLogsTest(extension: string, language: string) {

    describe(`Language: ${language}, Extension: ${extension}, Mode: Basic`, function () {

        let driver: WebDriver;

        before(async function () {
            driver = VSBrowser.instance.driver;
            await VSBrowser.instance.openResources(path.resolve('src', 'ui-test', 'resources'));
            await (await new ActivityBar().getViewControl('Explorer')).openView();
        });

        after(async function () {
            this.timeout(consts.TIMEOUT_60_SECONDS);
            await new EditorView().closeAllEditors();
            await sidebarIntegrationRemove(driver, consts.extensionName, consts.integrationFileName);
            await driver.wait(() => { return cleanOutputView(); }, this.timeout() - 1000);
        });

        it(`Select ${consts.startIntegration} in the popup menu`, async function () {
            this.timeout(consts.TIMEOUT_15_SECONDS);
            const section = await new SideBarView().getContent().getSection('resources');
            const item = await section.findItem(`${consts.integrationFileName}.${extension}`) as DefaultTreeItem;
            await driver.wait(() => { return contextMenuItemClick(item, consts.startIntegration); }, this.timeout() - 1000);
        });

        it(`Start integration with '${basicIntegration}' command`, async function () {
            this.timeout(consts.TIMEOUT_60_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('pick', basicIntegration));
        });

        it(`Integration exists in ${consts.extensionName} sidebar`, async function () {
            this.timeout(consts.TIMEOUT_30_SECONDS);
            const content = new SideBarView().getContent();
            await driver.wait(() => { return viewHasItem(content, consts.extensionName, consts.integrationFileName.toLowerCase()); }, this.timeout() - 1000);
        });

        it(`Open integration log with '${consts.followIntegrationLogs}' command`, async function () {
            this.timeout(consts.TIMEOUT_30_SECONDS);
            this.retries(2);
            const item = await findSectionItem(consts.extensionName, consts.integrationFileName.toLowerCase());
            await driver.wait(() => { return contextMenuItemClick(item, consts.followIntegrationLogs); }, consts.TIMEOUT_15_SECONDS);
            await driver.wait(() => { return webViewOpen(); }, consts.TIMEOUT_15_SECONDS);
        });

        it(`Integration pod started`, async function () {
            this.timeout(consts.TIMEOUT_30_SECONDS);
            assert.isTrue(await webViewHasTextInWebElement(driver, consts.initialPodReadyMessage));
        });

        it(`Integration log contains - Hello Camel from ${language}`, async function () {
            this.timeout(consts.TIMEOUT_30_SECONDS);
            assert.isTrue(await webViewHasTextInWebElement(driver, `Hello Camel from ${language}`));
        });

        it(`Integration log does not contain ASCI`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            this.id = 'independent';
            assert.isTrue(await textDoesNotContainAsci('WebView'));
        });
    });
}
