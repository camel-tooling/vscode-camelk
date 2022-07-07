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

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as IntegrationUtils from './../../IntegrationUtils';
import * as IntegrationConstants from './../../IntegrationConstants';
import { assert } from 'chai';
import { getDocUri } from './completion.util';

suite("IntegrationUtil tests", function () {

	let sandbox: sinon.SinonSandbox;
	let showQuickPickStub: sinon.SinonStub;
	let executeTaskStub: sinon.SinonStub;
	let newIntegrationStub: sinon.SinonStub;

	setup(() => {
		sandbox = sinon.createSandbox();
		showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
		executeTaskStub = sandbox.stub(vscode.tasks, 'executeTask');
		newIntegrationStub = sandbox.stub(IntegrationUtils, 'createNewIntegration');
	});

	teardown(() => {
		showQuickPickStub.restore();
		executeTaskStub.restore();
		newIntegrationStub.restore();
		sandbox.reset();
	});

	test("ensure listing Camel K task when accessing 'Start Apache Camel Integration'", async function () {
		showQuickPickStub.onFirstCall().returns(IntegrationConstants.vscodeTasksIntegration);
		showQuickPickStub.onSecondCall().returns('Test Camel K task');

		const status = await IntegrationUtils.startIntegration(getDocUri('MyRouteBuilder.java'));
		assert.isTrue(status, 'Command should return boolean for success status');

		sinon.assert.calledWith(showQuickPickStub,
			['Start in dev mode Camel K integration opened in active editor', 'Test Camel K task'],
			{ placeHolder: 'Choose a predefined task' });
		sinon.assert.calledOnce(executeTaskStub);
	});

	test("ensure filtering out Camel K task with unrelated target file when accessing 'Start Apache Camel Integration'", async function () {
		showQuickPickStub.onFirstCall().returns(IntegrationConstants.vscodeTasksIntegration);
		showQuickPickStub.onSecondCall().returns(undefined);

		try {
			await IntegrationUtils.startIntegration(getDocUri('ADifferentRouteBuilder.java'));
		} catch (error) {
			assert.exists(error);
		}

		sinon.assert.calledWith(showQuickPickStub,
			['Start in dev mode Camel K integration opened in active editor'],
			{ placeHolder: 'Choose a predefined task' });
		sinon.assert.notCalled(executeTaskStub);
	});

	test("ensure no action called on cancel of defined task from 'Start Apache Camel Integration'", async function () {
		showQuickPickStub.onFirstCall().returns(IntegrationConstants.vscodeTasksIntegration);
		showQuickPickStub.onSecondCall().returns(undefined);

		try {
			await IntegrationUtils.startIntegration(getDocUri('MyRouteBuilder.java'));
			sinon.assert.fail('The command should be in error.');
		} catch (error) {
			assert.exists(error);
			sinon.assert.notCalled(executeTaskStub);
			sinon.assert.notCalled(newIntegrationStub);
		}
	});

});
