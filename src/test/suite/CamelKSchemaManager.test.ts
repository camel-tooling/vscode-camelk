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

import * as CamelKSchemaManager from '../../CamelKSchemaManager';
import * as vscode from 'vscode';
import { expect } from 'chai';
import { CAMELK_SCHEMA_URI_PREFIX } from '../../CamelKSchemaManager';
const waitUntil = require('async-wait-until');

const outputChannelForTest: vscode.OutputChannel = vscode.window.createOutputChannel('Test output channel');

suite('Test Camel K Schema Manager', function () {

	this.beforeEach(async () => {
		await CamelKSchemaManager.registerCamelKSchemaProvider(outputChannelForTest);
	});

	this.afterEach(async () => {
		await vscode.workspace.getConfiguration().update('camelk.yaml.schema', undefined);
	});

	test('Default works', async () => {
		const schema: string | undefined = await CamelKSchemaManager.requestYamlSchemaContentCallback(CAMELK_SCHEMA_URI_PREFIX);
		expect(schema).to.contains('org.apache.camel.k.loader.yaml.parser.FromStepParser$Definition');
	});

	test('Return no schema for not Camel K files', async () => {
		const schema: string | undefined = await CamelKSchemaManager.requestYamlSchemaContentCallback('dummy');
		expect(schema).to.be.undefined;
	});

	test('Provide undefined for invalid url', async () => {
		await vscode.workspace.getConfiguration().update('camelk.yaml.schema', 'invalid');
		const schema: string | undefined = await CamelKSchemaManager.requestYamlSchemaContentCallback(CAMELK_SCHEMA_URI_PREFIX);
		expect(schema).to.be.undefined;
	});

	test('Change setting for the automatic schema binding', async () => {
		await vscode.workspace.getConfiguration().update('camelk.yaml.schema', 'https://raw.githubusercontent.com/camel-tooling/vscode-camelk/0.0.16/README.md');
		await waitUntil(() => {
			const schema: string | undefined = CamelKSchemaManager.requestYamlSchemaContentCallback(CAMELK_SCHEMA_URI_PREFIX);
			return schema?.includes('# Visual Studio extension to support Apache Camel K');
		});
	});
});
