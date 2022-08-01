/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as path from 'path';
import { ExTester } from 'vscode-extension-tester';
import { ReleaseQuality } from 'vscode-extension-tester/out/util/codeUtil';

const storageFolder = 'test-resources';
let releaseType: ReleaseQuality = ReleaseQuality.Stable;
export const projectPath = path.resolve(__dirname, '..', '..');
const extensionFolder = path.join(projectPath, '.test-extensions');

async function main(): Promise<void> {
	if (process.argv.length === 4) {
		if (process.argv[2] === '-t' && process.argv[3] === 'insider') {
			releaseType = ReleaseQuality.Insider;
		}
	}
	const tester = new ExTester(storageFolder, releaseType, extensionFolder);
	await tester.setupAndRunTests('out/src/ui-test/uitest_suite.js', process.env.CODE_VERSION);
}

main();
