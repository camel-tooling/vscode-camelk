/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the 'License'); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as consts from './utils/uiTestConstants';
import { DefaultWait, EditorView, InputBox, VSBrowser, WebDriver, Workbench } from 'vscode-uitests-tooling';
import { LANGUAGES_WITH_FILENAME_EXTENSIONS } from '../IntegrationConstants';
import { basicModeWithLogsTest } from './tests/basic_mode_test';
import { camelkExtensionTest } from './tests/camelk_extension_test';
import { devModeTest } from './tests/dev_mode_test';
import { DoNextTest, prepareEmptyTestFolder } from './utils/utils';

const doNextTest = new DoNextTest();
const extensionActivated = new DoNextTest();
let input: InputBox;

describe('Tooling for Apache Camel K extension', function () {

    after(async function () {
        this.timeout(11000);
        // TODO: TMP static wait workaround for unexpected vscode-extension-tester 'afterAll' timeout on Fedora
        // Issue: https://github.com/redhat-developer/vscode-extension-tester/issues/475
        await DefaultWait.sleep(10000);
    });

    before(async function() {
        this.timeout(consts.TIMEOUT_60_SECONDS);
        await VSBrowser.instance.openResources(consts.testDir);
        await VSBrowser.instance.waitForWorkbench();
    });

    describe(`Verify extension on Marketplace, check activation status`, async function () {
        camelkExtensionTest(extensionActivated);
    });

    if (extensionActivated) {
        LANGUAGES_WITH_FILENAME_EXTENSIONS.forEach(async function (extension: string, language: string) {
            describe(`${language} test pipeline`, async function () {
                this.timeout(consts.TIMEOUT_60_SECONDS);
                await prepareEmptyTestFolder(consts.testDir);
                await createIntegrationFile(extension, language);
                devModeTest(extension, language, doNextTest);
                basicModeWithLogsTest(extension, language, doNextTest);
            });
        });
    } else {
        console.log("Extension activation error occurred!");
    }

});

async function createIntegrationFile(extension: string, language: string) {
    await new Workbench().executeCommand(`Camel: Create Camel route with ${language} DSL`);

	await VSBrowser.instance.driver.wait(async function () {
				input = await InputBox.create();
				return (await input.isDisplayed());
			}, 30000);
    const fileNameInput = consts.integrationFileName;
	await input.setText('Simple');
	await input.confirm();

	await waitUntilEditorIsOpened(VSBrowser.instance.driver, fileNameInput, extension);
}

async function waitUntilEditorIsOpened(driver: WebDriver, fileNameInput: string, extension: string, timeout = 10000): Promise<void> {
	await driver.wait(async function () {
		return (await new EditorView().getOpenEditorTitles()).find(t => t.startsWith(fileNameInput) && t.endsWith(extension));
	}, timeout);
}
