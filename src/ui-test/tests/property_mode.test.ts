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
    WebDriver
} from 'vscode-uitests-tooling';
import { EXTENDED_LANGUAGES_WITH_FILENAME_EXTENSIONS, propertyIntegration } from '../../IntegrationConstants';
import {
    cleanOutputView,
    viewHasItem,
    contextMenuItemClick,
    sidebarIntegrationRemove,
    webViewOpen,
    webViewHasTextInWebElement
} from '../utils/waitConditions';
import {
    inputBoxQuickPickOrSet,
    findSectionItem
} from '../utils/utils';
import { assert } from 'chai';

describe('Property mode test with the logs', function () {
    this.timeout(300000);
    EXTENDED_LANGUAGES_WITH_FILENAME_EXTENSIONS.forEach(function (extension: string, language: string) {
        if (extension === 'xml') {
            console.log("Skip Property XML test, due the issue: https://issues.redhat.com/browse/FUSETOOLS2-2238")
        } else {
            propertyModeTest(extension, language)
        }
    });
});

function propertyModeTest(extension: string, language: string) {

    describe(`Language: ${language}, Extension: ${extension}, Mode: Property`, function () {

        let driver: WebDriver;
        const logMessage = `Hello Camel K with properties from ${language} with extension - ${extension}`;

        before(async function () {
            driver = VSBrowser.instance.driver;
            await VSBrowser.instance.openResources(path.resolve('src', 'ui-test', 'resources'));
            await (await new ActivityBar().getViewControl('Explorer')).openView();
        });

        after(async function () {
            this.timeout(consts.TIMEOUT_60_SECONDS);
            await new EditorView().closeAllEditors();
            await sidebarIntegrationRemove(driver, consts.extensionName, `${consts.integrationFileName}-property`.toLowerCase());
            await driver.wait(() => { return cleanOutputView(); }, this.timeout() - 1000);
        });

        it(`Select ${consts.startIntegration} in the popup menu`, async function () {
            this.timeout(consts.TIMEOUT_15_SECONDS);
            const section = await new SideBarView().getContent().getSection('resources');
            const item = await section.findItem(`${consts.integrationFileName}Property.${extension}`) as DefaultTreeItem;
            await driver.wait(() => { return contextMenuItemClick(item, consts.startIntegration); }, this.timeout() - 1000);
        });

        it(`Start integration with '${propertyIntegration}' command`, async function () {
            this.timeout(consts.TIMEOUT_15_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('pick', propertyIntegration));
        });

        it(`Set first property key`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('set', 'firstProperty'));
        });

        it(`Set first property value`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('set', language));
        });

        it(`Pick Yes option to add second property`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('pick', 'Yes'));
        });

        it(`Set second property key`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('set', 'secondProperty'));
        });

        it(`Set second property value`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('set', extension));
        });

        it(`Pick No option to start`, async function () {
            this.timeout(consts.TIMEOUT_5_SECONDS);
            assert.isTrue(await inputBoxQuickPickOrSet('pick', 'No'));
        });

        it(`Integration exists in ${consts.extensionName} sidebar`, async function () {
            this.timeout(consts.TIMEOUT_15_SECONDS);
            const content = new SideBarView().getContent();
            await driver.wait(() => { return viewHasItem(content, consts.extensionName, `${consts.integrationFileName}-property`.toLowerCase()); }, this.timeout() - 1000);
        });

        it(`Open integration log with '${consts.followIntegrationLogs}' command`, async function () {
            this.timeout(consts.TIMEOUT_30_SECONDS);
            this.retries(2);
            const item = await findSectionItem(consts.extensionName, `${consts.integrationFileName}-property`.toLowerCase());
            await driver.wait(() => { return contextMenuItemClick(item, consts.followIntegrationLogs); }, consts.TIMEOUT_15_SECONDS);
            await driver.wait(() => { return webViewOpen(); }, consts.TIMEOUT_15_SECONDS);
        });

        it(`Integration pod started`, async function () {
            this.timeout(consts.TIMEOUT_120_SECONDS);
            assert.isTrue(await webViewHasTextInWebElement(driver, consts.initialPodReadyMessage));
        });

        it(`Integration log contains - ${logMessage}`, async function () {
            this.timeout(consts.TIMEOUT_60_SECONDS);
            assert.isTrue(await webViewHasTextInWebElement(driver, logMessage));
        });
    });
}
