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

import { LANGUAGES_WITH_FILENAME_EXTENSIONS } from '../IntegrationConstants';
import { basicModeTest } from './tests/basic_mode_test';
import { camelkExtensionTest } from './tests/camelk_extension_test';
import { createIntegrationFile } from './tests/create_integration_file_test';
import { devModeTest } from './tests/dev_mode_test';
import { propertyModeTest } from './tests/property_mode_test';
import { DoNextTest } from './utils/utils';

const doNextTest = new DoNextTest();
const extensionActivated = new DoNextTest();

describe('Tooling for Apache Camel K extension', async function () {

    describe(`Verify extension on Marketplace, check activation status`, async function () {
        camelkExtensionTest(extensionActivated);
    });

    if (extensionActivated) {
        LANGUAGES_WITH_FILENAME_EXTENSIONS.forEach(async function (extension: string, language: string) {
            describe(`${language} test pipeline`, function () {
                createIntegrationFile(extension, language, doNextTest);
                devModeTest(extension, language, doNextTest);
                basicModeTest(extension, language, doNextTest);
                propertyModeTest(extension, language, doNextTest);
            });
        });
    } else {
        console.log("Extension activation error occurred!");
    }

});
